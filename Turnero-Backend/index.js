require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db'); // Importamos la conexión a la base de datos que hicimos recién
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { verificarToken } = require('./middleware');

// La firma secreta de tus llaves (en un proyecto real esto se oculta en un archivo .env)
const JWT_SECRET = process.env.JWT_SECRET;
const PORT = process.env.PORT || 3000;
const app = express();
const { enviarMailConfirmacion, enviarMailCancelacion } = require('./email');
// Configuraciones básicas
app.use(cors());
app.use(express.json()); // Permite que el servidor entienda datos en formato JSON
// ==========================================
//        SISTEMA DE AUTENTICACIÓN
// ==========================================

// === CALCULADORA DINÁMICA DE TURNOS ===
// Le pasás (09:00, 20:00, 30) y te devuelve ["09:00", "09:30", "10:00"...]
function generarGrillaHoraria(apertura, cierre, intervaloMinutos) {
  const turnos = [];
  
  // Convertimos las horas a minutos totales para que sea fácil sumar (ej: 09:00 -> 540 minutos)
  let [horaA, minA] = apertura.split(':').map(Number);
  let minutosActuales = (horaA * 60) + minA;
  
  let [horaC, minC] = cierre.split(':').map(Number);
  let minutosCierre = (horaC * 60) + minC;

  // Mientras el turno actual + lo que dura el turno no se pase de la hora de cierre
  while ((minutosActuales + intervaloMinutos) <= minutosCierre) {
    let h = Math.floor(minutosActuales / 60).toString().padStart(2, '0');
    let m = (minutosActuales % 60).toString().padStart(2, '0');
    
    turnos.push(`${h}:${m}`);
    minutosActuales += intervaloMinutos; // Avanzamos al siguiente turno
  }
  
  return turnos;
}

// Ruta para REGISTRAR un nuevo negocio (Onboarding)
app.post('/api/auth/registro', async (req, res) => {
  // 1. Agregamos telefono_aviso a lo que recibimos del Frontend
  const { nombre, email, password, hora_apertura, hora_cierre, duracion_turno_minutos, telefono_aviso } = req.body;

  try {
    const passwordEncriptada = await bcrypt.hash(password, 10);

    // 2. Agregamos telefono_aviso a la consulta SQL ($7)
    const query = `
      INSERT INTO negocios (nombre, email, password, hora_apertura, hora_cierre, duracion_turno_minutos, telefono_aviso)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, nombre, email;
    `;
    
    // 3. Le pasamos el valor (y si no lo mandan, le ponemos un '0' de relleno para que la BD no chille)
    const valores = [
      nombre, 
      email, 
      passwordEncriptada, 
      hora_apertura || '09:00', 
      hora_cierre || '18:00', 
      duracion_turno_minutos || 30,
      telefono_aviso || '0'
    ];
    
    const resultado = await db.query(query, valores);

    res.status(201).json({ mensaje: '¡Negocio registrado con éxito!', negocio: resultado.rows[0] });
  } catch (error) {
    
    console.error('Error en registro:', error);
    res.status(500).json({ error: 'Hubo un error al registrar el negocio (¿el email ya existe?)' });
  }
});

// Ruta para INICIAR SESIÓN (Login)
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. Buscamos si existe el negocio con ese email
    const resultado = await db.query('SELECT * FROM negocios WHERE email = $1', [email]);
    const negocio = resultado.rows[0];

    if (!negocio) {
      return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    }

    // 2. Comparamos la contraseña encriptada
    const esValida = await bcrypt.compare(password, negocio.password);

    if (!esValida) {
      return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    }

    // 3. Generamos la "llave digital" (Token JWT) que dura 8 horas
    const token = jwt.sign({ id: negocio.id, nombre: negocio.nombre }, JWT_SECRET, { expiresIn: '8h' });

    // Le devolvemos el token al Frontend para que lo guarde
    res.json({ mensaje: 'Login exitoso', token, negocio_id: negocio.id });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Hubo un error en el servidor' });
  }
});
// Nuestra primera ruta de prueba
app.get('/api/ping', (req, res) => {
  res.json({ mensaje: '¡El backend del turnero está vivo!' });
});
// ==========================================
//        CATÁLOGO DE SERVICIOS
// ==========================================

// 1. CREAR un servicio (RUTA PROTEGIDA: Solo el dueño logueado puede hacerlo)
app.post('/api/servicios', verificarToken, async (req, res) => {
  const { nombre, precio } = req.body;
  
  // ¡Acá está la magia del Token! El patovica (middleware) nos guardó 
  // los datos del dueño en req.negocioLogueado antes de dejarlo pasar.
  // Así evitamos que nos pasen un negocio_id falso por el body.
  const negocio_id = req.negocioLogueado.id; 

  if (!nombre || !precio) {
    return res.status(400).json({ error: 'Faltan datos: nombre o precio' });
  }

  try {
    const query = `
      INSERT INTO servicios (negocio_id, nombre, precio) 
      VALUES ($1, $2, $3) 
      RETURNING *;
    `;
    const resultado = await db.query(query, [negocio_id, nombre, precio]);
    
    res.status(201).json({ 
      mensaje: 'Servicio agregado al catálogo', 
      servicio: resultado.rows[0] 
    });
  } catch (error) {
    console.error('Error creando servicio:', error);
    res.status(500).json({ error: 'Hubo un error al guardar el servicio' });
  }
});

// 2. VER los servicios (RUTA PÚBLICA: Para el Frontend del cliente)
// Esta NO lleva verificarToken, porque cualquiera en internet debe poder ver los precios
app.get('/api/servicios', async (req, res) => {
  const { negocio_id } = req.query;

  if (!negocio_id) {
    return res.status(400).json({ error: 'Falta el negocio_id' });
  }

  try {
    const query = 'SELECT id, nombre, precio FROM servicios WHERE negocio_id = $1 ORDER BY precio ASC';
    const resultado = await db.query(query, [negocio_id]);
    
    res.json(resultado.rows);
  } catch (error) {
    console.error('Error buscando servicios:', error);
    res.status(500).json({ error: 'Hubo un error al cargar el catálogo' });
  }
});
// Ruta para GUARDAR un turno nuevo
// ==========================================
//    RUTA PARA CREAR UN TURNO (SAAS PRO)
// ==========================================
app.post('/api/turnos', async (req, res) => {
  const { negocio_id, fecha_hora, nombre_cliente, email_cliente, whatsapp_cliente, servicio_id } = req.body;

  try {
    // 1. Buscamos el nombre del negocio (Para el Mail y el WhatsApp dinámico)
    const resNegocio = await db.query('SELECT nombre FROM negocios WHERE id = $1', [negocio_id]);
    const nombreNegocio = resNegocio.rows.length > 0 ? resNegocio.rows[0].nombre : 'Nuestro Local';

    // 2. Buscamos el precio del servicio elegido (si es que eligió uno)
    let precioFinal = 0;
    if (servicio_id) {
      const resServicio = await db.query('SELECT precio FROM servicios WHERE id = $1', [servicio_id]);
      if (resServicio.rows.length > 0) {
        precioFinal = resServicio.rows[0].precio;
      }
    }

    // 3. Guardamos el turno inyectando el servicio_id, el precioFinal y el estado 'pendiente'
    const query = `
      INSERT INTO turnos (negocio_id, fecha_hora, nombre_cliente, email_cliente, whatsapp_cliente, servicio_id, precio, estado) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'pendiente') 
      RETURNING *;
    `;
    const valores = [negocio_id, fecha_hora, nombre_cliente, email_cliente, whatsapp_cliente, servicio_id, precioFinal];
    const resultado = await db.query(query, valores);

    // 4. --- MAGIA DE MAILS ---
    // (Llamamos a tu función de email.js pasándole los datos reales)
  // 4. --- MAGIA DE MAILS ---
    // 5. --- MAGIA DE WHATSAPP SEMI-AUTOMÁTICO ---
    // (Esto se ejecuta rapidísimo, así que lo dejamos primero)
    let linkWhatsApp = null;
    if (whatsapp_cliente) {
      const textoBase = `¡Hola ${nombre_cliente}! 💈\nTe confirmamos tu turno para el día y hora: ${fecha_hora} en ${nombreNegocio}.\n¡Te esperamos!`;
      const textoCodificado = encodeURIComponent(textoBase);
      linkWhatsApp = `https://wa.me/${whatsapp_cliente}?text=${textoCodificado}`;
    }

    // 6. RESPUESTA AL FRONTEND (¡LA MOVIMOS ACÁ ARRIBA!)
    // Le clavamos la respuesta inmediatamente para que la página web no se quede trabada
    res.status(201).json({
      mensaje: 'Turno guardado, mail intentando salir y WhatsApp listo',
      turno: resultado.rows[0],
      link_whatsapp_dueno: linkWhatsApp
    });

    // 7. --- MAGIA DE MAILS (EN SEGUNDO PLANO) ---
    console.log('--- TEST DE TURNO ---');
    console.log('Datos recibidos del frontend:', req.body);

    if (email_cliente) {
      console.log('¡Turno guardado! Intentando mandar mail en segundo plano a:', email_cliente);
      // Fíjate que le sacamos el "await" del principio y le agregamos el ".catch" al final
      enviarMailConfirmacion(email_cliente, nombre_cliente, fecha_hora, nombreNegocio)
        .catch(err => console.log('⚠️ Aviso: El correo dio timeout por bloqueo de Render (Modo MVP).'));
    } else {
      console.log('⚠️ ALERTA: email_cliente llegó vacío, se cancela el envío.');
    }

  } catch (error) {
    console.error('ERROR COMPLETO AL GUARDAR EL TURNO:', error);
    res.status(500).json({ error: 'Hubo un problema al guardar el turno' });
  }
});


// ==========================================
// RUTA PARA EL DASHBOARD: OBTENER TURNOS
// ==========================================
app.get('/api/turnos', async (req, res) => {
  try {
    const { negocio_id } = req.query;

    if (!negocio_id) {
      return res.status(400).json({ error: 'Falta enviar el negocio_id' });
    }

    // Buscamos en la base de datos todos los turnos de este negocio
    // y los ordenamos para que los más recientes salgan primero.
    const query = `
      SELECT id, servicio_id, fecha_hora, nombre_cliente, email_cliente, whatsapp_cliente
      FROM turnos
      WHERE negocio_id = $1
      ORDER BY fecha_hora ASC
    `;
    const resultado = await db.query(query, [negocio_id]);

    // Le devolvemos la lista completa al Frontend
    res.status(200).json(resultado.rows);

  } catch (error) {
    console.error('ERROR AL TRAER LOS TURNOS:', error);
    res.status(500).json({ error: 'Hubo un problema al consultar la base de datos' });
  }
});


// ==========================================
// RUTA PARA EL CLIENTE: OBTENER DISPONIBILIDAD DINÁMICA
// ==========================================
app.get('/api/turnos-disponibles', async (req, res) => {
  try {
    const { negocio_id, fecha } = req.query;

    if (!negocio_id || !fecha) {
      return res.status(400).json({ error: 'Faltan datos (negocio_id o fecha)' });
    }

    // 1. TRAER REGLAS DEL NEGOCIO: Vamos a la BD a ver cómo trabaja este local en particular
    const queryConfig = `SELECT hora_apertura, hora_cierre, duracion_turno_minutos FROM negocios_config WHERE negocio_id = $1`;
    const resultadoConfig = await pool.query(queryConfig, [negocio_id]);
    
    if (resultadoConfig.rows.length === 0) {
      return res.status(404).json({ error: 'Configuración del negocio no encontrada' });
    }

    const reglas = resultadoConfig.rows[0];

    // 2. EL REGLAMENTO DINÁMICO: Usamos nuestra calculadora
    // (Acomodamos el formato de la hora que devuelve Postgres cortando los segundos)
    const apertura = reglas.hora_apertura.substring(0, 5); 
    const cierre = reglas.hora_cierre.substring(0, 5);
    
    const turnosPosibles = generarGrillaHoraria(apertura, cierre, reglas.duracion_turno_minutos);

    // 3. BUSCAMOS LOS OCUPADOS:
    const queryTurnos = `SELECT fecha_hora FROM turnos WHERE negocio_id = $1 AND fecha_hora LIKE $2`;
    const resultadoTurnos = await pool.query(queryTurnos, [negocio_id, `${fecha}%`]);

    const turnosOcupados = resultadoTurnos.rows.map(turno => {
      return turno.fecha_hora.split(' ')[1].substring(0, 5); 
    });

    // 4. LA LIMPIEZA FINAL:
    const turnosDisponibles = turnosPosibles.filter(hora => !turnosOcupados.includes(hora));

    res.status(200).json(turnosDisponibles);

  } catch (error) {
    console.error('ERROR CALCULANDO DISPONIBILIDAD:', error);
    res.status(500).json({ error: 'Hubo un problema al calcular los turnos' });
  }
});

// ==========================================
//    RUTA PARA CANCELAR UN TURNO 
// ==========================================
// Usamos PUT porque estamos "actualizando" un dato existente, y :id en la URL
app.put('/api/turnos/:id/cancelar', async (req, res) => {
  const turno_id = req.params.id;

  try {
    // 1. Actualizamos y al mismo tiempo traemos los datos del cliente y el negocio
    const query = `
      UPDATE turnos t
      SET estado = 'cancelado' 
      FROM negocios n
      WHERE t.id = $1 AND t.negocio_id = n.id
      RETURNING t.nombre_cliente, t.email_cliente, t.fecha_hora, n.nombre as nombre_negocio;
    `;
    
    const resultado = await db.query(query, [turno_id]);

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Turno no encontrado' });
    }

    const infoTurno = resultado.rows[0];

    // 2. Disparamos el mail de cancelación
    if (infoTurno.email_cliente) {
        enviarMailCancelacion(
            infoTurno.email_cliente, 
            infoTurno.nombre_cliente, 
            infoTurno.fecha_hora, 
            infoTurno.nombre_negocio
        );
    }

    res.json({ 
      mensaje: '¡Turno cancelado y cliente notificado!', 
      detalles: infoTurno 
    });

  } catch (error) {
    console.error('Error al cancelar:', error);
    res.status(500).json({ error: 'Hubo un problema al cancelar el turno' });
  }
});
// Ruta para OBTENER los horarios libres de un día (VERSIÓN DINÁMICA SAAS)

app.get('/api/turnos/disponibles', async (req, res) => {
  const { negocio_id, fecha } = req.query;

  if (!negocio_id || !fecha) {
    return res.status(400).json({ error: 'Faltan parámetros: negocio_id y fecha' });
  }

  try {
    // 1. Buscamos la configuración EXACTA de este negocio
    const queryNegocio = 'SELECT hora_apertura, hora_cierre, duracion_turno_minutos FROM negocios WHERE id = $1';
    const resNegocio = await db.query(queryNegocio, [negocio_id]);
    
    if (resNegocio.rows.length === 0) {
      return res.status(404).json({ error: 'Negocio no encontrado' });
    }
    
    const config = resNegocio.rows[0];

    // 2. Función generadora de la grilla horaria matemática
    const generarGrilla = (apertura, cierre, intervalo) => {
      const horarios = [];
      let [horaActual, minActual] = apertura.split(':').map(Number);
      const [horaFin, minFin] = cierre.split(':').map(Number);

      while (horaActual < horaFin || (horaActual === horaFin && minActual < minFin)) {
        // Formateamos para que quede siempre "HH:MM"
        const horaStr = String(horaActual).padStart(2, '0');
        const minStr = String(minActual).padStart(2, '0');
        horarios.push(`${horaStr}:${minStr}`);

        // Sumamos los minutos
        minActual += intervalo;
        if (minActual >= 60) {
          horaActual += Math.floor(minActual / 60);
          minActual = minActual % 60;
        }
      }
      return horarios;
    };

    // 3. Armamos todos los horarios posibles de ese local
    const horariosPosibles = generarGrilla(config.hora_apertura, config.hora_cierre, config.duracion_turno_minutos);

    // 4. Buscamos en SQL los horarios que YA ESTÁN OCUPADOS ese día
    const queryOcupados = `
      SELECT TO_CHAR(fecha_hora, 'HH24:MI') as hora_ocupada
      FROM turnos
      WHERE negocio_id = $1 
        AND DATE(fecha_hora) = $2
        AND estado != 'cancelado'
    `;
    const resOcupados = await db.query(queryOcupados, [negocio_id, fecha]);
    const turnosOcupados = resOcupados.rows.map(row => row.hora_ocupada);

    // 5. Filtramos la grilla: dejamos solo los horarios que no están en la lista de ocupados
    const horariosLibres = horariosPosibles.filter(hora => !turnosOcupados.includes(hora));

    res.json({
      fecha: fecha,
      configuracion_local: {
        apertura: config.hora_apertura,
        cierre: config.hora_cierre,
        duracion_minutos: config.duracion_turno_minutos
      },
      disponibles: horariosLibres
    });

  } catch (error) {
    console.error('Error al consultar disponibilidad:', error);
    res.status(500).json({ error: 'Hubo un problema calculando los turnos' });
  }
});
// Ruta para el Dashboard: Métricas de Facturación y Horarios
// Ruta protegida con JWT
app.get('/api/dashboard/metricas', verificarToken, async (req, res) => {

  // Pedimos el negocio, y qué mes/año quiere analizar
  const { negocio_id, mes, anio } = req.query;

  if (!negocio_id || !mes || !anio) {
    return res.status(400).json({ error: 'Faltan parámetros: negocio_id, mes o anio' });
  }

  try {
    // 1. Calculamos la plata: Sumamos el precio de todos los turnos 'completados' de ese mes
    // Usamos COALESCE para que si no hay turnos, devuelva 0 en vez de 'null'
    const queryFacturacion = `
      SELECT 
        COALESCE(SUM(precio), 0) as total_facturado,
        COUNT(id) as total_turnos
      FROM turnos
      WHERE negocio_id = $1 
        AND estado = 'completado'
        AND EXTRACT(MONTH FROM fecha_hora) = $2
        AND EXTRACT(YEAR FROM fecha_hora) = $3
    `;
    const valoresFacturacion = [negocio_id, mes, anio];
    
    // 2. Calculamos los horarios: Agrupamos turnos para ver cuáles son las horas pico y las muertas
    const queryHorarios = `
      SELECT 
        TO_CHAR(fecha_hora, 'HH24:MI') as hora,
        COUNT(id) as cantidad_turnos
      FROM turnos
      WHERE negocio_id = $1
        AND estado != 'cancelado'
      GROUP BY TO_CHAR(fecha_hora, 'HH24:MI')
      ORDER BY cantidad_turnos DESC
    `;
    const valoresHorarios = [negocio_id];

    // Ejecutamos las dos consultas de SQL en paralelo (es más rápido que esperar una y luego la otra)
    const [resFacturacion, resHorarios] = await Promise.all([
      db.query(queryFacturacion, valoresFacturacion),
      db.query(queryHorarios, valoresHorarios)
    ]);

    // 3. Le devolvemos el paquete armado al Frontend
    res.json({
      periodo: `${mes}/${anio}`,
      resumen: resFacturacion.rows[0],
      distribucion_horaria: resHorarios.rows
    });

  } catch (error) {
    console.error('Error calculando métricas:', error);
    res.status(500).json({ error: 'Hubo un problema calculando las métricas del dashboard' });
  }
});
// Ruta para el Dashboard: Radar de Retención (Clientes perdidos)
app.get('/api/dashboard/retencion',verificarToken, async (req, res) => {
  // Pedimos el negocio y hace cuántos días consideramos que el cliente está "perdido"
  const { negocio_id, dias_inactividad } = req.query;

  if (!negocio_id) {
    return res.status(400).json({ error: 'Falta el parámetro: negocio_id' });
  }

  // Por defecto, si el frontend no nos manda los días, buscamos los que no vienen hace 30 días
  const limiteDias = dias_inactividad || 30;

  try {
    // Magia de SQL: Agrupamos por cliente y nos quedamos solo con los que 
    // su ÚLTIMO turno (MAX) fue hace más de X días atrás.
    const query = `
      SELECT 
        nombre_cliente,
        whatsapp_cliente,
        email_cliente,
        MAX(fecha_hora) as ultimo_turno
      FROM turnos
      WHERE negocio_id = $1 
        AND estado = 'completado'
      GROUP BY nombre_cliente, whatsapp_cliente, email_cliente
      HAVING MAX(fecha_hora) < NOW() - ($2::int * INTERVAL '1 day')
      ORDER BY ultimo_turno ASC
    `;
    
    // Le pasamos el ID del negocio y la cantidad de días
    const valores = [negocio_id, limiteDias];
    const resultado = await db.query(query, valores);

    res.json({
      mensaje: `Mostrando clientes inactivos hace más de ${limiteDias} días`,
      clientes_recuperables: resultado.rowCount,
      lista: resultado.rows
    });

  } catch (error) {
    console.error('Error calculando retención:', error);
    res.status(500).json({ error: 'Hubo un problema buscando a los clientes perdidos' });
  }
});
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});