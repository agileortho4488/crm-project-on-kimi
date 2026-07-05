import mysql from 'mysql2/promise';
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
  const [rows] = await conn.query('SELECT * FROM contacts WHERE phone = ? OR REPLACE(REPLACE(REPLACE(phone, "-", ""), " ", ""), "+", "") LIKE ?', [phone, `%${last10}`]);
  return rows[0] || null;
}

async function mergeOrCreate(name, phone) {
  const existing = await findByPhone(phone);
  if (existing) {
    const updates = {};
    if (!existing.specialty) updates.specialty = 'Obstetrics & Gynecology';
    if (Object.keys(updates).length > 0) {
      await conn.query('UPDATE contacts SET specialty = ? WHERE id = ?', ['Obstetrics & Gynecology', existing.id]);
      merged++;
    } else { skipped++; }
    return;
  }
  await conn.query(
    'INSERT INTO contacts (name, type, phone, specialty, source, status, tags) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [name, 'doctor', phone, 'Obstetrics & Gynecology', 'upload:gynecology-txt', 'active', JSON.stringify(['imported', 'gynecology'])]
  );
  created++;
}

const text = fs.readFileSync('/mnt/agents/upload/525197645-CFW-AP-Gynecology.txt', 'utf-8');
const lines = text.split('\n').filter(l => l.trim());

for (const line of lines) {
  const match = line.match(/^\s*\d+\s+([A-Za-z\s.]+?)\s+([6-9]\d{9})\s/);
  if (!match) continue;
  const name = match[1].trim();
  const mobile = match[2];
  if (name.toLowerCase().includes('candidate') || name.length < 3) continue;
  await mergeOrCreate(name, mobile);
}

console.log(`Gynecology TXT: Created=${created}, Merged=${merged}, Skipped=${skipped}`);
await conn.end();
