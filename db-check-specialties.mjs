import mysql from 'mysql2/promise';
const DB_URL = 'mysql://4CtfDUMzvSsZL7c.root:41ZOclbIOnTLB8tF@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/test?ssl={"rejectUnauthorized":true}';

async function main() {
  const conn = await mysql.createConnection(DB_URL);
  
  try {
    console.log('=== TOP SPECIALTIES AMONG UNCLASSIFIED ===\n');
    const [specs] = await conn.execute(
      "SELECT specialty, COUNT(*) as c FROM contacts WHERE (division IS NULL OR division = 'unknown' OR division = '') AND specialty IS NOT NULL AND specialty != '' GROUP BY specialty ORDER BY c DESC LIMIT 50"
    );
    for (const s of specs) {
      console.log(`  ${s.specialty}: ${s.c.toLocaleString()}`);
    }
  } finally {
    await conn.end();
  }
}
main().catch(e => console.error(e.message));
