import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import * as XLSX from 'xlsx';

const conn = await mysql.createConnection({
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: '4CtfDUMzvSsZL7c.root',
  password: '41ZOclbIOnTLB8tF',
  database: 'test',
  ssl: { rejectUnauthorized: true }
});

let totalCreated = 0;
let totalMerged = 0;
let totalSkipped = 0;

// ==========================================
// HELPER: Check if contact exists by phone
// ==========================================
async function findByPhone(phone) {
  if (!phone) return null;
  const norm = phone.replace(/\D/g, '');
  if (norm.length < 10) return null;
  const last10 = norm.slice(-10);
  const [rows] = await conn.query('SELECT * FROM contacts WHERE phone = ? OR REPLACE(REPLACE(phone, "-", ""), " ", "") LIKE ?', [phone, `%${last10}`]);
  return rows[0] || null;
}

// ==========================================
// HELPER: Smart merge or create
// ==========================================
async function mergeOrCreate(record) {
  const existing = await findByPhone(record.phone);
  
  if (existing) {
    // Merge: fill empty fields only
    const updates = {};
    if (!existing.email && record.email) updates.email = record.email;
    if (!existing.phone && record.phone) updates.phone = record.phone;
    if (!existing.district && record.district) updates.district = record.district;
    if (!existing.specialty && record.specialty) updates.specialty = record.specialty;
    if (!existing.hospital && record.hospital) updates.hospital = record.hospital;
    if (!existing.address && record.address) updates.address = record.address;
    
    if (Object.keys(updates).length > 0) {
      const setClause = Object.keys(updates).map(k => `${k} = ?`).join(', ');
      await conn.query(`UPDATE contacts SET ${setClause} WHERE id = ?`, [...Object.values(updates), existing.id]);
      totalMerged++;
    } else {
      totalSkipped++;
    }
    return 'merged';
  }
  
  // Create new
  await conn.query(
    'INSERT INTO contacts (name, type, phone, email, address, district, specialty, hospital, source, status, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      record.name || 'Unknown',
      record.hospital ? 'doctor' : 'doctor',
      record.phone || null,
      record.email || null,
      record.address || null,
      record.district || null,
      record.specialty || null,
      record.hospital || null,
      `upload:${record.sourceFile}`,
      'active',
      JSON.stringify(['imported', `from:${record.sourceFile}`])
    ]
  );
  totalCreated++;
  return 'created';
}

// ==========================================
// PARSER 1: Nephrologist TXT
// ==========================================
async function importNephrologist() {
  console.log('\n=== IMPORTING NEPHROLOGISTS ===');
  const text = fs.readFileSync('/mnt/agents/upload/415462234-Nephrologist-numbers-pdf.txt', 'utf-8');
  const lines = text.split('\n').map(l => l).filter(l => l.trim());
  
  const cities = ['Hyderabad','Secunderabad','Warangal','Karimnagar','Nizamabad','Khammam','Nalgonda','Mahbubnagar','Medak','Adilabad','Kakinada','Rajahmundry','Vijayawada','Vishakapatnam','Tirupati','Guntur','Nellore','Kurnool','Kadapa','Anantapur','Chittoor','Ongole','Bhimavaram','Eluru','Srikakulam','Cuddapah','Kurnool','Kakinada','Karimnagar','Kurnool','Nalgonda','Nellore','Nizamabad','Rajahmundry','Srikakulam','Tirupati','Vijayawada','Vishakapatnam','Warangal'];
  
  let currentDistrict = '';
  let currentState = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Skip headers
    if (trimmed.includes('Doctor Name') || trimmed.includes('Landline') || trimmed.includes('Mobile No') || trimmed.includes('Andhra Pradesh') || trimmed.includes('Karnataka') || trimmed.includes('Telangana')) continue;
    
    // Detect city
    const foundCity = cities.find(c => trimmed.toLowerCase() === c.toLowerCase());
    if (foundCity && trimmed.length < 40) {
      currentDistrict = foundCity;
      continue;
    }
    
    // Extract mobile from this line or next few lines
    const chunk = lines.slice(i, Math.min(i + 4, lines.length)).join(' ');
    const mobileMatch = chunk.match(/\b([7-9]\d{9})\b/);
    if (!mobileMatch) continue;
    
    const mobile = mobileMatch[1];
    
    // Extract name - check current and previous lines
    let name = '';
    const beforePhone = line.substring(0, line.indexOf(mobile) > 0 ? line.indexOf(mobile) : 60).trim();
    
    if (beforePhone.length > 2 && beforePhone.match(/[a-zA-Z]{2,}/) && !beforePhone.match(/^\d{3,}/)) {
      name = beforePhone.replace(/[,;]\s*$/, '').trim();
    }
    
    // If no name, try previous line
    if (!name && i > 0) {
      const prev = lines[i - 1].trim();
      if (prev.length > 2 && prev.length < 60 && prev.match(/[a-zA-Z]{2,}/) && !prev.match(/^\d{5,}/)) {
        name = prev;
      }
    }
    
    if (!name || name.length < 3) continue;
    
    // Extract email
    const emailMatch = chunk.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const email = emailMatch ? emailMatch[0] : null;
    
    // Extract hospital from address lines
    let address = '';
    const addrLines = [];
    for (let j = i; j < Math.min(i + 4, lines.length); j++) {
      const l = lines[j].trim();
      if (l.match(/^[A-Z][a-z]+\s+[A-Z]/)) break;
      if (l.includes(mobile)) {
        const afterPhone = l.substring(l.indexOf(mobile) + 10).trim();
        if (afterPhone.length > 3) addrLines.push(afterPhone);
      } else if (l.length > 5 && !l.match(/^\d{10}$/)) {
        addrLines.push(l);
      }
    }
    address = addrLines.join(', ').replace(/,\s*,/g, ',').trim();
    
    // Extract hospital name
    let hospital = null;
    const hospMatch = address.match(/([A-Za-z\s]+(?:Hospital|Clinic|Centre|Center|Institute|Foundation|Care|Medical|Kidney Care|Nephro Care))/i);
    if (hospMatch) hospital = hospMatch[1].trim();
    
    await mergeOrCreate({
      name, phone: mobile, email, address,
      district: currentDistrict || null,
      specialty: 'Nephrology',
      hospital,
      sourceFile: '415462234-Nephrologist-numbers-pdf.txt'
    });
  }
  
  console.log(`Nephrologists done!`);
}

// ==========================================
// PARSER 2: Gynecology TXT
// ==========================================
async function importGynecologyTXT() {
  console.log('\n=== IMPORTING GYNECOLOGY (TXT) ===');
  const text = fs.readFileSync('/mnt/agents/upload/525197645-CFW-AP-Gynecology.txt', 'utf-8');
  const lines = text.split('\n').filter(l => l.trim());
  
  for (const line of lines) {
    // Match: S.No + Name + Mobile (10 digits starting with 6/7/8/9)
    const match = line.match(/^\s*\d+\s+([A-Za-z\s.]+?)\s+([6-9]\d{9})\s/);
    if (!match) continue;
    
    const name = match[1].trim();
    const mobile = match[2];
    
    // Skip headers
    if (name.toLowerCase().includes('name of candidate') || name.toLowerCase().includes('candidate')) continue;
    if (name.length < 3) continue;
    
    await mergeOrCreate({
      name, phone: mobile, email: null, address: null,
      district: null, specialty: 'Obstetrics & Gynecology', hospital: null,
      sourceFile: '525197645-CFW-AP-Gynecology.txt'
    });
  }
  
  console.log(`Gynecology TXT done!`);
}

// ==========================================
// PARSER 3: Gynecology XLSX
// ==========================================
async function importGynecologyXLSX() {
  console.log('\n=== IMPORTING GYNECOLOGY (XLSX) ===');
  const buffer = fs.readFileSync('/mnt/agents/upload/525197645-CFW-AP-Gynecology.xlsx');
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  let dataStarted = false;
  
  for (const row of rows) {
    if (!row || row.length < 3) continue;
    
    const firstCol = String(row[0] || '').trim();
    
    // Wait for data rows to start
    if (!dataStarted) {
      if (firstCol === '1' || firstCol === 1) dataStarted = true;
      else continue;
    }
    
    // Find name and mobile in the row
    let name = '';
    let mobile = '';
    
    for (let i = 1; i < row.length; i++) {
      const val = String(row[i] || '').trim();
      if (!name && val.length > 2 && val.match(/[a-zA-Z]{2,}/) && !val.match(/^\d+$/)) {
        name = val;
      } else if (!mobile && val.match(/^[6-9]\d{9}$/)) {
        mobile = val;
      }
      if (name && mobile) break;
    }
    
    if (name && mobile && name.length > 2) {
      await mergeOrCreate({
        name, phone: mobile, email: null, address: null,
        district: null, specialty: 'Obstetrics & Gynecology', hospital: null,
        sourceFile: '525197645-CFW-AP-Gynecology.xlsx'
      });
    }
  }
  
  console.log(`Gynecology XLSX done!`);
}

// ==========================================
// RUN ALL IMPORTS
// ==========================================
console.log('Starting bulk import...');
console.time('Import');

await importNephrologist();
await importGynecologyTXT();
await importGynecologyXLSX();

console.timeEnd('Import');
console.log(`\n=== RESULTS ===`);
console.log(`Created: ${totalCreated}`);
console.log(`Merged: ${totalMerged}`);
console.log(`Skipped (duplicates): ${totalSkipped}`);
console.log(`Total processed: ${totalCreated + totalMerged + totalSkipped}`);

await conn.end();
console.log('\nDone!');
