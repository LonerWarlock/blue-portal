const fs = require('fs');

function loadEnv(path) {
  try {
    const content = fs.readFileSync(path, 'utf8');
    const env = {};
    content.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        env[parts[0].trim()] = parts.slice(1).join('=').trim();
      }
    });
    return env;
  } catch (e) {
    return {};
  }
}

const env = loadEnv('.env.local');

async function testNeon() {
  if (!env.DATABASE_URL) {
    console.log('No DATABASE_URL found');
    return;
  }
  try {
    const { Client } = require('pg');
    const client = new Client({ connectionString: env.DATABASE_URL });
    await client.connect();
    console.log('Connected to Neon Postgres!');

    const resTables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema='public'
    `);
    
    console.log('Neon Tables:', resTables.rows.map(r => r.table_name));

    for (const r of resTables.rows) {
      try {
        const resRows = await client.query(`SELECT * FROM "${r.table_name}" LIMIT 500`);
        resRows.rows.forEach(row => {
          if (row.email) console.log(`[Neon ${r.table_name}] ${row.email}`);
        });
      } catch (e) {}
    }

    await client.end();
  } catch (e) {
    console.log('Neon PG Check note:', e.message);
  }
}

testNeon();
