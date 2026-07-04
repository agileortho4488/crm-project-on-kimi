import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { leads } from "@db/schema";
import { eq, desc, count, and } from "drizzle-orm";

export const leadRouter = createRouter({
  list: publicQuery
    .input(z.object({
      stage: z.string().optional(),
      division: z.string().optional(),
      priority: z.string().optional(),
      search: z.string().optional(),
      limit: z.number().default(100),
      offset: z.number().default(0),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const filters = [];
      
      if (input?.stage) filters.push(eq(leads.stage, input.stage as any));
      if (input?.division) filters.push(eq(leads.division, input.division));
      if (input?.priority) filters.push(eq(leads.priority, input.priority as any));
      
      const where = filters.length > 0 ? and(...filters) : undefined;
      
      const [items, total] = await Promise.all([
        db.select().from(leads).where(where)
          .orderBy(desc(leads.updatedAt))
          .limit(input?.limit || 100).offset(input?.offset || 0),
        db.select({ count: count() }).from(leads).where(where),
      ]);
      
      return { items, total: total[0].count };
    }),

  get: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const result = await db.select().from(leads).where(eq(leads.id, input.id)).limit(1);
      return result[0] || null;
    }),

  create: publicQuery
    .input(z.object({
      title: z.string().min(1),
      contactId: z.number().optional(),
      division: z.string().optional(),
      productInterest: z.array(z.string()).default([]),
      stage: z.enum(["new", "qualified", "proposal", "negotiation", "closed_won", "closed_lost"]).default("new"),
      value: z.number().default(0),
      expectedCloseDate: z.string().optional(),
      source: z.string().optional(),
      assignedTo: z.string().optional(),
      priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const data: any = { ...input };
      if (input.expectedCloseDate) {
        data.expectedCloseDate = new Date(input.expectedCloseDate);
      }
      const result = await db.insert(leads).values(data);
      return { id: Number((result as any).insertId), ...input };
    }),

  update: publicQuery
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      stage: z.enum(["new", "qualified", "proposal", "negotiation", "closed_won", "closed_lost"]).optional(),
      value: z.number().optional(),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
      notes: z.string().optional(),
      division: z.string().optional(),
      assignedTo: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;
      await db.update(leads).set(data).where(eq(leads.id, id));
      return { id, ...data };
    }),

  delete: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(leads).where(eq(leads.id, input.id));
      return { success: true };
    }),

  stats: publicQuery.query(async () => {
    const db = getDb();
    const stages = ["new", "qualified", "proposal", "negotiation", "closed_won", "closed_lost"];
    const stageCounts = await Promise.all(
      stages.map(async (stage) => ({
        stage,
        count: (await db.select({ count: count() }).from(leads).where(eq(leads.stage, stage as any)))[0].count,
      }))
    );
    
    const totalValue = await db.select({ sum: count() }).from(leads);
    
    return { stageCounts, totalLeads: totalValue[0].sum };
  }),
});
