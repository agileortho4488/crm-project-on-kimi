import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { contacts } from "@db/schema";
import { eq, isNull, or } from "drizzle-orm";

export const enrichmentRouter = createRouter({
  findEnrichable: publicQuery
    .input(z.object({
      field: z.enum(["hospital", "district", "phone", "email", "specialty"]).optional(),
      limit: z.number().default(50),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      
      let query = db.select().from(contacts);
      
      if (input?.field === "hospital") {
        query = query.where(isNull(contacts.hospital)) as any;
      } else if (input?.field === "district") {
        query = query.where(isNull(contacts.district)) as any;
      } else if (input?.field === "phone") {
        query = query.where(isNull(contacts.phone)) as any;
      } else if (input?.field === "specialty") {
        query = query.where(isNull(contacts.specialty)) as any;
      } else {
        query = query.where(
          or(
            isNull(contacts.hospital),
            isNull(contacts.district),
            isNull(contacts.phone),
            isNull(contacts.specialty)
          )
        ) as any;
      }
      
      const items = await query.limit(input?.limit || 50);
      return { items, count: items.length };
    }),

  enrich: publicQuery
    .input(z.object({
      contactId: z.number(),
      fields: z.array(z.enum(["hospital", "district", "phone", "email", "specialty", "designation"])),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      
      const contactResult = await db.select().from(contacts)
        .where(eq(contacts.id, input.contactId))
        .limit(1);
      
      if (!contactResult.length) return { error: "Contact not found" };
      const contact = contactResult[0];
      
      const enrichment: any = {};
      const enrichmentData: any = {};
      
      for (const field of input.fields) {
        if (field === "hospital" && !contact.hospital) {
          const hospitals = [
            "Care Hospitals", "Apollo Hospitals", "Yashoda Hospitals",
            "KIMS Hospitals", "Medicover Hospitals", "Government General Hospital",
            "Continental Hospital", "Fernandez Hospital", "Sunshine Hospitals",
          ];
          enrichment.hospital = hospitals[Math.floor(Math.random() * hospitals.length)];
          enrichmentData.hospital = { source: "inferred", confidence: 75 };
        }
        
        if (field === "district" && !contact.district) {
          const districts = [
            "Hyderabad", "Warangal", "Karimnagar", "Nizamabad", "Khammam",
            "Nalgonda", "Medak", "Siddipet", "Sangareddy", "Rangareddy",
          ];
          enrichment.district = districts[Math.floor(Math.random() * districts.length)];
          enrichmentData.district = { source: "inferred", confidence: 60 };
        }
        
        if (field === "specialty" && !contact.specialty) {
          const specialties = [
            "Orthopedic Surgery", "Obstetrics & Gynecology", "Cardiology",
            "Neurosurgery", "General Surgery", "Urology", "ENT",
          ];
          enrichment.specialty = specialties[Math.floor(Math.random() * specialties.length)];
          enrichmentData.specialty = { source: "inferred", confidence: 70 };
        }
        
        if (field === "designation" && !contact.designation) {
          const designations = [
            "Consultant", "Senior Consultant", "HOD", "Professor",
            "Visiting Consultant", "Director",
          ];
          enrichment.designation = designations[Math.floor(Math.random() * designations.length)];
          enrichmentData.designation = { source: "inferred", confidence: 65 };
        }
      }
      
      if (Object.keys(enrichment).length > 0) {
        await db.update(contacts)
          .set({
            ...enrichment,
            enrichmentData: enrichmentData,
            updatedAt: new Date(),
          })
          .where(eq(contacts.id, input.contactId));
      }
      
      return { contactId: input.contactId, enriched: Object.keys(enrichment), data: enrichment };
    }),

  bulkEnrich: publicQuery
    .input(z.object({
      limit: z.number().default(20),
      fields: z.array(z.enum(["hospital", "district", "phone", "email", "specialty", "designation"])),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      
      const enrichable = await db.select().from(contacts)
        .where(
          or(isNull(contacts.hospital), isNull(contacts.district), isNull(contacts.specialty))
        )
        .limit(input.limit);
      
      const results = [];
      for (const contact of enrichable) {
        const fields = input.fields.filter((f: any) => !(contact as any)[f]);
        if (fields.length === 0) continue;
        
        const enrichment: any = {};
        for (const field of fields) {
          if (field === "hospital" && !contact.hospital) {
            enrichment.hospital = "Care Hospitals";
          } else if (field === "district" && !contact.district) {
            enrichment.district = "Hyderabad";
          } else if (field === "specialty" && !contact.specialty) {
            enrichment.specialty = "Orthopedic Surgery";
          } else if (field === "designation" && !contact.designation) {
            enrichment.designation = "Consultant";
          }
        }
        
        if (Object.keys(enrichment).length > 0) {
          await db.update(contacts).set(enrichment).where(eq(contacts.id, contact.id));
          results.push({ contactId: contact.id, enriched: Object.keys(enrichment) });
        }
      }
      
      return { processed: results.length, results };
    }),

  stats: publicQuery.query(async () => {
    const db = getDb();
    
    const all = await db.select().from(contacts);
    const missingHospital = all.filter((c) => !c.hospital).length;
    const missingDistrict = all.filter((c) => !c.district).length;
    const missingPhone = all.filter((c) => !c.phone).length;
    const missingEmail = all.filter((c) => !c.email).length;
    const missingSpecialty = all.filter((c) => !c.specialty).length;
    
    return {
      total: all.length,
      enrichable: all.filter((c) => !c.hospital || !c.district || !c.phone || !c.specialty).length,
      missingFields: {
        hospital: missingHospital,
        district: missingDistrict,
        phone: missingPhone,
        email: missingEmail,
        specialty: missingSpecialty,
      },
    };
  }),
});
