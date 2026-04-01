const { Pool } = require('pg');

// Acá le pasamos los datos del Docker que acabamos de levantar
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'postgres',
  password: 'admin',
  port: 5432,
});

// Probamos la conexión
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Error conectando a la base de datos', err.stack);
  } else {
    console.log('¡Base de datos conectada exitosamente! Hora del server DB:', res.rows[0].now);
  }
});

module.exports = pool;