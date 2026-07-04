import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { products } from "@db/schema";
import { eq, desc, and } from "drizzle-orm";

export const productRouter = createRouter({
  list: publicQuery
    .input(z.object({
      division: z.string().optional(),
      category: z.string().optional(),
      search: z.string().optional(),
      limit: z.number().default(100),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const filters = [];
      if (input?.division) filters.push(eq(products.division, input.division));
      if (input?.category) filters.push(eq(products.category, input.category));
      
      const where = filters.length > 0 ? and(...filters) : undefined;
      const items = await db.select().from(products)
        .where(where)
        .orderBy(desc(products.createdAt))
        .limit(input?.limit || 100);
      return { items, total: items.length };
    }),

  create: publicQuery
    .input(z.object({
      name: z.string().min(1),
      code: z.string().optional(),
      division: z.string().optional(),
      category: z.string().optional(),
      description: z.string().optional(),
      specifications: z.string().optional(),
      indications: z.array(z.string()).default([]),
      price: z.number().default(0),
      status: z.enum(["active", "discontinued", "coming_soon"]).default("active"),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const result = await db.insert(products).values(input);
      return { id: Number(result[0].insertId), ...input };
    }),

  delete: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(products).where(eq(products.id, input.id));
      return { success: true };
    }),
});
