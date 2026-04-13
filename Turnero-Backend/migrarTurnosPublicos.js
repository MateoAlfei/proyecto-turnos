const db = require('./db');

/**
 * Agrega campos para confirmación pública desde mail.
 * Ejecutar una vez: npm run migrate:turnos-publicos
 */
const migrar = async () => {
  try {
    await db.query(`ALTER TABLE turnos ADD COLUMN IF NOT EXISTS asistencia_confirmada BOOLEAN NOT NULL DEFAULT FALSE;`);
    await db.query(`ALTER TABLE turnos ADD COLUMN IF NOT EXISTS asistencia_confirmada_at TIMESTAMP;`);
    console.log('✅ Columnas de confirmación pública listas en turnos.');
  } catch (err) {
    console.error('Error en migración de turnos públicos:', err);
    process.exitCode = 1;
  } finally {
    process.exit();
  }
};

migrar();
