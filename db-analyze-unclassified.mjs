// Analyze what data unclassified contacts actually have
import mysql from 'mysql2/promise';

const DB_URL = 'mysql://4CtfDUMzvSsZL7c.root:41ZOclbIOnTLB8tF@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/test?ssl={"rejectUnauthorized":true}';

async function main() {
  const conn = await mysql.createConnection(DB_URL);
  
  try {
    console.log('=== ANALYZING UNCLASSIFIED CONTACTS ===\n');
    
    // 1. What % have hospital data?
    const [withHosp] = await conn.execute(
      "SELECT COUNT(*) as c FROM contacts WHERE (division IS NULL OR division = 'unknown' OR division = '') AND hospital IS NOT NULL AND hospital != ''"
    );
    console.log(`Unclassified with hospital: ${withHosp[0].c.toLocaleString()}`);
    
    // 2. What % have specialty data?
    const [withSpec] = await conn.execute(
      "SELECT COUNT(*) as c FROM contacts WHERE (division IS NULL OR division = 'unknown' OR division = '') AND specialty IS NOT NULL AND specialty != ''"
    );
    console.log(`Unclassified with specialty: ${withSpec[0].c.toLocaleString()}`);
    
    // 3. What % have neither?
    const [neither] = await conn.execute(
      "SELECT COUNT(*) as c FROM contacts WHERE (division IS NULL OR division = 'unknown' OR division = '') AND (hospital IS NULL OR hospital = '') AND (specialty IS NULL OR specialty = '')"
    );
    console.log(`Unclassified with NEITHER: ${neither[0].c.toLocaleString()}`);
    
    // 4. Name pattern analysis - Dr vs non-Dr
    const [drNames] = await conn.execute(
      "SELECT COUNT(*) as c FROM contacts WHERE (division IS NULL OR division = 'unknown' OR division = '') AND (name LIKE 'Dr %' OR name LIKE '%Dr.%')"
    );
    console.log(`\nUnclassified with 'Dr' prefix: ${drNames[0].c.toLocaleString()}`);
    
    const [nonDr] = await conn.execute(
      "SELECT COUNT(*) as c FROM contacts WHERE (division IS NULL OR division = 'unknown' OR division = '') AND name NOT LIKE 'Dr %' AND name NOT LIKE '%Dr.%'"
    );
    console.log(`Unclassified WITHOUT 'Dr': ${nonDr[0].c.toLocaleString()}`);
    
    // 5. Sample Dr contacts - what do they look like?
    console.log('\n=== SAMPLE Dr CONTACTS (unclassified) ===');
    const [drSamples] = await conn.execute(
      "SELECT id, name, specialty, hospital FROM contacts WHERE (division IS NULL OR division = 'unknown' OR division = '') AND (name LIKE 'Dr %' OR name LIKE '%Dr.%') LIMIT 15"
    );
    for (const s of drSamples) {
      console.log(`  #${s.id}: "${s.name}" | spec:"${s.specialty || 'NULL'}" | hosp:"${s.hospital || 'NULL'}"`);
    }
    
    // 6. Sample non-Dr contacts
    console.log('\n=== SAMPLE NON-Dr CONTACTS (unclassified) ===');
    const [nonDrSamples] = await conn.execute(
      "SELECT id, name, specialty, hospital FROM contacts WHERE (division IS NULL OR division = 'unknown' OR division = '') AND name NOT LIKE 'Dr %' AND name NOT LIKE '%Dr.%' LIMIT 15"
    );
    for (const s of nonDrSamples) {
      console.log(`  #${s.id}: "${s.name}" | spec:"${s.specialty || 'NULL'}" | hosp:"${s.hospital || 'NULL'}"`);
    }
    
    // 7. What specialties exist among classified contacts?
    console.log('\n=== TOP SPECIALTIES AMONG CLASSIFIED ===');
    const [topSpecs] = await conn.execute(
      "SELECT specialty, COUNT(*) as c FROM contacts WHERE division IS NOT NULL AND division != 'unknown' AND division != '' AND specialty IS NOT NULL AND specialty != '' GROUP BY specialty ORDER BY c DESC LIMIT 20"
    );
    for (const s of topSpecs) {
      console.log(`  ${s.specialty}: ${s.c.toLocaleString()}`);
    }
    
    // 8. Check if name field contains hospital/clinic info
    const [nameHasHosp] = await conn.execute(
      "SELECT COUNT(*) as c FROM contacts WHERE (division IS NULL OR division = 'unknown' OR division = '') AND (name LIKE '%Hospital%' OR name LIKE '%Clinic%' OR name LIKE '%Centre%')"
    );
    console.log(`\nUnclassified with Hospital/Clinic/Centre in NAME: ${nameHasHosp[0].c.toLocaleString()}`);
    
  } finally {
    await conn.end();
  }
}

main().catch(e => console.error(e.message));
