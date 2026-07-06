// Targeted enrichment - only process contacts that actually have enrichment signals
import mysql from 'mysql2/promise';

const DB_URL = 'mysql://4CtfDUMzvSsZL7c.root:41ZOclbIOnTLB8tF@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/test?ssl={"rejectUnauthorized":true}';

// Direct mapping: which keywords → which division
const KEYWORD_DIVISIONS = [
  // Gynecology
  ['%obg%', '%gynecolog%', '%gynaecolog%', '%maternity%', '%women%', '%pregnancy%', '%infertility%', '%ivf%', '%delivery%'],
  // Trauma & Fracture
  ['%orthopedic%', '%orthopaedic%', '%trauma%', '%fracture%', '%bone%', '%joint%', '%arthroplasty%', '%arthritis%'],
  // Cardiovascular
  ['%cardiolog%', '%cardiothoracic%', '%cardiac%', '%heart%', '%ctvs%', '%angioplasty%', '%stent%'],
  // Neuro & Spine
  ['%neurosurgery%', '%neurosurgeon%', '%neurologist%', '%neurology%', '%spine%', '%brain%', '%cranial%', '%epilepsy%'],
  // Endo-Surgery
  ['%laparoscop%', '%laparoscopy%', '%gi surgery%', '%endoscop%', '%hernia%'],
  // Diagnostics
  ['%pathology%', '%radiology%', '%diagnostic%', '%xray%', '%x-ray%', '%ct scan%', '%mri%', '%ultrasound%', '%imaging%'],
  // Consumables
  ['%general surgeon%', '%general surgery%', '%anesthesia%', '%critical care%', '%icu%'],
];

const DIVISION_NAMES = ['gynecology', 'trauma_fracture', 'cardiovascular', 'neuro_spine', 'endo_surgery', 'diagnostics', 'consumables'];

async function main() {
  const conn = await mysql.createConnection(DB_URL);
  console.log('Connected to TiDB');
  
  try {
    // Get total
    const [totalRow] = await conn.execute('SELECT COUNT(*) as c FROM contacts');
    const total = totalRow[0].c;
    
    // Check current state
    const [withDiv] = await conn.execute("SELECT COUNT(*) as c FROM contacts WHERE division IS NOT NULL AND division != 'unknown' AND division != ''");
    console.log(`Total: ${total.toLocaleString()}, With division: ${withDiv[0].c.toLocaleString()} (${(withDiv[0].c/total*100).toFixed(1)}%)`);
    
    let totalUpdated = 0;
    
    // Process each division with targeted specialty keywords
    for (let i = 0; i < KEYWORD_DIVISIONS.length; i++) {
      const division = DIVISION_NAMES[i];
      const keywords = KEYWORD_DIVISIONS[i];
      console.log(`\n--- Processing: ${division} ---`);
      
      for (const keyword of keywords) {
        try {
          const [result] = await conn.execute(
            `UPDATE contacts 
             SET division = ? 
             WHERE (division IS NULL OR division = 'unknown' OR division = '') 
               AND specialty LIKE ?
             LIMIT 50000`,
            [division, keyword]
          );
          if (result.affectedRows > 0) {
            console.log(`  ${keyword}: ${result.affectedRows.toLocaleString()}`);
            totalUpdated += result.affectedRows;
          }
        } catch (e) {
          console.log(`  ${keyword}: error - ${e.message.slice(0, 100)}`);
        }
      }
    }
    
    // Now process by hospital name patterns
    console.log('\n--- Processing by hospital name ---');
    
    const hospitalMappings = [
      ['%Maternity%', '%Women Care%', '%Mother Care%', '%Baby Care%', '%Gynic%'], 'gynecology',
      ['%Ortho%', '%Orthopedic%', '%Bone%', '%Fracture%'], 'trauma_fracture',
      ['%Heart%', '%Cardiac%', '%Cardio%', '%Cath Lab%'], 'cardiovascular',
      ['%Neuro%', '%Brain%', '%Spine%'], 'neuro_spine',
      ['%Diagnostic%', '%Path Lab%', '%Scan Centre%', '%Imaging%', '%Radiology%'], 'diagnostics',
      ['%Surgical%', '%Surgery%'], 'consumables',
    ];
    
    for (let i = 0; i < hospitalMappings.length; i += 2) {
      const keywords = hospitalMappings[i];
      const division = hospitalMappings[i + 1];
      
      for (const keyword of keywords) {
        try {
          const [result] = await conn.execute(
            `UPDATE contacts 
             SET division = ? 
             WHERE (division IS NULL OR division = 'unknown' OR division = '') 
               AND (name LIKE ? OR hospital LIKE ?)
             LIMIT 50000`,
            [division, keyword, keyword]
          );
          if (result.affectedRows > 0) {
            console.log(`  ${keyword} → ${division}: ${result.affectedRows.toLocaleString()}`);
            totalUpdated += result.affectedRows;
          }
        } catch (e) {
          console.log(`  ${keyword}: error`);
        }
      }
    }
    
    // Classify TYPE (hospital/clinic)
    console.log('\n--- Classifying TYPE ---');
    
    const typeMappings = [
      [`name LIKE '%Hospital%' AND name NOT LIKE 'Dr %' AND name NOT LIKE '%Dr.%'`, 'hospital'],
      [`name LIKE '%Hospitals%' AND name NOT LIKE 'Dr %' AND name NOT LIKE '%Dr.%'`, 'hospital'],
      [`name LIKE '%Clinic%' AND name NOT LIKE 'Dr %' AND name NOT LIKE '%Dr.%'`, 'clinic'],
      [`name LIKE '%Clinics%' AND name NOT LIKE 'Dr %' AND name NOT LIKE '%Dr.%'`, 'clinic'],
      [`name LIKE '%Diagnostic Centre%'`, 'clinic'],
      [`name LIKE '%Scan Centre%'`, 'clinic'],
      [`name LIKE '%Distributor%'`, 'distributor'],
      [`name LIKE '%Pvt Ltd%' AND name NOT LIKE 'Dr %'`, 'corporate'],
    ];
    
    for (const [condition, type] of typeMappings) {
      try {
        const [result] = await conn.execute(
          `UPDATE contacts SET type = ? WHERE type = 'doctor' AND ${condition} LIMIT 50000`,
          [type]
        );
        if (result.affectedRows > 0) {
          console.log(`  ${type}: ${result.affectedRows.toLocaleString()}`);
        }
      } catch (e) {
        console.log(`  ${type}: error - ${e.message.slice(0, 80)}`);
      }
    }
    
    // Recalculate quality
    console.log('\n--- Recalculating Quality ---');
    try {
      const [qResult] = await conn.execute(`
        UPDATE contacts
        SET quality_score = LEAST(100, 
          IF(name IS NOT NULL AND LENGTH(name) > 2, 20, 0) +
          IF(phone IS NOT NULL AND LENGTH(phone) >= 10, 25, 0) +
          IF(hospital IS NOT NULL AND LENGTH(hospital) > 2, 15, 0) +
          IF(district IS NOT NULL AND LENGTH(district) > 1, 10, 0) +
          IF(specialty IS NOT NULL AND LENGTH(specialty) > 1, 10, 0) +
          IF(email IS NOT NULL AND email LIKE '%@%', 10, 0) +
          IF(division IS NOT NULL AND division != 'unknown' AND division != '', 5, 0) +
          IF(designation IS NOT NULL AND LENGTH(designation) > 1, 5, 0)
        )
        WHERE quality_score = 55 OR quality_score = 0
        LIMIT 200000
      `);
      console.log(`  Quality recalculated: ${qResult.affectedRows.toLocaleString()}`);
    } catch (e) {
      console.log(`  Quality error: ${e.message.slice(0, 100)}`);
    }
    
    // Final check
    console.log('\n=== FINAL RESULTS ===');
    const [withDivF] = await conn.execute("SELECT COUNT(*) as c FROM contacts WHERE division IS NOT NULL AND division != 'unknown' AND division != ''");
    console.log(`With Division: ${withDivF[0].c.toLocaleString()} (${(withDivF[0].c/total*100).toFixed(1)}%)`);
    
    const [divs] = await conn.execute('SELECT division, COUNT(*) as c FROM contacts WHERE division IS NOT NULL AND division != "" GROUP BY division ORDER BY c DESC');
    for (const d of divs) {
      console.log(`  ${d.division}: ${d.c.toLocaleString()}`);
    }
    
    const [still] = await conn.execute("SELECT COUNT(*) as c FROM contacts WHERE division IS NULL OR division = 'unknown' OR division = ''");
    console.log(`\nStill unclassified: ${still[0].c.toLocaleString()} (${(still[0].c/total*100).toFixed(1)}%)`);
    console.log(`Total updated this run: ${totalUpdated.toLocaleString()}`);
    
  } finally {
    await conn.end();
    console.log('\nDone!');
  }
}

main().catch(e => console.error('Error:', e.message));
