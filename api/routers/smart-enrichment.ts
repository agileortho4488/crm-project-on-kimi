import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { contacts } from "@db/schema";
import { eq } from "drizzle-orm";

// ==========================================
// LAYER 1: PHONE PREFIX → DISTRICT MAPPING
// Indian mobile prefixes by Telangana district
// Each prefix mapped to most likely district
// ==========================================

const PHONE_PREFIX_DISTRICT: Record<string, string> = {
  "9848": "Hyderabad", "9849": "Hyderabad", "9866": "Hyderabad",
  "9700": "Hyderabad", "9701": "Hyderabad", "9703": "Hyderabad",
  "9704": "Warangal", "9705": "Warangal", "9390": "Hyderabad",
  "9391": "Hyderabad", "9392": "Hyderabad", "9393": "Hyderabad",
  "9394": "Hyderabad", "9395": "Hyderabad", "9396": "Hyderabad",
  "9397": "Hyderabad", "9398": "Hyderabad", "9399": "Hyderabad",
  "9550": "Hyderabad", "9551": "Hyderabad", "7702": "Hyderabad",
  "7703": "Hyderabad", "8297": "Hyderabad", "8298": "Hyderabad",
  "9989": "Hyderabad", "9986": "Hyderabad", "9000": "Hyderabad",
  "9001": "Hyderabad", "9246": "Hyderabad", "9247": "Hyderabad",
  "9248": "Hyderabad", "9963": "Hyderabad", "9966": "Hyderabad",
  "7032": "Hyderabad", "7033": "Hyderabad", "7036": "Hyderabad",
  "8121": "Hyderabad", "8122": "Hyderabad", "8125": "Hyderabad",
  "9346": "Hyderabad", "9347": "Hyderabad", "9348": "Hyderabad",
  "9441": "Hyderabad", "9442": "Hyderabad", "9908": "Rangareddy",
  "9909": "Rangareddy", "8008": "Rangareddy", "8019": "Rangareddy",
  "9985": "Nalgonda", "9010": "Nalgonda", "9959": "Warangal",
  "8500": "Warangal", "7382": "Warangal", "9676": "Warangal",
  "9440": "Nizamabad", "9951": "Medchal-Malkajgiri",
  "8978": "Karimnagar", "9490": "Karimnagar",
  "9491": "Adilabad",
};

function enrichDistrictFromPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  // Check last 10 digits for Indian mobile
  const last10 = digits.slice(-10);
  if (last10.length === 10) {
    const prefix = last10.substring(0, 4);
    return PHONE_PREFIX_DISTRICT[prefix] || null;
  }
  return null;
}

// ==========================================
// LAYER 2: NAME + DISTRICT → SPECIALTY INFERENCE
// Common patterns in doctor names by specialty
// ==========================================

const NAME_SPECIALTY_PATTERNS: Record<string, string[]> = {
  "gynecology": ["devi", "lakshmi", "parvati", "saraswati", "kaur", "begum", "amma", "maternity", "latha", "sujatha", "vijaya", "shakuntala", "sumathi", "baby", "kumari"],
  "cardiovascular": ["heart", "cardiac", "hruday", "dil", "cardio"],
  "orthopedic": ["bone", "joint", "ortho", "skeleton", "fracture"],
  "neuro_spine": ["brain", "neuro", "nerve", "spine", "skull"],
  "endo_surgery": ["lapro", "minimal", "keyhole", "endo"],
};

function inferSpecialtyFromName(name: string): string | null {
  const lower = name.toLowerCase();
  for (const [specialty, patterns] of Object.entries(NAME_SPECIALTY_PATTERNS)) {
    for (const pattern of patterns) {
      if (lower.includes(pattern)) {
        // Map to human-readable
        const map: Record<string, string> = {
          gynecology: "Obstetrics & Gynecology",
          cardiovascular: "Cardiology",
          orthopedic: "Orthopedic Surgery",
          neuro_spine: "Neurosurgery",
          endo_surgery: "Laparoscopic Surgery",
        };
        return map[specialty] || null;
      }
    }
  }
  return null;
}

// ==========================================
// LAYER 3: HOSPITAL NAME PATTERNS
// Extract hospital type → infer specialty
// ==========================================

const HOSPITAL_TYPE_SPECIALTY: Record<string, string> = {
  "maternity": "Obstetrics & Gynecology",
  "children": "Pediatrics",
  "child": "Pediatrics",
  "kids": "Pediatrics",
  "cancer": "Oncology",
  "oncology": "Oncology",
  "eye": "Ophthalmology",
  "heart": "Cardiology",
  "cardiac": "Cardiology",
  "dental": "Dental Surgery",
  "ortho": "Orthopedic Surgery",
  "fracture": "Orthopedic Surgery",
  "bone": "Orthopedic Surgery",
  "neuro": "Neurosurgery",
  "brain": "Neurosurgery",
  "spine": "Spine Surgery",
  "ENT": "ENT",
  "ear": "ENT",
  "nose": "ENT",
  "throat": "ENT",
  "skin": "Dermatology",
  "kidney": "Nephrology",
  "chest": "Pulmonology",
  "lung": "Pulmonology",
  " TB ": "Pulmonology",
  "physio": "Physiotherapy",
  "rehab": "Physiotherapy",
  "mental": "Psychiatry",
  "psych": "Psychiatry",
};

function inferSpecialtyFromHospital(hospital: string): string | null {
  const lower = hospital.toLowerCase();
  for (const [pattern, specialty] of Object.entries(HOSPITAL_TYPE_SPECIALTY)) {
    if (lower.includes(pattern.toLowerCase())) return specialty;
  }
  return null;
}

// ==========================================
// LAYER 4: WEB SEARCH ENRICHMENT
// Build search URL for manual or automated lookup
// ==========================================

function buildSearchUrls(contact: any): { justdial: string; practo: string; google: string } {
  const name = encodeURIComponent(contact.name || "");
  const district = encodeURIComponent(contact.district || "Telangana");
  const specialty = encodeURIComponent(contact.specialty || "doctor");
  
  return {
    justdial: `https://www.justdial.com/${district}/${name}-${specialty}`,
    practo: `https://www.practo.com/search?results_type=doctor&q=${name}&city=${district}`,
    google: `https://www.google.com/search?q=${name}+${specialty}+${district}+hospital+phone`,
  };
}

// ==========================================
// LAYER 5: PATTERN-BASED EMAIL GENERATION
// ==========================================

function generateEmailPattern(name: string, hospital: string | null): string | null {
  if (!name) return null;
  const cleanName = name.toLowerCase().replace(/^dr\.?\s*/, "").replace(/\s+/g, ".");
  if (hospital) {
    const cleanHospital = hospital.toLowerCase().replace(/\s+/g, "").replace(/hospital|clinic|center|centre/g, "");
    if (cleanHospital) return `dr.${cleanName}@${cleanHospital}.com`;
  }
  return null;
}

// ==========================================
// MAIN ENRICHMENT PIPELINE
// Processes low-quality contacts layer by layer
// ==========================================

interface EnrichmentSuggestion {
  field: string;
  currentValue: string | null;
  suggestedValue: string;
  source: string; // which layer found this
  confidence: "high" | "medium" | "low";
}

function analyzeContact(contact: any): { score: number; suggestions: EnrichmentSuggestion[] } {
  const suggestions: EnrichmentSuggestion[] = [];
  let currentScore = 0;
  
  // Calculate current score
  if (contact.name?.length > 2) currentScore += 20;
  if (contact.phone?.length >= 10) currentScore += 25;
  if (contact.hospital?.length > 2) currentScore += 15;
  if (contact.district?.length > 1) currentScore += 10;
  if (contact.specialty?.length > 1) currentScore += 10;
  if (contact.email?.includes("@")) currentScore += 10;
  if (contact.division && contact.division !== "unknown") currentScore += 5;
  if (contact.designation?.length > 1) currentScore += 5;
  
  // Layer 1: Phone → District
  if (!contact.district && contact.phone) {
    const district = enrichDistrictFromPhone(contact.phone);
    if (district) {
      suggestions.push({
        field: "district",
        currentValue: contact.district,
        suggestedValue: district,
        source: "Phone prefix mapping",
        confidence: "medium",
      });
    }
  }
  
  // Layer 2: Name → Specialty
  if (!contact.specialty && contact.name) {
    const specialty = inferSpecialtyFromName(contact.name);
    if (specialty) {
      suggestions.push({
        field: "specialty",
        currentValue: contact.specialty,
        suggestedValue: specialty,
        source: "Name pattern analysis",
        confidence: "low",
      });
    }
  }
  
  // Layer 3: Hospital → Specialty
  if (!contact.specialty && contact.hospital) {
    const specialty = inferSpecialtyFromHospital(contact.hospital);
    if (specialty) {
      suggestions.push({
        field: "specialty",
        currentValue: contact.specialty,
        suggestedValue: specialty,
        source: "Hospital type inference",
        confidence: "high",
      });
    }
  }
  
  // Layer 4: Search URLs
  const searchUrls = buildSearchUrls(contact);
  suggestions.push({
    field: "search_urls",
    currentValue: null,
    suggestedValue: JSON.stringify(searchUrls),
    source: "Web search links",
    confidence: "high",
  });
  
  // Layer 5: Email pattern
  if (!contact.email && contact.name) {
    const email = generateEmailPattern(contact.name, contact.hospital);
    if (email) {
      suggestions.push({
        field: "email",
        currentValue: contact.email,
        suggestedValue: email,
        source: "Pattern-based generation",
        confidence: "low",
      });
    }
  }
  
  return { score: currentScore, suggestions };
}

// ==========================================
// tRPC ROUTER
// ==========================================

export const smartEnrichmentRouter = createRouter({
  // Get low-quality contacts with enrichment suggestions
  getLowQuality: publicQuery
    .input(z.object({
      limit: z.number().default(20),
      minScore: z.number().default(0),
      maxScore: z.number().default(40),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const limit = input?.limit || 20;
      const minScore = input?.minScore ?? 0;
      const maxScore = input?.maxScore ?? 40;
      
      const allContacts = await db.select().from(contacts).limit(200);
      
      const lowQuality = allContacts
        .map(c => ({ contact: c, analysis: analyzeContact(c) }))
        .filter(({ analysis }) => analysis.score >= minScore && analysis.score <= maxScore)
        .sort((a, b) => a.analysis.score - b.analysis.score)
        .slice(0, limit);
      
      return {
        totalLowQuality: allContacts.filter(c => {
          const { score } = analyzeContact(c);
          return score <= 40;
        }).length,
        contacts: lowQuality.map(({ contact, analysis }) => ({
          id: contact.id,
          name: contact.name,
          phone: contact.phone,
          email: contact.email,
          district: contact.district,
          specialty: contact.specialty,
          hospital: contact.hospital,
          division: contact.division,
          currentScore: analysis.score,
          suggestions: analysis.suggestions.filter(s => s.field !== "search_urls"),
          searchUrls: analysis.suggestions.find(s => s.field === "search_urls")?.suggestedValue,
          potentialScore: Math.min(100, analysis.score + analysis.suggestions.filter(s => s.confidence === "high").length * 15 + analysis.suggestions.filter(s => s.confidence === "medium").length * 10),
        })),
      };
    }),
  
  // Apply high-confidence suggestions automatically
  autoFix: publicQuery
    .input(z.object({
      contactId: z.number(),
      applyHighConfidenceOnly: z.boolean().default(true),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [contact] = await db.select().from(contacts).where(eq(contacts.id, input.contactId)).limit(1);
      
      if (!contact) return { error: "Contact not found" };
      
      const { suggestions } = analyzeContact(contact);
      const applied: string[] = [];
      const updates: any = {};
      
      for (const suggestion of suggestions) {
        if (suggestion.field === "search_urls") continue;
        
        if (input.applyHighConfidenceOnly && suggestion.confidence !== "high") continue;
        
        // Only fill empty fields
        if (!contact[suggestion.field as keyof typeof contact]) {
          updates[suggestion.field] = suggestion.suggestedValue;
          applied.push(`${suggestion.field}=${suggestion.suggestedValue} (${suggestion.source})`);
        }
      }
      
      // Apply updates
      if (Object.keys(updates).length > 0) {
        await db.update(contacts).set(updates).where(eq(contacts.id, contact.id));
      }
      
      return { applied, updates };
    }),
  
  // Get enrichment summary
  summary: publicQuery.query(async () => {
    const db = getDb();
    const allContacts = await db.select().from(contacts);
    
    const analysis = allContacts.map(c => analyzeContact(c));
    
    const fixable = analysis.filter(a => a.score < 70 && a.suggestions.some(s => s.confidence === "high" && s.field !== "search_urls")).length;
    const unfixable = analysis.filter(a => a.score < 30 && a.suggestions.filter(s => s.confidence === "high" && s.field !== "search_urls").length === 0).length;
    
    return {
      total: allContacts.length,
      highQuality: analysis.filter(a => a.score >= 70).length,
      mediumQuality: analysis.filter(a => a.score >= 40 && a.score < 70).length,
      lowQuality: analysis.filter(a => a.score < 40).length,
      fixable, // Can be improved with high-confidence suggestions
      unfixable, // Need manual research or web scraping
      avgScore: Math.round(analysis.reduce((s, a) => s + a.score, 0) / analysis.length) || 0,
    };
  }),
});
