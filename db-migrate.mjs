import mysql from 'mysql2/promise';

async function migrate() {
  const conn = await mysql.createConnection({
    host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
    port: 4000,
    user: '4CtfDUMzvSsZL7c.root',
    password: '41ZOclbIOnTLB8tF',
    database: 'test',
    ssl: { rejectUnauthorized: true }
  });
  
  // Check if quality_score exists
  const [cols] = await conn.query('SHOW COLUMNS FROM contacts LIKE "quality_score"');
  if (cols.length === 0) {
    await conn.query('ALTER TABLE contacts ADD COLUMN quality_score INT DEFAULT 0');
    console.log('Added quality_score column');
  } else {
    console.log('quality_score already exists');
  }
  
  // Check if division has index
  const [divIdx] = await conn.query('SHOW INDEX FROM contacts WHERE Column_name = "division"');
  if (divIdx.length === 0) {
    await conn.query('CREATE INDEX idx_contacts_division ON contacts(division)');
    console.log('Added division index');
  }
  
  // Check if quality_score has index
  const [qsIdx] = await conn.query('SHOW INDEX FROM contacts WHERE Column_name = "quality_score"');
  if (qsIdx.length === 0) {
    await conn.query('CREATE INDEX idx_contacts_quality ON contacts(quality_score)');
    console.log('Added quality_score index');
  }
  
  await conn.end();
  console.log('Migration complete');
}

migrate().catch(e => { console.error(e); process.exit(1); });
