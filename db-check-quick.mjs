// Quick enrichment status check
import mysql from 'mysql2/promise';

const DB_URL = 'mysql://4CtfDUMzvSsZL7c.root:41ZOclbIOnTLB8tF@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/test?ssl={"rejectUnauthorized":true}';

async function main() {
  const conn = await mysql.createConnection(DB_URL);
  console.log('Connected to TiDB');

  try {
    const [total] = await conn.execute('SELECT COUNT(*) as c FROM contacts');
    console.log(`Total: ${total[0].c.toLocaleString()}`);

    const [withDiv] = await conn.execute("SELECT COUNT(*) as c FROM contacts WHERE division IS NOT NULL AND division != 'unknown' AND division != ''");
    console.log(`With Division: ${withDiv[0].c.toLocaleString()} (${(withDiv[0].c/total[0].c*100).toFixed(1)}%)`);

    const [withSpec] = await conn.execute("SELECT COUNT(*) as c FROM contacts WHERE specialty IS NOT NULL AND specialty != ''");
    console.log(`With Specialty: ${withSpec[0].c.toLocaleString()} (${(withSpec[0].c/total[0].c*100).toFixed(1)}%)`);

    const [docTypes] = await conn.execute("SELECT COUNT(*) as c FROM contacts WHERE type = 'doctor'");
    console.log(`Type=doctor: ${docTypes[0].c.toLocaleString()} (${(docTypes[0].c/total[0].c*100).toFixed(1)}%)`);

    const [avgQ] = await conn.execute('SELECT AVG(quality_score) as avg FROM contacts');
    console.log(`Avg Quality: ${Math.round(avgQ[0].avg || 0)}`);

    console.log('\nDivision breakdown:');
    const [divs] = await conn.execute('SELECT division, COUNT(*) as c FROM contacts GROUP BY division ORDER BY c DESC');
    for (const d of divs) {
      console.log(`  ${d.division || 'NULL/empty'}: ${d.c.toLocaleString()}`);
    }

    // Check if enrichment is needed
    const [needsDiv] = await conn.execute("SELECT COUNT(*) as c FROM contacts WHERE division IS NULL OR division = 'unknown' OR division = ''");
    console.log(`\nContacts needing division: ${needsDiv[0].c.toLocaleString()}`);

    // Quick sample of what would be classified
    const [samples] = await conn.execute(
      "SELECT id, name, hospital, specialty FROM contacts WHERE (division IS NULL OR division = 'unknown') AND (name LIKE '%Hospital%' OR name LIKE '%Clinic%' OR hospital LIKE '%Hospital%' OR hospital LIKE '%Clinic%') LIMIT 5"
    );
    console.log('\nSample hospital/clinic contacts:');
    for (const s of samples) {
      console.log(`  #${s.id}: "${s.name}" | Hospital: "${s.hospital}" | Specialty: "${s.specialty}"`);
    }

  } finally {
    await conn.end();
  }
}

main().catch(e => console.error(e.message));
