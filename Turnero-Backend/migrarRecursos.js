const db = require('./db');

/**
 * Crea la tabla recursos (calendarios: canchas, peluqueros, etc.),
 * agrega recurso_id a turnos y asigna un recurso "Principal" a cada negocio existente.
 * Ejecutar una vez: npm run migrate:recursos
 */
const migrar = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS recursos (
        id SERIAL PRIMARY KEY,
        negocio_id INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
        nombre VARCHAR(120) NOT NULL,
        orden INTEGER NOT NULL DEFAULT 0,
        hora_apertura TIME,
        hora_cierre TIME,
        dias_habilitados INTEGER[] DEFAULT ARRAY[0,1,2,3,4,5,6]
      );
    `);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_recursos_negocio ON recursos(negocio_id);`);
    await db.query(`ALTER TABLE recursos ADD COLUMN IF NOT EXISTS hora_apertura TIME;`);
    await db.query(`ALTER TABLE recursos ADD COLUMN IF NOT EXISTS hora_cierre TIME;`);
    await db.query(`ALTER TABLE recursos ADD COLUMN IF NOT EXISTS dias_habilitados INTEGER[] DEFAULT ARRAY[0,1,2,3,4,5,6];`);

    await db.query(`ALTER TABLE turnos ADD COLUMN IF NOT EXISTS recurso_id INTEGER REFERENCES recursos(id);`);

    const { rows: negocios } = await db.query('SELECT id FROM negocios');
    for (const n of negocios) {
      // Semillas por negocio: si un recurso no tiene reglas explícitas, hereda horario general del negocio.
      await db.query(
        `
        UPDATE recursos r
        SET hora_apertura = COALESCE(r.hora_apertura, b.hora_apertura),
            hora_cierre = COALESCE(r.hora_cierre, b.hora_cierre),
            dias_habilitados = COALESCE(r.dias_habilitados, ARRAY[0,1,2,3,4,5,6])
        FROM negocios b
        WHERE r.negocio_id = b.id AND r.negocio_id = $1
      `,
        [n.id]
      );

      const c = await db.query('SELECT COUNT(*)::int AS n FROM recursos WHERE negocio_id = $1', [n.id]);
      if (c.rows[0].n > 0) continue;
      const base = await db.query(
        `SELECT hora_apertura, hora_cierre FROM negocios WHERE id = $1`,
        [n.id]
      );
      const hA = base.rows[0]?.hora_apertura || '09:00';
      const hC = base.rows[0]?.hora_cierre || '18:00';
      const ins = await db.query(
        `INSERT INTO recursos (negocio_id, nombre, orden, hora_apertura, hora_cierre, dias_habilitados)
         VALUES ($1, 'Principal', 0, $2, $3, ARRAY[0,1,2,3,4,5,6]) RETURNING id`,
        [n.id, hA, hC]
      );
      const rid = ins.rows[0].id;
      await db.query('UPDATE turnos SET recurso_id = $1 WHERE negocio_id = $2 AND recurso_id IS NULL', [
        rid,
        n.id
      ]);
    }

    await db.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_turno_activo_recurso_fecha
      ON turnos (negocio_id, recurso_id, fecha_hora)
      WHERE estado <> 'cancelado' AND recurso_id IS NOT NULL;
    `);

    console.log('✅ Recursos y recurso_id en turnos listos.');
  } catch (err) {
    const refused =
      err?.code === 'ECONNREFUSED' ||
      (Array.isArray(err?.errors) && err.errors.some((e) => e?.code === 'ECONNREFUSED'));
    if (refused) {
      console.error(`
No se pudo conectar a PostgreSQL (conexión rechazada en localhost:5432).

Qué revisar:
  • ¿Está instalado y ENCENDIDO PostgreSQL? (Servicios de Windows → "postgresql")
  • Si usás base en la nube (Neon, Supabase, Railway…), creá un archivo .env en Turnero-Backend con:
      DATABASE_URL=postgresql://usuario:clave@host:5432/nombre_base
  • Sin .env, el backend usa por defecto: postgresql://postgres:admin@localhost:5432/turnero
    (usuario postgres, contraseña admin, base turnero — tenés que crearla si no existe)

Luego volvé a ejecutar: npm run migrate:recursos
`);
    } else {
      console.error('Error en migración recursos:', err);
    }
    process.exitCode = 1;
  } finally {
    process.exit();
  }
};

migrar();
