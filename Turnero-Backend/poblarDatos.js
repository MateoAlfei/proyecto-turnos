const db = require('./db');

const poblar = async () => {
  try {
    const query = `
      INSERT INTO turnos (negocio_id, fecha_hora, nombre_cliente, precio, estado) VALUES 
      (1, '2026-04-02 10:00:00', 'Marta', 15000, 'completado'),
      (1, '2026-04-03 14:30:00', 'Carlos', 20000, 'completado'),
      (1, '2026-04-04 10:00:00', 'Laura', 15000, 'completado'),
      (1, '2026-04-05 18:00:00', 'Pedro', 25000, 'completado'),
      (1, '2026-04-06 18:00:00', 'Sofía', 12000, 'completado'),
      (1, '2026-03-20 10:00:00', 'Juan (Marzo)', 15000, 'completado')
    `;
    await db.query(query);
    console.log('✅ ¡Turnos falsos con plata inyectados con éxito!');
  } catch (err) {
    console.error('Error inyectando datos:', err);
  } finally {
    process.exit();
  }
};

poblar();