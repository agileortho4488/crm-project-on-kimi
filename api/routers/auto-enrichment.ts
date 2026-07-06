import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { contacts } from "@db/schema";
import { eq, sql, and, or, like, isNotNull, isNull, count } from "drizzle-orm";

// ==========================================
// FULLY AUTOMATIC ENRICHMENT ENGINE
// Zero manual work - everything runs server-side in batches
// ==========================================

// --- HOSPITAL NAMES commonly found in India ---
const HOSPITAL_NAME_PATTERNS = [
  // Major chains
  'Apollo', 'Fortis', 'Max', 'Medanta', 'Narayana', 'Manipal', 'Aster',
  'Columbia Asia', 'Gleneagles', 'Global Hospitals', 'Care Hospital',
  'KIMS', 'Yashoda', 'Sunshine', 'Continental', 'Virinchi', 'Century',
  'M N J', 'MNJ', 'Osmania', 'Gandhi', 'NIMS', 'Niloufer', 'Fernandez',
  'Deccan', 'Basavatarakam', 'HCG', 'American Oncology', 'Omega',
  'Star Hospital', 'Citizen', 'Medicover', 'Rainbow', 'Lucid',
  'SLG', 'S L G', 'Srikara', 'Pace', 'Aarogya', 'Prathima',
  'Mahatma Gandhi', 'M G M', 'MGM', 'ESI', 'Area Hospital',
  'Community Health Centre', 'District Hospital', 'Govt Hospital',
  // Common suffixes
  'Hospital', 'Hospitals', 'Clinic', 'Clinics', 'Nursing Home',
  'Medical Centre', 'Health Centre', 'Care Centre', 'Scan Centre',
  'Diagnostic Centre', 'Cancer Centre', 'Heart Centre', 'Eye Centre',
  'Dental Clinic', 'Skin Clinic', 'Ortho Clinic', 'Child Clinic',
  // Common standalone names
  'Sai', 'Sri Sai', 'Om Sai', 'Lakshmi', 'Padmavati', 'Balaji',
  'Venkateswara', 'Vijaya', 'Kiran', 'Asha', 'Roshini', 'Surya',
  'Chandra', 'Rama', 'Krishna', 'Gopal', 'Sarada', 'Saritha',
  'Ramesh', 'Suresh', 'Rajesh', 'Mahesh', 'Ganesh',
];

// --- SPECIALTY keywords in hospital/clinic names ---
const NAME_TO_SPECIALTY: [string[], string][] = [
  [['Heart', 'Cardiac', 'Cardio', 'Hrudaya'], 'Cardiology'],
  [['Eye', 'Vision', 'Netralaya', 'Netra', 'Drishti'], 'Ophthalmology'],
  [['Dental', 'Dentist', 'Tooth', 'Smile'], 'Dental Surgery'],
  [['Ortho', 'Bone', 'Joint', 'Fracture'], 'Orthopedic Surgery'],
  [['Skin', 'Derma', 'Hair', 'Laser'], 'Dermatology'],
  [['Kidney', 'Nephro', 'Uro', 'Renal'], 'Nephrology & Urology'],
  [['Neuro', 'Brain', 'Spine', 'Nerve'], 'Neurosurgery'],
  [['Cancer', 'Onco', 'Tumor', 'Chemo'], 'Oncology'],
  [['Maternity', 'Women', 'Baby', 'Mother', 'Gynic', 'Gynec'], 'Obstetrics & Gynecology'],
  [['Child', 'Kids', 'Paediatric', 'Pediatric', 'Children'], 'Pediatrics'],
  [['ENT', 'Ear', 'Nose', 'Throat'], 'ENT'],
  [['Physio', 'Rehab', 'Physiotherapy'], 'Physiotherapy'],
  [['Homeo', 'Homeopathy', 'Homeopathic'], 'Homeopathy'],
  [['Ayurveda', 'Ayurvedic'], 'Ayurveda'],
  [['Diagnostic', 'Lab', 'Pathology', 'Radiology', 'Scan', 'Imaging', 'X-Ray', 'Xray'], 'Radiology & Diagnostics'],
  [['General'], 'General Medicine'],
  [['Surgical'], 'General Surgery'],
];

// --- Extract hospital name from contact name ---
function extractHospitalFromName(name: string): string | null {
  if (!name) return null;
  
  // Check for "X Hospital" / "X Clinic" patterns
  const hospitalMatch = name.match(/(.+?)(?:\s+(?:Hospital|Hospitals|Clinic|Clinics|Centre|Center|Nursing Home))/i);
  if (hospitalMatch) {
    const fullName = name.trim();
    // If the entire name is a hospital name, return it
    if (fullName.length > 5) return fullName;
  }
  
  // Check for known hospital chain names
  for (const pattern of HOSPITAL_NAME_PATTERNS) {
    if (name.toLowerCase().includes(pattern.toLowerCase())) {
      // Extract the portion containing the hospital name
      const regex = new RegExp(`.{0,20}${pattern}.{0,30}`, 'i');
      const match = name.match(regex);
      if (match) return match[0].trim();
    }
  }
  
  return null;
}

// --- Infer specialty from name/hospital ---
function inferSpecialtyFromName(name: string, hospital: string): string | null {
  const text = `${name || ''} ${hospital || ''}`.toLowerCase();
  
  for (const [keywords, specialty] of NAME_TO_SPECIALTY) {
    for (const kw of keywords) {
      if (text.includes(kw.toLowerCase())) return specialty;
    }
  }
  return null;
}

// --- Classify type from name ---
function classifyTypeFromName(name: string): string | null {
  if (!name) return null;
  const lower = name.toLowerCase();
  
  // Dr. patterns → doctor
  if (/^(dr\.?\s|doctor\s|prof\.?\s|professor)/i.test(name)) return 'doctor';
  
  // Hospital patterns → hospital
  if (lower.includes('hospital') || lower.includes('medical college') || 
      lower.includes('medical centre') || lower.includes('health centre') ||
      lower.includes('cancer centre') || lower.includes('care centre')) {
    if (!lower.startsWith('dr ')) return 'hospital';
  }
  
  // Clinic patterns → clinic
  if (lower.includes('clinic') || lower.includes('nursing home') ||
      lower.includes('diagnostic centre') || lower.includes('scan centre') ||
      lower.includes('path lab')) {
    if (!lower.startsWith('dr ')) return 'clinic';
  }
  
  // Distributor patterns → distributor
  if (lower.includes('distributor') || lower.includes('supplier') || 
      lower.includes('dealer') || lower.includes('traders') ||
      lower.includes('surgicals') || lower.includes('medicals') ||
      lower.includes('pharma')) return 'distributor';
  
  // Corporate patterns → corporate
  if (lower.includes('pvt ltd') || lower.includes('private limited') ||
      lower.includes(' ltd') || lower.includes('limited') ||
      lower.includes('healthcare') || lower.includes('health care')) return 'corporate';
  
  return null;
}

// --- Calculate quality score ---
function calculateQuality(contact: any): number {
  let score = 0;
  if (contact.name?.length > 2) score += 20;
  if (contact.phone?.length >= 10) score += 25;
  if (contact.hospital?.length > 2) score += 15;
  if (contact.district?.length > 1) score += 10;
  if (contact.specialty?.length > 1) score += 10;
  if (contact.email?.includes("@")) score += 10;
  if (contact.division && contact.division !== "unknown" && contact.division !== "") score += 5;
  if (contact.designation?.length > 1) score += 5;
  return score;
}

// --- Progress tracking (in-memory, per-instance) ---
let enrichmentState = {
  isRunning: false,
  startedAt: null as Date | null,
  totalProcessed: 0,
  totalUpdated: 0,
  currentBatch: 0,
  totalBatches: 0,
  lastContactId: 0,
  maxId: 0,
  stage: 'idle' as 'idle' | 'pattern' | 'crossref' | 'address' | 'quality' | 'done',
  recentLogs: [] as string[],
};

function addLog(message: string) {
  enrichmentState.recentLogs.unshift(`[${new Date().toLocaleTimeString()}] ${message}`);
  if (enrichmentState.recentLogs.length > 50) enrichmentState.recentLogs.pop();
}

export const autoEnrichmentRouter = createRouter({
  // ==========================================
  // START AUTO ENRICHMENT - Runs in background batches
  // ==========================================
  start: publicQuery
    .input(z.object({
      batchSize: z.number().min(10).max(1000).default(100),
      delayMs: z.number().min(1000).max(60000).default(5000),
      stages: z.array(z.enum(['pattern', 'crossref', 'address', 'quality'])).default(['pattern', 'crossref', 'address', 'quality']),
    }).optional())
    .mutation(async ({ input }) => {
      const db = getDb();
      const batchSize = input?.batchSize || 100;
      const stages = input?.stages || ['pattern', 'crossref', 'address', 'quality'];
      
      // Don't start if already running
      if (enrichmentState.isRunning) {
        return { status: 'already_running', state: enrichmentState };
      }
      
      // Get total scope
      const [maxResult] = await db.select({ max: sql`MAX(id)` }).from(contacts);
      const maxId = Number(maxResult.max) || 0;
      const totalBatches = Math.ceil(maxId / batchSize);
      
      enrichmentState = {
        isRunning: true,
        startedAt: new Date(),
        totalProcessed: 0,
        totalUpdated: 0,
        currentBatch: 0,
        totalBatches,
        lastContactId: 0,
        maxId,
        stage: 'pattern',
        recentLogs: [],
      };
      
      addLog(`Auto enrichment started. ${maxId.toLocaleString()} contacts, ${totalBatches} batches`);
      
      // Process in background - don't await
      processBatches(db, batchSize, stages).catch(err => {
        addLog(`Error: ${err.message}`);
        enrichmentState.isRunning = false;
        enrichmentState.stage = 'idle';
      });
      
      return { status: 'started', state: { ...enrichmentState, recentLogs: enrichmentState.recentLogs.slice(0, 10) } };
    }),
  
  // Stop enrichment
  stop: publicQuery.mutation(() => {
    enrichmentState.isRunning = false;
    enrichmentState.stage = 'idle';
    addLog('Enrichment stopped by user');
    return { status: 'stopped', state: enrichmentState };
  }),
  
  // Get current status
  status: publicQuery.query(async () => {
    const db = getDb();
    
    // Get current DB stats
    const [total, withHospital, withSpecialty, withAddress, avgQuality] = await Promise.all([
      db.select({ count: sql`COUNT(*)` }).from(contacts),
      db.select({ count: sql`COUNT(*)` }).from(contacts).where(and(isNotNull(contacts.hospital), sql`${contacts.hospital} != ''`)),
      db.select({ count: sql`COUNT(*)` }).from(contacts).where(and(isNotNull(contacts.specialty), sql`${contacts.specialty} != ''`)),
      db.select({ count: sql`COUNT(*)` }).from(contacts).where(and(isNotNull(contacts.address), sql`${contacts.address} != ''`)),
      db.select({ avg: sql`AVG(quality_score)` }).from(contacts),
    ]);
    
    return {
      running: enrichmentState.isRunning,
      state: {
        ...enrichmentState,
        recentLogs: enrichmentState.recentLogs.slice(0, 20),
      },
      dbStats: {
        total: Number(total[0].count),
        withHospital: Number(withHospital[0].count),
        withSpecialty: Number(withSpecialty[0].count),
        withAddress: Number(withAddress[0].count),
        avgQuality: Math.round(Number(avgQuality[0].avg) || 0),
        hospitalPercent: Number(total[0].count) > 0 ? (Number(withHospital[0].count) / Number(total[0].count) * 100).toFixed(1) : '0',
        specialtyPercent: Number(total[0].count) > 0 ? (Number(withSpecialty[0].count) / Number(total[0].count) * 100).toFixed(1) : '0',
      },
    };
  }),
  
  // Run single batch manually
  runBatch: publicQuery
    .input(z.object({
      batchSize: z.number().min(1).max(500).default(100),
      startId: z.number().default(0),
    }).optional())
    .mutation(async ({ input }) => {
      const db = getDb();
      const result = await processSingleBatch(db, input?.batchSize || 100, input?.startId || 0);
      return result;
    }),
});

// ==========================================
// BACKGROUND BATCH PROCESSOR
// ==========================================

async function processBatches(db: any, batchSize: number, stages: string[]) {
  let currentId = 0;
  
  while (enrichmentState.isRunning && currentId < enrichmentState.maxId) {
    const endId = currentId + batchSize;
    
    try {
      enrichmentState.currentBatch++;
      enrichmentState.lastContactId = currentId;
      
      // Process this batch
      const result = await processSingleBatch(db, batchSize, currentId);
      
      enrichmentState.totalProcessed += result.processed;
      enrichmentState.totalUpdated += result.updated;
      
      if (result.updated > 0) {
        addLog(`Batch ${enrichmentState.currentBatch}: Processed ${result.processed}, Updated ${result.updated}`);
      }
      
      currentId = endId;
      
      // Small delay between batches to not overwhelm the DB
      await sleep(1000);
      
    } catch (err: any) {
      addLog(`Batch ${enrichmentState.currentBatch} error: ${err.message?.slice(0, 100)}`);
      await sleep(5000); // Wait longer on error
      currentId = endId; // Skip to next batch
    }
  }
  
  enrichmentState.isRunning = false;
  enrichmentState.stage = 'done';
  addLog(`Enrichment complete! Total processed: ${enrichmentState.totalProcessed}, Updated: ${enrichmentState.totalUpdated}`);
}

async function processSingleBatch(db: any, batchSize: number, startId: number) {
  let updated = 0;
  
  // Get batch of contacts
  const rows = await db.select().from(contacts)
    .where(sql`${contacts.id} > ${startId}`)
    .orderBy(contacts.id)
    .limit(batchSize);
  
  if (rows.length === 0) return { processed: 0, updated: 0 };
  
  for (const contact of rows) {
    const updates: any = {};
    let changed = false;
    
    // STAGE 1: Pattern enrichment - extract hospital from name
    if (!contact.hospital || contact.hospital === '') {
      const extractedHospital = extractHospitalFromName(contact.name);
      if (extractedHospital && extractedHospital !== contact.name) {
        updates.hospital = extractedHospital;
        changed = true;
      }
    }
    
    // STAGE 2: Infer specialty from name/hospital
    if (!contact.specialty || contact.specialty === '') {
      const inferredSpecialty = inferSpecialtyFromName(contact.name, contact.hospital || updates.hospital);
      if (inferredSpecialty) {
        updates.specialty = inferredSpecialty;
        changed = true;
      }
    }
    
    // STAGE 3: Classify type from name
    const inferredType = classifyTypeFromName(contact.name);
    if (inferredType && inferredType !== contact.type) {
      // Only update if current type is default 'doctor'
      if (contact.type === 'doctor' || !contact.type) {
        updates.type = inferredType;
        changed = true;
      }
    }
    
    // STAGE 4: Recalculate quality score
    const newQuality = calculateQuality({ ...contact, ...updates });
    if (newQuality !== contact.qualityScore) {
      updates.qualityScore = newQuality;
      changed = true;
    }
    
    // Apply updates if anything changed
    if (changed) {
      await db.update(contacts).set(updates).where(eq(contacts.id, contact.id));
      updated++;
    }
  }
  
  return { processed: rows.length, updated };
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
