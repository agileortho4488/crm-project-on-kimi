import mysql from 'mysql2/promise';
import fs from 'fs';
import * as XLSX from 'xlsx';

const conn = await mysql.createConnection({
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com', port: 4000,
  user: '4CtfDUMzvSsZL7c.root', password: '41ZOclbIOnTLB8tF',
  database: 'test', ssl: { rejectUnauthorized: true }
});

let CREATED = 0, MERGED = 0, SKIPPED = 0;

async function findByPhone(phone) {
  if (!phone) return null;
  const norm = phone.replace(/\D/g, '');
  if (norm.length < 10) return null;
  const last10 = norm.slice(-10);
  const [rows] = await conn.query('SELECT * FROM contacts WHERE REPLACE(REPLACE(REPLACE(phone,"-","")," ",""),"+","") LIKE ?', [`%${last10}`]);
  return rows[0] || null;
}

async function create(name, phone, email, district, specialty, hospital, address, source) {
  if (!name || name.length < 2 || !phone) return;
  const existing = await findByPhone(phone);
  if (existing) {
    const upd = {};
    if (!existing.email && email) upd.email = email;
    if (!existing.district && district) upd.district = district;
    if (!existing.specialty && specialty) upd.specialty = specialty;
    if (!existing.hospital && hospital) upd.hospital = hospital;
    if (!existing.address && address) upd.address = address;
    if (Object.keys(upd).length > 0) {
      await conn.query(`UPDATE contacts SET ${Object.keys(upd).map(k=>k+'=?').join(',')} WHERE id=?`, [...Object.values(upd), existing.id]);
      MERGED++;
    } else SKIPPED++;
    return;
  }
  await conn.query('INSERT INTO contacts (name,type,phone,email,district,specialty,hospital,address,source,status,tags) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    [name, 'doctor', phone, email||null, district||null, specialty||null, hospital||null, address||null, `upload:${source}`, 'active', JSON.stringify(['imported', source])]);
  CREATED++;
}

function cleanPhone(p) { if(!p) return null; const s=String(p).replace(/\D/g,''); if(s.length===10) return s; if(s.length>10) return s.slice(-10); return null; }
function cleanName(n) { if(!n) return null; return String(n).trim().replace(/\s+/g,' ').replace(/[,;]$/,'').trim(); }

// === FILE TO IMPORT ===
const FILE = process.argv[2] || 'zoho';

if (FILE === 'zoho') {
  console.log('📄 Importing Zoho CRM...');
  const text = fs.readFileSync('/mnt/agents/upload/Contacts_2026_07_05.csv', 'utf-8');
  const lines = text.split('\n');
  const h = lines[0].split(',').map(x=>x.trim());
  const ni = h.findIndex(x=>x.includes('Contact Name'));
  const pi = h.findIndex(x=>x==='Phone');
  const mi = h.findIndex(x=>x==='Mobile');
  const ei = h.findIndex(x=>x==='Email');;
  const si = h.findIndex(x=>x.includes('Specialized'));
  const ci = h.findIndex(x=>x.includes('City'));
  const di = h.findIndex(x=>x.includes('District'));
  for (let i=1;i<lines.length;i++) {
    const p=lines[i].split(',');
    const n=cleanName(p[ni]), ph=cleanPhone(p[mi]||p[pi]);
    if(!n||!ph||n.length<3) continue;
    await create(n, ph, p[ei]?.trim()||null, p[di]?.trim()||p[ci]?.trim()||null, p[si]?.trim()||null, null, null, 'zoho-crm');
  }
}

if (FILE === 'doctors-xlsx') {
  console.log('📄 Importing Doctors Mobile XLSX...');
  const buf = fs.readFileSync('/mnt/agents/upload/719548903-DOCTORS-Mobile-Numbers-List.xlsx');
  const wb = XLSX.read(buf, {type:'buffer'});
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header:1});
  for (const r of rows.slice(1)) {
    if(!r||r.length<2) continue;
    const n=cleanName(r[0]), ph=cleanPhone(r[1]);
    if(!n||!ph) continue;
    await create(n, ph, String(r[3]||'').trim()||null, String(r[5]||'').trim()||null, null, null, String(r[4]||'').trim()||null, 'doctors-mobile');
  }
}

if (FILE === 'spec-xlsx') {
  console.log('📄 Importing Doctor Speciality XLSX...');
  const buf = fs.readFileSync('/mnt/agents/upload/865701116-d35f3638-3ee8-4910-9f53-dd84908467a5.xlsx');
  const wb = XLSX.read(buf, {type:'buffer'});
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header:1});
  for (const r of rows.slice(1)) {
    if(!r||r.length<3) continue;
    const n=cleanName(r[1]), ph=cleanPhone(r[3]);
    if(!n||!ph) continue;
    await create(n, ph, null, String(r[4]||'').trim()||null, String(r[2]||'').trim()||null, null, null, 'doctor-speciality');
  }
}

if (FILE === 'kmcdoctors') {
  console.log('📄 Importing KMC Warangal...');
  const text = fs.readFileSync('/mnt/agents/upload/794772703-KMCWARANGAL.txt', 'utf-8');
  const lines = text.split('\n');
  for (const line of lines) {
    const m = line.match(/(DR\.\s*[A-Za-z\s.]+?)\s+(NEURO\s*SURGERY|OPTHALMOLOGY|PATHOLOGY|ANAESTHESIA|G\.MEDICINE|PSYCHIATRY|PHARMACOLOGY|ORTHOPAEDICS|ENT|PAEDIATRICS|GENERAL\s*SURGERY|RADIOLOGY|DERMATOLOGY|OBG)/i);
    const pm = line.match(/\b([6-9]\d{9})\b/);
    const em = line.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (m && pm) {
      const n = cleanName(m[1]);
      if (n && n.length > 3) await create(n, pm[1], em?em[0]:null, 'Warangal', m[2], 'KMC Warangal', null, 'kmc-warangal');
    }
  }
}

if (FILE === 'telangana') {
  console.log('📄 Importing Telangana Members...');
  const text = fs.readFileSync('/mnt/agents/upload/558808574-member-telangana.txt', 'utf-8');
  const lines = text.split('\n');
  for (const line of lines) {
    const m = line.match(/Dr\.?\s*([A-Za-z\s.]+?)\s+(?:Mamata|Chalmeda|Deccan|SL|Area|District)/);
    const pm = line.match(/\b([6-9]\d{9})\b/);
    if (m && pm) {
      const n = cleanName('Dr. ' + m[1]);
      if (n.length > 3) await create(n, pm[1], null, null, null, null, null, 'telangana-members');
    }
  }
}

if (FILE === 'apdoctors') {
  console.log('📄 Importing AP CHC Doctors...');
  const text = fs.readFileSync('/mnt/agents/upload/640233256-Andhra-Pradesh-2023.txt', 'utf-8');
  const lines = text.split('\n');
  for (const line of lines) {
    const dm = line.match(/(Dr\.?[A-Za-z\s.]+?)(?:\s*,\s*|\s+MD|\s+GM|\s+MS|\s+MBBS|\s+\d{5})/);
    const pm = line.match(/\b([6-9]\d{9})\b/);
    const sm = line.match(/(General Medicine|PLUMONOLOGY|CARDIOLOGY|ORTHOPAEDICS|SURGERY|PEDIATRICS|GYNECOLOGY|DERMATOLOGY|OPHTHALMOLOGY|ENT|ANAESTHESIA|RADIOLOGY|PATHOLOGY)/i);
    if (dm && pm) {
      const n = cleanName(dm[1]);
      if (n.length > 3) await create(n, pm[1], null, null, sm?sm[1]:null, null, null, 'ap-chc-2023');
    }
  }
}

if (FILE === 'tos') {
  console.log('📄 Importing TOS Life Members...');
  const buf = fs.readFileSync('/mnt/agents/upload/886388647-TOS-Life-Members.xlsx');
  const wb = XLSX.read(buf, {type:'buffer'});
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header:1});
  for (const r of rows.slice(1)) {
    if(!r||r.length<2) continue;
    const n=cleanName(r[1]), ph=cleanPhone(r[4]);
    if(!n||!ph||n.toLowerCase().includes('expired')) continue;
    await create(n, ph, String(r[5]||'').trim()||null, String(r[3]||'').trim()||null, 'Ophthalmology', null, String(r[2]||'').trim()||null, 'tos-life-members');
  }
}

if (FILE === 'ghmc') {
  console.log('📄 Importing GHMC Doctors...');
  const text = fs.readFileSync('/mnt/agents/upload/253893188-Dotctors-Contact-with-in-GHMC-n-Hospitals-Lists-of-APNA-pdf.txt', 'utf-8');
  const lines = text.split('\n').map(l=>l.trimEnd());
  let hospital = '';
  for (let i=0;i<lines.length;i++) {
    const line = lines[i];
    if (line.match(/HOSPITAL|CENTRE|CLINIC|NURSING/i) && line.length<80) { hospital = line.trim(); continue; }
    if (line.match(/^Dr\.?\s+/i)) {
      const n = cleanName(line);
      let ph = null;
      for (let j=i+1;j<Math.min(i+5,lines.length);j++) { const p=cleanPhone(lines[j]); if(p){ph=p;break;} }
      if (n && ph && n.length>3) await create(n, ph, null, 'Hyderabad', null, hospital, null, 'ghmc-doctors');
    }
  }
}

console.log(`✅ Done! Created=${CREATED}, Merged=${MERGED}, Skipped=${SKIPPED}`);
await conn.end();
