import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { contacts } from "@db/schema";
import { eq, isNull, or } from "drizzle-orm";

// ==========================================
// DIVISION MAPPING ENGINE
// Maps specialties/hospitals to business divisions
// ==========================================

const DIVISION_KEYWORDS: Record<string, { specialties: string[]; hospitals: string[]; procedures: string[] }> = {
  "trauma_fracture": {
    specialties: ["orthopedic", "orthopaedic", "trauma", "fracture", "sports medicine", "general surgery"],
    hospitals: ["ortho", "trauma", "accident", "emergency", "bone"],
    procedures: [" plating", "nailing", "fixation", "external fixator"],
  },
  "arthroplasty": {
    specialties: ["joint replacement", "arthroplasty", "knee replacement", "hip replacement", "shoulder replacement"],
    hospitals: ["joint", "replacement center"],
    procedures: [" knee ", " hip ", "shoulder arthroplasty", "total knee", "total hip"],
  },
  "cardiovascular": {
    specialties: ["cardiology", "cardiologist", "cardiothoracic", "ctvs", "cardiac surgeon", "intervention cardiology"],
    hospitals: ["heart", "cardiac", "cath lab", "cvts"],
    procedures: ["angioplasty", "stent", "bypass", "valve", "cabg"],
  },
  "endo_surgery": {
    specialties: ["laparoscopic", "gi surgery", "gastro surgeon", "minimal access", "mias"],
    hospitals: ["laparoscopy", "endoscopy"],
    procedures: ["lap chole", "appendectomy", "hernia", "fundoplication"],
  },
  "neuro_spine": {
    specialties: ["neurosurgery", "neurosurgeon", "spine surgery", "neurologist", "cranial"],
    hospitals: ["neuro", "brain", "spine"],
    procedures: ["craniotomy", "discectomy", "laminectomy", "fusion"],
  },
  "gynecology": {
    specialties: ["obg", "obstetrics", "gynecology", "gynaecology", "gynecologist", "obstetrician", "maternity"],
    hospitals: ["maternity", "women", "obg", "delivery"],
    procedures: ["c section", "hysterectomy", "laparoscopy gyn", "iut", "tamponade"],
  },
  "diagnostics": {
    specialties: ["pathology", "radiology", "diagnostic", "lab", "microbiology", "biochemistry"],
    hospitals: ["diagnostic", "lab", "path lab", "imaging", "radiology"],
    procedures: ["mri", "ct scan", "xray", "ultrasound", "blood test"],
  },
  "consumables": {
    specialties: ["general surgeon", "nurse", "ot technician", "anesthesia", "critical care"],
    hospitals: ["surgical", "multi specialty", "tertiary"],
    procedures: ["suture", "drain", "catheter", "dressing"],
  },
};

// Telangana districts with common variants
const TELANGANA_DISTRICTS = [
  "hyderabad", "secunderabad", "cyberabad", "medchal", "ranga reddy",
  "warangal", "hanamkonda", "khammam", "karimnagar", "nizamabad",
  "adilabad", "nirmal", "mahabubnagar", "jogulamba gadwal", "nagarkurnool",
  "medak", "sangareddy", "siddipet", "nalgonda", "suryapet",
  "kothagudem", "mahabubabad", "jayashankar bhupalpally", "mancherial",
  "komaram bheem asifabad", "jagtial", "peddapalli", "rajanna sircilla",
  "vikarabad", "wanaparthy", "narayanpet", "kamareddy", "yadadri bhuvanagiri",
  "suryapet", "jangaon", "bhadradri kothagudem",
];

// ==========================================
// QUALITY SCORING ENGINE
// ==========================================

function calculateQualityScore(contact: any): number {
  let score = 0;
  if (contact.name && contact.name.length > 2) score += 20;
  if (contact.phone && contact.phone.length >= 10) score += 25;
  if (contact.hospital && contact.hospital.length > 2) score += 15;
  if (contact.district && contact.district.length > 1) score += 10;
  if (contact.specialty && contact.specialty.length > 1) score += 10;
  if (contact.email && contact.email.includes("@")) score += 10;
  if (contact.designation && contact.designation.length > 1) score += 5;
  if (contact.division && contact.division !== "unknown") score += 5;
  return score;
}

// ==========================================
// AUTO-DIVISION CLASSIFICATION
// ==========================================

function autoClassifyDivision(contact: any): string {
  const text = `${contact.specialty || ""} ${contact.hospital || ""} ${contact.name || ""} ${contact.designation || ""}`.toLowerCase();
  
  const scores: Record<string, number> = {};
  
  for (const [division, keywords] of Object.entries(DIVISION_KEYWORDS)) {
    scores[division] = 0;
    for (const kw of keywords.specialties) {
      if (text.includes(kw)) scores[division] += 3;
    }
    for (const kw of keywords.hospitals) {
      if (text.includes(kw)) scores[division] += 2;
    }
    for (const kw of keywords.procedures) {
      if (text.includes(kw)) scores[division] += 2;
    }
  }
  
  // Find highest scoring division
  let bestDivision = "unknown";
  let bestScore = 0;
  for (const [div, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestDivision = div;
    }
  }
  
  return bestScore >= 2 ? bestDivision : "unknown";
}

// ==========================================
// AUTO-EXTRACT DISTRICT
// ==========================================

function autoExtractDistrict(text: string): string | null {
  const lower = text.toLowerCase();
  for (const district of TELANGANA_DISTRICTS) {
    if (lower.includes(district)) {
      // Return proper-cased district
      return district.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    }
  }
  return null;
}

// ==========================================
// AUTO-TYPE CLASSIFICATION
// ==========================================

function autoClassifyType(contact: any): string {
  const text = `${contact.specialty || ""} ${contact.name || ""}`.toLowerCase();
  
  if (text.includes("hospital") || text.includes("clinic") || text.includes("center") || text.includes("centre")) {
    if (!text.includes("dr") && !text.includes("doctor")) return "hospital";
  }
  if (text.includes("lab") || text.includes("diagnostic") || text.includes("patholog")) return "diagnostic_center";
  if (text.includes("dr") || text.includes("doctor") || text.includes("surgeon") || text.includes("consultant")) return "doctor";
  if (text.includes("distributor") || text.includes("dealer") || text.includes("supplier")) return "distributor";
  
  return contact.type || "doctor";
}

// ==========================================
// AUTO-ENRICH: Run this after every import
// ==========================================

export async function autoEnrichContacts(limit = 500): Promise<{ enriched: number; totalChecked: number; details: string[] }> {
  const db = getDb();
  
  // Get contacts missing division/district/type/qualityScore
  const unprocessed = await db.select().from(contacts)
    .where(
      or(
        isNull(contacts.division),
        eq(contacts.division, "unknown"),
        isNull(contacts.district),
        isNull(contacts.type),
        eq(contacts.qualityScore, 0)
      )
    )
    .limit(limit);
  
  let enriched = 0;
  const details: string[] = [];
  
  for (const contact of unprocessed) {
    const updates: any = {};
    
    // Auto-classify division
    const division = autoClassifyDivision(contact);
    if (division !== "unknown" && (!contact.division || contact.division === "unknown")) {
      updates.division = division;
    }
    
    // Auto-extract district from address/name
    if (!contact.district) {
      const district = autoExtractDistrict(`${contact.address || ""} ${contact.name || ""} ${contact.hospital || ""}`);
      if (district) {
        updates.district = district;
      }
    }
    
    // Auto-classify type
    if (!contact.type) {
      updates.type = autoClassifyType(contact);
    }
    
    // Calculate quality score
    const score = calculateQualityScore({ ...contact, ...updates });
    if (!contact.qualityScore || contact.qualityScore === 0) {
      updates.qualityScore = score;
    }
    
    if (Object.keys(updates).length > 0) {
      await db.update(contacts).set(updates).where(eq(contacts.id, contact.id));
      enriched++;
      if (details.length < 10) {
        details.push(`${contact.name}: ${Object.keys(updates).join(", ")}`);
      }
    }
  }
  
  return { enriched, totalChecked: unprocessed.length, details };
}

// ==========================================
// tRPC ROUTER
// ==========================================

export const enrichmentRouter = createRouter({
  // Manual re-enrich (in case user wants to force re-processing)
  enrichAll: publicQuery.mutation(async () => {
    return autoEnrichContacts(500);
  }),
  
  // Get enrichment stats
  stats: publicQuery.query(async () => {
    const db = getDb();
    
    const allContacts = await db.select().from(contacts);
    
    const stats = {
      total: allContacts.length,
      withDivision: allContacts.filter(c => c.division && c.division !== "unknown").length,
      withDistrict: allContacts.filter(c => c.district).length,
      withHospital: allContacts.filter(c => c.hospital).length,
      withPhone: allContacts.filter(c => c.phone && c.phone.length >= 10).length,
      withEmail: allContacts.filter(c => c.email && c.email.includes("@")).length,
      avgQualityScore: allContacts.length > 0
        ? Math.round(allContacts.reduce((sum, c) => sum + (c.qualityScore || calculateQualityScore(c)), 0) / allContacts.length)
        : 0,
      byDivision: {} as Record<string, number>,
      byDistrict: {} as Record<string, number>,
      byType: {} as Record<string, number>,
      highQuality: allContacts.filter(c => (c.qualityScore || calculateQualityScore(c)) >= 70).length,
      mediumQuality: allContacts.filter(c => {
        const s = c.qualityScore || calculateQualityScore(c);
        return s >= 40 && s < 70;
      }).length,
      lowQuality: allContacts.filter(c => (c.qualityScore || calculateQualityScore(c)) < 40).length,
    };
    
    for (const c of allContacts) {
      const div = c.division || "unknown";
      stats.byDivision[div] = (stats.byDivision[div] || 0) + 1;
      
      const dist = c.district || "Unknown";
      stats.byDistrict[dist] = (stats.byDistrict[dist] || 0) + 1;
      
      const type = c.type || "unknown";
      stats.byType[type] = (stats.byType[type] || 0) + 1;
    }
    
    return stats;
  }),
  
  // Get contacts by division with filters
  byDivision: publicQuery
    .input(z.object({
      division: z.string(),
      district: z.string().optional(),
      quality: z.enum(["all", "high", "medium", "low"]).default("all"),
      limit: z.number().default(50),
    }))
    .query(async ({ input }) => {
      const db = getDb();
      
      const allContacts = await db.select().from(contacts)
        .where(eq(contacts.division, input.division))
        .limit(input.limit * 2); // Get more then filter
      
      let filtered = allContacts;
      
      if (input.district) {
        filtered = filtered.filter(c => 
          c.district?.toLowerCase() === input.district?.toLowerCase()
        );
      }
      
      if (input.quality !== "all") {
        filtered = filtered.filter(c => {
          const score = c.qualityScore || calculateQualityScore(c);
          if (input.quality === "high") return score >= 70;
          if (input.quality === "medium") return score >= 40 && score < 70;
          return score < 40;
        });
      }
      
      return {
        items: filtered.slice(0, input.limit),
        total: filtered.length,
      };
    }),
  
  // Re-classify a single contact
  reclassify: publicQuery
    .input(z.object({ contactId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [contact] = await db.select().from(contacts).where(eq(contacts.id, input.contactId)).limit(1);
      
      if (!contact) return { error: "Contact not found" };
      
      const updates: any = {};
      
      const division = autoClassifyDivision(contact);
      if (division !== "unknown") updates.division = division;
      
      const district = autoExtractDistrict(`${contact.address || ""} ${contact.name || ""} ${contact.hospital || ""}`);
      if (district && !contact.district) updates.district = district;
      
      updates.type = autoClassifyType(contact);
      updates.qualityScore = calculateQualityScore({ ...contact, ...updates });
      
      await db.update(contacts).set(updates).where(eq(contacts.id, contact.id));
      
      return { contact: { ...contact, ...updates }, classified: Object.keys(updates) };
    }),
});
