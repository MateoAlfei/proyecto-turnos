const { Pool } = require('pg');
require('dotenv').config();

// En la nube, usamos una "Connection String" (un link largo) en vez de usuario y contraseña separados.
// Si no hay DATABASE_URL en el .env, usa una configuración por defecto para tu PC.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:admin@localhost:5432/turnero',
  // La nube exige conexión segura (SSL), así que la activamos si estamos usando el link de la nube
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};