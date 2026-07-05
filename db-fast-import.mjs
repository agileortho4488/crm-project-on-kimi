import mysql from 'mysql2/promise';
import fs from 'fs';
import * as XLSX from 'xlsx';

const conn = await mysql.createConnection({
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com', port: 4000,
  user: '4CtfDUMzvSsZL7c.root', password: '41ZOclbIOnTLB8tF',
  database: 'test', ssl: { rejectUnauthorized: true },
  multipleStatements: true
});

// Get all existing phones for fast dedup
const [existingRows] = await conn.query('SELECT phone FROM contacts WHERE phone IS NOT NULL');
const existingPhones = new Set();
for (const r of existingRows) {
  const norm = String(r.phone).replace(/\D/g, '');
  if (norm.length >= 10) existingPhones.add(norm.slice(-10));
}
console.log(`Existing contacts: ${existingRows.length}`);

let BATCH = [];
let CREATED = 0, DUPES = 0;
const BATCH_SIZE = 200;

function cleanPhone(p) {
  if (!p) return null;
  const s = String(p).replace(/\D/g, '');
  if (s.length === 10) return s;
  if (s.length > 10) return s.slice(-10);
  return null;
}

function cleanName(n) {
  if (!n) return null;
  return String(n).trim().replace(/\s+/g, ' ').replace(/[,;]$/, '').trim();
}

async function flush() {
  if (BATCH.length === 0) return;
  const sql = 'INSERT INTO contacts (name, type, phone, email, district, specialty, hospital, address, source, status, tags) VALUES ' +
    BATCH.map(() => '(?,?,?,?,?,?,?,?,?,?,?)').join(',');
  const vals = BATCH.flat();
  try {
    await conn.query(sql, vals);
    CREATED += BATCH.length;
  } catch(e) {
    // If batch fails, insert one by one
    for (const row of BATCH) {
      try { await conn.query('INSERT INTO contacts (name,type,phone,email,district,specialty,hospital,address,source,status,tags) VALUES (?,?,?,?,?,?,?,?,?,?,?)', row); CREATED++; }
      catch(e2) { /* skip duplicate */ }
    }
  }
  BATCH = [];
}

function add(name, phone, email, district, specialty, hospital, address, source) {
  if (!name || name.length < 2 || !phone) return;
  const normPhone = cleanPhone(phone);
  if (!normPhone) return;
  if (existingPhones.has(normPhone)) { DUPES++; return; }
  existingPhones.add(normPhone);
  
  BATCH.push([
    name.substring(0, 100), 'doctor', normPhone,
    email ? email.substring(0, 100) : null,
    district ? district.substring(0, 100) : null,
    specialty ? specialty.substring(0, 100) : null,
    hospital ? hospital.substring(0, 100) : null,
    address ? address.substring(0, 255) : null,
    `upload:${source}`, 'active',
    JSON.stringify(['imported', source])
  ]);
  
  if (BATCH.length >= BATCH_SIZE) return flush();
}

// ==========================================
// 1. Zoho CRM (1.6MB CSV)
// ==========================================
console.log('\n📄 [1/7] Zoho CRM...');
{
  const text = fs.readFileSync('/mnt/agents/upload/Contacts_2026_07_05.csv', 'utf-8');
  const lines = text.split('\n');
  const h = lines[0].split(',').map(x => x.trim());
  const ni = h.indexOf('Contact Name'); if(ni<0) h.findIndex(x=>x.includes('Name'));
  const pi = h.indexOf('Phone');
  const mi = h.indexOf('Mobile');
  const ei = h.indexOf('Email');
  const si = h.findIndex(x => x.includes('Specialized'));
  const ci = h.findIndex(x => x.includes('City'));
  const di = h.findIndex(x => x.includes('District'));
  
  for (let i = 1; i < lines.length; i++) {
    const p = lines[i].split(',');
    const n = cleanName(p[ni]); const ph = cleanPhone(p[mi] || p[pi]);
    if (!n || !ph || n.length < 3) continue;
    add(n, ph, p[ei]?.trim()||null, p[di]?.trim()||p[ci]?.trim()||null, p[si]?.trim()||null, null, null, 'zoho-crm');
  }
  await flush();
  console.log(`   ✅ ${CREATED} created, ${DUPES} dupes`);
}

// ==========================================
// 2. Doctors Mobile XLSX
// ==========================================
console.log('\n📄 [2/7] Doctors Mobile XLSX...');
{
  const buf = fs.readFileSync('/mnt/agents/upload/719548903-DOCTORS-Mobile-Numbers-List.xlsx');
  const wb = XLSX.read(buf, { type: 'buffer' });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
  for (const r of rows.slice(1)) {
    if (!r || r.length < 2) continue;
    const n = cleanName(r[0]); const ph = cleanPhone(r[1]);
    if (!n || !ph) continue;
    add(n, ph, String(r[3]||'').trim()||null, String(r[5]||'').trim()||null, null, null, String(r[4]||'').trim()||null, 'doctors-mobile');
  }
  await flush();
  console.log(`   ✅ ${CREATED} created, ${DUPES} dupes`);
}

// ==========================================
// 3. Doctor Speciality XLSX
// ==========================================
console.log('\n📄 [3/7] Doctor Speciality Area XLSX...');
{
  const buf = fs.readFileSync('/mnt/agents/upload/865701116-d35f3638-3ee8-4910-9f53-dd84908467a5.xlsx');
  const wb = XLSX.read(buf, { type: 'buffer' });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
  for (const r of rows.slice(1)) {
    if (!r || r.length < 3) continue;
    const n = cleanName(r[1]); const ph = cleanPhone(r[3]);
    if (!n || !ph) continue;
    add(n, ph, null, String(r[4]||'').trim()||null, String(r[2]||'').trim()||null, null, null, 'doctor-speciality');
  }
  await flush();
  console.log(`   ✅ ${CREATED} created, ${DUPES} dupes`);
}

// ==========================================
// 4. KMC Warangal
// ==========================================
console.log('\n📄 [4/7] KMC Warangal...');
{
  const text = fs.readFileSync('/mnt/agents/upload/794772703-KMCWARANGAL.txt', 'utf-8');
  const lines = text.split('\n');
  for (const line of lines) {
    const m = line.match(/(DR\.\s*[A-Za-z\s.]+?)\s+(NEURO\s*SURGERY|OPTHALMOLOGY|PATHOLOGY|ANAESTHESIA|G\.MEDICINE|PSYCHIATRY|PHARMACOLOGY|ORTHOPAEDICS|ENT|PAEDIATRICS|GENERAL\s*SURGERY|RADIOLOGY|DERMATOLOGY|OBG)/i);
    const pm = line.match(/\b([6-9]\d{9})\b/);
    const em = line.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (m && pm) {
      const n = cleanName(m[1]);
      if (n && n.length > 3) add(n, pm[1], em?em[0]:null, 'Warangal', m[2], 'KMC Warangal', null, 'kmc-warangal');
    }
  }
  await flush();
  console.log(`   ✅ ${CREATED} created, ${DUPES} dupes`);
}

// ==========================================
// 5. Telangana Members
// ==========================================
console.log('\n📄 [5/7] Telangana Members...');
{
  const text = fs.readFileSync('/mnt/agents/upload/558808574-member-telangana.txt', 'utf-8');
  const lines = text.split('\n');
  for (const line of lines) {
    const m = line.match(/Dr\.?\s*([A-Za-z\s.]+?)\s+(?:Mamata|Chalmeda|Deccan|SL|Area|District)/);
    const pm = line.match(/\b([6-9]\d{9})\b/);
    if (m && pm) {
      const n = cleanName('Dr. ' + m[1]);
      if (n.length > 3) add(n, pm[1], null, null, null, null, null, 'telangana-members');
    }
  }
  await flush();
  console.log(`   ✅ ${CREATED} created, ${DUPES} dupes`);
}

// ==========================================
// 6. AP CHC Doctors
// ==========================================
console.log('\n📄 [6/7] AP CHC Doctors...');
{
  const text = fs.readFileSync('/mnt/agents/upload/640233256-Andhra-Pradesh-2023.txt', 'utf-8');
  const lines = text.split('\n');
  for (const line of lines) {
    const dm = line.match(/(Dr\.?[A-Za-z\s.]+?)(?:\s*,\s*|\s+MD|\s+GM|\s+MS|\s+MBBS)/);
    const pm = line.match(/\b([6-9]\d{9})\b/);
    const sm = line.match(/(General Medicine|PLUMONOLOGY|CARDIOLOGY|ORTHOPAEDICS|SURGERY|PEDIATRICS|GYNECOLOGY|DERMATOLOGY|OPHTHALMOLOGY|ENT|ANAESTHESIA|RADIOLOGY|PATHOLOGY)/i);
    if (dm && pm) {
      const n = cleanName(dm[1]);
      if (n.length > 3) add(n, pm[1], null, null, sm?sm[1]:null, null, null, 'ap-chc-2023');
    }
  }
  await flush();
  console.log(`   ✅ ${CREATED} created, ${DUPES} dupes`);
}

// ==========================================
// 7. TOS Life Members
// ==========================================
console.log('\n📄 [7/7] TOS Life Members...');
{
  const buf = fs.readFileSync('/mnt/agents/upload/886388647-TOS-Life-Members.xlsx');
  const wb = XLSX.read(buf, { type: 'buffer' });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
  for (const r of rows.slice(1)) {
    if (!r || r.length < 2) continue;
    const n = cleanName(r[1]); const ph = cleanPhone(r[4]);
    if (!n || !ph || n.toLowerCase().includes('expired')) continue;
    add(n, ph, String(r[5]||'').trim()||null, String(r[3]||'').trim()||null, 'Ophthalmology', null, String(r[2]||'').trim()||null, 'tos-life-members');
  }
  await flush();
  console.log(`   ✅ ${CREATED} created, ${DUPES} dupes`);
}

console.log(`\n🎉 DONE! Total created: ${CREATED}, Dupes skipped: ${DUPES}`);
await conn.end();
