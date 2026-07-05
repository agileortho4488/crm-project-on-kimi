import mysql from 'mysql2/promise';
import fs from 'fs';
import readline from 'readline';

const conn = await mysql.createConnection({
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com', port: 4000,
  user: '4CtfDUMzvSsZL7c.root', password: '41ZOclbIOnTLB8tF',
  database: 'test', ssl: { rejectUnauthorized: true }
});

// ========== ENRICH ALL CONTACTS ==========
console.log('Running enrichment on all contacts...');

const DIVISION_KWS = {
  gynecology: ['obg','obstetrics','gynecology','gynaecology','gynecologist','obstetrician','maternity','gyn','dgo','ms obg'],
  trauma_fracture: ['orthopedic','orthopaedic','trauma','fracture','bone','joint replacement','knee','hip','arthroplasty','ms ortho'],
  cardiovascular: ['cardiology','cardiologist','cardiothoracic','ctvs','cardiac','heart','stent','angioplasty','dm cardio'],
  endo_surgery: ['laparoscopic','gi surgery','gastro surgeon','minimal access','mias','endo'],
  neuro_spine: ['neurosurgery','neurosurgeon','spine surgery','neurologist','cranial','brain','neuro'],
  diagnostics: ['pathology','radiology','diagnostic','lab','microbiology','biochemistry','nephrology','dm nephro'],
  consumables: ['general surgeon','general medicine','nurse','ot technician','anesthesia','critical care','gm','physician'],
};

function classifyDivision(specialty, hospital, name) {
  const text = `${specialty || ''} ${hospital || ''} ${name || ''}`.toLowerCase();
  const scores = {};
  for (const [div, kws] of Object.entries(DIVISION_KWS)) {
    scores[div] = 0;
    for (const kw of kws) if (text.includes(kw)) scores[div] += 3;
  }
  let best = 'unknown', bestScore = 0;
  for (const [div, score] of Object.entries(scores)) { if (score > bestScore) { bestScore = score; best = div; } }
  return bestScore >= 2 ? best : 'unknown';
}

function calcScore(c) {
  let s = 0;
  if (c.name?.length > 2) s += 20;
  if (c.phone?.length >= 10) s += 25;
  if (c.hospital?.length > 2) s += 15;
  if (c.district?.length > 1) s += 10;
  if (c.specialty?.length > 1) s += 10;
  if (c.email?.includes('@')) s += 10;
  if (c.division && c.division !== 'unknown') s += 5;
  if (c.designation?.length > 1) s += 5;
  return s;
}

// Enrich all contacts missing division/district/quality_score
const [contacts] = await conn.query('SELECT id, name, phone, email, district, specialty, hospital, division, quality_score FROM contacts WHERE division IS NULL OR division = "unknown" OR district IS NULL OR quality_score = 0 OR quality_score IS NULL');
console.log(`Enriching ${contacts.length} contacts...`);

let enriched = 0;
for (const c of contacts) {
  const updates = {};
  const division = classifyDivision(c.specialty, c.hospital, c.name);
  if (division !== 'unknown' && (!c.division || c.division === 'unknown')) updates.division = division;
  updates.quality_score = calcScore({ ...c, ...updates });
  if (Object.keys(updates).length > 0) {
    const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    await conn.query(`UPDATE contacts SET ${sets} WHERE id = ?`, [...Object.values(updates), c.id]);
    enriched++;
  }
}
console.log(`Enriched ${enriched} contacts`);

// ========== STREAM ZOHO CRM CSV (too big for memory) ==========
console.log('\n📄 Streaming Zoho CRM CSV...');
let zohoMerged = 0, zohoSkipped = 0;

const fileStream = fs.createReadStream('/mnt/agents/upload/Contacts_2026_07_05.csv');
const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

let lineNum = 0;
let headers = [];
const ni = 0, pi = 0, mi = 0, ei = 0, si = 0, ci = 0, di = 0;

for await (const line of rl) {
  lineNum++;
  if (lineNum === 1) {
    headers = line.split(',').map(h => h.trim());
    console.log(`Headers: ${headers.length} columns`);
    continue;
  }
  
  if (lineNum % 1000 === 0) console.log(`  Processed ${lineNum} lines...`);
  
  const parts = line.split(',');
  if (parts.length < 5) continue;
  
  const name = (parts[5] || parts[4] || '').trim();
  const phone = String(parts[11] || parts[10] || '').replace(/\D/g, '');
  if (!name || !phone || phone.length < 10 || name.length < 3) continue;
  
  const last10 = phone.slice(-10);
  
  // Find existing by phone
  const [rows] = await conn.query('SELECT id, email, district, specialty FROM contacts WHERE REPLACE(REPLACE(phone, "-", ""), " ", "") LIKE ?', [`%${last10}`]);
  
  if (rows.length > 0) {
    const existing = rows[0];
    const updates = {};
    const email = (parts[8] || '').trim();
    const specialty = (parts[43] || '').trim();
    const district = (parts[55] || parts[52] || '').trim();
    
    if (!existing.email && email && email.includes('@')) updates.email = email;
    if (!existing.district && district) updates.district = district;
    if (!existing.specialty && specialty) updates.specialty = specialty;
    
    if (Object.keys(updates).length > 0) {
      const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
      await conn.query(`UPDATE contacts SET ${sets} WHERE id = ?`, [...Object.values(updates), existing.id]);
      zohoMerged++;
    } else {
      zohoSkipped++;
    }
  }
}

console.log(`Zoho CRM: Merged ${zohoMerged}, Skipped ${zohoSkipped}`);

// Final stats
const [summary] = await conn.query(`
  SELECT COUNT(*) as total,
    SUM(CASE WHEN division='gynecology' THEN 1 ELSE 0 END) as obg,
    SUM(CASE WHEN specialty='Nephrology' THEN 1 ELSE 0 END) as nephro,
    SUM(CASE WHEN division='trauma_fracture' THEN 1 ELSE 0 END) as ortho,
    SUM(CASE WHEN division='cardiovascular' THEN 1 ELSE 0 END) as cardio,
    SUM(CASE WHEN quality_score >= 70 THEN 1 ELSE 0 END) as high,
    SUM(CASE WHEN quality_score >= 40 AND quality_score < 70 THEN 1 ELSE 0 END) as med,
    SUM(CASE WHEN quality_score < 40 THEN 1 ELSE 0 END) as low
  FROM contacts
`);
console.log('\n=== FINAL DATABASE ===');
console.log(`Total: ${summary[0].total}`);
console.log(`Gynecology: ${summary[0].obg}`);
console.log(`Nephrology: ${summary[0].nephro}`);
console.log(`Ortho/Trauma: ${summary[0].ortho}`);
console.log(`Cardiology: ${summary[0].cardio}`);
console.log(`High Quality: ${summary[0].high}`);
console.log(`Medium: ${summary[0].med}`);
console.log(`Low: ${summary[0].low}`);

await conn.end();
console.log('\n✅ All done!');
