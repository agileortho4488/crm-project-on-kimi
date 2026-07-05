import mysql from 'mysql2/promise';

async function check() {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
      port: 4000,
      user: '4CtfDUMzvSsZL7c.root',
      password: '41ZOclbIOnTLB8tF',
      database: 'test',
      ssl: { rejectUnauthorized: true }
    });
    console.log('Connection OK');
    
    const [tables] = await conn.query('SHOW TABLES');
    console.log('Tables:', tables.map(t => Object.values(t)[0]));
    
    if (tables.length === 0) {
      console.log('NO TABLES FOUND - need to create schema!');
    }
  } catch (e) {
    console.error('Connection failed:', e.message);
  } finally {
    if (conn) await conn.end();
  }
}
check();
