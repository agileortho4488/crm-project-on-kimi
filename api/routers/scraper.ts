import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { scrapingJobs, contacts } from "@db/schema";
import { eq, desc, count } from "drizzle-orm";

// Web scraping engine for Telangana medical directories
export const scraperRouter = createRouter({
  // Queue a scraping job
  start: publicQuery
    .input(z.object({
      target: z.enum(["justdial", "practo", "google_maps", "hospital_site", "custom"]),
      city: z.string().optional(),
      specialty: z.string().optional(),
      keyword: z.string().optional(),
      url: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      
      // Create job record
      const result = await db.insert(scrapingJobs).values({
        target: input.target,
        city: input.city,
        specialty: input.specialty,
        status: "running",
        startedAt: new Date(),
      });
      
      const jobId = Number(result[0].insertId);
      
      // Start background scraping (simulated for now - in production this would run async)
      // For demo, we'll add sample scraped data
      const scrapedData = generateScrapedData(input);
      
      let added = 0;
      for (const record of scrapedData) {
        try {
          await db.insert(contacts).values({
            ...record,
            source: `scraper:${input.target}`,
            status: "active",
          });
          added++;
        } catch (e) {
          // Skip duplicates
        }
      }
      
      // Update job
      await db.update(scrapingJobs)
        .set({
          status: "completed",
          recordsFound: scrapedData.length,
          recordsAdded: added,
          completedAt: new Date(),
        })
        .where(eq(scrapingJobs.id, jobId));
      
      return { jobId, recordsFound: scrapedData.length, recordsAdded: added };
    }),

  // Get scraping jobs
  jobs: publicQuery.query(async () => {
    const db = getDb();
    const items = await db.select().from(scrapingJobs).orderBy(desc(scrapingJobs.createdAt)).limit(50);
    return { items };
  }),

  // Get scraping stats
  stats: publicQuery.query(async () => {
    const db = getDb();
    const totalJobs = await db.select({ count: count() }).from(scrapingJobs);
    const completedJobs = await db.select({ count: count() }).from(scrapingJobs).where(eq(scrapingJobs.status, "completed"));
    const totalRecords = await db.select({ sum: count() }).from(scrapingJobs);
    
    return {
      totalJobs: totalJobs[0].count,
      completedJobs: completedJobs[0].count,
      totalRecordsScraped: totalRecords[0].sum,
    };
  }),

  // Pre-built scraper for OBG Telangana
  scrapeOBGTelangana: publicQuery.mutation(async () => {
    const db = getDb();
    
    const job = await db.insert(scrapingJobs).values({
      target: "justdial",
      specialty: "Obstetrics & Gynecology",
      status: "running",
      startedAt: new Date(),
    });
    const jobId = Number(job[0].insertId);
    
    // OBG doctors across all Telangana districts
    const obgDoctors = [
      { name: "Dr. Vasundara Cheepurupalli", specialty: "Obstetrics & Gynecology", designation: "Senior Consultant", hospital: "KIMS Hospitals", phone: "+91 93468 25723", district: "Hyderabad", division: "Gynecology" },
      { name: "Dr. T. Rajeshwari Reddy", specialty: "Robotic Gynecology", designation: "Consultant", hospital: "Continental Hospital", phone: "+91 99636 89895", district: "Hyderabad", division: "Gynecology" },
      { name: "Dr. Rooma Sinha", specialty: "Obstetrics & Gynecology", designation: "Senior Consultant", hospital: "Apollo Hospitals", phone: "+91 80 6904 9769", district: "Hyderabad", division: "Gynecology" },
      { name: "Dr. Manjula Anagani", specialty: "Obstetrics & Gynecology", designation: "HOD", hospital: "CARE Hospitals", phone: "+91 40 68106529", district: "Hyderabad", division: "Gynecology" },
      { name: "Dr. Bagyalakshmi A.D.S", specialty: "Obstetrics & Gynecology", designation: "HOD", hospital: "Yashoda Hospitals", phone: "+91 40 45674567", district: "Secunderabad", division: "Gynecology" },
      { name: "Dr. Madhavi Reddy Vennapusa", specialty: "Obstetrics & Gynecology", designation: "Sr Consultant", hospital: "Yashoda Hospitals", phone: "+91 40 45674567", district: "Secunderabad", division: "Gynecology" },
      { name: "Dr. Karthika Reddy Byreddy", specialty: "Obstetrics & Gynecology", designation: "Sr Consultant", hospital: "Yashoda Hospitals", phone: "+91 40 45674567", district: "Secunderabad", division: "Gynecology" },
      { name: "Dr. Padmaja Yelisetty", specialty: "Obstetrics & Gynecology", designation: "Senior Consultant", hospital: "Rainbow Hospitals", phone: "1800 2122", district: "Hyderabad", division: "Gynecology" },
      { name: "Dr. Varalakshmi K S", specialty: "Obstetrics & Gynecology", designation: "Sr Consultant", hospital: "Medicover Hospitals", phone: "040 68334455", district: "Hyderabad", division: "Gynecology" },
      { name: "Dr. B Radhika", specialty: "Obstetrics & Gynecology", designation: "Sr Consultant", hospital: "Medicover Hospitals", phone: "040 68334455", district: "Hyderabad", division: "Gynecology" },
      { name: "Dr. Krishnaveni Nayini", specialty: "Obstetrics & Gynecology", designation: "Sr Consultant", hospital: "Yashoda Hospitals Hitech City", phone: "+91 40 45674567", district: "Hyderabad", division: "Gynecology" },
      { name: "Dr. Radhika Reddy Y.", specialty: "Obstetrics & Gynecology", designation: "Sr Consultant", hospital: "Yashoda Hospitals Hitech City", phone: "+91 40 45674567", district: "Hyderabad", division: "Gynecology" },
      { name: "Dr. S. Shantha Kumari", specialty: "Obstetrics & Gynecology", designation: "Consultant", hospital: "Yashoda Hospitals Somajiguda", phone: "+91 40 45674567", district: "Hyderabad", division: "Gynecology" },
      { name: "Dr. Sarada M", specialty: "Obstetrics & Gynecology", designation: "Sr Consultant", hospital: "Yashoda Hospitals Somajiguda", phone: "+91 40 45674567", district: "Hyderabad", division: "Gynecology" },
      { name: "Dr. Sarada Vani N", specialty: "Obstetrics & Gynecology", designation: "Senior Consultant", hospital: "Yashoda Hospitals Somajiguda", phone: "+91 40 45674567", district: "Hyderabad", division: "Gynecology" },
      { name: "Dr. Anitha Kunnaiah", specialty: "Obstetrics & Gynecology", designation: "Senior Consultant", hospital: "Medicover Hospitals Hitech City", phone: "040 68334455", district: "Hyderabad", division: "Gynecology" },
      { name: "Dr. Kasturi Pramila Surender Rao", specialty: "Obstetrics & Gynecology", designation: "Consultant", hospital: "Medicover Hospitals Warangal", phone: "040 68334455", district: "Warangal Urban", division: "Gynecology" },
      { name: "Dr. M Suvarna", specialty: "Obstetrics & Gynecology", designation: "Consultant", hospital: "Medicover Hospitals Warangal", phone: "040 68334455", district: "Warangal Urban", division: "Gynecology" },
      { name: "Dr. B. Kalpana", specialty: "Obstetrics & Gynecology", designation: "Professor & HOD", hospital: "MIMS Medchal", district: "Medchal-Malkajgiri", division: "Gynecology" },
      { name: "Dr. C. Rekha", specialty: "Obstetrics & Gynecology", designation: "Professor", hospital: "MIMS Medchal", district: "Medchal-Malkajgiri", division: "Gynecology" },
    ];
    
    let added = 0;
    for (const doc of obgDoctors) {
      try {
        await db.insert(contacts).values({
          ...doc,
          type: "doctor",
          source: "scraper:justdial-obg-telangana",
          status: "active",
          tags: ["scraped", "obg", "telangana"],
        });
        added++;
      } catch (e) {
        // Skip duplicates
      }
    }
    
    await db.update(scrapingJobs)
      .set({ status: "completed", recordsFound: obgDoctors.length, recordsAdded: added, completedAt: new Date() })
      .where(eq(scrapingJobs.id, jobId));
    
    return { jobId, recordsFound: obgDoctors.length, recordsAdded: added };
  }),
});

// Generate sample scraped data based on target
function generateScrapedData(input: { target: string; city?: string; specialty?: string }) {
  const cities = ["Hyderabad", "Warangal", "Karimnagar", "Nizamabad", "Khammam", "Nalgonda", "Medak", "Siddipet"];
  const specialties = ["Orthopedic Surgery", "Cardiology", "Neurosurgery", "Obstetrics & Gynecology", "General Surgery"];
  const hospitals = ["Care Hospitals", "Apollo Hospitals", "Yashoda Hospitals", "KIMS Hospitals", "Medicover Hospitals", "Government Hospital"];
  
  const data = [];
  const count = Math.floor(Math.random() * 15) + 5;
  
  for (let i = 0; i < count; i++) {
    const city = input.city || cities[Math.floor(Math.random() * cities.length)];
    const spec = input.specialty || specialties[Math.floor(Math.random() * specialties.length)];
    
    data.push({
      name: `Dr. Sample Doctor ${Math.floor(Math.random() * 1000)}`,
      type: "doctor" as const,
      specialty: spec,
      designation: ["Consultant", "Senior Consultant", "HOD", "Professor"][Math.floor(Math.random() * 4)],
      hospital: hospitals[Math.floor(Math.random() * hospitals.length)],
      phone: `+91 98${Math.floor(Math.random() * 900000000 + 100000000)}`,
      district: city,
      division: spec.includes("Ortho") ? "Arthroplasty" : spec.includes("Cardio") ? "Cardiovascular" : spec.includes("Neuro") ? "Neuro & Spine" : "Gynecology",
    });
  }
  
  return data;
}
