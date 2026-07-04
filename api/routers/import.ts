import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { dataSources, contacts } from "@db/schema";
import { eq, desc } from "drizzle-orm";

// Extract structured data from PDF text
function parsePDFText(text: string): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = [];
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Pattern: find lines with phone numbers, then look backward for names
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Find 10-digit mobile numbers (Indian format)
    const mobileMatches = line.match(/(?:\+91[-\s]?)?(?:0)?([6-9]\d{9})/g);

    if (mobileMatches && mobileMatches.length > 0) {
      const phone = mobileMatches[0].replace(/\D/g, '');
      if (phone.length === 10 || (phone.length > 10 && phone.startsWith('91'))) {
        const cleanPhone = phone.length > 10 ? '+' + phone : '+91' + phone;

        // Look backward up to 3 lines for a name
        let name = '';
        for (let j = Math.max(0, i - 3); j < i; j++) {
          const prevLine = lines[j];
          // Name patterns: starts with Dr., Mr., Mrs., or capitalized words
          if (/^(Dr\.?|Mr\.?|Mrs\.?|Ms\.?|Prof\.?|Er\.?|Smt\.?|Shri\.?)\s+[A-Z]/i.test(prevLine) ||
              /^[A-Z][a-z]+\s+[A-Z][a-z]+/.test(prevLine)) {
            name = prevLine.replace(/\s+/g, ' ').trim();
            // Limit name length
            if (name.length > 3 && name.length < 100) break;
          }
        }

        // If no name found backward, try same line before the phone
        if (!name) {
          const phoneIdx = line.indexOf(mobileMatches[0]);
          if (phoneIdx > 0) {
            const beforePhone = line.substring(0, phoneIdx).trim().replace(/[,;:-]+$/, '').trim();
            if (beforePhone.length > 3 && beforePhone.length < 100) {
              name = beforePhone;
            }
          }
        }

        // Extract email if present
        const emailMatch = line.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);

        if (name) {
          records.push({
            name,
            phone: cleanPhone,
            email: emailMatch ? emailMatch[0] : '',
            raw: line,
          });
        }
      }
    }
  }

  return records;
}

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
      return { id: Number((result as any)[0].insertId) };
    }),

  parseAndImport: publicQuery
    .input(z.object({
      fileName: z.string(),
      fileType: z.enum(["excel", "csv", "pdf"]),
      rows: z.array(z.record(z.string(), z.unknown())).optional(),
      pdfText: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();

      // Create source record
      const source = await db.insert(dataSources).values({
        sourceType: "upload",
        sourceName: input.fileType,
        fileName: input.fileName,
        rawDataCount: input.rows?.length || 0,
        status: "processing",
      });
      const sourceId = Number((source as any)[0].insertId);
      if (isNaN(sourceId)) throw new Error("Failed to create import job - invalid source ID");

      let records: Record<string, string>[] = [];

      if (input.fileType === "pdf" && input.pdfText) {
        // Parse PDF text
        const pdfRecords = parsePDFText(input.pdfText);
        records = pdfRecords.map(r => ({
          name: String(r.name || ''),
          phone: String(r.phone || ''),
          email: String(r.email || ''),
          address: '',
          district: '',
          specialty: '',
          hospital: '',
          designation: '',
        }));
      } else if (input.rows) {
        // Parse CSV/Excel rows
        const mapping: Record<string, string> = {};
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

        records = input.rows.map((row) => ({
          name: getVal(row, getCol("name", ["Name", "name", "NAME", "Doctor Name"])),
          phone: getVal(row, getCol("phone", ["Phone", "phone", "Mobile", "Contact Number"])),
          email: getVal(row, getCol("email", ["Email", "email"])),
          address: getVal(row, getCol("address", ["Address", "address", "Clinic Address"])),
          district: getVal(row, getCol("district", ["District", "district", "City"])),
          specialty: getVal(row, getCol("specialty", ["Specialty", "specialty", "Specialization"])),
          hospital: getVal(row, getCol("hospital", ["Hospital", "hospital", "Hospital/Clinic"])),
          designation: getVal(row, getCol("designation", ["Designation", "designation"])),
        })).filter((r) => r.name);
      }

      let created = 0;
      let merged = 0;
      let skipped = 0;
      const mergeLog: string[] = [];

      for (const record of records) {
        if (!record.name) { skipped++; continue; }

        // Check for existing contact by phone
        let existing: any = null;

        if (record.phone) {
          const byPhone = await db.select().from(contacts)
            .where(eq(contacts.phone, record.phone))
            .limit(1);
          if (byPhone.length > 0) existing = byPhone[0];

          // Try normalized phone
          if (!existing) {
            const normPhone = record.phone.replace(/\D/g, '');
            if (normPhone.length >= 10) {
              const allContacts = await db.select().from(contacts);
              existing = allContacts.find((c: any) =>
                c.phone && c.phone.replace(/\D/g, '').slice(-10) === normPhone.slice(-10)
              );
            }
          }
        }

        // Name + district match
        if (!existing && record.district) {
          const byNameDistrict = await db.select().from(contacts)
            .where(eq(contacts.district, record.district))
            .limit(50);
          const normNewName = record.name.toLowerCase().replace(/[^a-z]/g, '');
          existing = byNameDistrict.find((c: any) => {
            if (!c.name) return false;
            const normExisting = c.name.toLowerCase().replace(/[^a-z]/g, '');
            return normExisting === normNewName ||
              normExisting.includes(normNewName) ||
              normNewName.includes(normExisting);
          });
        }

        // Merge: fill empty fields only
        if (existing) {
          const updates: any = {};
          const filledFields: string[] = [];

          if (!existing.email && record.email) { updates.email = record.email; filledFields.push('email'); }
          if (!existing.phone && record.phone) { updates.phone = record.phone; filledFields.push('phone'); }
          if (!existing.whatsapp && record.phone) { updates.whatsapp = record.phone; filledFields.push('whatsapp'); }
          if (!existing.district && record.district) { updates.district = record.district; filledFields.push('district'); }
          if (!existing.specialty && record.specialty) { updates.specialty = record.specialty; filledFields.push('specialty'); }
          if (!existing.hospital && record.hospital) { updates.hospital = record.hospital; filledFields.push('hospital'); }
          if (!existing.designation && record.designation) { updates.designation = record.designation; filledFields.push('designation'); }
          if (!existing.address && record.address) { updates.address = record.address; filledFields.push('address'); }

          const existingTags = (existing.tags as string[] | null) || [];
          const newTags = [...new Set([...existingTags, 'imported', `from:${input.fileName}`])];
          updates.tags = newTags;

          if (Object.keys(updates).length > 0) {
            await db.update(contacts).set(updates).where(eq(contacts.id, existing.id));
            mergeLog.push(`${existing.name}: filled ${filledFields.join(', ')}`);
          }
          merged++;
          continue;
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
            source: `upload:${input.fileName}`,
            status: "active",
            tags: ["imported", `from:${input.fileName}`],
          });
          created++;
        } catch (e) { skipped++; }
      }

      // Update source status
      await db.update(dataSources)
        .set({ status: "completed", processedCount: created + merged })
        .where(eq(dataSources.id, sourceId));

      return { sourceId, totalRows: input.rows?.length || 0, parsedRecords: records.length, created, merged, skipped, mergeLog: mergeLog.slice(0, 20) };
    }),

  jobs: publicQuery.query(async () => {
    const db = getDb();
    const items = await db.select().from(dataSources).orderBy(desc(dataSources.createdAt)).limit(50);
    return { items };
  }),
});
