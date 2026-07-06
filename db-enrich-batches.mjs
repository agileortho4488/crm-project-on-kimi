// Batch enrichment in small chunks to avoid TiDB memory limits
import mysql from 'mysql2/promise';

const DB_URL = 'mysql://4CtfDUMzvSsZL7c.root:41ZOclbIOnTLB8tF@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/test?ssl={"rejectUnauthorized":true}';

async function main() {
  const conn = await mysql.createConnection(DB_URL);
  console.log('Connected to TiDB');

  try {
    // Get total count and max ID
    const [totalRow] = await conn.execute('SELECT COUNT(*) as c, MAX(id) as maxId FROM contacts');
    const total = totalRow[0].c;
    const maxId = totalRow[0].maxId;
    console.log(`Total contacts: ${total.toLocaleString()}, Max ID: ${maxId}`);

    // Process in ID ranges of 100,000
    const BATCH_SIZE = 100000;
    let overallUpdated = 0;

    for (let startId = 1; startId <= maxId; startId += BATCH_SIZE) {
      const endId = startId + BATCH_SIZE - 1;
      console.log(`\n--- Processing IDs ${startId} to ${endId} ---`);

      // Gynecology
      const [gyn] = await conn.execute(`
        UPDATE contacts 
        SET division = 'gynecology' 
        WHERE id BETWEEN ? AND ?
          AND (division IS NULL OR division = 'unknown' OR division = '')
          AND (
            specialty LIKE '%obg%' OR specialty LIKE '%gynecolog%' OR specialty LIKE '%gynaecolog%'
            OR specialty LIKE '%maternity%' OR specialty LIKE '%women%' OR specialty LIKE '%pregnancy%'
            OR specialty LIKE '%infertility%' OR specialty LIKE '%ivf%'
            OR name LIKE '%Maternity%' OR name LIKE '%Women Care%' OR name LIKE '%Gynic%'
          )
      `, [startId, endId]);
      if (gyn.affectedRows > 0) console.log(`  Gynecology: ${gyn.affectedRows}`);

      // Trauma & Fracture
      const [ortho] = await conn.execute(`
        UPDATE contacts 
        SET division = 'trauma_fracture' 
        WHERE id BETWEEN ? AND ?
          AND (division IS NULL OR division = 'unknown' OR division = '')
          AND (
            specialty LIKE '%orthopedic%' OR specialty LIKE '%orthopaedic%' OR specialty LIKE '%trauma%'
            OR specialty LIKE '%fracture%' OR specialty LIKE '%bone%' OR specialty LIKE '%joint%'
            OR specialty LIKE '%arthroplasty%' OR specialty LIKE '%arthritis%'
            OR name LIKE '%Ortho%' OR name LIKE '%Orthopedic%' OR name LIKE '%Bone%'
          )
      `, [startId, endId]);
      if (ortho.affectedRows > 0) console.log(`  Trauma/Ortho: ${ortho.affectedRows}`);

      // Cardiovascular
      const [cardio] = await conn.execute(`
        UPDATE contacts 
        SET division = 'cardiovascular' 
        WHERE id BETWEEN ? AND ?
          AND (division IS NULL OR division = 'unknown' OR division = '')
          AND (
            specialty LIKE '%cardiolog%' OR specialty LIKE '%cardiothoracic%' OR specialty LIKE '%cardiac%'
            OR specialty LIKE '%heart%' OR specialty LIKE '%ctvs%' OR specialty LIKE '%angioplasty%'
            OR specialty LIKE '%stent%' OR specialty LIKE '%bypass%'
            OR name LIKE '%Heart%' OR name LIKE '%Cardiac%' OR name LIKE '%Cardio%'
          )
      `, [startId, endId]);
      if (cardio.affectedRows > 0) console.log(`  Cardiovascular: ${cardio.affectedRows}`);

      // Neuro & Spine
      const [neuro] = await conn.execute(`
        UPDATE contacts 
        SET division = 'neuro_spine' 
        WHERE id BETWEEN ? AND ?
          AND (division IS NULL OR division = 'unknown' OR division = '')
          AND (
            specialty LIKE '%neurosurgery%' OR specialty LIKE '%neurosurgeon%' OR specialty LIKE '%neurologist%'
            OR specialty LIKE '%neurology%' OR specialty LIKE '%spine%' OR specialty LIKE '%brain%'
            OR specialty LIKE '%cranial%' OR specialty LIKE '%epilepsy%' OR specialty LIKE '%stroke%'
            OR name LIKE '%Neuro%' OR name LIKE '%Brain%' OR name LIKE '%Spine%'
          )
      `, [startId, endId]);
      if (neuro.affectedRows > 0) console.log(`  Neuro/Spine: ${neuro.affectedRows}`);

      // Endo-Surgery
      const [endo] = await conn.execute(`
        UPDATE contacts 
        SET division = 'endo_surgery' 
        WHERE id BETWEEN ? AND ?
          AND (division IS NULL OR division = 'unknown' OR division = '')
          AND (
            specialty LIKE '%laparoscop%' OR specialty LIKE '%laparoscopy%' OR specialty LIKE '%gi surgery%'
            OR specialty LIKE '%gastro surgeon%' OR specialty LIKE '%minimal access%' OR specialty LIKE '%endoscop%'
            OR specialty LIKE '%hernia%' OR specialty LIKE '%appendectomy%'
          )
      `, [startId, endId]);
      if (endo.affectedRows > 0) console.log(`  Endo-Surgery: ${endo.affectedRows}`);

      // Diagnostics
      const [diag] = await conn.execute(`
        UPDATE contacts 
        SET division = 'diagnostics' 
        WHERE id BETWEEN ? AND ?
          AND (division IS NULL OR division = 'unknown' OR division = '')
          AND (
            specialty LIKE '%pathology%' OR specialty LIKE '%radiology%' OR specialty LIKE '%diagnostic%'
            OR specialty LIKE '%lab%' OR specialty LIKE '%microbiology%' OR specialty LIKE '%biochemistry%'
            OR specialty LIKE '%imaging%' OR specialty LIKE '%xray%' OR specialty LIKE '%x-ray%'
            OR specialty LIKE '%ct scan%' OR specialty LIKE '%mri%' OR specialty LIKE '%ultrasound%'
            OR name LIKE '%Diagnostic%' OR name LIKE '%Path Lab%' OR name LIKE '%Scan Centre%'
            OR name LIKE '%Imaging%' OR name LIKE '%Radiology%'
          )
      `, [startId, endId]);
      if (diag.affectedRows > 0) console.log(`  Diagnostics: ${diag.affectedRows}`);

      // Consumables (general surgery, catch-all)
      const [cons] = await conn.execute(`
        UPDATE contacts 
        SET division = 'consumables' 
        WHERE id BETWEEN ? AND ?
          AND (division IS NULL OR division = 'unknown' OR division = '')
          AND (
            specialty LIKE '%general surgeon%' OR specialty LIKE '%general surgery%'
            OR specialty LIKE '%nurse%' OR specialty LIKE '%ot technician%'
            OR specialty LIKE '%anesthesia%' OR specialty LIKE '%critical care%' OR specialty LIKE '%icu%'
            OR specialty LIKE '%emergency medicine%'
            OR name LIKE '%Surgical%' OR name LIKE '%Surgery%'
          )
      `, [startId, endId]);
      if (cons.affectedRows > 0) console.log(`  Consumables: ${cons.affectedRows}`);

      overallUpdated += gyn.affectedRows + ortho.affectedRows + cardio.affectedRows + 
                         neuro.affectedRows + endo.affectedRows + diag.affectedRows + cons.affectedRows;

      // Progress check
      const [progress] = await conn.execute(
        "SELECT COUNT(*) as c FROM contacts WHERE division IS NULL OR division = 'unknown' OR division = ''"
      );
      const remaining = progress[0].c;
      console.log(`  Progress: ${((1 - remaining/total) * 100).toFixed(1)}% enriched (${remaining.toLocaleString()} remaining)`);
    }

    // ============================================================
    // Quality score recalculation
    // ============================================================
    console.log('\n=== Recalculating Quality Scores ===');
    for (let startId = 1; startId <= maxId; startId += BATCH_SIZE) {
      const endId = startId + BATCH_SIZE - 1;
      const [qRes] = await conn.execute(`
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
        WHERE id BETWEEN ? AND ?
      `, [startId, endId]);
      if (qRes.affectedRows > 0) console.log(`  IDs ${startId}-${endId}: ${qRes.affectedRows} quality scores updated`);
    }

    // ============================================================
    // Final verification
    // ============================================================
    console.log('\n=== FINAL RESULTS ===');
    
    const [totalF] = await conn.execute('SELECT COUNT(*) as c FROM contacts');
    const [withDivF] = await conn.execute("SELECT COUNT(*) as c FROM contacts WHERE division IS NOT NULL AND division != 'unknown' AND division != ''");
    console.log(`Total: ${totalF[0].c.toLocaleString()}`);
    console.log(`With Division: ${withDivF[0].c.toLocaleString()} (${(withDivF[0].c/totalF[0].c*100).toFixed(1)}%)`);
    
    const [docF] = await conn.execute("SELECT COUNT(*) as c FROM contacts WHERE type = 'doctor'");
    const [hospF] = await conn.execute("SELECT COUNT(*) as c FROM contacts WHERE type = 'hospital'");
    const [clinicF] = await conn.execute("SELECT COUNT(*) as c FROM contacts WHERE type = 'clinic'");
    console.log(`Types: doctor=${docF[0].c.toLocaleString()}, hospital=${hospF[0].c.toLocaleString()}, clinic=${clinicF[0].c.toLocaleString()}`);
    
    const [avgQF] = await conn.execute('SELECT AVG(quality_score) as avg FROM contacts');
    console.log(`Avg Quality: ${Math.round(avgQF[0].avg || 0)}`);
    
    console.log('\nDivision breakdown:');
    const [divsF] = await conn.execute('SELECT division, COUNT(*) as c FROM contacts WHERE division IS NOT NULL AND division != "" GROUP BY division ORDER BY c DESC');
    for (const d of divsF) {
      console.log(`  ${d.division}: ${d.c.toLocaleString()}`);
    }
    
    const [stillF] = await conn.execute("SELECT COUNT(*) as c FROM contacts WHERE division IS NULL OR division = 'unknown' OR division = ''");
    console.log(`\nStill unclassified: ${stillF[0].c.toLocaleString()} (${(stillF[0].c/totalF[0].c*100).toFixed(1)}%)`);

  } finally {
    await conn.end();
    console.log('\nEnrichment complete!');
  }
}

main().catch(e => console.error('Error:', e.message));
