import mysql from 'mysql2/promise';
import fs from 'fs';
import * as XLSX from 'xlsx';

const conn = await mysql.createConnection({
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com', port: 4000,
  user: '4CtfDUMzvSsZL7c.root', password: '41ZOclbIOnTLB8tF',
  database: 'test', ssl: { rejectUnauthorized: true }, multipleStatements: true
});

const [existing] = await conn.query('SELECT phone FROM contacts WHERE phone IS NOT NULL');
const existingPhones = new Set();
for (const r of existing) {
  const n = String(r.phone).replace(/\D/g, '');
  if (n.length >= 10) existingPhones.add(n.slice(-10));
}

let BATCH = [], CREATED = 0, DUPES = 0;
function cleanPhone(p) { if(!p) return null; const s=String(p).replace(/\D/g,''); if(s.length===10)return s; if(s.length>10)return s.slice(-10); return null; }
function cleanName(n) { if(!n) return null; return String(n).trim().replace(/\s+/g,' ').replace(/[,;]$/,'').trim(); }
function add(name, phone, email, district, specialty, hospital, address, source) {
  if(!name||name.length<2)return;
  const ph=cleanPhone(phone); if(!ph)return;
  if(existingPhones.has(ph)){DUPES++;return;}
  existingPhones.add(ph);
  BATCH.push([name.substring(0,100),'doctor',ph,email?email.substring(0,100):null,district?district.substring(0,100):null,specialty?specialty.substring(0,100):null,hospital?hospital.substring(0,100):null,address?address.substring(0,255):null,'upload:'+source,'active',JSON.stringify(['imported',source])]);
}
async function flush() {
  if(BATCH.length===0)return;
  const sql='INSERT INTO contacts (name,type,phone,email,district,specialty,hospital,address,source,status,tags) VALUES '+BATCH.map(()=>'(?,?,?,?,?,?,?,?,?,?,?)').join(',');
  try{await conn.query(sql,BATCH.flat());CREATED+=BATCH.length;}catch(e){}
  BATCH=[];
}

function getCols(headers) {
  const h=headers.map(x=>String(x||'').toLowerCase().trim());
  const f=(kws)=>{for(let i=0;i<h.length;i++){if(!h[i])continue;for(const kw of kws)if(h[i].includes(kw))return i;}return -1;};
  return {name:f(['name','doctor name','doctor','business name','full name','contact name']),phone:f(['phone','mobile','cell','phone1','contact number']),email:f(['email','e-mail','mail id']),specialty:f(['speciality','specialty','department','dept','expertise']),hospital:f(['hospital','clinic','institute','account name','center','centre','nursing home']),city:f(['city','town']),district:f(['district','area','location']),state:f(['state','region']),address:f(['address','street','full address'])};
}

// Process ONE file at a time
async function processFile(path, source) {
  console.log(`Processing ${source}...`);
  const ext = path.toLowerCase();
  
  if (ext.endsWith('.xlsx') || ext.endsWith('.xls')) {
    const buf = fs.readFileSync(path);
    const wb = XLSX.read(buf, { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
    if (rows.length < 2) return 0;
    const cols = getCols(rows[0]);
    let count = 0;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i]; if (!r) continue;
      const name = cols.name >= 0 ? cleanName(r[cols.name]) : null;
      const phone = cols.phone >= 0 ? cleanPhone(r[cols.phone]) : null;
      if (!name || !phone || name.length < 2) continue;
      if (name.toLowerCase().includes('name') || name.toLowerCase().includes('total')) continue;
      const email = cols.email >= 0 ? (r[cols.email] ? String(r[cols.email]).trim() : null) : null;
      const specialty = cols.specialty >= 0 ? (r[cols.specialty] ? String(r[cols.specialty]).trim() : null) : null;
      const hospital = cols.hospital >= 0 ? (r[cols.hospital] ? String(r[cols.hospital]).trim() : null) : null;
      const city = cols.city >= 0 ? (r[cols.city] ? String(r[cols.city]).trim() : null) : null;
      const state = cols.state >= 0 ? (r[cols.state] ? String(r[cols.state]).trim() : null) : null;
      const district = city || state ? `${city || ''}${city && state ? ', ' : ''}${state || ''}` : null;
      const address = cols.address >= 0 ? (r[cols.address] ? String(r[cols.address]).trim() : null) : null;
      add(name, phone, email, district, specialty, hospital, address, source);
      count++;
    }
    await flush();
    return count;
  }
  
  if (ext.endsWith('.txt')) {
    const text = fs.readFileSync(path, 'utf-8');
    const lines = text.split('\n');
    let count = 0;
    for (let i = 0; i < lines.length; i++) {
      const pm = lines[i].match(/\b([6-9]\d{9})\b/);
      if (!pm) continue;
      let name = '';
      const before = lines[i].substring(0, lines[i].indexOf(pm[0])).trim();
      if (before.length > 2 && before.match(/[a-zA-Z]/)) name = cleanName(before.replace(/[,;]$/, ''));
      if (!name && i > 0) { const prev = lines[i-1].trim(); if (prev.length > 2 && prev.length < 80 && prev.match(/[a-zA-Z]/) && !prev.match(/^\d{5,}/)) name = cleanName(prev); }
      if (!name || name.length < 3 || name.toLowerCase().includes('doctor name') || name.toLowerCase().includes('candidate')) continue;
      const em = lines[i].match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      add(name, pm[1], em ? em[0] : null, null, null, null, null, source);
      count++;
    }
    await flush();
    return count;
  }
  
  if (ext.endsWith('.pdf')) {
    const txtPath = path.replace('.pdf', '.txt');
    if (fs.existsSync(txtPath)) {
      return processFile(txtPath, source);
    }
  }
  return 0;
}

// Process top priority files
const files = [
  ['/mnt/agents/upload/785033692-AP-TS-Doctors-for-ISP.xlsx', 'ap-ts-isp'],
  ['/mnt/agents/upload/948267230-Hyd-Dr-Compare.xlsx', 'hyd-compare'],
  ['/mnt/agents/upload/873079709-Doctor-108949.xlsx', 'doctor-108949'],
  ['/mnt/agents/upload/803728455-Doctors-Consolidated-Master-Data.xlsx', 'consolidated-master'],
  ['/mnt/agents/upload/861574218-Central-Zone5.xlsx', 'central-zone5'],
  ['/mnt/agents/upload/752970888-Dental-2150.xlsx', 'dental-2150'],
  ['/mnt/agents/upload/949120942-Orthopaedic-doctors-of-Bihar-jharkhand-and-uttar-pradesh-state.xlsx', 'ortho-bihar'],
  ['/mnt/agents/upload/807761768-District-Wise-Providers-List-in-Male-Female-Sterlisation.xlsx', 'district-providers'],
  ['/mnt/agents/upload/963270227-Doctors-in-Telangana.xlsx', 'doctors-telangana'],
  ['/mnt/agents/upload/959040860-Telangana-Network.xlsx', 'telangana-network'],
  ['/mnt/agents/upload/889481376-Doctors-All-India-30000.xls', 'all-india-30k'],
  ['/mnt/agents/upload/881465760-Cashless-Hospital-Lists.xlsx', 'cashless-hospitals'],
  ['/mnt/agents/upload/898061503-output-1.xlsx', 'output-1'],
  ['/mnt/agents/upload/886388647-TOS-Life-Members(1).xlsx', 'tos-new'],
  ['/mnt/agents/upload/61919507-Hospital-Data.xls', 'hospital-data'],
  ['/mnt/agents/upload/393932844-392246292-Book1-1-351-777-pdf.txt', 'book1-pdf'],
  ['/mnt/agents/upload/396582068-TOS-Life-Members.xlsx', 'tos-life-old'],
  ['/mnt/agents/upload/745804958-520810340-List-of-Doctors.pdf', 'list-of-doctors'],
  ['/mnt/agents/upload/745804958-520810340-List-of-Doctors (1).pdf', 'list-of-doctors-2'],
  ['/mnt/agents/upload/549578129-Pan-India-Doctor-Data.pdf', 'pan-india'],
  ['/mnt/agents/upload/549578129-Pan-India-Doctor-Data (1).pdf', 'pan-india-2'],
  ['/mnt/agents/upload/525197611-Electoral-College-Of-All-States-Doctors-Data-With-Contact-Number.pdf', 'electoral-1'],
  ['/mnt/agents/upload/525609273-Electoral-College-Of-All-States-Doctors-Data-With-Contact-Number.pdf', 'electoral-2'],
  ['/mnt/agents/upload/514466525-484481380-Ap-Doctors-Data-base-xlsx.pdf', 'ap-db'],
  ['/mnt/agents/upload/818950573-DG-approved-Doctors-List-15032024.pdf', 'dg-approved'],
  ['/mnt/agents/upload/948604968-Bhadratha-Hospital-List-District-Wise-on-02-08-2023.pdf', 'bhadratha'],
  ['/mnt/agents/upload/892701213-Doctors-Contact-within-GHMC-and-Hospitals-Lists-of-APNA-pdf.pdf', 'ghmc-apna'],
  ['/mnt/agents/upload/558808574-member-telangana.pdf', 'telangana-pdf'],
  ['/mnt/agents/upload/483433876-doctors-member-andhrapradesh.pdf', 'ap-pdf'],
  ['/mnt/agents/upload/903667149-ICICI-Lombard-updated.pdf', 'icici'],
  ['/mnt/agents/upload/934381922-Star-Health1.pdf', 'star-health'],
  ['/mnt/agents/upload/253893188-Dotctors-Contact-with-in-GHMC-n-Hospitals-Lists-of-APNA-pdf.pdf', 'ghmc-apna-2'],
  ['/mnt/agents/upload/420073366-1536732957-pdf.pdf', 'pdf-420073'],
  ['/mnt/agents/upload/420074252-1536732957-pdf.pdf', 'pdf-420074'],
  ['/mnt/agents/upload/579528113-Class-3-Medical-Examiners.pdf', 'medical-examiners'],
  ['/mnt/agents/upload/790469366-Excluded-List-1234.pdf', 'excluded-list'],
  ['/mnt/agents/upload/828112285-05-e-sathish-dr-list.pdf', 'e-sathish'],
  ['/mnt/agents/upload/803729002-Doctors-Consolidated-Master-Data.xlsx', 'consolidated-master-2'],
];

let totalImported = 0;
for (const [path, source] of files) {
  try {
    if (fs.existsSync(path)) {
      const count = await processFile(path, source);
      if (count > 0) {
        console.log(`  ✅ ${source}: ${count} imported`);
        totalImported += count;
      }
    } else {
      const txtPath = path.replace('.pdf', '.txt');
      if (fs.existsSync(txtPath)) {
        const count = await processFile(txtPath, source);
        if (count > 0) { console.log(`  ✅ ${source}: ${count} imported`); totalImported += count; }
      }
    }
  } catch (e) {
    console.log(`  ⚠️ ${source}: ${e.message}`);
  }
}

await flush();

console.log(`\n🎉 BATCH 1 COMPLETE!`);
console.log(`   New: ${CREATED}, Dupes: ${DUPES}, Total: ${totalImported}`);

// Update quality scores
await conn.query('UPDATE contacts SET quality_score = LEAST(100, 20 + IF(phone IS NOT NULL AND LENGTH(phone) >= 10, 25, 0) + IF(hospital IS NOT NULL AND LENGTH(hospital) > 2, 15, 0) + IF(district IS NOT NULL AND LENGTH(district) > 1, 10, 0) + IF(specialty IS NOT NULL AND LENGTH(specialty) > 1, 10, 0) + IF(email IS NOT NULL AND email LIKE "%@%", 10, 0) + IF(division IS NOT NULL AND division != "unknown", 10, 0))');

const [summary] = await conn.query('SELECT COUNT(*) as total FROM contacts');
console.log(`📊 DATABASE: ${summary[0].total} contacts`);

await conn.end();
