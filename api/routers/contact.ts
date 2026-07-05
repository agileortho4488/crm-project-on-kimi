import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { contacts, activities } from "@db/schema";
import { eq, like, or, and, desc, asc, sql, count, gte, lte, isNotNull } from "drizzle-orm";

export const contactRouter = createRouter({
  // ==========================================
  // LIST CONTACTS — Full server-side filtering, sorting, pagination
  // Optimized for 1M+ records with indexed queries
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
        sortBy: z.enum(["name", "phone", "specialty", "hospital", "district", "division", "qualityScore", "status", "createdAt"]).optional(),
        sortOrder: z.enum(["asc", "desc"]).optional(),
        limit: z.number().min(1).max(500).default(100),
        offset: z.number().min(0).default(0),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [];
      
      // Search across name, phone, hospital, specialty, district
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
      if (input?.district) {
        // Use LIKE for case-insensitive partial matching
        conditions.push(like(contacts.district, `%${input.district}%`));
      }
      if (input?.status) conditions.push(eq(contacts.status, input.status as any));
      if (input?.qualityMin !== undefined) conditions.push(gte(contacts.qualityScore, input.qualityMin));
      if (input?.qualityMax !== undefined) conditions.push(lte(contacts.qualityScore, input.qualityMax));

      // Build where clause - only apply if conditions exist
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Build sort clause - default to id desc for performance (indexed)
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
        : sortDir(contacts.id); // default: id desc (fastest, indexed)

      const limit = input?.limit || 100;
      const offset = input?.offset || 0;

      // Build queries conditionally to avoid where(undefined)
      let itemsQuery = db.select().from(contacts).orderBy(orderBy).limit(limit).offset(offset);
      let countQuery = db.select({ count: count() }).from(contacts);
      
      if (whereClause) {
        itemsQuery = itemsQuery.where(whereClause) as typeof itemsQuery;
        countQuery = countQuery.where(whereClause) as typeof countQuery;
      }

      const [items, totalResult] = await Promise.all([
        itemsQuery,
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

  // Deduplication - find potential duplicates
  findDuplicates: publicQuery
    .input(z.object({ threshold: z.number().default(80) }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const all = await db.select().from(contacts).limit(5000);
      const duplicates = [];
      
      for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) {
          const a = all[i];
          const b = all[j];
          let score = 0;
          
          if (a.name && b.name) {
            const aName = a.name.toLowerCase().replace(/[^a-z]/g, '');
            const bName = b.name.toLowerCase().replace(/[^a-z]/g, '');
            if (aName === bName) score += 50;
            else if (aName.includes(bName) || bName.includes(aName)) score += 30;
          }
          
          if (a.phone && b.phone && a.phone.replace(/\D/g,'') === b.phone.replace(/\D/g,'')) score += 30;
          if (a.hospital && b.hospital && a.hospital.toLowerCase() === b.hospital.toLowerCase()) score += 10;
          if (a.district && b.district && a.district === b.district) score += 10;
          
          if (score >= (input?.threshold || 80)) {
            duplicates.push({ contactA: a, contactB: b, score });
          }
        }
      }
      
      return duplicates;
    }),

  // Stats
  stats: publicQuery.query(async () => {
    const db = getDb();
    const [total, doctors, hospitals, clinics, distributors, districts, active, withDivision, avgQuality] = await Promise.all([
      db.select({ count: count() }).from(contacts),
      db.select({ count: count() }).from(contacts).where(eq(contacts.type, "doctor")),
      db.select({ count: count() }).from(contacts).where(eq(contacts.type, "hospital")),
      db.select({ count: count() }).from(contacts).where(eq(contacts.type, "clinic")),
      db.select({ count: count() }).from(contacts).where(eq(contacts.type, "distributor")),
      db.select({ count: sql`DISTINCT district` }).from(contacts),
      db.select({ count: count() }).from(contacts).where(eq(contacts.status, "active")),
      db.select({ count: count() }).from(contacts).where(isNotNull(contacts.division)),
      db.select({ avg: sql`AVG(quality_score)` }).from(contacts),
    ]);
    
    return {
      total: total[0].count,
      doctors: doctors[0].count,
      hospitals: hospitals[0].count,
      clinics: clinics[0].count,
      distributors: distributors[0].count,
      districts: districts[0].count,
      active: active[0].count,
      withDivision: withDivision[0].count,
      avgQuality: Math.round(Number(avgQuality[0].avg) || 0),
    };
  }),

  // ==========================================
  // FILTER OPTIONS — Get unique values for filter dropdowns
  // ==========================================
  filterOptions: publicQuery.query(async () => {
    const db = getDb();
    
    const [divisions, districts, specialties, statuses] = await Promise.all([
      db.select({ division: contacts.division, count: count() }).from(contacts).groupBy(contacts.division).orderBy(desc(count())),
      // Get top 100 districts by count, normalize to proper case
      db.select({ district: contacts.district, count: count() }).from(contacts).where(isNotNull(contacts.district)).groupBy(contacts.district).orderBy(desc(count())).limit(100),
      db.select({ specialty: contacts.specialty, count: count() }).from(contacts).where(isNotNull(contacts.specialty)).groupBy(contacts.specialty).orderBy(desc(count())).limit(100),
      db.select({ status: contacts.status, count: count() }).from(contacts).groupBy(contacts.status),
    ]);

    // Merge districts with same name but different case (e.g., "Hyderabad" and "hyderabad")
    const districtMap = new Map<string, number>();
    for (const d of districts) {
      const key = (d.district || 'Unknown').toLowerCase().trim();
      const existing = districtMap.get(key);
      if (existing) {
        districtMap.set(key, existing + d.count);
      } else {
        // Store first occurrence's casing as the canonical form
        districtMap.set(key, d.count);
      }
    }

    // Convert back to array with proper title case
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

  // ==========================================
  // GEO AGGREGATION — For map dashboard
  // Groups contacts by district with counts
  // ==========================================
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
  // AUTO-CLASSIFY TYPES — Fix data quality
  // Updates contact type based on name/hospital patterns
  // ==========================================
  autoClassifyTypes: publicQuery
    .input(z.object({ limit: z.number().default(10000) }).optional())
    .mutation(async ({ input }) => {
      const db = getDb();
      const limit = input?.limit || 10000;
      
      // Get contacts with type="doctor" that should be something else
      const candidates = await db.select()
        .from(contacts)
        .where(eq(contacts.type, "doctor"))
        .limit(limit);

      let updated = 0;
      const classifications: Record<string, number> = {};

      for (const contact of candidates) {
        const text = `${contact.name || ''} ${contact.hospital || ''} ${contact.specialty || ''}`.toLowerCase();
        let newType: string | null = null;

        // Hospital patterns
        if (text.includes('hospital') || text.includes('medical college') || text.includes('institute')) {
          if (!text.includes('dr ') && !text.includes('dr.') && !text.includes('doctor')) {
            newType = 'hospital';
          }
        }
        // Clinic patterns
        else if (text.includes('clinic') || text.includes('nursing home') || text.includes('health center')) {
          if (!text.includes('dr ') && !text.includes('dr.') && !text.includes('doctor')) {
            newType = 'clinic';
          }
        }
        // Distributor patterns
        else if (text.includes('distributor') || text.includes('supplier') || text.includes('dealer') || text.includes('traders')) {
          newType = 'distributor';
        }
        // Corporate patterns
        else if (text.includes('pvt ltd') || text.includes('private limited') || text.includes(' ltd') || text.includes('limited') || text.includes('corporation') || text.includes('inc') || text.includes('company') || text.includes('healthcare') || text.includes('pharma') || text.includes('surgical')) {
          if (!text.includes('dr ') && !text.includes('dr.') && !text.includes('doctor')) {
            newType = 'corporate';
          }
        }

        if (newType) {
          await db.update(contacts).set({ type: newType as any }).where(eq(contacts.id, contact.id));
          updated++;
          classifications[newType] = (classifications[newType] || 0) + 1;
        }
      }

      return { updated, classifications, checked: candidates.length };
    }),
});
