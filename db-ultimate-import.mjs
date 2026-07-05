import mysql from 'mysql2/promise';
import fs from 'fs';
import * as XLSX from 'xlsx';

const conn = await mysql.createConnection({
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com', port: 4000,
  user: '4CtfDUMzvSsZL7c.root', password: '41ZOclbIOnTLB8tF',
  database: 'test', ssl: { rejectUnauthorized: true }, multipleStatements: true
});

// Get existing phones for dedup
const [existing] = await conn.query('SELECT phone FROM contacts WHERE phone IS NOT NULL');
const existingPhones = new Set();
for (const r of existing) {
  const n = String(r.phone).replace(/\D/g, '');
  if (n.length >= 10) existingPhones.add(n.slice(-10));
}
console.log(`Existing: ${existing.length} contacts`);

let BATCH = [], CREATED = 0, DUPES = 0;
const BATCH_SIZE = 300;

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
function add(name, phone, email, district, specialty, hospital, address, source) {
  if (!name || name.length < 2) return;
  const ph = cleanPhone(phone);
  if (!ph) return;
  if (existingPhones.has(ph)) { DUPES++; return; }
  existingPhones.add(ph);
  BATCH.push([name.substring(0,100), 'doctor', ph, email?email.substring(0,100):null, district?district.substring(0,100):null, specialty?specialty.substring(0,100):null, hospital?hospital.substring(0,100):null, address?address.substring(0,255):null, 'upload:'+source, 'active', JSON.stringify(['imported', source])]);
  if (BATCH.length >= BATCH_SIZE) return flush();
}
async function flush() {
  if (BATCH.length === 0) return;
  const sql = 'INSERT INTO contacts (name,type,phone,email,district,specialty,hospital,address,source,status,tags) VALUES ' + BATCH.map(()=>'(?,?,?,?,?,?,?,?,?,?,?)').join(',');
  try { await conn.query(sql, BATCH.flat()); CREATED += BATCH.length; } catch(e) {}
  BATCH = [];
}

// ========== AUTO-DETECT COLUMN HEADERS ==========
function detectColumns(headers) {
  const h = headers.map(x => String(x || '').toLowerCase().trim());
  const find = (keywords) => {
    for (let i = 0; i < h.length; i++) {
      if (!h[i]) continue;
      for (const kw of keywords) {
        if (h[i].includes(kw)) return i;
      }
    }
    return -1;
  };
  return {
    name: find(['name', 'doctor name', 'doctor', 'business name', 'full name', 'contact name']),
    firstName: find(['first name', 'firstname']),
    lastName: find(['last name', 'lastname']),
    phone: find(['phone', 'mobile', 'cell', 'phone1', 'contact number']),
    phone2: find(['phone2', 'alt phone', 'alternative']),
    email: find(['email', 'e-mail', 'mail id']),
    specialty: find(['speciality', 'specialty', 'department', 'dept', 'expertise']),
    hospital: find(['hospital', 'clinic', 'institute', 'account name', 'center', 'centre', 'nursing home']),
    city: find(['city', 'town']),
    district: find(['district', 'area', 'location']),
    state: find(['state', 'region']),
    address: find(['address', 'street', 'full address']),
  };
}

function getName(row, cols) {
  if (cols.name >= 0 && row[cols.name]) return cleanName(row[cols.name]);
  if (cols.firstName >= 0 || cols.lastName >= 0) {
    const fn = row[cols.firstName] || '';
    const ln = row[cols.lastName] || '';
    const name = cleanName(`${fn} ${ln}`.trim());
    if (name) return name;
  }
  return null;
}

function getPhone(row, cols) {
  let ph = cleanPhone(row[cols.phone]);
  if (!ph && cols.phone2 >= 0) ph = cleanPhone(row[cols.phone2]);
  return ph;
}

function getValue(row, colIdx) {
  if (colIdx === undefined || colIdx < 0) return null;
  const v = row[colIdx];
  return v ? String(v).trim() : null;
}

// ========== IMPORT XLSX/CSV ==========
async function importExcel(filePath, source, opts = {}) {
  const buf = fs.readFileSync(filePath);
  const wb = XLSX.read(buf, { type: 'buffer' });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
  if (rows.length < 2) return 0;
  
  const cols = opts.cols || detectColumns(rows[0]);
  console.log(`  Columns: name=${cols.name}, phone=${cols.phone}, email=${cols.email}, specialty=${cols.specialty}, hospital=${cols.hospital}, city=${cols.city}`);
  
  let count = 0;
  const startRow = opts.startRow || 1;
  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const name = getName(row, cols);
    const phone = getPhone(row, cols);
    if (!name || !phone || name.length < 2) continue;
    if (name.toLowerCase().includes('name') || name.toLowerCase().includes('total') || name.toLowerCase().includes('grand')) continue;
    
    const email = getValue(row, cols.email);
    const specialty = getValue(row, cols.specialty);
    const hospital = getValue(row, cols.hospital);
    const city = getValue(row, cols.city) || getValue(row, cols.district);
    const state = getValue(row, cols.state);
    const district = city || state ? `${city || ''}${city && state ? ', ' : ''}${state || ''}` : null;
    const address = getValue(row, cols.address);
    
    add(name, phone, email, district, specialty, hospital, address, source);
    count++;
  }
  await flush();
  return count;
}

// ========== IMPORT TXT (name + phone patterns) ==========
async function importTXT(filePath, source, opts = {}) {
  const text = fs.readFileSync(filePath, 'utf-8');
  const lines = text.split('\n');
  let count = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Try to find phone number
    const phoneMatch = line.match(/\b([6-9]\d{9})\b/);
    if (!phoneMatch) continue;
    
    const phone = phoneMatch[1];
    let name = '';
    
    // Try to extract name from same line (before phone)
    const beforePhone = line.substring(0, line.indexOf(phoneMatch[0])).trim();
    if (beforePhone.length > 2 && beforePhone.match(/[a-zA-Z]/)) {
      name = cleanName(beforePhone.replace(/[,;]$/, ''));
    }
    
    // If no name, try previous line
    if (!name && i > 0) {
      const prev = lines[i - 1].trim();
      if (prev.length > 2 && prev.length < 80 && prev.match(/[a-zA-Z]/) && !prev.match(/^\d{5,}/) && !prev.includes('@')) {
        name = cleanName(prev);
      }
    }
    
    if (!name || name.length < 3 || name.toLowerCase().includes('doctor name') || name.toLowerCase().includes('candidate')) continue;
    
    // Extract email
    const emailMatch = line.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const email = emailMatch ? emailMatch[0] : null;
    
    add(name, phone, email, null, null, null, null, source);
    count++;
  }
  await flush();
  return count;
}

// ========== IMPORT PDF (read as text) ==========
async function importPDF(filePath, source) {
  // Try to find a corresponding .txt file (already extracted)
  const txtPath = filePath.replace('.pdf', '.txt');
  if (fs.existsSync(txtPath)) {
    return importTXT(txtPath, source);
  }
  console.log(`  No TXT extraction for ${filePath}, skipping PDF`);
  return 0;
}

// ========== RUN IMPORTS ==========
console.log('\n🚀 ULTIMATE IMPORT STARTING...');
console.time('Total');

// 1. AP-TS Doctors for ISP (rich data: name, specialty, hospital, city, phone, email)
console.log('\n[1] AP-TS Doctors for ISP...');
const c1 = await importExcel('/mnt/agents/upload/785033692-AP-TS-Doctors-for-ISP.xlsx', 'ap-ts-doctors-isp');
console.log(`  ✅ ${c1} doctors`);

// 2. Doctors Consolidated Master Data
console.log('\n[2] Doctors Consolidated Master Data...');
const c2 = await importExcel('/mnt/agents/upload/803728455-Doctors-Consolidated-Master-Data.xlsx', 'consolidated-master', { startRow: 1 });
console.log(`  ✅ ${c2} doctors`);

// 3. Doctor-108949 (Hospital directory)
console.log('\n[3] Doctor 108949 (Hospitals)...');
const c3 = await importExcel('/mnt/agents/upload/873079709-Doctor-108949.xlsx', 'doctor-108949');
console.log(`  ✅ ${c3} entries`);

// 4. Hyderabad Dr Compare
console.log('\n[4] Hyderabad Dr Compare...');
const c4 = await importExcel('/mnt/agents/upload/948267230-Hyd-Dr-Compare.xlsx', 'hyd-dr-compare');
console.log(`  ✅ ${c4} doctors`);

// 5. Telangana Network (hospitals)
console.log('\n[5] Telangana Network...');
const c5 = await importExcel('/mnt/agents/upload/959040860-Telangana-Network.xlsx', 'telangana-network');
console.log(`  ✅ ${c5} hospitals`);

// 6. Central Zone 5
console.log('\n[6] Central Zone 5...');
const c6 = await importExcel('/mnt/agents/upload/861574218-Central-Zone5.xlsx', 'central-zone5');
console.log(`  ✅ ${c6} doctors`);

// 7. Dental 2150
console.log('\n[7] Dental 2150...');
const c7 = await importExcel('/mnt/agents/upload/752970888-Dental-2150.xlsx', 'dental-2150');
console.log(`  ✅ ${c7} dentists`);

// 8. Orthopaedic doctors
console.log('\n[8] Orthopaedic Doctors...');
const c8 = await importExcel('/mnt/agents/upload/949120942-Orthopaedic-doctors-of-Bihar-jharkhand-and-uttar-pradesh-state.xlsx', 'ortho-doctors');
console.log(`  ✅ ${c8} ortho doctors`);

// 9. District Wise Providers
console.log('\n[9] District Wise Providers...');
const c9 = await importExcel('/mnt/agents/upload/807761768-District-Wise-Providers-List-in-Male-Female-Sterlisation.xlsx', 'district-providers');
console.log(`  ✅ ${c9} providers`);

// 10. Doctors in Telangana
console.log('\n[10] Doctors in Telangana...');
const c10 = await importExcel('/mnt/agents/upload/963270227-Doctors-in-Telangana.xlsx', 'doctors-in-telangana');
console.log(`  ✅ ${c10} doctors`);

// 11. Doctors All India 30000 (the big one!)
console.log('\n[11] Doctors All India 30000 (BIG FILE)...');
const c11 = await importExcel('/mnt/agents/upload/889481376-Doctors-All-India-30000.xls', 'doctors-all-india');
console.log(`  ✅ ${c11} doctors`);

// 12. Cashless Hospital Lists
console.log('\n[12] Cashless Hospital Lists...');
const c12 = await importExcel('/mnt/agents/upload/881465760-Cashless-Hospital-Lists.xlsx', 'cashless-hospitals');
console.log(`  ✅ ${c12} hospitals`);

// 13. Hospital Data
console.log('\n[13] Hospital Data...');
const c13 = await importExcel('/mnt/agents/upload/61919507-Hospital-Data.xls', 'hospital-data');
console.log(`  ✅ ${c13} hospitals`);

// 14. TOS Life Members (new duplicate)
console.log('\n[14] TOS Life Members (new)...');
const c14 = await importExcel('/mnt/agents/upload/886388647-TOS-Life-Members(1).xlsx', 'tos-life-members-new');
console.log(`  ✅ ${c14} members`);

// 15. Output-1
console.log('\n[15] Output 1...');
const c15 = await importExcel('/mnt/agents/upload/898061503-output-1.xlsx', 'output-1');
console.log(`  ✅ ${c15} entries`);

// PDF imports (use existing TXT extractions)
console.log('\n[16] Pan India Doctor Data (1)...');
const c16 = await importPDF('/mnt/agents/upload/549578129-Pan-India-Doctor-Data (1).pdf', 'pan-india-1');
console.log(`  ✅ ${c16} entries`);

console.log('\n[17] Pan India Doctor Data...');
const c17 = await importPDF('/mnt/agents/upload/549578129-Pan-India-Doctor-Data.pdf', 'pan-india');
console.log(`  ✅ ${c17} entries`);

console.log('\n[18] Electoral College All States...');
const c18 = await importPDF('/mnt/agents/upload/525197611-Electoral-College-Of-All-States-Doctors-Data-With-Contact-Number.pdf', 'electoral-college');
console.log(`  ✅ ${c18} entries`);

console.log('\n[19] Electoral College All States (2)...');
const c19 = await importPDF('/mnt/agents/upload/525609273-Electoral-College-Of-All-States-Doctors-Data-With-Contact-Number.pdf', 'electoral-college-2');
console.log(`  ✅ ${c19} entries`);

console.log('\n[20] AP Doctors Database...');
const c20 = await importPDF('/mnt/agents/upload/514466525-484481380-Ap-Doctors-Data-base-xlsx.pdf', 'ap-doctors-db');
console.log(`  ✅ ${c20} entries`);

console.log('\n[21] DG Approved Doctors...');
const c21 = await importPDF('/mnt/agents/upload/818950573-DG-approved-Doctors-List-15032024.pdf', 'dg-approved-doctors');
console.log(`  ✅ ${c21} entries`);

console.log('\n[22] Bhadratha Hospital List...');
const c22 = await importPDF('/mnt/agents/upload/948604968-Bhadratha-Hospital-List-District-Wise-on-02-08-2023.pdf', 'bhadratha-hospitals');
console.log(`  ✅ ${c22} entries`);

console.log('\n[23] ICICI Lombard...');
const c23 = await importPDF('/mnt/agents/upload/903667149-ICICI-Lombard-updated.pdf', 'icici-lombard');
console.log(`  ✅ ${c23} entries`);

console.log('\n[24] Star Health...');
const c24 = await importPDF('/mnt/agents/upload/934381922-Star-Health1.pdf', 'star-health');
console.log(`  ✅ ${c24} entries`);

console.log('\n[25] Doctors Contact GHMC APNA...');
const c25 = await importPDF('/mnt/agents/upload/892701213-Doctors-Contact-within-GHMC-and-Hospitals-Lists-of-APNA-pdf.pdf', 'ghmc-apna');
console.log(`  ✅ ${c25} entries`);

console.log('\n[26] Member Telangana (PDF)...');
const c26 = await importPDF('/mnt/agents/upload/558808574-member-telangana.pdf', 'member-telangana-pdf');
console.log(`  ✅ ${c26} entries`);

console.log('\n[27] Doctors Member Andhra Pradesh...');
const c27 = await importPDF('/mnt/agents/upload/483433876-doctors-member-andhrapradesh.pdf', 'doctors-ap-pdf');
console.log(`  ✅ ${c27} entries`);

// Done!
await flush();
console.timeEnd('Total');

console.log(`\n🎉 ULTIMATE IMPORT COMPLETE!`);
console.log(`   New contacts created: ${CREATED}`);
console.log(`   Duplicates skipped: ${DUPES}`);
console.log(`   Total processed: ${CREATED + DUPES}`);

// Update stats
await conn.query('UPDATE contacts SET quality_score = LEAST(100, 20 + IF(phone IS NOT NULL AND LENGTH(phone) >= 10, 25, 0) + IF(hospital IS NOT NULL AND LENGTH(hospital) > 2, 15, 0) + IF(district IS NOT NULL AND LENGTH(district) > 1, 10, 0) + IF(specialty IS NOT NULL AND LENGTH(specialty) > 1, 10, 0) + IF(email IS NOT NULL AND email LIKE "%@%", 10, 0) + IF(division IS NOT NULL AND division != "unknown", 10, 0))');

const [summary] = await conn.query('SELECT COUNT(*) as total FROM contacts');
console.log(`\n📊 TOTAL DATABASE: ${summary[0].total} contacts`);

await conn.end();
