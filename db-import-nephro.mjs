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
  const [rows] = await conn.query('SELECT * FROM contacts WHERE REPLACE(REPLACE(phone, "-", ""), " ", "") LIKE ?', [`%${last10}`]);
  return rows[0] || null;
}

async function mergeOrCreate(name, phone, email, district, hospital, address) {
  const existing = await findByPhone(phone);
  if (existing) {
    merged++;
    return;
  }
  await conn.query(
    'INSERT INTO contacts (name, type, phone, email, district, specialty, hospital, address, source, status, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [name, 'doctor', phone, email, district, 'Nephrology', hospital, address, 'upload:nephrologist-pdf', 'active', JSON.stringify(['imported', 'nephrology'])]
  );
  created++;
}

const text = fs.readFileSync('/mnt/agents/upload/415462234-Nephrologist-numbers-pdf.txt', 'utf-8');
const lines = text.split('\n');

const cities = ['Hyderabad','Secunderabad','Warangal','Karimnagar','Nizamabad','Khammam','Nalgonda','Mahbubnagar','Medak','Adilabad','Kakinada','Rajahmundry','Vijayawada','Vishakapatnam','Tirupati','Guntur','Nellore','Kurnool','Kadapa','Anantapur','Chittoor','Ongole','Bhimavaram','Eluru','Srikakulam','Cuddapah','Kurnool','Kakinada','Karimnagar','Kurnool','Nalgonda','Nellore','Nizamabad','Rajahmundry','Srikakulam','Tirupati','Vijayawada','Vishakapatnam','Warangal','Bijapur','Davangere','Dharwad','Gulbarga','Hassan','Hubli','Bellary'];

let currentDistrict = '';

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trim();
  
  if (trimmed.includes('Doctor Name') || trimmed.includes('Landline') || trimmed.includes('Mobile No')) continue;
  if (trimmed === 'Andhra Pradesh' || trimmed === 'Karnataka' || trimmed === 'Telangana') continue;
  
  const foundCity = cities.find(c => trimmed === c);
  if (foundCity) { currentDistrict = foundCity; continue; }
  
  // Get chunk of 3 lines
  const chunk = lines.slice(i, Math.min(i + 3, lines.length)).join(' ');
  const mobileMatch = chunk.match(/\b([7-9]\d{9})\b/);
  if (!mobileMatch) continue;
  
  const mobile = mobileMatch[1];
  let name = '';
  
  // Try to get name from current line before phone
  const phoneIdx = line.indexOf(mobile);
  if (phoneIdx > 0) {
    const before = line.substring(0, phoneIdx).trim();
    if (before.length > 2 && before.match(/[a-zA-Z]/)) name = before.replace(/[,;]$/, '');
  }
  
  // Try previous line
  if (!name && i > 0) {
    const prev = lines[i-1].trim();
    if (prev.length > 2 && prev.length < 60 && prev.match(/[a-zA-Z]/) && !prev.match(/^\d{5,}/)) {
      name = prev;
    }
  }
  
  if (!name || name.length < 3 || name.length > 60) continue;
  
  // Extract email
  const emailMatch = chunk.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch ? emailMatch[0] : null;
  
  // Extract hospital
  let hospital = null;
  const hospMatch = chunk.match(/([A-Za-z\s]+(?:Hospital|Clinic|Centre|Center|Institute|Foundation|Care|Medical))/i);
  if (hospMatch) hospital = hospMatch[1].trim().substring(0, 100);
  
  // Build address
  let address = '';
  const addrParts = [];
  for (let j = i; j < Math.min(i + 3, lines.length); j++) {
    const l = lines[j].trim();
    if (l === name) continue;
    if (l.match(/^[A-Z][a-z]+\s+[A-Z]/)) break;
    if (l.length > 5 && !l.match(/^\d{10}$/)) addrParts.push(l);
  }
  address = addrParts.join(', ').substring(0, 255);
  
  await mergeOrCreate(name, mobile, email, currentDistrict || null, hospital, address || null);
}

console.log(`Nephrologist: Created=${created}, Merged=${merged}, Skipped=${skipped}`);
await conn.end();
