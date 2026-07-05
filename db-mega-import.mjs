import mysql from 'mysql2/promise';
import fs from 'fs';
import * as XLSX from 'xlsx';
import readline from 'readline';

const conn = await mysql.createConnection({
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com', port: 4000,
  user: '4CtfDUMzvSsZL7c.root', password: '41ZOclbIOnTLB8tF',
  database: 'test', ssl: { rejectUnauthorized: true }
});

let TOTAL_CREATED = 0, TOTAL_MERGED = 0, TOTAL_SKIPPED = 0;

// ========== HELPERS ==========
async function findByPhone(phone) {
  if (!phone) return null;
  const norm = phone.replace(/\D/g, '');
  if (norm.length < 10) return null;
  const last10 = norm.slice(-10);
  const [rows] = await conn.query(
    'SELECT * FROM contacts WHERE REPLACE(REPLACE(REPLACE(phone,"-","")," ",""),"+","") LIKE ?',
    [`%${last10}`]
  );
  return rows[0] || null;
}

async function createContact(name, phone, email, district, specialty, hospital, address, source) {
  if (!name || name.length < 2) return;
  if (!phone) return;
  const existing = await findByPhone(phone);
  if (existing) {
    const updates = {};
    if (!existing.email && email) updates.email = email;
    if (!existing.district && district) updates.district = district;
    if (!existing.specialty && specialty) updates.specialty = specialty;
    if (!existing.hospital && hospital) updates.hospital = hospital;
    if (!existing.address && address) updates.address = address;
    if (Object.keys(updates).length > 0) {
      const sets = Object.keys(updates).map(k => `${k}=?`).join(',');
      await conn.query(`UPDATE contacts SET ${sets} WHERE id=?`, [...Object.values(updates), existing.id]);
      TOTAL_MERGED++;
    } else { TOTAL_SKIPPED++; }
    return;
  }
  await conn.query(
    'INSERT INTO contacts (name,type,phone,email,district,specialty,hospital,address,source,status,tags) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    [name, 'doctor', phone, email||null, district||null, specialty||null, hospital||null, address||null, `upload:${source}`, 'active', JSON.stringify(['imported', source])]
  );
  TOTAL_CREATED++;
}

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

// ========== PARSER 1: Zoho CRM CSV ==========
async function importZohoCRM() {
  console.log('\n📄 [1/10] Zoho CRM Export (Contacts_2026_07_05.csv)...');
  const text = fs.readFileSync('/mnt/agents/upload/Contacts_2026_07_05.csv', 'utf-8');
  const lines = text.split('\n');
  if (lines.length < 2) return;
  
  // Parse header
  const headers = lines[0].split(',').map(h => h.trim());
  const nameIdx = headers.findIndex(h => h.includes('Contact Name'));
  const phoneIdx = headers.findIndex(h => h === 'Phone');
  const mobileIdx = headers.findIndex(h => h === 'Mobile');
  const emailIdx = headers.findIndex(h => h === 'Email');
  const titleIdx = headers.findIndex(h => h === 'Title');;
  const specialtyIdx = headers.findIndex(h => h.includes('Specialized'));
  const cityIdx = headers.findIndex(h => h.includes('City'));
  const districtIdx = headers.findIndex(h => h.includes('District'));
  const hospitalIdx = headers.findIndex(h => h.includes('Hospital'));
  
  let count = 0;
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    const name = cleanName(parts[nameIdx]);
    const phone = cleanPhone(parts[mobileIdx] || parts[phoneIdx]);
    if (!name || !phone || name.length < 3) continue;
    const email = parts[emailIdx]?.trim() || null;
    const specialty = parts[specialtyIdx]?.trim() || parts[titleIdx]?.trim() || null;
    const district = parts[districtIdx]?.trim() || parts[cityIdx]?.trim() || null;
    const hospital = parts[hospitalIdx]?.trim() || null;
    await createContact(name, phone, email, district, specialty, hospital, null, 'zoho-crm-export');
    count++;
  }
  console.log(`   ✅ ${count} contacts processed`);
}

// ========== PARSER 2: DOCTORS-Mobile-Numbers-List (XLSX) ==========
async function importDoctorsMobileXLSX() {
  console.log('\n📄 [2/10] Doctors Mobile Numbers List (XLSX)...');
  const buf = fs.readFileSync('/mnt/agents/upload/719548903-DOCTORS-Mobile-Numbers-List.xlsx');
  const wb = XLSX.read(buf, { type: 'buffer' });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
  
  let count = 0;
  for (const row of rows.slice(1)) {
    if (!row || row.length < 2) continue;
    const name = cleanName(row[0]);
    const phone = cleanPhone(row[1]);
    if (!name || !phone) continue;
    const memNo = row[2] || '';
    const email = String(row[3] || '').trim() || null;
    const address = String(row[4] || '').trim() || null;
    const city = String(row[5] || '').trim() || null;
    const state = String(row[6] || '').trim() || null;
    await createContact(name, phone, email, city, null, null, address, 'doctors-mobile-list');
    count++;
  }
  console.log(`   ✅ ${count} contacts processed`);
}

// ========== PARSER 3: List-of-Doctors (TXT fixed-width) ==========
async function importListOfDoctorsTXT() {
  console.log('\n📄 [3/10] List of Doctors (TXT)...');
  const text = fs.readFileSync('/mnt/agents/upload/745804958-520810340-List-of-Doctors.txt', 'utf-8');
  const lines = text.split('\n');
  
  let count = 0, i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    // Name is on one line, phone on next
    if (!line || line.includes('Name') || line.includes('Mob No')) { i++; continue; }
    
    const name = cleanName(line);
    if (!name || name.length < 3 || name.length > 60) { i++; continue; }
    
    // Look for phone in next few lines
    let phone = null;
    for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
      const p = cleanPhone(lines[j]);
      if (p) { phone = p; i = j; break; }
    }
    
    if (phone) {
      await createContact(name, phone, null, null, null, null, null, 'list-of-doctors-txt');
      count++;
    }
    i++;
  }
  console.log(`   ✅ ${count} contacts processed`);
}

// ========== PARSER 4: Doctor Speciality Mobile Area (XLSX) ==========
async function importDoctorSpecialityXLSX() {
  console.log('\n📄 [4/10] Doctor Speciality Mobile Area (XLSX)...');
  const buf = fs.readFileSync('/mnt/agents/upload/865701116-d35f3638-3ee8-4910-9f53-dd84908467a5.xlsx');
  const wb = XLSX.read(buf, { type: 'buffer' });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
  
  let count = 0;
  for (const row of rows.slice(1)) {
    if (!row || row.length < 3) continue;
    const name = cleanName(row[1]);
    const specialty = String(row[2] || '').trim() || null;
    const phone = cleanPhone(row[3]);
    const area = String(row[4] || '').trim() || null;
    if (!name || !phone) continue;
    await createContact(name, phone, null, area, specialty, null, null, 'doctor-speciality-area');
    count++;
  }
  console.log(`   ✅ ${count} contacts processed`);
}

// ========== PARSER 5: GHMC Hospital Doctors (TXT) ==========
async function importGHMCDoctors() {
  console.log('\n📄 [5/10] GHMC Hospital Doctors (TXT)...');
  const text = fs.readFileSync('/mnt/agents/upload/253893188-Dotctors-Contact-with-in-GHMC-n-Hospitals-Lists-of-APNA-pdf.txt', 'utf-8');
  const lines = text.split('\n').map(l => l.trimEnd());
  
  let count = 0, hospital = '', i = 0;
  while (i < lines.length) {
    const line = lines[i];
    
    // Detect hospital name (usually has "HOSPITAL" or "CENTRE")
    if (line.match(/HOSPITAL|CENTRE|CLINIC|NURSING/i) && line.length < 80) {
      hospital = line.trim();
      i++;
      continue;
    }
    
    // Detect doctor name (starts with Dr.)
    if (line.match(/^Dr\.?\s+/i)) {
      const name = cleanName(line);
      
      // Look for phone in next 3 lines
      let phone = null, address = '';
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const p = cleanPhone(lines[j]);
        if (p) { phone = p; }
        if (lines[j].match(/\d{6}/) && !cleanPhone(lines[j])) {
          address = lines[j].trim();
        }
      }
      
      if (name && phone) {
        await createContact(name, phone, null, 'Hyderabad', null, hospital, address || null, 'ghmc-hospital-doctors');
        count++;
      }
    }
    i++;
  }
  console.log(`   ✅ ${count} contacts processed`);
}

// ========== PARSER 6: Members Directory (TXT) ==========
async function importMembersDirectory() {
  console.log('\n📄 [6/10] Members Directory (TXT)...');
  const text = fs.readFileSync('/mnt/agents/upload/694991347-Members-Directory.txt', 'utf-8');
  const lines = text.split('\n');
  
  let count = 0;
  for (const line of lines) {
    // Pattern: Mem no, Dr. Name, Designation, Address, City, Mobile, Email
    const match = line.match(/Dr\.\s*([A-Za-z\s.]+?)\s+(?:Resident|Senior|Assistant|Professor|Prof|Consultant|Director|Head)?\s*.*?([6-9]\d{9})/);
    if (match) {
      const name = cleanName('Dr. ' + match[1]);
      const phone = match[2];
      // Extract city
      const cityMatch = line.match(/(Hyderabad|Bangalore|Mumbai|New Delhi|Chennai|Pune|Kolkata)/);
      const city = cityMatch ? cityMatch[1] : null;
      // Extract email
      const emailMatch = line.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      const email = emailMatch ? emailMatch[0] : null;
      
      if (name && phone && name.length > 3) {
        await createContact(name, phone, email, city, null, null, null, 'members-directory');
        count++;
      }
    }
  }
  console.log(`   ✅ ${count} contacts processed`);
}

// ========== PARSER 7: Telangana Members (TXT) ==========
async function importTelanganaMembers() {
  console.log('\n📄 [7/10] Telangana Members (TXT)...');
  const text = fs.readFileSync('/mnt/agents/upload/558808574-member-telangana.txt', 'utf-8');
  const lines = text.split('\n');
  
  let count = 0;
  for (const line of lines) {
    // Pattern: TS/2015/01 Dr L Vijaya Mamata Medical College 07702305352 email address
    const match = line.match(/Dr\.?\s*([A-Za-z\s.]+?)\s+(?:Mamata|Chalmeda|Deccan|SL|Area|District|\d)/);
    const phoneMatch = line.match(/\b([6-9]\d{9})\b/);
    
    if (match && phoneMatch) {
      const name = cleanName('Dr. ' + match[1]);
      const phone = phoneMatch[1];
      const emailMatch = line.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      const email = emailMatch ? emailMatch[0] : null;
      
      if (name.length > 3) {
        await createContact(name, phone, email, null, null, null, null, 'telangana-members');
        count++;
      }
    }
  }
  console.log(`   ✅ ${count} contacts processed`);
}

// ========== PARSER 8: Andhra Pradesh CHC Doctors (TXT) ==========
async function importAPCHCDoctors() {
  console.log('\n📄 [8/10] Andhra Pradesh CHC Doctors (TXT)...');
  const text = fs.readFileSync('/mnt/agents/upload/640233256-Andhra-Pradesh-2023.txt', 'utf-8');
  const lines = text.split('\n');
  
  let count = 0;
  for (const line of lines) {
    // Pattern: Dr.Name, MD, GM, Institution, Mobile
    const drMatch = line.match(/(Dr\.?[A-Za-z\s.]+?)(?:\s*,\s*|\s+MD|\s+GM|\s+MS|\s+MBBS|\s+\d{5})/);
    const phoneMatch = line.match(/\b([6-9]\d{9})\b/);
    const specMatch = line.match(/(General Medicine|PLUMONOLOGY|CARDIOLOGY|ORTHOPAEDICS|SURGERY|PEDIATRICS|GYNECOLOGY|DERMATOLOGY|OPHTHALMOLOGY|ENT|ANAESTHESIA|RADIOLOGY|PATHOLOGY)/i);
    const districtMatch = line.match(/(Alluri Sitharama Raju|Anakapalli|Anantapur|Annamayya|Bapatla|Chittoor|East Godavari|Eluru|Guntur|Kadapa|Kakinada|Konaseema|Krishna|Kurnool|Nandyal|Nellore|NTR|Palnadu|Parvathipuram Manyam|Prakasam|Sri Potti Sriramulu Nellore|Srikakulam|Visakhapatnam|Vizianagaram|West Godavari)/i);
    
    if (drMatch && phoneMatch) {
      const name = cleanName(drMatch[1]);
      const phone = phoneMatch[1];
      const specialty = specMatch ? specMatch[1] : null;
      const district = districtMatch ? districtMatch[1] : null;
      
      if (name.length > 3) {
        await createContact(name, phone, null, district, specialty, null, null, 'ap-chc-doctors-2023');
        count++;
      }
    }
  }
  console.log(`   ✅ ${count} contacts processed`);
}

// ========== PARSER 9: KMC Warangal (TXT) ==========
async function importKMCWarangal() {
  console.log('\n📄 [9/10] KMC Warangal Doctors (TXT)...');
  const text = fs.readFileSync('/mnt/agents/upload/794772703-KMCWARANGAL.txt', 'utf-8');
  const lines = text.split('\n');
  
  let count = 0;
  for (const line of lines) {
    // Pattern: DR.NAME DEPARTMENT DESIGNATION DATE MOBILE EMAIL
    const match = line.match(/(DR\.\s*[A-Za-z\s.]+?)\s+(NEURO\s*SURGERY|OPTHALMOLOGY|PATHOLOGY|ANAESTHESIA|G\.MEDICINE|PSYCHIATRY|PHARMACOLOGY|ORTHOPAEDICS|ENT|PAEDIATRICS|GENERAL\s*SURGERY|RADIOLOGY|DERMATOLOGY|OBG)/i);
    const phoneMatch = line.match(/\b([6-9]\d{9})\b/);
    const emailMatch = line.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    
    if (match && phoneMatch) {
      const name = cleanName(match[1]);
      const dept = match[2];
      const phone = phoneMatch[1];
      const email = emailMatch ? emailMatch[0] : null;
      
      if (name.length > 3) {
        await createContact(name, phone, email, 'Warangal', dept, 'KMC Warangal', null, 'kmc-warangal');
        count++;
      }
    }
  }
  console.log(`   ✅ ${count} contacts processed`);
}

// ========== PARSER 10: TOS Life Members (XLSX) ==========
async function importTOSMembers() {
  console.log('\n📄 [10/10] TOS Life Members (XLSX)...');
  const buf = fs.readFileSync('/mnt/agents/upload/886388647-TOS-Life-Members.xlsx');
  const wb = XLSX.read(buf, { type: 'buffer' });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
  
  let count = 0;
  for (const row of rows.slice(1)) {
    if (!row || row.length < 2) continue;
    const name = cleanName(row[1]);
    const phone = cleanPhone(row[4]);
    if (!name || !phone || name.toLowerCase().includes('expired')) continue;
    
    const city = String(row[3] || '').trim() || null;
    const email = String(row[5] || '').trim() || null;
    const address = String(row[2] || '').trim() || null;
    
    await createContact(name, phone, email, city, 'Ophthalmology', null, address, 'tos-life-members');
    count++;
  }
  console.log(`   ✅ ${count} contacts processed`);
}

// ========== PARSER 11: Rahul List (TXT) ==========
async function importRahulList() {
  console.log('\n📄 [11/11] Rahul List (TXT)...');
  const text = fs.readFileSync('/mnt/agents/upload/837621294-rahul-list.txt', 'utf-8');
  const lines = text.split('\n');
  
  let count = 0;
  for (const line of lines) {
    const match = line.match(/([A-Za-z\s.]+?)\s+(?:Once|Visit|DM|EN|GP)\s+(?:DM\d+|EN\d+|GP\d+|\d+)\s+(?:MBBS|MS|MD|DD)?\s*.*?([6-9]\d{9})/);
    if (match) {
      const name = cleanName(match[1]);
      const phone = match[2];
      if (name.length > 3) {
        await createContact(name, phone, null, null, null, null, null, 'rahul-list');
        count++;
      }
    }
  }
  console.log(`   ✅ ${count} contacts processed`);
}

// ========== RUN ALL ==========
console.log('🚀 MEGA IMPORT STARTING...');
console.time('Total Import');

await importZohoCRM();
await importDoctorsMobileXLSX();
await importListOfDoctorsTXT();
await importDoctorSpecialityXLSX();
await importGHMCDoctors();
await importMembersDirectory();
await importTelanganaMembers();
await importAPCHCDoctors();
await importKMCWarangal();
await importTOSMembers();
await importRahulList();

console.timeEnd('Total Import');
console.log(`\n🎉 MEGA IMPORT COMPLETE!`);
console.log(`   Created: ${TOTAL_CREATED}`);
console.log(`   Merged: ${TOTAL_MERGED}`);
console.log(`   Skipped: ${TOTAL_SKIPPED}`);
console.log(`   Total processed: ${TOTAL_CREATED + TOTAL_MERGED + TOTAL_SKIPPED}`);

await conn.end();
