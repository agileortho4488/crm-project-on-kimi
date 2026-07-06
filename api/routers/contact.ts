import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { contacts, activities } from "@db/schema";
import { eq, like, or, and, desc, asc, sql, count, gte, lte, isNotNull } from "drizzle-orm";

// ==========================================
// CLASSIFICATION ENGINE
// ==========================================

const DIVISION_KEYWORDS: Record<string, { specialties: string[]; hospitals: string[]; namePatterns: string[] }> = {
  gynecology: {
    specialties: ["obg", "obstetric", "gynecolog", "gynaecolog", "maternity", "women", "delivery", "pregnancy", "infertility", "ivf"],
    hospitals: ["maternity", "women", "mother", "baby", "obg", "gynic"],
    namePatterns: ["devi", "lakshmi", "parvati", "saraswati", "kaur", "begum", "amma", "latha", "sujatha", "vijaya", "shakuntala", "sumathi", "baby", "kumari"],
  },
  trauma_fracture: {
    specialties: ["orthopedic", "orthopaedic", "trauma", "fracture", "sports medicine", "bone", "joint", "arthritis", "plating", "nailing"],
    hospitals: ["ortho", "trauma", "accident", "emergency", "bone", "fracture"],
    namePatterns: [],
  },
  cardiovascular: {
    specialties: ["cardiolog", "cardiothoracic", "ctvs", "cardiac", "heart", "angioplasty", "stent", "bypass", "cabg", "valve"],
    hospitals: ["heart", "cardiac", "cath lab", "cvts", "cardiolog"],
    namePatterns: ["heart", "cardiac", "hruday", "dil"],
  },
  neuro_spine: {
    specialties: ["neurosurgery", "neurosurgeon", "neurologist", "spine", "brain", "cranial", "cranio", "epilepsy", "stroke"],
    hospitals: ["neuro", "brain", "spine", "neurolog"],
    namePatterns: ["brain", "neuro", "nerve", "spine", "skull"],
  },
  endo_surgery: {
    specialties: ["laparoscopic", "laparoscopy", "gi surgery", "gastro surgeon", "minimal access", "mias", "endoscop", "hernia", "appendectomy"],
    hospitals: ["laparoscopy", "endoscopy", "gi", "gastro"],
    namePatterns: ["lapro", "minimal", "keyhole", "endo"],
  },
  diagnostics: {
    specialties: ["pathology", "radiology", "diagnostic", "lab", "microbiology", "biochemistry", "imaging", "xray", "x-ray", "ct scan", "mri", "ultrasound"],
    hospitals: ["diagnostic", "path lab", "imaging", "radiology", "scan centre", "lab"],
    namePatterns: [],
  },
  consumables: {
    specialties: ["general surgeon", "general surgery", "nurse", "ot technician", "anesthesia", "critical care", "icu", "emergency medicine"],
    hospitals: ["surgical", "multi specialty", "multispecialty", "general hospital"],
    namePatterns: [],
  },
};

function classifyDivision(contact: any): string {
  const text = `${contact.specialty || ''} ${contact.hospital || ''} ${contact.name || ''} ${contact.designation || ''}`.toLowerCase();
  
  const scores: Record<string, number> = {};
  
  for (const [division, keywords] of Object.entries(DIVISION_KEYWORDS)) {
    scores[division] = 0;
    for (const kw of keywords.specialties) {
      if (text.includes(kw)) scores[division] += 3;
    }
    for (const kw of keywords.hospitals) {
      if (text.includes(kw)) scores[division] += 2;
    }
    for (const kw of keywords.namePatterns) {
      if (text.includes(kw)) scores[division] += 2;
    }
  }
  
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

function classifyType(contact: any): string {
  const text = `${contact.name || ''} ${contact.hospital || ''} ${contact.specialty || ''}`.toLowerCase();
  
  // Hospital patterns
  if (text.includes('hospital') || text.includes('medical college') || text.includes('institute') || text.includes('medical centre') || text.includes('health centre')) {
    if (!text.includes('dr ') && !text.includes('dr.') && !text.includes('doctor')) return 'hospital';
  }
  // Clinic patterns
  if (text.includes('clinic') || text.includes('nursing home') || text.includes('health center') || text.includes('care centre') || text.includes('diagnostic centre')) {
    if (!text.includes('dr ') && !text.includes('dr.') && !text.includes('doctor')) return 'clinic';
  }
  // Distributor patterns
  if (text.includes('distributor') || text.includes('supplier') || text.includes('dealer') || text.includes('traders') || text.includes('traders')) {
    return 'distributor';
  }
  // Corporate patterns
  if (text.includes('pvt ltd') || text.includes('private limited') || text.includes(' ltd') || text.includes('limited') || text.includes('corporation') || text.includes('company') || text.includes('healthcare') || text.includes('pharma') || text.includes('surgical') || text.includes('surgicals') || text.includes('medicals')) {
    if (!text.includes('dr ') && !text.includes('dr.') && !text.includes('doctor')) return 'corporate';
  }
  
  return contact.type || 'doctor';
}

function inferSpecialty(contact: any): string | null {
  const text = `${contact.name || ''} ${contact.hospital || ''} ${contact.designation || ''}`.toLowerCase();
  
  const mappings: [string[], string][] = [
    [["obg", "obstetric", "gynecolog", "gynaecolog", "maternity", "women care", "delivery"], "Obstetrics & Gynecology"],
    [["orthopedic", "orthopaedic", "trauma", "fracture", "bone", "joint replacement", "arthroplasty"], "Orthopedic Surgery"],
    [["cardiolog", "cardiothoracic", "cardiac", "heart", "ctvs"], "Cardiology"],
    [["neurosurgery", "neurosurgeon", "brain surgeon"], "Neurosurgery"],
    [["neurologist", "neurology", "epilepsy", "stroke"], "Neurology"],
    [["laparoscop", "gi surgery", "gastro surgeon", "minimal access"], "General Surgery"],
    [["pediatric", "paediatric", "child specialist", "children"], "Pediatrics"],
    [["urologist", "urology", "kidney", "nephrolog"], "Urology"],
    [["ent", "ear nose throat", "otorhinolaryngology"], "ENT"],
    [["ophthalmolog", "eye specialist", "eye surgeon"], "Ophthalmology"],
    [["dental", "dentist", "orthodontist"], "Dental Surgery"],
    [["dermatolog", "skin specialist"], "Dermatology"],
    [["pulmonolog", "chest", "lung", "tb", "respiratory"], "Pulmonology"],
    [["onco", "cancer"], "Oncology"],
    [["psychiatr", "psychologist", "mental health"], "Psychiatry"],
    [["diagnostic", "radiology", "pathology", "imaging", "xray", "x-ray", "ct scan", "mri"], "Radiology & Diagnostics"],
    [["anesthesia", "anaesthesia", "critical care", "icu"], "Anesthesiology & Critical Care"],
    [["plastic surgery", "cosmetic surgery"], "Plastic Surgery"],
    [["endocrinolog", "diabet"], "Endocrinology"],
    [["gastroenterolog", "gi"], "Gastroenterology"],
    [["nephrolog", "kidney", "dialysis"], "Nephrology"],
    [["rheumatolog"], "Rheumatology"],
    [["physiotherap", "physio", "rehab"], "Physiotherapy"],
    [["homeo", "homeopath"], "Homeopathy"],
    [["ayurveda", "ayurvedic"], "Ayurveda"],
    [["general surgeon"], "General Surgery"],
    [["general physician", "internal medicine", "medicine"], "General Medicine"],
  ];
  
  for (const [keywords, specialty] of mappings) {
    for (const kw of keywords) {
      if (text.includes(kw)) return specialty;
    }
  }
  
  return null;
}

function calculateQuality(contact: any): number {
  let score = 0;
  if (contact.name?.length > 2) score += 20;
  if (contact.phone?.length >= 10) score += 25;
  if (contact.hospital?.length > 2) score += 15;
  if (contact.district?.length > 1) score += 10;
  if (contact.specialty?.length > 1) score += 10;
  if (contact.email?.includes("@")) score += 10;
  if (contact.division && contact.division !== "unknown") score += 5;
  if (contact.designation?.length > 1) score += 5;
  return score;
}

export const contactRouter = createRouter({
  // ==========================================
  // LIST CONTACTS — Full server-side filtering, sorting, pagination
  // ==========================================
  list: publicQuery
    .input(
      z.object({
        search: z.string().optional(),
        type: z.string().optional(),
        division: z.string().optional(),
        district: z.string().optional(),
        status: z.string().optional(),
        qualityMin: z.number().min(0).max(100).optional(),
        qualityMax: z.number().min(0).max(100).optional(),
        sortBy: z.enum(["id", "name", "phone", "specialty", "hospital", "district", "division", "qualityScore", "status", "createdAt"]).optional(),
        sortOrder: z.enum(["asc", "desc"]).optional(),
        limit: z.number().min(1).max(500).default(100),
        offset: z.number().min(0).default(0),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [];
      
      if (input?.search) {
        const s = `%${input.search}%`;
        conditions.push(or(
          like(contacts.name, s),
          like(contacts.phone, s),
          like(contacts.hospital, s),
          like(contacts.specialty, s),
          like(contacts.district, s)
        ));
      }
      if (input?.type) conditions.push(eq(contacts.type, input.type as any));
      if (input?.division) conditions.push(eq(contacts.division, input.division));
      if (input?.district) conditions.push(like(contacts.district, `%${input.district}%`));
      if (input?.status) conditions.push(eq(contacts.status, input.status as any));
      if (input?.qualityMin !== undefined) conditions.push(gte(contacts.qualityScore, input.qualityMin));
      if (input?.qualityMax !== undefined) conditions.push(lte(contacts.qualityScore, input.qualityMax));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const sortColumn = input?.sortBy || "id";
      const sortDir = input?.sortOrder === "asc" ? asc : desc;
      const orderBy = sortColumn === "name" ? sortDir(contacts.name)
        : sortColumn === "phone" ? sortDir(contacts.phone)
        : sortColumn === "specialty" ? sortDir(contacts.specialty)
        : sortColumn === "hospital" ? sortDir(contacts.hospital)
        : sortColumn === "district" ? sortDir(contacts.district)
        : sortColumn === "division" ? sortDir(contacts.division)
        : sortColumn === "qualityScore" ? sortDir(contacts.qualityScore)
        : sortColumn === "status" ? sortDir(contacts.status)
        : sortColumn === "createdAt" ? sortDir(contacts.createdAt)
        : sortColumn === "id" ? sortDir(contacts.id)
        : sortDir(contacts.id);

      const limit = input?.limit || 100;
      const offset = input?.offset || 0;

      let itemsQuery = db.select().from(contacts);
      let countQuery = db.select({ count: count() }).from(contacts);
      
      if (whereClause) {
        itemsQuery = itemsQuery.where(whereClause);
        countQuery = countQuery.where(whereClause);
      }

      const [items, totalResult] = await Promise.all([
        itemsQuery.orderBy(orderBy).limit(limit).offset(offset),
        countQuery,
      ]);

      return { items, total: totalResult[0].count };
    }),

  // Get single contact
  get: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const result = await db.select().from(contacts).where(eq(contacts.id, input.id)).limit(1);
      return result[0] || null;
    }),

  // Create contact
  create: publicQuery
    .input(z.object({
      name: z.string().min(1),
      type: z.enum(["doctor", "hospital", "clinic", "distributor", "corporate"]).default("doctor"),
      specialty: z.string().optional(),
      designation: z.string().optional(),
      hospital: z.string().optional(),
      phone: z.string().optional(),
      phone2: z.string().optional(),
      email: z.string().optional(),
      whatsapp: z.string().optional(),
      address: z.string().optional(),
      district: z.string().optional(),
      division: z.string().optional(),
      status: z.enum(["active", "inactive", "prospect", "blacklisted"]).default("active"),
      notes: z.string().optional(),
      tags: z.array(z.string()).default([]),
      source: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const result = await db.insert(contacts).values(input);
      const id = Number((result as any)[0].insertId);
      
      await db.insert(activities).values({
        type: "note",
        contactId: id,
        description: `Contact created${input.source ? ` from ${input.source}` : ""}`,
        createdBy: "system",
      });
      
      return { id, ...input };
    }),

  // Update contact
  update: publicQuery
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      type: z.enum(["doctor", "hospital", "clinic", "distributor", "corporate"]).optional(),
      specialty: z.string().optional(),
      designation: z.string().optional(),
      hospital: z.string().optional(),
      phone: z.string().optional(),
      phone2: z.string().optional(),
      email: z.string().optional(),
      whatsapp: z.string().optional(),
      address: z.string().optional(),
      district: z.string().optional(),
      division: z.string().optional(),
      status: z.enum(["active", "inactive", "prospect", "blacklisted"]).optional(),
      notes: z.string().optional(),
      tags: z.array(z.string()).optional(),
      nextFollowUp: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;
      const updateData: any = { ...data };
      if (data.nextFollowUp) updateData.nextFollowUp = new Date(data.nextFollowUp);
      await db.update(contacts).set(updateData).where(eq(contacts.id, id));
      return { id, ...data };
    }),

  // Delete contact
  delete: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(contacts).where(eq(contacts.id, input.id));
      return { success: true };
    }),

  // Bulk delete
  bulkDelete: publicQuery
    .input(z.array(z.number()))
    .mutation(async ({ input }) => {
      const db = getDb();
      let deleted = 0;
      for (const id of input) {
        await db.delete(contacts).where(eq(contacts.id, id));
        deleted++;
      }
      return { deleted };
    }),

  // Bulk update division
  bulkUpdateDivision: publicQuery
    .input(z.object({
      ids: z.array(z.number()),
      division: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      let updated = 0;
      for (const id of input.ids) {
        await db.update(contacts).set({ division: input.division }).where(eq(contacts.id, id));
        updated++;
      }
      return { updated };
    }),

  // Stats
  stats: publicQuery.query(async () => {
    const db = getDb();
    const [total, doctors, hospitals, clinics, distributors, corporate, districts, active, withDivision, avgQuality, highQuality] = await Promise.all([
      db.select({ count: count() }).from(contacts),
      db.select({ count: count() }).from(contacts).where(eq(contacts.type, "doctor")),
      db.select({ count: count() }).from(contacts).where(eq(contacts.type, "hospital")),
      db.select({ count: count() }).from(contacts).where(eq(contacts.type, "clinic")),
      db.select({ count: count() }).from(contacts).where(eq(contacts.type, "distributor")),
      db.select({ count: count() }).from(contacts).where(eq(contacts.type, "corporate")),
      db.select({ count: sql`DISTINCT district` }).from(contacts),
      db.select({ count: count() }).from(contacts).where(eq(contacts.status, "active")),
      db.select({ count: count() }).from(contacts).where(and(isNotNull(contacts.division), sql`${contacts.division} != 'unknown'`)),
      db.select({ avg: sql`AVG(quality_score)` }).from(contacts),
      db.select({ count: count() }).from(contacts).where(gte(contacts.qualityScore, 70)),
    ]);
    
    return {
      total: total[0].count,
      doctors: doctors[0].count,
      hospitals: hospitals[0].count,
      clinics: clinics[0].count,
      distributors: distributors[0].count,
      corporate: corporate[0].count,
      districts: districts[0].count,
      active: active[0].count,
      withDivision: withDivision[0].count,
      avgQuality: Math.round(Number(avgQuality[0].avg) || 0),
      highQuality: highQuality[0].count,
    };
  }),

  // Filter options
  filterOptions: publicQuery.query(async () => {
    const db = getDb();
    
    const [divisions, districts, specialties, statuses] = await Promise.all([
      db.select({ division: contacts.division, count: count() }).from(contacts).groupBy(contacts.division).orderBy(desc(count())),
      db.select({ district: contacts.district, count: count() }).from(contacts).where(isNotNull(contacts.district)).groupBy(contacts.district).orderBy(desc(count())).limit(100),
      db.select({ specialty: contacts.specialty, count: count() }).from(contacts).where(isNotNull(contacts.specialty)).groupBy(contacts.specialty).orderBy(desc(count())).limit(100),
      db.select({ status: contacts.status, count: count() }).from(contacts).groupBy(contacts.status),
    ]);

    const districtMap = new Map<string, number>();
    for (const d of districts) {
      const key = (d.district || 'Unknown').toLowerCase().trim();
      const existing = districtMap.get(key);
      districtMap.set(key, (existing || 0) + d.count);
    }

    const mergedDistricts = Array.from(districtMap.entries())
      .map(([key, count]) => ({
        value: key.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        count,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      divisions: divisions.map(d => ({ value: d.division || "unknown", count: d.count })),
      districts: mergedDistricts,
      specialties: specialties.map(s => ({ value: s.specialty || "Unknown", count: s.count })),
      statuses: statuses.map(s => ({ value: s.status, count: s.count })),
    };
  }),

  // Geo aggregation
  geoAggregation: publicQuery
    .input(
      z.object({
        state: z.string().optional(),
        division: z.string().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      
      const filters = [];
      if (input?.division) filters.push(eq(contacts.division, input.division));
      
      const where = filters.length > 0 ? and(...filters) : undefined;

      const results = await db.select({
        district: contacts.district,
        division: contacts.division,
        count: count(),
      })
        .from(contacts)
        .where(where)
        .groupBy(contacts.district, contacts.division)
        .orderBy(desc(count()));

      return results
        .filter(r => r.district)
        .map(r => ({
          district: r.district || "Unknown",
          division: r.division || "unknown",
          count: r.count,
        }));
    }),

  // ==========================================
  // BATCH ENRICH — Auto-classify all contacts
  // ==========================================
  batchEnrich: publicQuery
    .input(z.object({
      limit: z.number().min(1).max(50000).default(5000),
      classifyDivision: z.boolean().default(true),
      classifyType: z.boolean().default(true),
      inferSpecialty: z.boolean().default(true),
      recalculateQuality: z.boolean().default(true),
    }).optional())
    .mutation(async ({ input }) => {
      const db = getDb();
      const limit = input?.limit || 5000;
      
      // Get contacts that need enrichment
      const unenriched = await db.select()
        .from(contacts)
        .where(
          or(
            sql`${contacts.division} IS NULL`,
            eq(contacts.division, "unknown"),
            eq(contacts.division, ""),
            sql`${contacts.specialty} IS NULL`,
            eq(contacts.specialty, ""),
            eq(contacts.qualityScore, 0),
            eq(contacts.qualityScore, 55),
          )
        )
        .limit(limit);

      let updated = 0;
      const breakdown = {
        division: 0,
        type: 0,
        specialty: 0,
        quality: 0,
      };

      for (const contact of unenriched) {
        const updates: any = {};

        // Classify division
        if (input?.classifyDivision !== false && (!contact.division || contact.division === "unknown" || contact.division === "")) {
          const division = classifyDivision(contact);
          if (division !== "unknown") {
            updates.division = division;
            breakdown.division++;
          }
        }

        // Classify type (doctor/hospital/clinic/distributor/corporate)
        if (input?.classifyType !== false) {
          const newType = classifyType(contact);
          if (newType !== contact.type) {
            updates.type = newType;
            breakdown.type++;
          }
        }

        // Infer specialty from name/hospital
        if (input?.inferSpecialty !== false && (!contact.specialty || contact.specialty === "")) {
          const specialty = inferSpecialty(contact);
          if (specialty) {
            updates.specialty = specialty;
            breakdown.specialty++;
          }
        }

        // Recalculate quality score
        if (input?.recalculateQuality !== false) {
          const quality = calculateQuality({ ...contact, ...updates });
          if (quality !== contact.qualityScore) {
            updates.qualityScore = quality;
            breakdown.quality++;
          }
        }

        if (Object.keys(updates).length > 0) {
          await db.update(contacts).set(updates).where(eq(contacts.id, contact.id));
          updated++;
        }
      }

      return {
        processed: unenriched.length,
        updated,
        breakdown,
      };
    }),

  // Get enrichment progress stats
  enrichmentStats: publicQuery.query(async () => {
    const db = getDb();
    
    const [total, withDivision, withSpecialty, withType, avgQuality, byDivision] = await Promise.all([
      db.select({ count: count() }).from(contacts),
      db.select({ count: count() }).from(contacts).where(and(isNotNull(contacts.division), sql`${contacts.division} != 'unknown'`, sql`${contacts.division} != ''`)),
      db.select({ count: count() }).from(contacts).where(and(isNotNull(contacts.specialty), sql`${contacts.specialty} != ''`)),
      db.select({ count: count() }).from(contacts).where(eq(contacts.type, "doctor")),
      db.select({ avg: sql`AVG(quality_score)` }).from(contacts),
      db.select({ division: contacts.division, count: count() }).from(contacts).groupBy(contacts.division).orderBy(desc(count())),
    ]);

    return {
      total: total[0].count,
      withDivision: withDivision[0].count,
      withSpecialty: withSpecialty[0].count,
      doctorTypes: withType[0].count,
      avgQuality: Math.round(Number(avgQuality[0].avg) || 0),
      byDivision: byDivision.map(d => ({ division: d.division || "unknown", count: d.count })),
    };
  }),
});
