const { Pool } = require('pg');
require('dotenv').config();

/**
 * Neon (y otros) a veces agregan `channel_binding=require`; `pg` en Node suele ir mejor sin ese parámetro.
 */
function normalizeDatabaseUrl(url) {
  if (!url || typeof url !== 'string') return url;
  try {
    const u = new URL(url);
    u.searchParams.delete('channel_binding');
    return u.toString();
  } catch {
    return url.replace(/[&?]channel_binding=[^&]*/gi, '').replace(/\?&/, '?');
  }
}

const rawUrl = process.env.DATABASE_URL;
const connectionString = rawUrl
  ? normalizeDatabaseUrl(rawUrl)
  : 'postgresql://postgres:admin@localhost:5432/turnero';

// En la nube hace falta SSL; en local (sin DATABASE_URL) no.
const pool = new Pool({
  connectionString,
  ssl: rawUrl ? { rejectUnauthorized: false } : false
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};