// backend/sql/migrate.js
// Runs schema.sql against your Neon PostgreSQL database
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function migrate() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    console.log('🔄 Running migration against Neon PostgreSQL...');
    const result = await pool.query(sql);
    // Print last command result
    const last = Array.isArray(result) ? result[result.length - 1] : result;
    if (last?.rows?.length) {
      console.log(last.rows[0].status || 'Done');
    }
    console.log('✅ Migration complete');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
