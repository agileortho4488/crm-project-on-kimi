import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { contacts, activities } from "@db/schema";
import { eq, like, or, and, desc, sql, count } from "drizzle-orm";

export const contactRouter = createRouter({
  // List contacts with filters
  list: publicQuery
    .input(
      z.object({
        search: z.string().optional(),
        type: z.string().optional(),
        district: z.string().optional(),
        division: z.string().optional(),
        status: z.string().optional(),
        limit: z.number().min(1).max(1000).default(100),
        offset: z.number().min(0).default(0),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const filters = [];
      
      if (input?.search) {
        const s = `%${input.search}%`;
        filters.push(or(
          like(contacts.name, s),
          like(contacts.phone, s),
          like(contacts.email, s),
          like(contacts.specialty, s),
          like(contacts.hospital, s),
          like(contacts.district, s)
        ));
      }
      if (input?.type) filters.push(eq(contacts.type, input.type as any));
      if (input?.district) filters.push(eq(contacts.district, input.district));
      if (input?.division) filters.push(eq(contacts.division, input.division));
      if (input?.status) filters.push(eq(contacts.status, input.status as any));

      const where = filters.length > 0 ? and(...filters) : undefined;

      const [items, totalResult] = await Promise.all([
        db.select().from(contacts).where(where)
          .orderBy(desc(contacts.updatedAt))
          .limit(input?.limit || 100)
          .offset(input?.offset || 0),
        db.select({ count: count() }).from(contacts).where(where),
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
      const id = Number((result as any).insertId);
      
      // Log activity
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

  // Bulk create (for imports)
  bulkCreate: publicQuery
    .input(z.array(z.object({
      name: z.string().min(1),
      type: z.enum(["doctor", "hospital", "clinic", "distributor", "corporate"]).default("doctor"),
      specialty: z.string().optional(),
      designation: z.string().optional(),
      hospital: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      whatsapp: z.string().optional(),
      address: z.string().optional(),
      district: z.string().optional(),
      division: z.string().optional(),
      status: z.enum(["active", "inactive", "prospect", "blacklisted"]).default("active"),
      notes: z.string().optional(),
      tags: z.array(z.string()).default([]),
      source: z.string().optional(),
      sourceUrl: z.string().optional(),
    })))
    .mutation(async ({ input }) => {
      const db = getDb();
      const results = [];
      for (const record of input) {
        try {
          const result = await db.insert(contacts).values(record);
          results.push({ id: Number((result as any).insertId), ...record, status: "created" });
        } catch (e) {
          results.push({ ...record, status: "error", error: (e as Error).message });
        }
      }
      return results;
    }),

  // Deduplication - find potential duplicates
  findDuplicates: publicQuery
    .input(z.object({ threshold: z.number().default(80) }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const all = await db.select().from(contacts);
      const duplicates = [];
      
      for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) {
          const a = all[i];
          const b = all[j];
          let score = 0;
          
          // Name similarity (50%)
          if (a.name && b.name) {
            const aName = a.name.toLowerCase().replace(/[^a-z]/g, '');
            const bName = b.name.toLowerCase().replace(/[^a-z]/g, '');
            if (aName === bName) score += 50;
            else if (aName.includes(bName) || bName.includes(aName)) score += 30;
          }
          
          // Phone match (30%)
          if (a.phone && b.phone && a.phone.replace(/\D/g,'') === b.phone.replace(/\D/g,'')) score += 30;
          
          // Same hospital (10%)
          if (a.hospital && b.hospital && a.hospital.toLowerCase() === b.hospital.toLowerCase()) score += 10;
          
          // Same district (10%)
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
    const [total, doctors, hospitals, districts, active] = await Promise.all([
      db.select({ count: count() }).from(contacts),
      db.select({ count: count() }).from(contacts).where(eq(contacts.type, "doctor")),
      db.select({ count: count() }).from(contacts).where(eq(contacts.type, "hospital")),
      db.select({ count: sql`DISTINCT district` }).from(contacts),
      db.select({ count: count() }).from(contacts).where(eq(contacts.status, "active")),
    ]);
    
    return {
      total: total[0].count,
      doctors: doctors[0].count,
      hospitals: hospitals[0].count,
      districts: districts[0].count,
      active: active[0].count,
    };
  }),
});
