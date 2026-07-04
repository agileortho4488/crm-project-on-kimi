import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { tasks } from "@db/schema";
import { eq, desc, count, and } from "drizzle-orm";

export const taskRouter = createRouter({
  list: publicQuery
    .input(z.object({
      status: z.string().optional(),
      assignedTo: z.string().optional(),
      priority: z.string().optional(),
      limit: z.number().default(100),
      offset: z.number().default(0),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const filters = [];
      if (input?.status) filters.push(eq(tasks.status, input.status as any));
      if (input?.assignedTo) filters.push(eq(tasks.assignedTo, input.assignedTo));
      if (input?.priority) filters.push(eq(tasks.priority, input.priority as any));
      
      const where = filters.length > 0 ? and(...filters) : undefined;
      
      const [items, total] = await Promise.all([
        db.select().from(tasks).where(where)
          .orderBy(desc(tasks.createdAt))
          .limit(input?.limit || 100).offset(input?.offset || 0),
        db.select({ count: count() }).from(tasks).where(where),
      ]);
      
      return { items, total: total[0].count };
    }),

  create: publicQuery
    .input(z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      assignedTo: z.string().optional(),
      dueDate: z.string().optional(),
      priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
      status: z.enum(["pending", "in_progress", "completed", "overdue"]).default("pending"),
      relatedType: z.string().optional(),
      relatedId: z.number().optional(),
      relatedName: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const data: any = { ...input };
      if (input.dueDate) {
        data.dueDate = new Date(input.dueDate);
      }
      const result = await db.insert(tasks).values(data);
      return { id: Number((result as any)[0].insertId), ...input };
    }),

  update: publicQuery
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      description: z.string().optional(),
      assignedTo: z.string().optional(),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
      status: z.enum(["pending", "in_progress", "completed", "overdue"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;
      await db.update(tasks).set(data).where(eq(tasks.id, id));
      return { id, ...data };
    }),

  delete: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(tasks).where(eq(tasks.id, input.id));
      return { success: true };
    }),
});
