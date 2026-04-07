const db = require('./db');

const arreglar = async () => {
  try {
    // Le inyectamos las columnas faltantes a la fuerza
    await db.query(`ALTER TABLE negocios ADD COLUMN IF NOT EXISTS email VARCHAR(100) UNIQUE;`);
    await db.query(`ALTER TABLE negocios ADD COLUMN IF NOT EXISTS password VARCHAR(255);`);
    await db.query(`ALTER TABLE negocios ADD COLUMN IF NOT EXISTS hora_apertura TIME DEFAULT '09:00';`);
    await db.query(`ALTER TABLE negocios ADD COLUMN IF NOT EXISTS hora_cierre TIME DEFAULT '18:00';`);
    await db.query(`ALTER TABLE negocios ADD COLUMN IF NOT EXISTS duracion_turno_minutos INT DEFAULT 30;`);
    
    console.log('✅ ¡Columnas inyectadas a la fuerza! La tabla negocios ya está lista.');
  } catch (err) {
    console.error('Error inyectando columnas:', err);
  } finally {
    process.exit();
  }
};

arreglar();