// Direct TiDB enrichment check and manual enrichment runner
import mysql from 'mysql2/promise';

const DB_URL = 'mysql://4CtfDUMzvSsZL7c.root:41ZOclbIOnTLB8tF@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/test?ssl={"rejectUnauthorized":true}';

// Division classification keywords
const DIVISION_KEYWORDS = {
  gynecology: {
    specialties: ["obg", "obstetric", "gynecolog", "gynaecolog", "maternity", "women", "delivery", "pregnancy", "infertility", "ivf"],
    hospitals: ["maternity", "women", "mother", "baby", "obg", "gynic"],
    patterns: ["devi", "lakshmi", "parvati", "saraswati", "kaur", "begum", "amma", "latha", "sujatha", "vijaya", "shakuntala", "sumathi", "baby", "kumari"],
  },
  trauma_fracture: {
    specialties: ["orthopedic", "orthopaedic", "trauma", "fracture", "sports medicine", "bone", "joint", "arthritis", "plating", "nailing"],
    hospitals: ["ortho", "trauma", "accident", "emergency", "bone", "fracture"],
    patterns: [],
  },
  cardiovascular: {
    specialties: ["cardiolog", "cardiothoracic", "ctvs", "cardiac", "heart", "angioplasty", "stent", "bypass", "cabg", "valve"],
    hospitals: ["heart", "cardiac", "cath lab", "cvts", "cardiolog"],
    patterns: ["heart", "cardiac", "hruday", "dil"],
  },
  neuro_spine: {
    specialties: ["neurosurgery", "neurosurgeon", "neurologist", "spine", "brain", "cranial", "cranio", "epilepsy", "stroke"],
    hospitals: ["neuro", "brain", "spine", "neurolog"],
    patterns: ["brain", "neuro", "nerve", "spine", "skull"],
  },
  endo_surgery: {
    specialties: ["laparoscopic", "laparoscopy", "gi surgery", "gastro surgeon", "minimal access", "mias", "endoscop", "hernia", "appendectomy"],
    hospitals: ["laparoscopy", "endoscopy", "gi", "gastro"],
    patterns: ["lapro", "minimal", "keyhole", "endo"],
  },
  diagnostics: {
    specialties: ["pathology", "radiology", "diagnostic", "lab", "microbiology", "biochemistry", "imaging", "xray", "x-ray", "ct scan", "mri", "ultrasound"],
    hospitals: ["diagnostic", "path lab", "imaging", "radiology", "scan centre", "lab"],
    patterns: [],
  },
  consumables: {
    specialties: ["general surgeon", "general surgery", "nurse", "ot technician", "anesthesia", "critical care", "icu", "emergency medicine"],
    hospitals: ["surgical", "multi specialty", "multispecialty", "general hospital"],
    patterns: [],
  },
};

// Specialty inference mappings
const SPECIALTY_MAPPINGS = [
  [["obg", "obstetric", "gynecolog", "gynaecolog", "maternity", "women care", "delivery"], "Obstetrics & Gynecology"],
  [["orthopedic", "orthopaedic", "trauma", "fracture", "bone", "joint replacement", "arthroplasty"], "Orthopedic Surgery"],
  [["cardiolog", "cardiothoracic", "cardiac", "heart", "ctvs"], "Cardiology"],
  [["neurosurgery", "neurosurgeon", "brain surgeon"], "Neurosurgery"],
  [["neurologist", "neurology", "epilepsy", "stroke"], "Neurology"],
  [["laparoscop", "gi surgery", "gastro surgeon", "minimal access"], "General Surgery"],
  [["pediatric", "paediatric", "child specialist", "children"], "Pediatrics"],
  [["urologist", "urology", "kidney", "nephrolog"], "Urology"],
  [["ent", "ear nose throat", "otorhinolaryngology"], "ENT"],
  [["ophthalmolog", "eye specialist", "eye surgeon"], "Ophthalmology"],
  [["dental", "dentist", "orthodontist"], "Dental Surgery"],
  [["dermatolog", "skin specialist"], "Dermatology"],
  [["pulmonolog", "chest", "lung", "tb", "respiratory"], "Pulmonology"],
  [["onco", "cancer"], "Oncology"],
  [["psychiatr", "psychologist", "mental health"], "Psychiatry"],
  [["diagnostic", "radiology", "pathology", "imaging", "xray", "x-ray", "ct scan", "mri"], "Radiology & Diagnostics"],
  [["anesthesia", "anaesthesia", "critical care", "icu"], "Anesthesiology & Critical Care"],
  [["plastic surgery", "cosmetic surgery"], "Plastic Surgery"],
  [["endocrinolog", "diabet"], "Endocrinology"],
  [["gastroenterolog", "gi"], "Gastroenterology"],
  [["nephrolog", "kidney", "dialysis"], "Nephrology"],
  [["rheumatolog"], "Rheumatology"],
  [["physiotherap", "physio", "rehab"], "Physiotherapy"],
  [["homeo", "homeopath"], "Homeopathy"],
  [["ayurveda", "ayurvedic"], "Ayurveda"],
  [["general surgeon"], "General Surgery"],
  [["general physician", "internal medicine", "medicine"], "General Medicine"],
];

function classifyDivision(name, hospital, specialty, designation) {
  const text = `${specialty || ''} ${hospital || ''} ${name || ''} ${designation || ''}`.toLowerCase();
  const scores = {};
  
  for (const [division, keywords] of Object.entries(DIVISION_KEYWORDS)) {
    scores[division] = 0;
    for (const kw of keywords.specialties) {
      if (text.includes(kw)) scores[division] += 3;
    }
    for (const kw of keywords.hospitals) {
      if (text.includes(kw)) scores[division] += 2;
    }
    for (const kw of keywords.patterns) {
      if (text.includes(kw)) scores[division] += 2;
    }
  }
  
  let bestDivision = null;
  let bestScore = 0;
  for (const [div, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestDivision = div;
    }
  }
  
  return bestScore >= 2 ? bestDivision : null;
}

function classifyType(name, hospital, specialty) {
  const text = `${name || ''} ${hospital || ''} ${specialty || ''}`.toLowerCase();
  
  if (text.includes('hospital') || text.includes('medical college') || text.includes('institute') || text.includes('medical centre') || text.includes('health centre')) {
    if (!text.includes('dr ') && !text.includes('dr.')) return 'hospital';
  }
  if (text.includes('clinic') || text.includes('nursing home') || text.includes('health center') || text.includes('care centre') || text.includes('diagnostic centre')) {
    if (!text.includes('dr ') && !text.includes('dr.')) return 'clinic';
  }
  if (text.includes('distributor') || text.includes('supplier') || text.includes('dealer') || text.includes('traders')) {
    return 'distributor';
  }
  if (text.includes('pvt ltd') || text.includes('private limited') || text.includes(' ltd') || text.includes('limited') || text.includes('corporation') || text.includes('company') || text.includes('healthcare') || text.includes('pharma') || text.includes('surgical') || text.includes('medicals')) {
    if (!text.includes('dr ') && !text.includes('dr.')) return 'corporate';
  }
  return null;
}

function inferSpecialty(name, hospital, designation) {
  const text = `${name || ''} ${hospital || ''} ${designation || ''}`.toLowerCase();
  
  for (const [keywords, specialty] of SPECIALTY_MAPPINGS) {
    for (const kw of keywords) {
      if (text.includes(kw)) return specialty;
    }
  }
  return null;
}

function calculateQuality(contact) {
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

async function main() {
  console.log('Connecting to TiDB...');
  const conn = await mysql.createConnection(DB_URL);
  console.log('Connected!');

  try {
    // 1. Check current enrichment status
    console.log('\n=== CURRENT ENRICHMENT STATUS ===');
    
    const [total] = await conn.execute('SELECT COUNT(*) as c FROM contacts');
    console.log(`Total contacts: ${total[0].c.toLocaleString()}`);
    
    const [withDivision] = await conn.execute("SELECT COUNT(*) as c FROM contacts WHERE division IS NOT NULL AND division != 'unknown' AND division != ''");
    console.log(`With Division: ${withDivision[0].c.toLocaleString()} (${Math.round(withDivision[0].c/total[0].c*100)}%)`);
    
    const [withSpecialty] = await conn.execute("SELECT COUNT(*) as c FROM contacts WHERE specialty IS NOT NULL AND specialty != ''");
    console.log(`With Specialty: ${withSpecialty[0].c.toLocaleString()} (${Math.round(withSpecialty[0].c/total[0].c*100)}%)`);
    
    const [doctorTypes] = await conn.execute("SELECT COUNT(*) as c FROM contacts WHERE type = 'doctor'");
    console.log(`Type=doctor: ${doctorTypes[0].c.toLocaleString()} (${Math.round(doctorTypes[0].c/total[0].c*100)}%)`);
    
    const [hospitalTypes] = await conn.execute("SELECT COUNT(*) as c FROM contacts WHERE type = 'hospital'");
    console.log(`Type=hospital: ${hospitalTypes[0].c.toLocaleString()}`);
    
    const [clinicTypes] = await conn.execute("SELECT COUNT(*) as c FROM contacts WHERE type = 'clinic'");
    console.log(`Type=clinic: ${clinicTypes[0].c.toLocaleString()}`);
    
    const [distributorTypes] = await conn.execute("SELECT COUNT(*) as c FROM contacts WHERE type = 'distributor'");
    console.log(`Type=distributor: ${distributorTypes[0].c.toLocaleString()}`);
    
    const [corporateTypes] = await conn.execute("SELECT COUNT(*) as c FROM contacts WHERE type = 'corporate'");
    console.log(`Type=corporate: ${corporateTypes[0].c.toLocaleString()}`);
    
    const [avgQuality] = await conn.execute('SELECT AVG(quality_score) as avg FROM contacts');
    console.log(`Avg Quality Score: ${Math.round(avgQuality[0].avg || 0)}`);
    
    // Division breakdown
    console.log('\n=== DIVISION BREAKDOWN ===');
    const [divisions] = await conn.execute('SELECT division, COUNT(*) as c FROM contacts GROUP BY division ORDER BY c DESC');
    for (const d of divisions) {
      const pct = Math.round(d.c / total[0].c * 100);
      console.log(`  ${d.division || 'NULL'}: ${d.c.toLocaleString()} (${pct}%)`);
    }
    
    // 2. Get sample contacts with no division to check
    console.log('\n=== SAMPLE UNCLASSIFIED CONTACTS ===');
    const [samples] = await conn.execute(
      "SELECT id, name, hospital, specialty, designation, type, division, quality_score FROM contacts WHERE division IS NULL OR division = 'unknown' OR division = '' LIMIT 10"
    );
    for (const s of samples) {
      const div = classifyDivision(s.name, s.hospital, s.specialty, s.designation);
      const spec = inferSpecialty(s.name, s.hospital, s.designation);
      const typ = classifyType(s.name, s.hospital, s.specialty);
      console.log(`  #${s.id}: "${s.name}" | hosp:"${s.hospital}" | spec:"${s.specialty}"`);
      console.log(`    → Division: ${div || 'unknown'} | Type: ${typ || s.type || 'doctor'} | Specialty: ${spec || 'unknown'}`);
    }
    
    // 3. MANUAL ENRICHMENT
    console.log('\n=== STARTING MANUAL BATCH ENRICHMENT ===');
    console.log('Fetching unenriched contacts...');
    
    const [unenriched] = await conn.execute(
      "SELECT id, name, hospital, specialty, designation, type, division, quality_score, phone, email, district FROM contacts WHERE division IS NULL OR division = 'unknown' OR division = '' OR specialty IS NULL OR specialty = '' OR quality_score = 0 OR quality_score = 55 LIMIT 10000"
    );
    
    console.log(`Found ${unenriched.length} contacts to enrich`);
    
    let updated = 0;
    let divisionCount = 0;
    let typeCount = 0;
    let specialtyCount = 0;
    let qualityCount = 0;
    
    for (let i = 0; i < unenriched.length; i++) {
      const contact = unenriched[i];
      const updates = {};
      
      // Classify division
      if (!contact.division || contact.division === 'unknown' || contact.division === '') {
        const division = classifyDivision(contact.name, contact.hospital, contact.specialty, contact.designation);
        if (division) {
          updates.division = division;
          divisionCount++;
        }
      }
      
      // Classify type
      const newType = classifyType(contact.name, contact.hospital, contact.specialty);
      if (newType && newType !== contact.type) {
        updates.type = newType;
        typeCount++;
      }
      
      // Infer specialty
      if (!contact.specialty || contact.specialty === '') {
        const specialty = inferSpecialty(contact.name, contact.hospital, contact.designation);
        if (specialty) {
          updates.specialty = specialty;
          specialtyCount++;
        }
      }
      
      // Recalculate quality
      const quality = calculateQuality({ ...contact, ...updates });
      if (quality !== contact.quality_score) {
        updates.quality_score = quality;
        qualityCount++;
      }
      
      if (Object.keys(updates).length > 0) {
        const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
        const values = [...Object.values(updates), contact.id];
        await conn.execute(`UPDATE contacts SET ${fields} WHERE id = ?`, values);
        updated++;
      }
      
      if ((i + 1) % 1000 === 0) {
        console.log(`  Processed ${i + 1}/${unenriched.length}... Updated: ${updated}`);
      }
    }
    
    console.log(`\n=== ENRICHMENT COMPLETE ===`);
    console.log(`Total processed: ${unenriched.length}`);
    console.log(`Updated: ${updated}`);
    console.log(`Division classified: ${divisionCount}`);
    console.log(`Type reclassified: ${typeCount}`);
    console.log(`Specialty inferred: ${specialtyCount}`);
    console.log(`Quality recalculated: ${qualityCount}`);
    
    // 4. Verify results
    console.log('\n=== VERIFICATION ===');
    const [afterDiv] = await conn.execute("SELECT COUNT(*) as c FROM contacts WHERE division IS NOT NULL AND division != 'unknown' AND division != ''");
    console.log(`With Division (after): ${afterDiv[0].c.toLocaleString()} (${Math.round(afterDiv[0].c/total[0].c*100)}%)`);
    
    const [afterSpec] = await conn.execute("SELECT COUNT(*) as c FROM contacts WHERE specialty IS NOT NULL AND specialty != ''");
    console.log(`With Specialty (after): ${afterSpec[0].c.toLocaleString()} (${Math.round(afterSpec[0].c/total[0].c*100)}%)`);
    
    const [afterAvgQ] = await conn.execute('SELECT AVG(quality_score) as avg FROM contacts');
    console.log(`Avg Quality (after): ${Math.round(afterAvgQ[0].avg || 0)}`);
    
    // New division breakdown
    console.log('\n=== NEW DIVISION BREAKDOWN ===');
    const [newDivisions] = await conn.execute('SELECT division, COUNT(*) as c FROM contacts GROUP BY division ORDER BY c DESC LIMIT 10');
    for (const d of newDivisions) {
      console.log(`  ${d.division || 'NULL'}: ${d.c.toLocaleString()}`);
    }
    
    // Sample enriched contacts
    console.log('\n=== SAMPLE ENRICHED CONTACTS ===');
    const [enriched] = await conn.execute(
      "SELECT id, name, hospital, specialty, division, type, quality_score FROM contacts WHERE division IS NOT NULL AND division != 'unknown' AND division != '' ORDER BY id DESC LIMIT 10"
    );
    for (const e of enriched) {
      console.log(`  #${e.id}: "${e.name}" | Division: ${e.division} | Type: ${e.type} | Specialty: ${e.specialty} | Quality: ${e.quality_score}`);
    }
    
  } finally {
    await conn.end();
    console.log('\nDisconnected from TiDB.');
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
