const express = require('express');
const cors = require('cors');
const db = require('./db'); // Importamos la conexión a la base de datos que hicimos recién

const app = express();
const PORT = 3000;

// Configuraciones básicas
app.use(cors());
app.use(express.json()); // Permite que el servidor entienda datos en formato JSON

// Nuestra primera ruta de prueba
app.get('/api/ping', (req, res) => {
  res.json({ mensaje: '¡El backend del turnero está vivo!' });
});

// Ruta para GUARDAR un turno nuevo
app.post('/api/turnos', async (req, res) => {
  // 1. Recibimos los datos que manda el Frontend
  const { negocio_id, fecha_hora, nombre_cliente, whatsapp_cliente } = req.body;

  try {
    // 2. Armamos la consulta SQL (usamos $1, $2 para evitar inyecciones SQL)
    const query = `
      INSERT INTO turnos (negocio_id, fecha_hora, nombre_cliente, whatsapp_cliente)
      VALUES ($1, $2, $3, $4)
      RETURNING *; 
    `;
    
    // 3. Pasamos los valores
    const valores = [negocio_id, fecha_hora, nombre_cliente, whatsapp_cliente];

    // 4. Ejecutamos en la base de datos
    const resultado = await db.query(query, valores);

    // 5. Le respondemos al Frontend que todo salió de 10
    res.status(201).json({
      mensaje: 'Turno guardado con éxito',
      turno: resultado.rows[0]
    });

  } catch (error) {
    console.error('Error al guardar el turno:', error);
    res.status(500).json({ error: 'Hubo un problema guardando el turno' });
  }
});


app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});