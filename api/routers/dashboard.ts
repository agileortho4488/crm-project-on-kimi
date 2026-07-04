import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { contacts, leads, activities, tasks, products, scrapingJobs } from "@db/schema";
import { eq, count, sql, desc } from "drizzle-orm";

export const dashboardRouter = createRouter({
  // Main dashboard stats
  stats: publicQuery.query(async () => {
    const db = getDb();
    
    const [
      totalContacts,
      totalDoctors,
      totalHospitals,
      activeContacts,
      totalLeads,
      activeLeads,
      wonLeads,
      pendingTasks,
      overdueTasks,
      totalProducts,
      scrapingStats,
    ] = await Promise.all([
      db.select({ count: count() }).from(contacts),
      db.select({ count: count() }).from(contacts).where(eq(contacts.type, "doctor")),
      db.select({ count: count() }).from(contacts).where(eq(contacts.type, "hospital")),
      db.select({ count: count() }).from(contacts).where(eq(contacts.status, "active")),
      db.select({ count: count() }).from(leads),
      db.select({ count: count() }).from(leads).where(sql`stage NOT IN ('closed_won', 'closed_lost')`),
      db.select({ count: count() }).from(leads).where(eq(leads.stage, "closed_won")),
      db.select({ count: count() }).from(tasks).where(eq(tasks.status, "pending")),
      db.select({ count: count() }).from(tasks).where(eq(tasks.status, "overdue")),
      db.select({ count: count() }).from(products),
      db.select({ count: count() }).from(scrapingJobs),
    ]);
    
    // Division breakdown
    const divisionData = await db.select({
      division: contacts.division,
      count: count(),
    }).from(contacts).groupBy(contacts.division);
    
    // District coverage
    const districtCount = await db.select({
      count: sql`COUNT(DISTINCT district)`,
    }).from(contacts);
    
    // Recent activities
    const recentActivities = await db.select().from(activities)
      .orderBy(desc(activities.createdAt))
      .limit(10);
    
    // Pipeline stages
    const pipelineStages = await Promise.all(
      ["new", "qualified", "proposal", "negotiation", "closed_won", "closed_lost"].map(async (stage) => ({
        stage,
        count: (await db.select({ count: count() }).from(leads).where(eq(leads.stage, stage as any)))[0].count,
      }))
    );
    
    return {
      contacts: {
        total: totalContacts[0].count,
        doctors: totalDoctors[0].count,
        hospitals: totalHospitals[0].count,
        active: activeContacts[0].count,
      },
      leads: {
        total: totalLeads[0].count,
        active: activeLeads[0].count,
        won: wonLeads[0].count,
        pipeline: pipelineStages,
      },
      tasks: {
        pending: pendingTasks[0].count,
        overdue: overdueTasks[0].count,
      },
      products: totalProducts[0].count,
      divisions: divisionData,
      districts: districtCount[0].count,
      scrapingJobs: scrapingStats[0].count,
      recentActivities,
    };
  }),

  // Monthly trends (mock data for now)
  trends: publicQuery.query(async () => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"];
    return months.map((month) => ({
      month,
      contacts: Math.floor(Math.random() * 50) + 10,
      leads: Math.floor(Math.random() * 20) + 5,
      revenue: Math.floor(Math.random() * 5000000) + 1000000,
      activities: Math.floor(Math.random() * 30) + 10,
    }));
  }),
});
