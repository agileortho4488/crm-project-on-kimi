import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { contacts, activities } from "@db/schema";
import { eq, like, or, and, desc, sql, count, isNotNull } from "drizzle-orm";

export const campaignRouter = createRouter({
  // Get OBG doctors with clean mobile numbers for WhatsApp
  getOBGForWhatsApp: publicQuery
    .input(z.object({
      district: z.string().optional(),
      hasMobileOnly: z.boolean().default(true),
      limit: z.number().default(500),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const filters = [
        or(
          like(contacts.division, "%Gynecology%"),
          like(contacts.specialty, "%gynec%"),
          like(contacts.specialty, "%obstetric%"),
          like(contacts.specialty, "%OBG%"),
          like(contacts.specialty, "%ob-gyn%"),
          like(contacts.specialty, "%fertility%"),
          like(contacts.specialty, "%ivf%"),
          like(contacts.specialty, "%maternity%"),
          like(contacts.tags, "%obg%"),
        )
      ];
      
      if (input?.district) {
        filters.push(eq(contacts.district, input.district));
      }
      if (input?.hasMobileOnly) {
        filters.push(
          or(
            and(isNotNull(contacts.whatsapp), sql`whatsapp != ''`),
            and(isNotNull(contacts.phone), sql`phone REGEXP '[6-9][0-9]{9}'`),
          )
        );
      }

      const items = await db.select().from(contacts)
        .where(and(...filters))
        .orderBy(desc(contacts.updatedAt))
        .limit(input?.limit || 500);

      // Clean mobile numbers
      const withCleanMobiles = items.map((c: any) => {
        let mobile = c.whatsapp || '';
        if (!mobile && c.phone) {
          const matches = c.phone.match(/[6-9]\d{9}/);
          if (matches) mobile = '+91' + matches[0];
        }
        return { ...c, cleanMobile: mobile };
      }).filter((c: any) => c.cleanMobile.length >= 10);

      return { 
        items: withCleanMobiles, 
        total: withCleanMobiles.length,
        summary: {
          totalOBG: items.length,
          withMobile: withCleanMobiles.length,
          withoutMobile: items.length - withCleanMobiles.length,
        }
      };
    }),

  // Generate WhatsApp links for a campaign
  generateWhatsAppLinks: publicQuery
    .input(z.object({
      message: z.string().min(1),
      productName: z.string().optional(),
      district: z.string().optional(),
      limit: z.number().default(500),
    }))
    .query(async ({ input }) => {
      const db = getDb();
      const filters = [
        or(
          like(contacts.division, "%Gynecology%"),
          like(contacts.specialty, "%gynec%"),
          like(contacts.specialty, "%obstetric%"),
          like(contacts.specialty, "%fertility%"),
          like(contacts.specialty, "%ivf%"),
        ),
        or(
          and(isNotNull(contacts.whatsapp), sql`whatsapp != ''`),
          and(isNotNull(contacts.phone), sql`phone REGEXP '[6-9][0-9]{9}'`),
        )
      ];
      
      if (input.district) {
        filters.push(eq(contacts.district, input.district));
      }

      const items = await db.select().from(contacts)
        .where(and(...filters))
        .orderBy(desc(contacts.updatedAt))
        .limit(input.limit);

      const links = items.map((c: any) => {
        let mobile = c.whatsapp || '';
        if (!mobile && c.phone) {
          const matches = c.phone.match(/[6-9]\d{9}/);
          if (matches) mobile = '+91' + matches[0];
        }
        const encodedMsg = encodeURIComponent(input.message);
        return {
          name: c.name,
          mobile,
          district: c.district,
          hospital: c.hospital,
          waLink: `https://wa.me/${mobile}?text=${encodedMsg}`,
        };
      }).filter((l: any) => l.mobile.length >= 10);

      return { links, total: links.length };
    }),

  // Mark contacts as messaged in a campaign
  markMessaged: publicQuery
    .input(z.object({
      contactIds: z.array(z.number()),
      campaignName: z.string(),
      message: z.string(),
      productName: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const results = [];
      
      for (const contactId of input.contactIds) {
        const activity = await db.insert(activities).values({
          type: "whatsapp",
          contactId,
          description: `Campaign: ${input.campaignName} | Product: ${input.productName || 'N/A'} | Message: ${input.message.substring(0, 100)}`,
          outcome: "message_sent",
          createdBy: "campaign_system",
        });
        results.push({ contactId, activityId: Number((activity as any)[0].insertId) });
      }
      
      // Update contact tags
      for (const contactId of input.contactIds) {
        const [existing] = await db.select().from(contacts).where(eq(contacts.id, contactId));
        if (existing) {
          const currentTags = (existing.tags as string[]) || [];
          const newTags = [...new Set([...currentTags, `campaign:${input.campaignName}`, `product:${input.productName || 'generic'}`])];
          await db.update(contacts).set({ tags: newTags }).where(eq(contacts.id, contactId));
        }
      }
      
      return { marked: results.length };
    }),

  // Auto-clean mobile numbers across all contacts
  cleanMobiles: publicQuery.mutation(async () => {
    const db = getDb();
    const allContacts = await db.select().from(contacts)
      .where(and(isNotNull(contacts.phone), sql`phone != ''`));
    
    let cleaned = 0;
    let skipped = 0;
    
    for (const c of allContacts) {
      const phone = c.phone || '';
      
      // Extract all 10-digit mobile numbers
      const matches = phone.match(/[6-9]\d{9}/g);
      if (matches && matches.length > 0) {
        const cleanMobile = '+91' + matches[0];
        
        // Also extract second number if present
        let phone2 = null;
        if (matches.length > 1) {
          phone2 = '+91' + matches[1];
        }
        
        const updates: any = { whatsapp: cleanMobile };
        if (phone2) updates.phone2 = phone2;
        
        await db.update(contacts).set(updates).where(eq(contacts.id, c.id));
        cleaned++;
      } else {
        skipped++;
      }
    }
    
    return { cleaned, skipped, total: allContacts.length };
  }),

  // Get campaign stats
  campaignStats: publicQuery.query(async () => {
    const db = getDb();
    
    // Total OBG contacts
    const [obgTotal] = await db.select({ count: count() }).from(contacts)
      .where(or(
        like(contacts.division, "%Gynecology%"),
        like(contacts.specialty, "%gynec%"),
        like(contacts.specialty, "%obstetric%"),
        like(contacts.specialty, "%fertility%"),
        like(contacts.specialty, "%ivf%"),
      ));
    
    // OBG with mobile
    const [obgMobile] = await db.select({ count: count() }).from(contacts)
      .where(and(
        or(
          like(contacts.division, "%Gynecology%"),
          like(contacts.specialty, "%gynec%"),
          like(contacts.specialty, "%obstetric%"),
          like(contacts.specialty, "%fertility%"),
          like(contacts.specialty, "%ivf%"),
        ),
        isNotNull(contacts.whatsapp),
        sql`whatsapp != ''`,
      ));
    
    // Total contacts with mobile
    const [allMobile] = await db.select({ count: count() }).from(contacts)
      .where(and(isNotNull(contacts.whatsapp), sql`whatsapp != ''`));
    
    // Campaign activities
    const [campaignActivities] = await db.select({ count: count() }).from(activities)
      .where(like(activities.description, "%Campaign:%"));
    
    return {
      obgTotal: obgTotal.count,
      obgWithMobile: obgMobile.count,
      totalContacts: (await db.select({ count: count() }).from(contacts))[0].count,
      totalWithMobile: allMobile.count,
      campaignsRun: campaignActivities.count,
    };
  }),
});
