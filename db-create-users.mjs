import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

async function createUsersTable() {
  const conn = await mysql.createConnection({
    host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
    port: 4000,
    user: '4CtfDUMzvSsZL7c.root',
    password: '41ZOclbIOnTLB8tF',
    database: 'test',
    ssl: { rejectUnauthorized: true }
  });

  // Check if users table exists
  const [tables] = await conn.query('SHOW TABLES LIKE "users"');
  if (tables.length === 0) {
    console.log('Creating users table...');
    await conn.query(`
      CREATE TABLE users (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(100) NOT NULL,
        role ENUM('admin','manager','sales','marketing','surgical_assistant','viewer') NOT NULL DEFAULT 'viewer',
        division VARCHAR(100),
        district VARCHAR(100),
        phone VARCHAR(20),
        email VARCHAR(100),
        is_active BOOLEAN DEFAULT TRUE,
        last_login TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('users table created!');
  } else {
    console.log('users table already exists');
  }

  // Check if any users exist
  const [users] = await conn.query('SELECT COUNT(*) as count FROM users');
  if (users[0].count === 0) {
    console.log('Seeding default users...');
    const hashed = await bcrypt.hash('Agile1', 10);
    
    const defaultUsers = [
      { username: 'admin', password: hashed, name: 'Admin User', role: 'admin' },
      { username: 'sales1', password: hashed, name: 'Sales Person 1', role: 'sales' },
      { username: 'marketing1', password: hashed, name: 'Marketing Person 1', role: 'marketing' },
      { username: 'surgical1', password: hashed, name: 'Surgical Assistant 1', role: 'surgical_assistant' },
      { username: 'manager1', password: hashed, name: 'Manager 1', role: 'manager' },
    ];
    
    for (const u of defaultUsers) {
      await conn.query(
        'INSERT INTO users (username, password, name, role, is_active) VALUES (?, ?, ?, ?, TRUE)',
        [u.username, u.password, u.name, u.role]
      );
      console.log(`  Created: ${u.username} / Agile1 (${u.role})`);
    }
    console.log('Default users seeded!');
  } else {
    console.log(`Users already exist: ${users[0].count} users`);
  }

  await conn.end();
  console.log('Done!');
}

createUsersTable().catch(e => { console.error(e); process.exit(1); });
