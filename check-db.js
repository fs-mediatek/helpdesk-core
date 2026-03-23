const mysql = require('mysql2/promise');

async function check() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1', port: 3307, user: 'helpdesk', password: 'helpdesk123', database: 'helpdesk'
  });

  const [tables] = await conn.execute("SHOW TABLES");
  console.log('Tables:', tables.map(t => Object.values(t)[0]));

  try {
    const [users] = await conn.execute("SELECT id, email, role FROM users");
    console.log('Users:', users);
  } catch(e) {
    console.log('Users table error:', e.message);
  }

  await conn.end();
}
check().catch(e => console.error(e.message));
