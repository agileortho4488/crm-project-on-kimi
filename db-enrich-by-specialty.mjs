// Enrich by exact specialty values found in the database
import mysql from 'mysql2/promise';

const DB_URL = 'mysql://4CtfDUMzvSsZL7c.root:41ZOclbIOnTLB8tF@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/test?ssl={"rejectUnauthorized":true}';

// Exact specialty → division mapping based on actual data
const SPECIALTY_TO_DIVISION = {
  // Gynecology
  'Obstetrics & Gynaecology': 'gynecology',
  'Gynaecology': 'gynecology',
  'Gynaecologist': 'gynecology',
  'Obstetrics & Gynecology': 'gynecology',
  'Obstetrics & Gynaecologist': 'gynecology',
  
  // Cardiovascular
  'Cardiology': 'cardiovascular',
  'Cardiologist': 'cardiovascular',
  'Cardiac Surgeon': 'cardiovascular',
  'Interventional Cardiology': 'cardiovascular',
  
  // Trauma & Fracture
  'Orthopaedics': 'trauma_fracture',
  'Orthopedic': 'trauma_fracture',
  'Orthopaedic Surgery': 'trauma_fracture',
  'Orthopedic Surgeon': 'trauma_fracture',
  'Joint Replacement': 'trauma_fracture',
  
  // Neuro & Spine
  'Neuro Surgery': 'neuro_spine',
  'Neuro Surgeon': 'neuro_spine',
  'Neurologist': 'neuro_spine',
  'Neurosurgery': 'neuro_spine',
  'Spine Surgery': 'neuro_spine',
  
  // Endo-Surgery
  'Laparoscopic Surgery': 'endo_surgery',
  'Laparoscopic Surgeon': 'endo_surgery',
  'GI Surgery': 'endo_surgery',
  'Gastroenterology': 'endo_surgery',
  
  // Diagnostics
  'Radiology': 'diagnostics',
  'Radiologist': 'diagnostics',
  'Pathology': 'diagnostics',
  'Diagnostic': 'diagnostics',
  'Imaging': 'diagnostics',
};

async function main() {
  const conn = await mysql.createConnection(DB_URL);
  console.log('Connected to TiDB');
  
  try {
    let totalUpdated = 0;
    
    // Method 1: Map by exact specialty values
    console.log('\n=== Method 1: Exact specialty mapping ===');
    for (const [specialty, division] of Object.entries(SPECIALTY_TO_DIVISION)) {
      try {
        const [result] = await conn.execute(
          `UPDATE contacts 
           SET division = ? 
           WHERE (division IS NULL OR division = 'unknown' OR division = '') 
             AND specialty = ?
           LIMIT 50000`,
          [division, specialty]
        );
        if (result.affectedRows > 0) {
          console.log(`  "${specialty}" → ${division}: ${result.affectedRows.toLocaleString()}`);
          totalUpdated += result.affectedRows;
        }
      } catch (e) {
        // ignore
      }
    }
    
    // Method 2: LIKE matching for broader patterns
    console.log('\n=== Method 2: LIKE pattern matching ===');
    
    const likeMappings = [
      // Gynecology
      [`specialty LIKE '%gynaec%' OR specialty LIKE '%gynec%' OR specialty LIKE '%obstetric%'`, 'gynecology'],
      // Cardiovascular
      [`specialty LIKE '%cardio%' OR specialty LIKE '%cardiac%' OR specialty LIKE '%heart%'`, 'cardiovascular'],
      // Ortho/Trauma
      [`specialty LIKE '%orthop%' OR specialty LIKE '%orthopaedic%' OR specialty LIKE '%fracture%' OR specialty LIKE '%joint%'`, 'trauma_fracture'],
      // Neuro
      [`specialty LIKE '%neuro%' OR specialty LIKE '%neurologist%' OR specialty LIKE '%brain%' OR specialty LIKE '%spine%'`, 'neuro_spine'],
      // Endo/Laparoscopic
      [`specialty LIKE '%laparosc%' OR specialty LIKE '%gi surgery%' OR specialty LIKE '%endoscop%'`, 'endo_surgery'],
      // Diagnostics
      [`specialty LIKE '%radiolog%' OR specialty LIKE '%radiologist%' OR specialty LIKE '%patholog%' OR specialty LIKE '%diagnostic%'`, 'diagnostics'],
      // Dental
      [`specialty LIKE '%dental%' OR specialty LIKE '%dentist%' OR specialty LIKE '%orthodont%'`, 'consumables'],
      // General surgery
      [`specialty LIKE '%general surger%' OR specialty LIKE '%general surgeon%' OR specialty LIKE '%plastic surger%' OR specialty LIKE '%ent surger%' OR specialty LIKE '%ent surgery%'`, 'consumables'],
      // Anesthesia/Intensivist
      [`specialty LIKE '%anesthes%' OR specialty LIKE '%anaesthes%' OR specialty LIKE '%intensiv%' OR specialty LIKE '%critical care%'`, 'consumables'],
      // Catch all remaining medical
      [`specialty LIKE '%surger%' OR specialty LIKE '%surgeon%'`, 'consumables'],
    ];
    
    for (const [condition, division] of likeMappings) {
      try {
        const [result] = await conn.execute(
          `UPDATE contacts 
           SET division = ? 
           WHERE (division IS NULL OR division = 'unknown' OR division = '') 
             AND (${condition})
           LIMIT 50000`,
          [division]
        );
        if (result.affectedRows > 0) {
          console.log(`  ${division}: ${result.affectedRows.toLocaleString()}`);
          totalUpdated += result.affectedRows;
        }
      } catch (e) {
        console.log(`  ${division}: error`);
      }
    }
    
    // Method 3: Classify by name patterns (Hospital/Clinic in name)
    console.log('\n=== Method 3: Name pattern classification ===');
    
    const namePatterns = [
      [`name LIKE '%Hospital%' AND name NOT LIKE 'Dr %' AND name NOT LIKE '%Dr.%'`, 'hospital', 'consumables'],
      [`name LIKE '%Clinic%' AND name NOT LIKE 'Dr %' AND name NOT LIKE '%Dr.%'`, 'clinic', 'consumables'],
      [`name LIKE '%Dental%'`, null, 'consumables'],
      [`name LIKE '%Eye %' OR name LIKE '%Eye Hospital%'`, null, 'consumables'],
      [`name LIKE '%Skin %'`, null, 'consumables'],
      [`name LIKE '%Ortho %'`, null, 'trauma_fracture'],
      [`name LIKE '%Maternity%'`, null, 'gynecology'],
      [`name LIKE '%Diagnostic%'`, null, 'diagnostics'],
      [`name LIKE '%Scan %'`, null, 'diagnostics'],
      [`name LIKE '%Path Lab%'`, null, 'diagnostics'],
      [`name LIKE '%Pharma%' OR name LIKE '%Medicals%'`, null, 'consumables'],
    ];
    
    for (const [condition, newType, division] of namePatterns) {
      try {
        // Set division
        const [divResult] = await conn.execute(
          `UPDATE contacts 
           SET division = ? 
           WHERE (division IS NULL OR division = 'unknown' OR division = '') 
             AND (${condition})
           LIMIT 50000`,
          [division]
        );
        if (divResult.affectedRows > 0) {
          console.log(`  Division ${division}: ${divResult.affectedRows.toLocaleString()}`);
          totalUpdated += divResult.affectedRows;
        }
        
        // Set type if specified
        if (newType) {
          await conn.execute(
            `UPDATE contacts SET type = ? WHERE type = 'doctor' AND (${condition}) LIMIT 50000`,
            [newType]
          );
        }
      } catch (e) {
        // ignore
      }
    }
    
    // Method 4: Default remaining Dr. contacts to consumables (general medical supplies)
    console.log('\n=== Method 4: Default Dr. contacts to consumables ===');
    try {
      const [defaultDr] = await conn.execute(
        `UPDATE contacts 
         SET division = 'consumables' 
         WHERE (division IS NULL OR division = 'unknown' OR division = '') 
           AND (name LIKE 'Dr %' OR name LIKE '%Dr.%' OR name LIKE '%Doctor%')
         LIMIT 200000`
      );
      console.log(`  Dr. → consumables: ${defaultDr.affectedRows.toLocaleString()}`);
      totalUpdated += defaultDr.affectedRows;
    } catch (e) {
      console.log(`  Error: ${e.message.slice(0, 80)}`);
    }
    
    // Method 5: Default ALL remaining to consumables
    console.log('\n=== Method 5: Default remaining to consumables ===');
    try {
      const [defaultAll] = await conn.execute(
        `UPDATE contacts 
         SET division = 'consumables' 
         WHERE division IS NULL OR division = 'unknown' OR division = ''
         LIMIT 1000000`
      );
      console.log(`  Remaining → consumables: ${defaultAll.affectedRows.toLocaleString()}`);
      totalUpdated += defaultAll.affectedRows;
    } catch (e) {
      console.log(`  Error: ${e.message.slice(0, 80)}`);
    }
    
    // Final results
    console.log('\n=== FINAL RESULTS ===');
    const [total] = await conn.execute('SELECT COUNT(*) as c FROM contacts');
    const [withDiv] = await conn.execute("SELECT COUNT(*) as c FROM contacts WHERE division IS NOT NULL AND division != 'unknown' AND division != ''");
    console.log(`Total: ${total[0].c.toLocaleString()}`);
    console.log(`With Division: ${withDiv[0].c.toLocaleString()} (${(withDiv[0].c/total[0].c*100).toFixed(1)}%)`);
    
    console.log('\nDivision breakdown:');
    const [divs] = await conn.execute('SELECT division, COUNT(*) as c FROM contacts WHERE division IS NOT NULL AND division != "" GROUP BY division ORDER BY c DESC');
    for (const d of divs) {
      console.log(`  ${d.division}: ${d.c.toLocaleString()}`);
    }
    
    // Type breakdown
    console.log('\nType breakdown:');
    const [types] = await conn.execute('SELECT type, COUNT(*) as c FROM contacts GROUP BY type ORDER BY c DESC');
    for (const t of types) {
      console.log(`  ${t.type}: ${t.c.toLocaleString()}`);
    }
    
    console.log(`\nTotal updated this run: ${totalUpdated.toLocaleString()}`);
    
  } finally {
    await conn.end();
    console.log('\nDone!');
  }
}

main().catch(e => console.error('Error:', e.message));
