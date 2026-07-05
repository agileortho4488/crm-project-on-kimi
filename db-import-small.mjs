import mysql from 'mysql2/promise';
import fs from 'fs';
import * as XLSX from 'xlsx';

const conn = await mysql.createConnection({
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com', port: 4000,
  user: '4CtfDUMzvSsZL7c.root', password: '41ZOclbIOnTLB8tF',
  database: 'test', ssl: { rejectUnauthorized: true }, multipleStatements: true
});

const [existingRows] = await conn.query('SELECT phone FROM contacts WHERE phone IS NOT NULL');
const existingPhones = new Set();
for (const r of existingRows) {
  const n = String(r.phone).replace(/\D/g, '');
  if (n.length >= 10) existingPhones.add(n.slice(-10));
}
console.log(`Existing: ${existingRows.length}`);

let BATCH = [], CREATED = 0, DUPES = 0;

function add(n, ph, email, district, specialty, hospital, address, source) {
  if (!n || n.length < 2 || !ph) return;
  const norm = String(ph).replace(/\D/g, '');
  const last10 = norm.length > 10 ? norm.slice(-10) : norm;
  if (last10.length !== 10) return;
  if (existingPhones.has(last10)) { DUPES++; return; }
  existingPhones.add(last10);
  BATCH.push([n.substring(0, 100), 'doctor', last10, email ? email.substring(0, 100) : null, district ? district.substring(0, 100) : null, specialty ? specialty.substring(0, 100) : null, hospital ? hospital.substring(0, 100) : null, address ? address.substring(0, 255) : null, 'upload:' + source, 'active', JSON.stringify(['imported', source])]);
}

async function flush() {
  if (BATCH.length === 0) return;
  const sql = 'INSERT INTO contacts (name,type,phone,email,district,specialty,hospital,address,source,status,tags) VALUES ' + BATCH.map(() => '(?,?,?,?,?,?,?,?,?,?,?)').join(',');
  try { await conn.query(sql, BATCH.flat()); CREATED += BATCH.length; } catch (e) { }
  BATCH = [];
}

// [1] Doctors Mobile XLSX
console.log('[1/6] Doctors Mobile XLSX...');
{
  const wb = XLSX.read(fs.readFileSync('/mnt/agents/upload/719548903-DOCTORS-Mobile-Numbers-List.xlsx'), { type: 'buffer' });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
  for (const r of rows.slice(1)) {
    if (!r || r.length < 2) continue;
    const n = String(r[0] || '').trim(), ph = String(r[1] || '').replace(/\D/g, '');
    if (!n || !ph || ph.length < 10) continue;
    add(n, ph, String(r[3] || '').trim() || null, String(r[5] || '').trim() || null, null, null, String(r[4] || '').trim() || null, 'doctors-mobile');
    if (BATCH.length >= 200) await flush();
  }
  await flush();
  console.log('  Created: ' + CREATED);
}

// [2] Doctor Speciality XLSX
console.log('[2/6] Doctor Speciality XLSX...');
{
  const wb = XLSX.read(fs.readFileSync('/mnt/agents/upload/865701116-d35f3638-3ee8-4910-9f53-dd84908467a5.xlsx'), { type: 'buffer' });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
  for (const r of rows.slice(1)) {
    if (!r || r.length < 3) continue;
    const n = String(r[1] || '').trim(), ph = String(r[3] || '').replace(/\D/g, '');
    if (!n || !ph || ph.length < 10) continue;
    add(n, ph, null, String(r[4] || '').trim() || null, String(r[2] || '').trim() || null, null, null, 'doctor-speciality');
    if (BATCH.length >= 200) await flush();
  }
  await flush();
  console.log('  Created: ' + CREATED);
}

// [3] KMC Warangal
console.log('[3/6] KMC Warangal...');
{
  const lines = fs.readFileSync('/mnt/agents/upload/794772703-KMCWARANGAL.txt', 'utf-8').split('\n');
  for (const line of lines) {
    const m = line.match(/(DR\.\s*[A-Za-z\s.]+?)\s+(NEURO\s*SURGERY|OPTHALMOLOGY|PATHOLOGY|ANAESTHESIA|G\.MEDICINE|PSYCHIATRY|PHARMACOLOGY|ORTHOPAEDICS|ENT|PAEDIATRICS|GENERAL\s*SURGERY|RADIOLOGY|DERMATOLOGY|OBG)/i);
    const pm = line.match(/\b([6-9]\d{9})\b/);
    const em = line.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (m && pm) {
      const n = String(m[1]).trim();
      if (n.length > 3) add(n, pm[1], em ? em[0] : null, 'Warangal', m[2], 'KMC Warangal', null, 'kmc-warangal');
      if (BATCH.length >= 200) await flush();
    }
  }
  await flush();
  console.log('  Created: ' + CREATED);
}

// [4] Telangana Members
console.log('[4/6] Telangana Members...');
{
  const lines = fs.readFileSync('/mnt/agents/upload/558808574-member-telangana.txt', 'utf-8').split('\n');
  for (const line of lines) {
    const m = line.match(/Dr\.?\s*([A-Za-z\s.]+?)\s+(?:Mamata|Chalmeda|Deccan|SL|Area|District)/);
    const pm = line.match(/\b([6-9]\d{9})\b/);
    if (m && pm) {
      const n = 'Dr. ' + String(m[1]).trim();
      if (n.length > 3) add(n, pm[1], null, null, null, null, null, 'telangana-members');
      if (BATCH.length >= 200) await flush();
    }
  }
  await flush();
  console.log('  Created: ' + CREATED);
}

// [5] TOS Life Members
console.log('[5/6] TOS Life Members...');
{
  const wb = XLSX.read(fs.readFileSync('/mnt/agents/upload/886388647-TOS-Life-Members.xlsx'), { type: 'buffer' });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
  for (const r of rows.slice(1)) {
    if (!r || r.length < 2) continue;
    const n = String(r[1] || '').trim(), ph = String(r[4] || '').replace(/\D/g, '');
    if (!n || !ph || ph.length < 10 || n.toLowerCase().includes('expired')) continue;
    add(n, ph, String(r[5] || '').trim() || null, String(r[3] || '').trim() || null, 'Ophthalmology', null, String(r[2] || '').trim() || null, 'tos-life-members');
    if (BATCH.length >= 200) await flush();
  }
  await flush();
  console.log('  Created: ' + CREATED);
}

// [6] AP CHC Doctors
console.log('[6/6] AP CHC Doctors...');
{
  const lines = fs.readFileSync('/mnt/agents/upload/640233256-Andhra-Pradesh-2023.txt', 'utf-8').split('\n');
  for (const line of lines) {
    const dm = line.match(/(Dr\.?[A-Za-z\s.]+?)(?:\s*,\s*|\s+MD|\s+GM|\s+MS|\s+MBBS)/);
    const pm = line.match(/\b([6-9]\d{9})\b/);
    const sm = line.match(/(General Medicine|PLUMONOLOGY|CARDIOLOGY|ORTHOPAEDICS|SURGERY|PEDIATRICS|GYNECOLOGY|DERMATOLOGY|OPHTHALMOLOGY|ENT|ANAESTHESIA|RADIOLOGY|PATHOLOGY)/i);
    if (dm && pm) {
      const n = String(dm[1]).trim();
      if (n.length > 3) add(n, pm[1], null, null, sm ? sm[1] : null, null, null, 'ap-chc-2023');
      if (BATCH.length >= 200) await flush();
    }
  }
  await flush();
  console.log('  Created: ' + CREATED);
}

console.log('\n🎉 DONE! Total created: ' + CREATED + ', Dupes: ' + DUPES);
await conn.end();
