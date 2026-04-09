const db = require('./db');
const { slugify, elegirSlugUnico } = require('./slugUtils');

const arreglar = async () => {
  try {
    await db.query(`ALTER TABLE negocios ADD COLUMN IF NOT EXISTS email VARCHAR(100) UNIQUE;`);
    await db.query(`ALTER TABLE negocios ADD COLUMN IF NOT EXISTS password VARCHAR(255);`);
    await db.query(`ALTER TABLE negocios ADD COLUMN IF NOT EXISTS hora_apertura TIME DEFAULT '09:00';`);
    await db.query(`ALTER TABLE negocios ADD COLUMN IF NOT EXISTS hora_cierre TIME DEFAULT '18:00';`);
    await db.query(`ALTER TABLE negocios ADD COLUMN IF NOT EXISTS duracion_turno_minutos INT DEFAULT 30;`);
    await db.query(`ALTER TABLE negocios ADD COLUMN IF NOT EXISTS slug VARCHAR(80);`);
    await db.query(`ALTER TABLE negocios ADD COLUMN IF NOT EXISTS direccion VARCHAR(255);`);

    const { rows } = await db.query(
      `SELECT id, nombre FROM negocios WHERE slug IS NULL OR TRIM(slug) = ''`
    );
    for (const r of rows) {
      const slug = await elegirSlugUnico(db, `${slugify(r.nombre)}-${r.id}`);
      await db.query('UPDATE negocios SET slug = $1 WHERE id = $2', [slug, r.id]);
    }

    await db.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_negocios_slug_unique ON negocios (slug) WHERE slug IS NOT NULL`
    );

    console.log('✅ Tabla negocios lista (slug, direccion, índice único).');
  } catch (err) {
    console.error('Error migrando negocios:', err);
  } finally {
    process.exit();
  }
};

arreglar();
