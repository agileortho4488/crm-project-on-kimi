import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com', port: 4000,
  user: '4CtfDUMzvSsZL7c.root', password: '41ZOclbIOnTLB8tF',
  database: 'test', ssl: { rejectUnauthorized: true }
});

// Division classification
const DIVISION_KEYWORDS = {
  trauma_fracture: ['orthopedic','orthopaedic','trauma','fracture','sports medicine','bone','joint replacement','knee','hip','arthroplasty'],
  cardiovascular: ['cardiology','cardiologist','cardiothoracic','ctvs','cardiac surgeon','intervention cardiology','heart','stent','angioplasty'],
  endo_surgery: ['laparoscopic','gi surgery','gastro surgeon','minimal access','mias','endo'],
  neuro_spine: ['neurosurgery','neurosurgeon','spine surgery','neurologist','cranial','brain'],
  gynecology: ['obg','obstetrics','gynecology','gynaecology','gynecologist','obstetrician','maternity','gyn'],
  diagnostics: ['pathology','radiology','diagnostic','lab','microbiology','biochemistry','nephrology'],
  consumables: ['general surgeon','nurse','ot technician','anesthesia','critical care'],
};

function classifyDivision(specialty, hospital, name) {
  const text = `${specialty || ''} ${hospital || ''} ${name || ''}`.toLowerCase();
  const scores = {};
  for (const [div, kws] of Object.entries(DIVISION_KEYWORDS)) {
    scores[div] = 0;
    for (const kw of kws) if (text.includes(kw)) scores[div] += 3;
  }
  let best = 'unknown', bestScore = 0;
  for (const [div, score] of Object.entries(scores)) {
    if (score > bestScore) { bestScore = score; best = div; }
  }
  return bestScore >= 2 ? best : 'unknown';
}

// District extraction
const DISTRICTS = ['hyderabad','secunderabad','warangal','hanamkonda','khammam','karimnagar','nizamabad','adilabad','medak','sangareddy','siddipet','nalgonda','suryapet','mahabubnagar','jogulamba gadwal','nagarkurnool','vikarabad','wanaparthy','narayanpet','kamareddy','yadadri bhuvanagiri','jangaon','bhadradri kothagudem','mancherial','komaram bheem asifabad','jagtial','peddapalli','rajanna sircilla','medchal','ranga reddy'];

function extractDistrict(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const d of DISTRICTS) if (lower.includes(d)) return d.charAt(0).toUpperCase() + d.slice(1);
  return null;
}

// Quality score
function calcScore(c) {
  let s = 0;
  if (c.name?.length > 2) s += 20;
  if (c.phone?.length >= 10) s += 25;
  if (c.hospital?.length > 2) s += 15;
  if (c.district?.length > 1) s += 10;
  if (c.specialty?.length > 1) s += 10;
  if (c.email?.includes('@')) s += 10;
  if (c.division && c.division !== 'unknown') s += 5;
  if (c.designation?.length > 1) s += 5;
  return s;
}

// Get all contacts needing enrichment
const [contacts] = await conn.query('SELECT * FROM contacts WHERE division IS NULL OR division = "unknown" OR district IS NULL OR quality_score = 0');
console.log(`Enriching ${contacts.length} contacts...`);

let enriched = 0;
for (const c of contacts) {
  const updates = {};
  
  const division = classifyDivision(c.specialty, c.hospital, c.name);
  if (division !== 'unknown' && (!c.division || c.division === 'unknown')) updates.division = division;
  
  if (!c.district) {
    const d = extractDistrict(`${c.address || ''} ${c.hospital || ''}`);
    if (d) updates.district = d;
  }
  
  updates.quality_score = calcScore({...c, ...updates});
  
  if (Object.keys(updates).length > 0) {
    const setClause = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    await conn.query(`UPDATE contacts SET ${setClause} WHERE id = ?`, [...Object.values(updates), c.id]);
    enriched++;
  }
}

console.log(`Enriched ${enriched} contacts!`);

// Summary
const [summary] = await conn.query(`
  SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN division = 'gynecology' THEN 1 ELSE 0 END) as obg,
    SUM(CASE WHEN specialty = 'Nephrology' THEN 1 ELSE 0 END) as nephro,
    SUM(CASE WHEN quality_score >= 70 THEN 1 ELSE 0 END) as high,
    SUM(CASE WHEN quality_score >= 40 AND quality_score < 70 THEN 1 ELSE 0 END) as medium,
    SUM(CASE WHEN quality_score < 40 THEN 1 ELSE 0 END) as low
  FROM contacts
`);
console.log('\n=== DATABASE SUMMARY ===');
console.log(`Total: ${summary[0].total}`);
console.log(`Gynecology division: ${summary[0].obg}`);
console.log(`Nephrology: ${summary[0].nephro}`);
console.log(`High quality (70+): ${summary[0].high}`);
console.log(`Medium (40-69): ${summary[0].medium}`);
console.log(`Low (<40): ${summary[0].low}`);

await conn.end();
