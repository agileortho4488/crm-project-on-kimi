import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { contacts } from "@db/schema";
import { eq, sql, isNotNull, and, or, like } from "drizzle-orm";

// ==========================================
// MULTI-SOURCE ONLINE ENRICHMENT ENGINE
// Generates search URLs for Practo, Google, Justdial, Lybrate, Apollo
// ==========================================

interface EnrichmentSource {
  name: string;
  icon: string;
  searchUrl: (name: string, city: string, specialty: string) => string;
  description: string;
}

const ENRICHMENT_SOURCES: EnrichmentSource[] = [
  {
    name: "Practo",
    icon: "stethoscope",
    searchUrl: (name, city, specialty) => {
      const q = encodeURIComponent(`${name} ${specialty}`.trim());
      const cityParam = encodeURIComponent(city);
      return `https://www.practo.com/search/doctors?results_type=doctor&q=${q}&city=${cityParam}`;
    },
    description: "India's largest doctor directory - 500K+ profiles with hospital, fees, timings",
  },
  {
    name: "Google",
    icon: "search",
    searchUrl: (name, city, specialty) => {
      const q = encodeURIComponent(`${name} doctor ${specialty} ${city} hospital`.trim());
      return `https://www.google.com/search?q=${q}`;
    },
    description: "General web search - finds hospital websites, news, directories",
  },
  {
    name: "Justdial",
    icon: "map-pin",
    searchUrl: (name, city, specialty) => {
      const q = encodeURIComponent(`${name} ${specialty} doctor ${city}`.trim());
      return `https://www.justdial.com/${encodeURIComponent(city)}/search?q=${q}`;
    },
    description: "Local business listings - phone numbers, addresses, ratings",
  },
  {
    name: "Lybrate",
    icon: "heart-pulse",
    searchUrl: (name, city, specialty) => {
      const q = encodeURIComponent(`${name} ${specialty} ${city}`.trim());
      return `https://www.lybrate.com/search?q=${q}&city=${encodeURIComponent(city)}&search_type=doctor`;
    },
    description: "Doctor consultation platform - fees, availability, reviews",
  },
  {
    name: "Apollo Hospitals",
    icon: "building-2",
    searchUrl: (name, city, specialty) => {
      const q = encodeURIComponent(`${name} ${specialty}`.trim());
      return `https://www.apollohospitals.com/doctors/?search=${q}`;
    },
    description: "Apollo Hospitals doctor directory - affiliated doctors",
  },
  {
    name: "Google Maps",
    icon: "navigation",
    searchUrl: (name, city, specialty) => {
      const q = encodeURIComponent(`${name} doctor clinic ${city}`.trim());
      return `https://www.google.com/maps/search/${q}`;
    },
    description: "Map view of clinics/hospitals - directions, photos, hours",
  },
];

export const onlineEnrichmentRouter = createRouter({
  // Get enrichment sources with search URLs for a specific contact
  getSearchUrls: publicQuery
    .input(z.object({
      name: z.string(),
      city: z.string().optional(),
      district: z.string().optional(),
      specialty: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const city = input.city || input.district || "India";
      const specialty = input.specialty || "";
      
      return ENRICHMENT_SOURCES.map(source => ({
        name: source.name,
        icon: source.icon,
        url: source.searchUrl(input.name, city, specialty),
        description: source.description,
      }));
    }),

  // Get contacts that need online enrichment (no hospital, no address)
  getEnrichmentTargets: publicQuery
    .input(z.object({
      division: z.string().optional(),
      district: z.string().optional(),
      limit: z.number().min(1).max(1000).default(100),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const conditions = [
        or(
          sql`${contacts.hospital} IS NULL OR ${contacts.hospital} = ''`,
          sql`${contacts.address} IS NULL OR ${contacts.address} = ''`,
          sql`${contacts.specialty} IS NULL OR ${contacts.specialty} = ''`,
        )
      ];

      if (input?.division) {
        conditions.push(eq(contacts.division, input.division));
      }
      if (input?.district) {
        conditions.push(like(contacts.district, `%${input.district}%`));
      }

      const where = and(...conditions);

      const [items, totalResult] = await Promise.all([
        db.select().from(contacts)
          .where(where)
          .orderBy(sql`RAND()`)
          .limit(input?.limit || 100)
          .offset(input?.offset || 0),
        db.select({ count: sql`COUNT(*)` }).from(contacts).where(where),
      ]);

      // Attach search URLs to each contact
      const enriched = items.map(contact => {
        const city = contact.district || "India";
        const specialty = contact.specialty || contact.division || "";
        return {
          ...contact,
          searchUrls: ENRICHMENT_SOURCES.map(source => ({
            name: source.name,
            icon: source.icon,
            url: source.searchUrl(contact.name, city, specialty),
          })),
        };
      });

      return {
        items: enriched,
        total: Number(totalResult[0].count),
      };
    }),

  // Manual enrichment - update contact with found data
  manualEnrich: publicQuery
    .input(z.object({
      contactId: z.number(),
      hospital: z.string().optional(),
      address: z.string().optional(),
      specialty: z.string().optional(),
      designation: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      source: z.string().optional(), // which website the data came from
      sourceUrl: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { contactId, ...updateData } = input;

      // Build update object with only provided fields
      const updates: any = {};
      if (updateData.hospital !== undefined) updates.hospital = updateData.hospital;
      if (updateData.address !== undefined) updates.address = updateData.address;
      if (updateData.specialty !== undefined) updates.specialty = updateData.specialty;
      if (updateData.designation !== undefined) updates.designation = updateData.designation;
      if (updateData.email !== undefined) updates.email = updateData.email;
      if (updateData.phone !== undefined) updates.phone = updateData.phone;
      if (updateData.sourceUrl !== undefined) updates.sourceUrl = updateData.sourceUrl;

      // Recalculate quality score
      const [existing] = await db.select().from(contacts).where(eq(contacts.id, contactId)).limit(1);
      if (existing) {
        const merged = { ...existing, ...updates };
        let score = 0;
        if (merged.name?.length > 2) score += 20;
        if (merged.phone?.length >= 10) score += 25;
        if (merged.hospital?.length > 2) score += 15;
        if (merged.district?.length > 1) score += 10;
        if (merged.specialty?.length > 1) score += 10;
        if (merged.email?.includes("@")) score += 10;
        if (merged.division && merged.division !== "unknown" && merged.division !== "") score += 5;
        if (merged.designation?.length > 1) score += 5;
        updates.qualityScore = score;
      }

      // Store enrichment metadata
      const enrichmentEntry = {
        source: updateData.source || "manual",
        enrichedAt: new Date().toISOString(),
        fieldsUpdated: Object.keys(updates).filter(k => k !== "qualityScore"),
      };

      // Update enrichment_data JSON
      if (existing?.enrichmentData) {
        const existingData = typeof existing.enrichmentData === 'string' 
          ? JSON.parse(existing.enrichmentData) 
          : existing.enrichmentData;
        updates.enrichmentData = JSON.stringify({
          ...existingData,
          enrichmentHistory: [...(existingData.enrichmentHistory || []), enrichmentEntry],
          lastEnriched: new Date().toISOString(),
        });
      } else {
        updates.enrichmentData = JSON.stringify({
          enrichmentHistory: [enrichmentEntry],
          lastEnriched: new Date().toISOString(),
        });
      }

      await db.update(contacts).set(updates).where(eq(contacts.id, contactId));

      return {
        contactId,
        updated: Object.keys(updates).filter(k => k !== "enrichmentData"),
        newQualityScore: updates.qualityScore,
      };
    }),

  // Get enrichment progress stats
  enrichmentProgress: publicQuery.query(async () => {
    const db = getDb();

    const [total, withHospital, withAddress, withSpecialty, withEnrichmentData] = await Promise.all([
      db.select({ count: sql`COUNT(*)` }).from(contacts),
      db.select({ count: sql`COUNT(*)` }).from(contacts).where(and(isNotNull(contacts.hospital), sql`${contacts.hospital} != ''`)),
      db.select({ count: sql`COUNT(*)` }).from(contacts).where(and(isNotNull(contacts.address), sql`${contacts.address} != ''`)),
      db.select({ count: sql`COUNT(*)` }).from(contacts).where(and(isNotNull(contacts.specialty), sql`${contacts.specialty} != ''`)),
      db.select({ count: sql`COUNT(*)` }).from(contacts).where(and(isNotNull(contacts.enrichmentData), sql`${contacts.enrichmentData} != ''`)),
    ]);

    // By division - who needs enrichment most
    const [byDivision] = await db.select({
      division: contacts.division,
      total: sql`COUNT(*)`,
      withHospital: sql`SUM(CASE WHEN hospital IS NOT NULL AND hospital != '' THEN 1 ELSE 0 END)`,
      withoutHospital: sql`SUM(CASE WHEN hospital IS NULL OR hospital = '' THEN 1 ELSE 0 END)`,
    })
      .from(contacts)
      .groupBy(contacts.division)
      .orderBy(sql`COUNT(*) DESC`);

    return {
      total: Number(total[0].count),
      withHospital: Number(withHospital[0].count),
      withAddress: Number(withAddress[0].count),
      withSpecialty: Number(withSpecialty[0].count),
      withEnrichmentData: Number(withEnrichmentData[0].count),
      needsHospital: Number(total[0].count) - Number(withHospital[0].count),
      byDivision: Array.isArray(byDivision) ? byDivision : [byDivision],
    };
  }),
});
