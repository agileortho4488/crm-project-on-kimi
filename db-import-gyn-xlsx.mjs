import mysql from 'mysql2/promise';
import * as XLSX from 'xlsx';
import fs from 'fs';

const conn = await mysql.createConnection({
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com', port: 4000,
  user: '4CtfDUMzvSsZL7c.root', password: '41ZOclbIOnTLB8tF',
  database: 'test', ssl: { rejectUnauthorized: true }
});

let created = 0, merged = 0, skipped = 0;

async function findByPhone(phone) {
  if (!phone) return null;
  const norm = phone.replace(/\D/g, '');
  if (norm.length < 10) return null;
  const last10 = norm.slice(-10);
  const [rows] = await conn.query('SELECT * FROM contacts WHERE REPLACE(REPLACE(phone, "-", ""), " ", "") LIKE ?', [`%${last10}`]);
  return rows[0] || null;
}

async function mergeOrCreate(name, phone) {
  const existing = await findByPhone(phone);
  if (existing) { merged++; return; }
  await conn.query(
    'INSERT INTO contacts (name, type, phone, specialty, source, status, tags) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [name, 'doctor', phone, 'Obstetrics & Gynecology', 'upload:gynecology-xlsx', 'active', JSON.stringify(['imported', 'gynecology'])]
  );
  created++;
}

const buffer = fs.readFileSync('/mnt/agents/upload/525197645-CFW-AP-Gynecology.xlsx');
const workbook = XLSX.read(buffer, { type: "buffer" });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

let dataStarted = false;

for (const row of rows) {
  if (!row || row.length < 3) continue;
  
  const firstCol = String(row[0] || '').trim();
  if (!dataStarted) {
    if (firstCol === '1' || firstCol === 1) dataStarted = true;
    else continue;
  }
  
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
  
  if (name && mobile && name.length > 2 && !name.toLowerCase().includes('candidate')) {
    await mergeOrCreate(name, mobile);
  }
}

console.log(`Gynecology XLSX: Created=${created}, Merged=${merged}, Skipped=${skipped}`);
await conn.end();
