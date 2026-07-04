import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { activities } from "@db/schema";
import { eq, desc } from "drizzle-orm";

export const activityRouter = createRouter({
  list: publicQuery
    .input(z.object({
      contactId: z.number().optional(),
      leadId: z.number().optional(),
      type: z.string().optional(),
      limit: z.number().default(100),
      offset: z.number().default(0),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const filters = [];
      if (input?.contactId) filters.push(eq(activities.contactId, input.contactId));
      if (input?.leadId) filters.push(eq(activities.leadId, input.leadId));
      if (input?.type) filters.push(eq(activities.type, input.type as any));
      
      const items = await db.select().from(activities)
        .orderBy(desc(activities.createdAt))
        .limit(input?.limit || 100).offset(input?.offset || 0);
      
      return { items, total: items.length };
    }),

  create: publicQuery
    .input(z.object({
      type: z.enum(["call", "visit", "meeting", "email", "whatsapp", "demo", "follow_up", "order", "note"]),
      contactId: z.number().optional(),
      leadId: z.number().optional(),
      description: z.string().min(1),
      duration: z.number().optional(),
      outcome: z.string().optional(),
      nextAction: z.string().optional(),
      followUpDate: z.string().optional(),
      createdBy: z.string().default("system"),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const data: any = { ...input };
      if (input.followUpDate) data.followUpDate = new Date(input.followUpDate);
      const result = await db.insert(activities).values(data);
      return { id: Number(result[0].insertId), ...input };
    }),

  delete: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(activities).where(eq(activities.id, input.id));
      return { success: true };
    }),
});
