import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { dataSources, rawImports, contacts } from "@db/schema";
import { eq, desc } from "drizzle-orm";

export const importRouter = createRouter({
  createJob: publicQuery
    .input(z.object({
      sourceType: z.enum(["upload", "scraper", "manual"]),
      sourceName: z.string(),
      fileName: z.string().optional(),
      rawDataCount: z.number().default(0),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const result = await db.insert(dataSources).values(input);
      return { id: Number((result as any).insertId) };
    }),

  processData: publicQuery
    .input(z.object({
      sourceId: z.number(),
      records: z.array(z.object({
        name: z.string(),
        phone: z.string().optional(),
        email: z.string().optional(),
        address: z.string().optional(),
        district: z.string().optional(),
        specialty: z.string().optional(),
        hospital: z.string().optional(),
        designation: z.string().optional(),
      })),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { sourceId, records } = input;
      
      let created = 0;
      let duplicates = 0;
      
      for (const record of records) {
        if (!record.name) continue;
        
        // Check for existing contact by phone
        if (record.phone) {
          const existing = await db.select().from(contacts)
            .where(eq(contacts.phone, record.phone))
            .limit(1);
          
          if (existing.length > 0) {
            duplicates++;
            const updates: any = {};
            if (record.email && !existing[0].email) updates.email = record.email;
            if (record.district && !existing[0].district) updates.district = record.district;
            if (record.hospital && !existing[0].hospital) updates.hospital = record.hospital;
            if (record.specialty && !existing[0].specialty) updates.specialty = record.specialty;
            
            if (Object.keys(updates).length > 0) {
              await db.update(contacts).set(updates).where(eq(contacts.id, existing[0].id));
            }
            continue;
          }
        }
        
        // Create new contact
        try {
          await db.insert(contacts).values({
            name: record.name,
            type: "doctor",
            phone: record.phone || null,
            email: record.email || null,
            address: record.address || null,
            district: record.district || null,
            specialty: record.specialty || null,
            hospital: record.hospital || null,
            designation: record.designation || null,
            source: `import:${sourceId}`,
            status: "active",
            tags: ["imported"],
          });
          created++;
        } catch (e) {
          // Skip errors
        }
      }
      
      await db.update(dataSources)
        .set({ status: "completed", processedCount: created })
        .where(eq(dataSources.id, sourceId));
      
      return { rawRecords: records.length, created, duplicates };
    }),

  parseAndImport: publicQuery
    .input(z.object({
      fileName: z.string(),
      fileType: z.enum(["excel", "csv", "pdf"]),
      rows: z.array(z.record(z.string(), z.unknown())),
      columnMapping: z.record(z.string(), z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      
      const source = await db.insert(dataSources).values({
        sourceType: "upload",
        sourceName: input.fileType,
        fileName: input.fileName,
        rawDataCount: input.rows.length,
        status: "processing",
      });
      const sourceId = Number((source as any).insertId);
      
      const mapping: Record<string, string> = input.columnMapping || {};
      const getCol = (mKey: string, defaults: string[]): string[] => {
        const mapped = mapping[mKey];
        return mapped ? [mapped, ...defaults] : defaults;
      };
      const getVal = (row: Record<string, unknown>, keys: string[]): string => {
        for (const key of keys) {
          const val = row[key];
          if (val !== undefined && val !== null) return String(val);
        }
        return "";
      };
      
      const records = input.rows.map((row) => ({
        name: getVal(row, getCol("name", ["Name", "name", "NAME", "Doctor Name"])),
        phone: getVal(row, getCol("phone", ["Phone", "phone", "Mobile", "Contact Number"])),
        email: getVal(row, getCol("email", ["Email", "email"])),
        address: getVal(row, getCol("address", ["Address", "address", "Clinic Address"])),
        district: getVal(row, getCol("district", ["District", "district", "City"])),
        specialty: getVal(row, getCol("specialty", ["Specialty", "specialty", "Specialization"])),
        hospital: getVal(row, getCol("hospital", ["Hospital", "hospital", "Hospital/Clinic"])),
        designation: getVal(row, getCol("designation", ["Designation", "designation"])),
      })).filter((r) => r.name);
      
      let created = 0;
      let duplicates = 0;
      
      for (const record of records) {
        if (record.phone) {
          const existing = await db.select().from(contacts)
            .where(eq(contacts.phone, record.phone))
            .limit(1);
          if (existing.length > 0) { duplicates++; continue; }
        }
        
        try {
          await db.insert(contacts).values({
            name: record.name,
            type: "doctor",
            phone: record.phone || null,
            email: record.email || null,
            address: record.address || null,
            district: record.district || null,
            specialty: record.specialty || null,
            hospital: record.hospital || null,
            designation: record.designation || null,
            source: `upload:${input.fileName}`,
            status: "active",
            tags: ["imported", input.fileType],
          });
          created++;
        } catch (e) { /* skip */ }
      }
      
      await db.update(dataSources)
        .set({ status: "completed", processedCount: created })
        .where(eq(dataSources.id, sourceId));
      
      return { sourceId, totalRows: input.rows.length, parsedRecords: records.length, created, duplicates };
    }),

  jobs: publicQuery.query(async () => {
    const db = getDb();
    const items = await db.select().from(dataSources).orderBy(desc(dataSources.createdAt)).limit(50);
    return { items };
  }),

  rawData: publicQuery
    .input(z.object({ sourceId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const items = await db.select().from(rawImports)
        .where(eq(rawImports.sourceId, input.sourceId))
        .orderBy(desc(rawImports.createdAt));
      return { items };
    }),
});
