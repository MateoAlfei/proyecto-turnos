const db = require('./db');

const queryCrearTablas = `
  CREATE TABLE IF NOT EXISTS negocios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    telefono_aviso VARCHAR(20) NOT NULL
    ubicacion VARCHAR(255) 
  );

  CREATE TABLE IF NOT EXISTS turnos (
    id SERIAL PRIMARY KEY,
    negocio_id INTEGER REFERENCES negocios(id),
    fecha_hora TIMESTAMP NOT NULL,
    nombre_cliente VARCHAR(100) NOT NULL,
    whatsapp_cliente VARCHAR(20) NOT NULL,
    estado VARCHAR(20) DEFAULT 'pendiente'
  );
`;

const ejecutarScript = async () => {
  try {
    
    console.log('Creando tablas...');
    await db.query(queryCrearTablas);
    
    // Insertamos un negocio de prueba para que tengas con qué jugar
    await db.query(`
      INSERT INTO negocios (nombre, telefono_aviso) 
      VALUES ('Barbería de Prueba', '5493510000000') 
      ON CONFLICT DO NOTHING;
    `);

    console.log('¡Tablas creadas y negocio de prueba insertado con éxito!');
  } catch (err) {
    console.error('Error creando las tablas:', err);
  } finally {
    process.exit(); // Cierra el script cuando termina
  }
};

ejecutarScript();
