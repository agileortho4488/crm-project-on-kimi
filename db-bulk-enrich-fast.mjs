// FAST bulk enrichment using SQL UPDATE with CASE statements
// Processes ALL contacts in a single query per field
import mysql from 'mysql2/promise';

const DB_URL = 'mysql://4CtfDUMzvSsZL7c.root:41ZOclbIOnTLB8tF@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/test?ssl={"rejectUnauthorized":true}';

async function main() {
  const conn = await mysql.createConnection(DB_URL);
  console.log('Connected to TiDB');
  
  try {
    // ============================================================
    // STEP 1: Classify TYPE (doctor/hospital/clinic/distributor/corporate)
    // Based on name patterns
    // ============================================================
    console.log('\n=== STEP 1: Classifying TYPE ===');
    
    // Hospital type
    const [hospitalRes] = await conn.execute(`
      UPDATE contacts 
      SET type = 'hospital' 
      WHERE type = 'doctor' 
        AND (name LIKE '%Hospital%' OR name LIKE '%Hospitals%' OR name LIKE '%Medical College%' 
             OR name LIKE '%Institute%' OR name LIKE '%Medical Centre%' OR name LIKE '%Health Centre%'
             OR name LIKE '%Cancer Centre%' OR name LIKE '%Care Centre%' OR name LIKE '%Care Center%'
             OR name LIKE '%Nursing Home%' OR name LIKE '%Health Care%')
        AND name NOT LIKE 'Dr %' AND name NOT LIKE '%Dr.%' AND name NOT LIKE '%Doctor%'
    `);
    console.log(`  Hospital type: ${hospitalRes.affectedRows.toLocaleString()} updated`);
    
    // Clinic type
    const [clinicRes] = await conn.execute(`
      UPDATE contacts 
      SET type = 'clinic' 
      WHERE type = 'doctor' 
        AND (name LIKE '%Clinic%' OR name LIKE '%Clinics%' OR name LIKE '%Diagnostic Centre%'
             OR name LIKE '%Scan Centre%' OR name LIKE '%Imaging Centre%' OR name LIKE '%Path Lab%')
        AND name NOT LIKE 'Dr %' AND name NOT LIKE '%Dr.%'
    `);
    console.log(`  Clinic type: ${clinicRes.affectedRows.toLocaleString()} updated`);
    
    // Distributor type
    const [distRes] = await conn.execute(`
      UPDATE contacts 
      SET type = 'distributor' 
      WHERE type = 'doctor' 
        AND (name LIKE '%Distributor%' OR name LIKE '%Distributors%' OR name LIKE '%Supplier%'
             OR name LIKE '%Dealer%' OR name LIKE '%Traders%' OR name LIKE '%Surgicals%'
             OR name LIKE '%Medicals%' OR name LIKE '%Pharma%')
    `);
    console.log(`  Distributor type: ${distRes.affectedRows.toLocaleString()} updated`);
    
    // Corporate type
    const [corpRes] = await conn.execute(`
      UPDATE contacts 
      SET type = 'corporate' 
      WHERE type = 'doctor' 
        AND (name LIKE '%Pvt Ltd%' OR name LIKE '%Private Limited%' OR name LIKE '% Ltd%'
             OR name LIKE '%Limited%' OR name LIKE '%Corporation%' OR name LIKE '%Company%'
             OR name LIKE '%Healthcare%' OR name LIKE '%Health Care%')
        AND name NOT LIKE 'Dr %' AND name NOT LIKE '%Dr.%'
    `);
    console.log(`  Corporate type: ${corpRes.affectedRows.toLocaleString()} updated`);
    
    // ============================================================
    // STEP 2: Classify DIVISION using CASE statement
    // ============================================================
    console.log('\n=== STEP 2: Classifying DIVISION ===');
    
    // Gynecology
    const [gynRes] = await conn.execute(`
      UPDATE contacts 
      SET division = 'gynecology' 
      WHERE division IS NULL OR division = 'unknown' OR division = ''
        AND (
          specialty LIKE '%obg%' OR specialty LIKE '%obstetric%' OR specialty LIKE '%gynecolog%'
          OR specialty LIKE '%gynaecolog%' OR specialty LIKE '%maternity%' OR specialty LIKE '%women%'
          OR specialty LIKE '%pregnancy%' OR specialty LIKE '%infertility%' OR specialty LIKE '%ivf%'
          OR specialty LIKE '%delivery%' OR specialty LIKE '%gynic%'
          OR name LIKE '%Maternity%' OR name LIKE '%Women Care%' OR name LIKE '%Mother Care%'
          OR name LIKE '%Baby Care%' OR name LIKE '%Gynic%'
          OR hospital LIKE '%Maternity%' OR hospital LIKE '%Women%'
        )
    `);
    console.log(`  Gynecology: ${gynRes.affectedRows.toLocaleString()}`);
    
    // Trauma & Fracture (Orthopedic)
    const [orthoRes] = await conn.execute(`
      UPDATE contacts 
      SET division = 'trauma_fracture' 
      WHERE division IS NULL OR division = 'unknown' OR division = ''
        AND (
          specialty LIKE '%orthopedic%' OR specialty LIKE '%orthopaedic%' OR specialty LIKE '%trauma%'
          OR specialty LIKE '%fracture%' OR specialty LIKE '%bone%' OR specialty LIKE '%joint%'
          OR specialty LIKE '%arthritis%' OR specialty LIKE '%arthroplasty%' OR specialty LIKE '%plating%'
          OR name LIKE '%Ortho%' OR name LIKE '%Orthopedic%' OR name LIKE '%Bone%'
          OR name LIKE '%Fracture%' OR name LIKE '%Joint%'
          OR hospital LIKE '%Ortho%' OR hospital LIKE '%Orthopedic%'
        )
    `);
    console.log(`  Trauma & Fracture: ${orthoRes.affectedRows.toLocaleString()}`);
    
    // Cardiovascular
    const [cardioRes] = await conn.execute(`
      UPDATE contacts 
      SET division = 'cardiovascular' 
      WHERE division IS NULL OR division = 'unknown' OR division = ''
        AND (
          specialty LIKE '%cardiolog%' OR specialty LIKE '%cardiothoracic%' OR specialty LIKE '%cardiac%'
          OR specialty LIKE '%heart%' OR specialty LIKE '%ctvs%' OR specialty LIKE '%angioplasty%'
          OR specialty LIKE '%stent%' OR specialty LIKE '%bypass%' OR specialty LIKE '%cabg%'
          OR specialty LIKE '%valve%'
          OR name LIKE '%Heart%' OR name LIKE '%Cardiac%' OR name LIKE '%Cardio%'
          OR hospital LIKE '%Heart%' OR hospital LIKE '%Cardiac%' OR hospital LIKE '%Cardiolog%'
          OR hospital LIKE '%Cath Lab%' OR hospital LIKE '%CVTS%'
        )
    `);
    console.log(`  Cardiovascular: ${cardioRes.affectedRows.toLocaleString()}`);
    
    // Neuro & Spine
    const [neuroRes] = await conn.execute(`
      UPDATE contacts 
      SET division = 'neuro_spine' 
      WHERE division IS NULL OR division = 'unknown' OR division = ''
        AND (
          specialty LIKE '%neurosurgery%' OR specialty LIKE '%neurosurgeon%' OR specialty LIKE '%neurologist%'
          OR specialty LIKE '%neurology%' OR specialty LIKE '%spine%' OR specialty LIKE '%brain%'
          OR specialty LIKE '%cranial%' OR specialty LIKE '%epilepsy%' OR specialty LIKE '%stroke%'
          OR name LIKE '%Neuro%' OR name LIKE '%Brain%' OR name LIKE '%Spine%'
          OR hospital LIKE '%Neuro%' OR hospital LIKE '%Brain%' OR hospital LIKE '%Spine%'
        )
    `);
    console.log(`  Neuro & Spine: ${neuroRes.affectedRows.toLocaleString()}`);
    
    // Endo-Surgery
    const [endoRes] = await conn.execute(`
      UPDATE contacts 
      SET division = 'endo_surgery' 
      WHERE division IS NULL OR division = 'unknown' OR division = ''
        AND (
          specialty LIKE '%laparoscop%' OR specialty LIKE '%laparoscopy%' OR specialty LIKE '%gi surgery%'
          OR specialty LIKE '%gastro surgeon%' OR specialty LIKE '%minimal access%' OR specialty LIKE '%endoscop%'
          OR specialty LIKE '%hernia%' OR specialty LIKE '%appendectomy%'
          OR name LIKE '%Laparoscop%' OR name LIKE '%Endoscop%'
          OR hospital LIKE '%Laparoscop%' OR hospital LIKE '%Endoscop%'
        )
    `);
    console.log(`  Endo-Surgery: ${endoRes.affectedRows.toLocaleString()}`);
    
    // Diagnostics
    const [diagRes] = await conn.execute(`
      UPDATE contacts 
      SET division = 'diagnostics' 
      WHERE division IS NULL OR division = 'unknown' OR division = ''
        AND (
          specialty LIKE '%pathology%' OR specialty LIKE '%radiology%' OR specialty LIKE '%diagnostic%'
          OR specialty LIKE '%lab%' OR specialty LIKE '%microbiology%' OR specialty LIKE '%biochemistry%'
          OR specialty LIKE '%imaging%' OR specialty LIKE '%xray%' OR specialty LIKE '%x-ray%'
          OR specialty LIKE '%ct scan%' OR specialty LIKE '%mri%' OR specialty LIKE '%ultrasound%'
          OR name LIKE '%Diagnostic%' OR name LIKE '%Path Lab%' OR name LIKE '%Scan Centre%'
          OR name LIKE '%Imaging%' OR name LIKE '%Radiology%'
          OR hospital LIKE '%Diagnostic%' OR hospital LIKE '%Lab%' OR hospital LIKE '%Imaging%'
          OR hospital LIKE '%Radiology%' OR hospital LIKE '%Patholog%'
        )
    `);
    console.log(`  Diagnostics: ${diagRes.affectedRows.toLocaleString()}`);
    
    // Consumables (general surgery / catch-all for remaining surgical contacts)
    const [consRes] = await conn.execute(`
      UPDATE contacts 
      SET division = 'consumables' 
      WHERE division IS NULL OR division = 'unknown' OR division = ''
        AND (
          specialty LIKE '%general surgeon%' OR specialty LIKE '%general surgery%'
          OR specialty LIKE '%nurse%' OR specialty LIKE '%ot technician%'
          OR specialty LIKE '%anesthesia%' OR specialty LIKE '%critical care%' OR specialty LIKE '%icu%'
          OR specialty LIKE '%emergency medicine%'
          OR name LIKE '%Surgical%' OR name LIKE '%Surgery%'
          OR hospital LIKE '%Surgical%' OR hospital LIKE '%Multi Speciality%'
          OR hospital LIKE '%Multispeciality%' OR hospital LIKE '%General Hospital%'
        )
    `);
    console.log(`  Consumables: ${consRes.affectedRows.toLocaleString()}`);
    
    // ============================================================
    // STEP 3: Recalculate Quality Scores
    // ============================================================
    console.log('\n=== STEP 3: Recalculating Quality Scores ===');
    
    const [qualityRes] = await conn.execute(`
      UPDATE contacts
      SET quality_score = LEAST(100, 
        (CASE WHEN name IS NOT NULL AND LENGTH(name) > 2 THEN 20 ELSE 0 END) +
        (CASE WHEN phone IS NOT NULL AND LENGTH(phone) >= 10 THEN 25 ELSE 0 END) +
        (CASE WHEN hospital IS NOT NULL AND LENGTH(hospital) > 2 THEN 15 ELSE 0 END) +
        (CASE WHEN district IS NOT NULL AND LENGTH(district) > 1 THEN 10 ELSE 0 END) +
        (CASE WHEN specialty IS NOT NULL AND LENGTH(specialty) > 1 THEN 10 ELSE 0 END) +
        (CASE WHEN email IS NOT NULL AND email LIKE '%@%' THEN 10 ELSE 0 END) +
        (CASE WHEN division IS NOT NULL AND division != 'unknown' AND division != '' THEN 5 ELSE 0 END) +
        (CASE WHEN designation IS NOT NULL AND LENGTH(designation) > 1 THEN 5 ELSE 0 END)
      )
    `);
    console.log(`  Quality scores recalculated: ${qualityRes.affectedRows.toLocaleString()}`);
    
    // ============================================================
    // STEP 4: Verify results
    // ============================================================
    console.log('\n=== VERIFICATION ===');
    
    const [total] = await conn.execute('SELECT COUNT(*) as c FROM contacts');
    console.log(`Total: ${total[0].c.toLocaleString()}`);
    
    const [withDiv] = await conn.execute("SELECT COUNT(*) as c FROM contacts WHERE division IS NOT NULL AND division != 'unknown' AND division != ''");
    console.log(`With Division: ${withDiv[0].c.toLocaleString()} (${(withDiv[0].c/total[0].c*100).toFixed(1)}%)`);
    
    const [docT] = await conn.execute("SELECT COUNT(*) as c FROM contacts WHERE type = 'doctor'");
    const [hospT] = await conn.execute("SELECT COUNT(*) as c FROM contacts WHERE type = 'hospital'");
    const [clinicT] = await conn.execute("SELECT COUNT(*) as c FROM contacts WHERE type = 'clinic'");
    const [distT] = await conn.execute("SELECT COUNT(*) as c FROM contacts WHERE type = 'distributor'");
    const [corpT] = await conn.execute("SELECT COUNT(*) as c FROM contacts WHERE type = 'corporate'");
    console.log(`Type breakdown: doctor=${docT[0].c.toLocaleString()}, hospital=${hospT[0].c.toLocaleString()}, clinic=${clinicT[0].c.toLocaleString()}, distributor=${distT[0].c.toLocaleString()}, corporate=${corpT[0].c.toLocaleString()}`);
    
    const [avgQ] = await conn.execute('SELECT AVG(quality_score) as avg FROM contacts');
    console.log(`Avg Quality: ${Math.round(avgQ[0].avg || 0)}`);
    
    console.log('\nDivision breakdown:');
    const [divs] = await conn.execute('SELECT division, COUNT(*) as c FROM contacts GROUP BY division ORDER BY c DESC');
    for (const d of divs) {
      console.log(`  ${d.division || 'NULL/empty'}: ${d.c.toLocaleString()}`);
    }
    
    // Still unclassified?
    const [stillNeed] = await conn.execute("SELECT COUNT(*) as c FROM contacts WHERE division IS NULL OR division = 'unknown' OR division = ''");
    console.log(`\nStill needing division: ${stillNeed[0].c.toLocaleString()} (${(stillNeed[0].c/total[0].c*100).toFixed(1)}%)`);
    
  } finally {
    await conn.end();
    console.log('\nDone!');
  }
}

main().catch(e => console.error('Error:', e.message));
