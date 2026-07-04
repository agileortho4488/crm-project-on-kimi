import type { Context } from "hono";
import { getDb } from "../queries/connection";
import { dataSources, contacts } from "@db/schema";
import { eq } from "drizzle-orm";
import * as XLSX from "xlsx";

// Parse CSV text properly (handles commas in quotes)
function parseCSV(text: string): Record<string, unknown>[] {
  const lines = text.split('\n').filter((r) => r.trim());
  if (lines.length === 0) return [];

  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line);
    const obj: Record<string, unknown> = {};
    headers.forEach((h, i) => { obj[h] = (values[i] || '').trim(); });
    return obj;
  }).filter((r) => Object.values(r).some((v) => v && String(v).trim()));
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map((v) => v.trim().replace(/^"|"$/g, '').trim());
}

function getVal(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const val = row[key];
    if (val !== undefined && val !== null) return String(val);
  }
  return "";
}

function parseRows(rows: Record<string, unknown>[]): Array<Record<string, string>> {
  return rows.map((row) => ({
    name: getVal(row, ["Name", "name", "NAME", "Doctor Name", "Contact Name", "Full Name"]),
    phone: getVal(row, ["Phone", "phone", "Mobile", "Contact Number", "Phone Number", "Cell"]),
    email: getVal(row, ["Email", "email", "E-mail", "Mail"]),
    address: getVal(row, ["Address", "address", "Clinic Address"]),
    district: getVal(row, ["District", "district", "City", "city"]),
    specialty: getVal(row, ["Specialty", "specialty", "Specialization", "Department"]),
    hospital: getVal(row, ["Hospital", "hospital", "Clinic", "Organization"]),
    designation: getVal(row, ["Designation", "designation", "Title"]),
  })).filter((r) => r.name);
}

async function mergeContact(db: any, record: Record<string, string>, fileName: string) {
  // Check phone match
  let existing: any = null;
  if (record.phone) {
    const byPhone = await db.select().from(contacts).where(eq(contacts.phone, record.phone)).limit(1);
    if (byPhone.length > 0) existing = byPhone[0];

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
    const byNameDistrict = await db.select().from(contacts).where(eq(contacts.district, record.district)).limit(50);
    const normNewName = record.name.toLowerCase().replace(/[^a-z]/g, '');
    existing = byNameDistrict.find((c: any) => {
      if (!c.name) return false;
      const normExisting = c.name.toLowerCase().replace(/[^a-z]/g, '');
      return normExisting === normNewName || normExisting.includes(normNewName) || normNewName.includes(normExisting);
    });
  }

  if (existing) {
    const updates: any = {};
    if (!existing.email && record.email) updates.email = record.email;
    if (!existing.phone && record.phone) updates.phone = record.phone;
    if (!existing.whatsapp && record.phone) updates.whatsapp = record.phone;
    if (!existing.district && record.district) updates.district = record.district;
    if (!existing.specialty && record.specialty) updates.specialty = record.specialty;
    if (!existing.hospital && record.hospital) updates.hospital = record.hospital;
    if (!existing.designation && record.designation) updates.designation = record.designation;
    if (!existing.address && record.address) updates.address = record.address;

    const existingTags = (existing.tags as string[] | null) || [];
    updates.tags = [...new Set([...existingTags, 'imported', `from:${fileName}`])];

    if (Object.keys(updates).length > 0) {
      await db.update(contacts).set(updates).where(eq(contacts.id, existing.id));
    }
    return 'merged';
  }

  // Create new
  try {
    await db.insert(contacts).values({
      name: record.name,
      type: record.hospital ? "hospital" : "doctor",
      phone: record.phone || null,
      email: record.email || null,
      address: record.address || null,
      district: record.district || null,
      specialty: record.specialty || null,
      hospital: record.hospital || null,
      designation: record.designation || null,
      source: `upload:${fileName}`,
      status: "active",
      tags: ["imported", `from:${fileName}`],
    });
    return 'created';
  } catch (e) {
    return 'skipped';
  }
}

export async function handleFileUpload(c: Context) {
  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File;
    const fileName = formData.get("fileName") as string || file.name;

    if (!file) return c.json({ error: "No file uploaded" }, 400);

    const ext = fileName.toLowerCase();

    // Reject PDFs - client should send PDF text via tRPC parseAndImport instead
    if (ext.endsWith(".pdf")) {
      return c.json({
        error: "PDF_UPLOAD_NOT_SUPPORTED",
        message: "Please use the tRPC import endpoint for PDF files. The server cannot parse PDFs directly."
      }, 400);
    }

    const db = getDb();
    const buffer = Buffer.from(await file.arrayBuffer());

    // Create import job
    const source = await db.insert(dataSources).values({
      sourceType: "upload",
      sourceName: ext.endsWith(".csv") ? "csv" : "excel",
      fileName: fileName,
      status: "processing",
    });
    const sourceId = Number((source as any)[0].insertId);
    if (isNaN(sourceId)) throw new Error("Failed to create import job");

    let records: Array<Record<string, string>> = [];

    if (ext.endsWith(".csv") || ext.endsWith(".txt")) {
      // Parse CSV
      const text = buffer.toString("utf-8");
      const rows = parseCSV(text);
      records = parseRows(rows);
    } else {
      // Parse Excel
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet) as Record<string, unknown>[];
      records = parseRows(rows);
    }

    // Process records
    let created = 0;
    let merged = 0;
    let skipped = 0;

    for (const record of records) {
      const result = await mergeContact(db, record, fileName);
      if (result === 'created') created++;
      else if (result === 'merged') merged++;
      else skipped++;
    }

    // Update job status
    await db.update(dataSources)
      .set({ status: "completed", rawDataCount: records.length, processedCount: created + merged })
      .where(eq(dataSources.id, sourceId));

    return c.json({
      success: true,
      sourceId,
      fileName,
      totalRows: records.length,
      created,
      merged,
      skipped,
    });

  } catch (error: any) {
    console.error("Upload error:", error);
    return c.json({ error: error.message || "Upload failed" }, 500);
  }
}
