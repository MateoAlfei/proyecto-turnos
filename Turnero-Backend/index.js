require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db'); // Importamos la conexión a la base de datos que hicimos recién
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { verificarToken } = require('./middleware');
const { JWT_SECRET } = require('./jwtSecret');
const { slugify, elegirSlugUnico } = require('./slugUtils');
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
  const {
    nombre,
    email,
    password,
    hora_apertura,
    hora_cierre,
    duracion_turno_minutos,
    telefono_aviso,
    slug: slugPedido,
    direccion
  } = req.body;

  if (!nombre || !email || !password) {
    return res.status(400).json({ error: 'Faltan nombre, email o contraseña' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }

  try {
    const passwordEncriptada = await bcrypt.hash(password, 10);

    let slug;
    if (slugPedido && String(slugPedido).trim()) {
      slug = slugify(slugPedido);
      const taken = await db.query('SELECT id FROM negocios WHERE slug = $1', [slug]);
      if (taken.rows.length > 0) {
        return res.status(400).json({ error: 'Ese enlace ya está en uso. Probá con otro.' });
      }
    } else {
      slug = await elegirSlugUnico(db, nombre);
    }

    const query = `
      INSERT INTO negocios (nombre, email, password, hora_apertura, hora_cierre, duracion_turno_minutos, telefono_aviso, slug, direccion)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, nombre, email, slug;
    `;

    const valores = [
      nombre,
      email,
      passwordEncriptada,
      hora_apertura || '09:00',
      hora_cierre || '18:00',
      duracion_turno_minutos || 30,
      telefono_aviso || '0',
      slug,
      direccion || null
    ];

    const resultado = await db.query(query, valores);
    const negId = resultado.rows[0].id;
    try {
      await db.query(
        `INSERT INTO recursos (negocio_id, nombre, orden) VALUES ($1, 'Principal', 0)`,
        [negId]
      );
    } catch (e) {
      console.error('Aviso: no se pudo crear recurso por defecto (¿corriste npm run migrate:recursos?):', e.message);
    }

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
    const resultado = await db.query(
      'SELECT id, nombre, email, password, slug FROM negocios WHERE email = $1',
      [email]
    );
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
    res.json({
      mensaje: 'Login exitoso',
      token,
      negocio_id: negocio.id,
      nombre: negocio.nombre,
      slug: negocio.slug
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Hubo un error en el servidor' });
  }
});
// Nuestra primera ruta de prueba
app.get('/api/ping', (req, res) => {
  res.json({ mensaje: '¡El backend del turnero está vivo!' });
});

// Acciones públicas firmadas para clientes (desde link en email)
app.get('/api/public/turnos/:accion', async (req, res) => {
  const accion = req.params.accion;
  const token = req.query?.token ? String(req.query.token) : '';
  if (!token) {
    return res.status(400).send(renderHtmlEstadoPublico('Link inválido', 'Falta el token de validación.'));
  }
  if (accion !== 'confirmar' && accion !== 'cancelar') {
    return res.status(404).send(renderHtmlEstadoPublico('Acción inválida', 'La acción solicitada no existe.'));
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload || payload.act !== accion || !Number.isInteger(Number(payload.tid))) {
      return res.status(400).send(renderHtmlEstadoPublico('Link inválido', 'El enlace no es válido para esta acción.'));
    }
    const tid = Number(payload.tid);

    if (accion === 'confirmar') {
      const r = await db.query(
        `UPDATE turnos
         SET asistencia_confirmada = TRUE,
             asistencia_confirmada_at = NOW()
         WHERE id = $1 AND estado != 'cancelado'
         RETURNING id, fecha_hora`,
        [tid]
      );
      if (r.rows.length === 0) {
        return res.status(404).send(
          renderHtmlEstadoPublico('No se pudo confirmar', 'El turno no existe o ya fue cancelado.')
        );
      }
      return res.send(
        renderHtmlEstadoPublico(
          'Asistencia confirmada',
          `Gracias. Tu turno del ${String(r.rows[0].fecha_hora)} quedó confirmado.`
        )
      );
    }

    const r = await db.query(
      `UPDATE turnos
       SET estado = 'cancelado'
       WHERE id = $1 AND estado != 'cancelado'
       RETURNING id, fecha_hora`,
      [tid]
    );
    if (r.rows.length === 0) {
      return res.status(404).send(
        renderHtmlEstadoPublico('No se pudo cancelar', 'El turno no existe o ya estaba cancelado.')
      );
    }
    return res.send(
      renderHtmlEstadoPublico('Turno cancelado', `Tu turno del ${String(r.rows[0].fecha_hora)} fue cancelado correctamente.`)
    );
  } catch (error) {
    return res
      .status(400)
      .send(renderHtmlEstadoPublico('Link vencido o inválido', 'Solicitá un nuevo enlace al negocio.'));
  }
});

// Datos públicos del negocio (página de reservas por slug)
app.get('/api/public/negocios/:slug', async (req, res) => {
  let raw = req.params.slug || '';
  try {
    raw = decodeURIComponent(raw);
  } catch {
    /* usar valor sin decodificar */
  }
  raw = raw.trim().toLowerCase();
  if (!raw) {
    return res.status(400).json({ error: 'Falta el identificador del negocio' });
  }
  try {
    const resultado = await db.query(
      `SELECT id, nombre, slug, direccion, hora_apertura, hora_cierre, duracion_turno_minutos
       FROM negocios WHERE slug = $1`,
      [raw]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Negocio no encontrado' });
    }
    const row = resultado.rows[0];
    res.json({
      id: row.id,
      nombre: row.nombre,
      slug: row.slug,
      direccion: row.direccion,
      hora_apertura: row.hora_apertura,
      hora_cierre: row.hora_cierre,
      duracion_turno_minutos: row.duracion_turno_minutos
    });
  } catch (error) {
    console.error('Error público negocio:', error);
    res.status(500).json({ error: 'Error al cargar el negocio' });
  }
});

function formatHoraSalida(val) {
  if (val == null) return null;
  const s = String(val);
  return s.length >= 5 ? s.slice(0, 5) : s;
}

function normalizarHoraInput(h) {
  const [a, b] = String(h).trim().split(':');
  const hh = Number(a);
  const mm = Number(b);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || mm < 0 || mm > 59 || hh < 0 || hh > 23) {
    return null;
  }
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function horaToMinutos(hhmm) {
  const [h, m] = String(hhmm).slice(0, 5).split(':').map(Number);
  return h * 60 + m;
}

function diaSemanaDesdeFecha(fechaYYYYMMDD) {
  return new Date(`${fechaYYYYMMDD}T12:00:00`).getDay(); // 0=domingo...6=sábado
}

function recursoHabilitadoEnHorario(recurso, diaSemana, horaTurno, duracionMinutos) {
  const dias = Array.isArray(recurso?.dias_habilitados) ? recurso.dias_habilitados : [0, 1, 2, 3, 4, 5, 6];
  if (!dias.includes(diaSemana)) return false;
  const apertura = recurso?.hora_apertura ? String(recurso.hora_apertura).slice(0, 5) : null;
  const cierre = recurso?.hora_cierre ? String(recurso.hora_cierre).slice(0, 5) : null;
  if (!apertura || !cierre) return true;
  const ini = horaToMinutos(horaTurno);
  const a = horaToMinutos(apertura);
  const c = horaToMinutos(cierre);
  return ini >= a && (ini + duracionMinutos) <= c;
}

function getPublicApiBase() {
  return (
    process.env.PUBLIC_API_URL ||
    process.env.BACKEND_PUBLIC_URL ||
    `http://localhost:${PORT}`
  );
}

function renderHtmlEstadoPublico(titulo, detalle) {
  return `<!doctype html>
  <html lang="es">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${titulo}</title>
      <style>
        body { font-family: Arial, sans-serif; background:#f5f7fb; margin:0; padding:24px; }
        .card { max-width:680px; margin:40px auto; background:white; border:1px solid #e5e7eb; border-radius:14px; padding:24px; }
        h1 { margin:0 0 10px; color:#111827; font-size:24px; }
        p { color:#4b5563; line-height:1.5; }
        .muted { color:#6b7280; font-size:14px; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>${titulo}</h1>
        <p>${detalle}</p>
        <p class="muted">Podés cerrar esta ventana.</p>
      </div>
    </body>
  </html>`;
}

// Perfil del negocio (dueño logueado)
app.get('/api/negocio/perfil', verificarToken, async (req, res) => {
  try {
    const resultado = await db.query(
      `SELECT id, nombre, slug, email, direccion, hora_apertura, hora_cierre, duracion_turno_minutos, telefono_aviso
       FROM negocios WHERE id = $1`,
      [req.negocioLogueado.id]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Negocio no encontrado' });
    }
    const row = resultado.rows[0];
    res.json({
      id: row.id,
      nombre: row.nombre,
      slug: row.slug,
      email: row.email,
      direccion: row.direccion,
      hora_apertura: formatHoraSalida(row.hora_apertura),
      hora_cierre: formatHoraSalida(row.hora_cierre),
      duracion_turno_minutos: row.duracion_turno_minutos,
      telefono_aviso: row.telefono_aviso
    });
  } catch (error) {
    console.error('Error perfil negocio:', error);
    res.status(500).json({ error: 'Error al cargar el perfil' });
  }
});

app.put('/api/negocio/perfil', verificarToken, async (req, res) => {
  const id = req.negocioLogueado.id;
  const p = req.body || {};
  const campos = [];
  const valores = [];
  let idx = 1;

  const agregar = (col, val) => {
    campos.push(`${col} = $${idx++}`);
    valores.push(val);
  };

  if (p.nombre !== undefined) {
    const n = String(p.nombre).trim();
    if (!n) return res.status(400).json({ error: 'El nombre no puede quedar vacío' });
    agregar('nombre', n);
  }
  if (p.direccion !== undefined) {
    agregar('direccion', p.direccion === '' || p.direccion == null ? null : String(p.direccion).trim());
  }
  if (p.hora_apertura !== undefined) {
    const norm = normalizarHoraInput(p.hora_apertura);
    if (!norm) return res.status(400).json({ error: 'hora_apertura inválida (usá HH:MM, 24 h)' });
    agregar('hora_apertura', norm);
  }
  if (p.hora_cierre !== undefined) {
    const norm = normalizarHoraInput(p.hora_cierre);
    if (!norm) return res.status(400).json({ error: 'hora_cierre inválida (usá HH:MM, 24 h)' });
    agregar('hora_cierre', norm);
  }
  if (p.duracion_turno_minutos !== undefined) {
    const d = Number(p.duracion_turno_minutos);
    if (!Number.isInteger(d) || d < 5 || d > 480) {
      return res.status(400).json({ error: 'duracion_turno_minutos debe ser un entero entre 5 y 480' });
    }
    agregar('duracion_turno_minutos', d);
  }
  if (p.telefono_aviso !== undefined) {
    agregar('telefono_aviso', String(p.telefono_aviso).trim() || '0');
  }

  if (campos.length === 0) {
    return res.status(400).json({ error: 'No hay datos para actualizar' });
  }

  valores.push(id);

  try {
    await db.query(`UPDATE negocios SET ${campos.join(', ')} WHERE id = $${idx}`, valores);
    const resultado = await db.query(
      `SELECT id, nombre, slug, email, direccion, hora_apertura, hora_cierre, duracion_turno_minutos, telefono_aviso
       FROM negocios WHERE id = $1`,
      [id]
    );
    const row = resultado.rows[0];
    res.json({
      mensaje: 'Perfil actualizado',
      perfil: {
        id: row.id,
        nombre: row.nombre,
        slug: row.slug,
        email: row.email,
        direccion: row.direccion,
        hora_apertura: formatHoraSalida(row.hora_apertura),
        hora_cierre: formatHoraSalida(row.hora_cierre),
        duracion_turno_minutos: row.duracion_turno_minutos,
        telefono_aviso: row.telefono_aviso
      }
    });
  } catch (error) {
    console.error('Error actualizando perfil:', error);
    res.status(500).json({ error: 'No se pudo guardar el perfil' });
  }
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

  if (!nombre || precio === undefined || precio === null || precio === '') {
    return res.status(400).json({ error: 'Faltan datos: nombre o precio' });
  }

  const precioNum = Number(precio);
  if (!Number.isFinite(precioNum) || precioNum < 0) {
    return res.status(400).json({ error: 'Precio inválido' });
  }

  try {
    const query = `
      INSERT INTO servicios (negocio_id, nombre, precio) 
      VALUES ($1, $2, $3) 
      RETURNING *;
    `;
    const resultado = await db.query(query, [negocio_id, String(nombre).trim(), precioNum]);
    
    res.status(201).json({ 
      mensaje: 'Servicio agregado al catálogo', 
      servicio: resultado.rows[0] 
    });
  } catch (error) {
    console.error('Error creando servicio:', error);
    res.status(500).json({ error: 'Hubo un error al guardar el servicio' });
  }
});

// Listado de servicios del negocio logueado (panel dueño)
app.get('/api/servicios/propios', verificarToken, async (req, res) => {
  try {
    const resultado = await db.query(
      'SELECT id, nombre, precio FROM servicios WHERE negocio_id = $1 ORDER BY nombre ASC',
      [req.negocioLogueado.id]
    );
    res.json(resultado.rows);
  } catch (error) {
    console.error('Error servicios propios:', error);
    res.status(500).json({ error: 'Error al cargar servicios' });
  }
});

app.delete('/api/servicios/:id', verificarToken, async (req, res) => {
  const servicioId = Number(req.params.id);
  if (!Number.isInteger(servicioId) || servicioId < 1) {
    return res.status(400).json({ error: 'ID inválido' });
  }
  try {
    const resultado = await db.query(
      'DELETE FROM servicios WHERE id = $1 AND negocio_id = $2 RETURNING id',
      [servicioId, req.negocioLogueado.id]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Servicio no encontrado' });
    }
    res.json({ mensaje: 'Servicio eliminado' });
  } catch (error) {
    if (error.code === '23503') {
      return res.status(409).json({ error: 'No se puede borrar: hay turnos que usan este servicio' });
    }
    console.error('Error borrando servicio:', error);
    res.status(500).json({ error: 'Error al eliminar el servicio' });
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

// Calendarios / recursos (canchas, peluqueros, etc.) — lectura pública para la página de reservas
app.get('/api/recursos', async (req, res) => {
  const { negocio_id } = req.query;
  const nid = Number(negocio_id);
  if (!Number.isInteger(nid) || nid < 1) {
    return res.status(400).json({ error: 'Falta negocio_id válido' });
  }
  try {
    const resultado = await db.query(
      `SELECT id, nombre, orden, hora_apertura, hora_cierre, dias_habilitados
       FROM recursos WHERE negocio_id = $1 ORDER BY orden ASC, id ASC`,
      [nid]
    );
    res.json(resultado.rows);
  } catch (error) {
    console.error('Error listando recursos:', error);
    res.status(500).json({ error: 'Error al cargar calendarios' });
  }
});

app.get('/api/recursos/propios', verificarToken, async (req, res) => {
  try {
    const resultado = await db.query(
      `SELECT id, nombre, orden, hora_apertura, hora_cierre, dias_habilitados
       FROM recursos WHERE negocio_id = $1 ORDER BY orden ASC, id ASC`,
      [req.negocioLogueado.id]
    );
    res.json(resultado.rows);
  } catch (error) {
    console.error('Error recursos propios:', error);
    res.status(500).json({ error: 'Error al cargar calendarios' });
  }
});

app.post('/api/recursos', verificarToken, async (req, res) => {
  const nombre = req.body?.nombre != null ? String(req.body.nombre).trim() : '';
  if (!nombre) {
    return res.status(400).json({ error: 'El nombre del calendario no puede quedar vacío' });
  }
  if (nombre.length > 120) {
    return res.status(400).json({ error: 'Nombre demasiado largo (máx. 120)' });
  }
  try {
    const maxOrden = await db.query(
      `SELECT COALESCE(MAX(orden), -1) + 1 AS siguiente FROM recursos WHERE negocio_id = $1`,
      [req.negocioLogueado.id]
    );
    const orden = maxOrden.rows[0].siguiente;
    const base = await db.query(
      `SELECT hora_apertura, hora_cierre FROM negocios WHERE id = $1`,
      [req.negocioLogueado.id]
    );
    const hA = base.rows[0]?.hora_apertura || '09:00';
    const hC = base.rows[0]?.hora_cierre || '18:00';
    const resultado = await db.query(
      `INSERT INTO recursos (negocio_id, nombre, orden, hora_apertura, hora_cierre, dias_habilitados)
       VALUES ($1, $2, $3, $4, $5, ARRAY[0,1,2,3,4,5,6])
       RETURNING id, nombre, orden, hora_apertura, hora_cierre, dias_habilitados`,
      [req.negocioLogueado.id, nombre, orden, hA, hC]
    );
    res.status(201).json({ mensaje: 'Calendario agregado', recurso: resultado.rows[0] });
  } catch (error) {
    console.error('Error creando recurso:', error);
    res.status(500).json({ error: 'No se pudo crear el calendario' });
  }
});

app.put('/api/recursos/:id', verificarToken, async (req, res) => {
  const rid = Number(req.params.id);
  if (!Number.isInteger(rid) || rid < 1) {
    return res.status(400).json({ error: 'ID inválido' });
  }
  const negocio_id = req.negocioLogueado.id;
  const p = req.body || {};

  const campos = [];
  const valores = [];
  let idx = 1;
  const add = (k, v) => {
    campos.push(`${k} = $${idx++}`);
    valores.push(v);
  };

  if (p.nombre !== undefined) {
    const n = String(p.nombre).trim();
    if (!n) return res.status(400).json({ error: 'El nombre no puede quedar vacío' });
    if (n.length > 120) return res.status(400).json({ error: 'Nombre demasiado largo (máx. 120)' });
    add('nombre', n);
  }
  if (p.hora_apertura !== undefined) {
    const norm = normalizarHoraInput(p.hora_apertura);
    if (!norm) return res.status(400).json({ error: 'hora_apertura inválida (HH:MM)' });
    add('hora_apertura', norm);
  }
  if (p.hora_cierre !== undefined) {
    const norm = normalizarHoraInput(p.hora_cierre);
    if (!norm) return res.status(400).json({ error: 'hora_cierre inválida (HH:MM)' });
    add('hora_cierre', norm);
  }
  if (p.dias_habilitados !== undefined) {
    if (!Array.isArray(p.dias_habilitados)) {
      return res.status(400).json({ error: 'dias_habilitados debe ser un array' });
    }
    const limpios = [...new Set(p.dias_habilitados.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
    if (limpios.length === 0) {
      return res.status(400).json({ error: 'Elegí al menos un día habilitado' });
    }
    add('dias_habilitados', limpios);
  }
  if (campos.length === 0) {
    return res.status(400).json({ error: 'No hay datos para actualizar' });
  }

  valores.push(rid, negocio_id);
  try {
    const r = await db.query(
      `UPDATE recursos SET ${campos.join(', ')}
       WHERE id = $${idx++} AND negocio_id = $${idx}
       RETURNING id, nombre, orden, hora_apertura, hora_cierre, dias_habilitados`,
      valores
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Calendario no encontrado' });
    res.json({ mensaje: 'Calendario actualizado', recurso: r.rows[0] });
  } catch (error) {
    console.error('Error actualizando recurso:', error);
    res.status(500).json({ error: 'No se pudo actualizar el calendario' });
  }
});

app.delete('/api/recursos/:id', verificarToken, async (req, res) => {
  const rid = Number(req.params.id);
  if (!Number.isInteger(rid) || rid < 1) {
    return res.status(400).json({ error: 'ID inválido' });
  }
  const negocio_id = req.negocioLogueado.id;
  try {
    const usados = await db.query(
      `SELECT COUNT(*)::int AS n FROM turnos WHERE recurso_id = $1 AND negocio_id = $2`,
      [rid, negocio_id]
    );
    if (usados.rows[0].n > 0) {
      return res.status(409).json({
        error: 'No se puede borrar: hay turnos asociados a este calendario (incluye cancelados)'
      });
    }
    const total = await db.query(`SELECT COUNT(*)::int AS n FROM recursos WHERE negocio_id = $1`, [negocio_id]);
    if (total.rows[0].n <= 1) {
      return res.status(400).json({ error: 'Tenés que tener al menos un calendario' });
    }
    const del = await db.query(`DELETE FROM recursos WHERE id = $1 AND negocio_id = $2 RETURNING id`, [rid, negocio_id]);
    if (del.rows.length === 0) {
      return res.status(404).json({ error: 'Calendario no encontrado' });
    }
    res.json({ mensaje: 'Calendario eliminado' });
  } catch (error) {
    console.error('Error borrando recurso:', error);
    res.status(500).json({ error: 'No se pudo eliminar el calendario' });
  }
});

// Ruta para GUARDAR un turno nuevo
// ==========================================
//    RUTA PARA CREAR UN TURNO (SAAS PRO)
// ==========================================
app.post('/api/turnos', async (req, res) => {
  const { negocio_id, fecha_hora, nombre_cliente, email_cliente, whatsapp_cliente, servicio_id, recurso_id } =
    req.body;

  const nid = Number(negocio_id);
  if (!Number.isInteger(nid) || nid < 1) {
    return res.status(400).json({ error: 'negocio_id inválido' });
  }
  const recursoOpcional =
    recurso_id === undefined || recurso_id === null || recurso_id === '' ? null : Number(recurso_id);
  if (recursoOpcional !== null && (!Number.isInteger(recursoOpcional) || recursoOpcional < 1)) {
    return res.status(400).json({ error: 'recurso_id inválido' });
  }
  if (!fecha_hora || !nombre_cliente) {
    return res.status(400).json({ error: 'Faltan fecha/hora o nombre del cliente' });
  }

  try {
    const resNegocio = await db.query('SELECT nombre, direccion FROM negocios WHERE id = $1', [nid]);
    if (resNegocio.rows.length === 0) {
      return res.status(404).json({ error: 'Negocio no encontrado' });
    }
    const nombreNegocio = resNegocio.rows[0].nombre;
    const direccionNegocio = resNegocio.rows[0].direccion;

    let ridAsignado = recursoOpcional;
    const fechaTurno = String(fecha_hora).slice(0, 10);
    const horaTurno = String(fecha_hora).slice(11, 16);
    const diaSemana = diaSemanaDesdeFecha(fechaTurno);
    const duracionTurno = await db.query(
      'SELECT duracion_turno_minutos FROM negocios WHERE id = $1',
      [nid]
    );
    const duracionMinutos = Number(duracionTurno.rows[0]?.duracion_turno_minutos || 30);

    if (ridAsignado !== null) {
      const resRecurso = await db.query(
        'SELECT id, hora_apertura, hora_cierre, dias_habilitados FROM recursos WHERE id = $1 AND negocio_id = $2',
        [
        ridAsignado,
        nid
      ]);
      if (resRecurso.rows.length === 0) {
        return res.status(400).json({ error: 'Calendario inválido para este negocio' });
      }
      if (!recursoHabilitadoEnHorario(resRecurso.rows[0], diaSemana, horaTurno, duracionMinutos)) {
        return res.status(400).json({ error: 'Ese calendario no atiende en el día/horario elegido' });
      }
    }

    let precioFinal = 0;
    if (servicio_id) {
      const resServicio = await db.query('SELECT precio FROM servicios WHERE id = $1', [servicio_id]);
      if (resServicio.rows.length > 0) {
        precioFinal = resServicio.rows[0].precio;
      }
    }

    let resultado;
    if (ridAsignado !== null) {
      const query = `
      INSERT INTO turnos (negocio_id, recurso_id, fecha_hora, nombre_cliente, email_cliente, whatsapp_cliente, servicio_id, precio, estado)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pendiente')
      RETURNING *;
    `;
      const valores = [
        nid,
        ridAsignado,
        fecha_hora,
        nombre_cliente,
        email_cliente,
        whatsapp_cliente,
        servicio_id,
        precioFinal
      ];
      try {
        resultado = await db.query(query, valores);
      } catch (insErr) {
        if (insErr && insErr.code === '23505') {
          return res.status(409).json({ error: 'Ese horario ya está ocupado en este calendario' });
        }
        throw insErr;
      }
    } else {
      // Modo "cualquiera disponible": intenta reservar el primer calendario libre por orden.
      let lastErr = null;
      for (let i = 0; i < 3; i++) {
        try {
          resultado = await db.query(
            `
            INSERT INTO turnos (negocio_id, recurso_id, fecha_hora, nombre_cliente, email_cliente, whatsapp_cliente, servicio_id, precio, estado)
            SELECT $1, r.id, $2, $3, $4, $5, $6, $7, 'pendiente'
            FROM recursos r
            WHERE r.negocio_id = $1
              AND $8 = ANY(COALESCE(r.dias_habilitados, ARRAY[0,1,2,3,4,5,6]))
              AND COALESCE(r.hora_apertura, '00:00'::time) <= $9::time
              AND COALESCE(r.hora_cierre, '23:59'::time) >= ($9::time + ($10::text || ' minutes')::interval)
              AND NOT EXISTS (
                SELECT 1
                FROM turnos t
                WHERE t.negocio_id = $1
                  AND t.recurso_id = r.id
                  AND t.fecha_hora = $2
                  AND t.estado != 'cancelado'
              )
            ORDER BY r.orden ASC, r.id ASC
            LIMIT 1
            RETURNING *;
          `,
            [
              nid,
              fecha_hora,
              nombre_cliente,
              email_cliente,
              whatsapp_cliente,
              servicio_id,
              precioFinal,
              diaSemana,
              horaTurno,
              duracionMinutos
            ]
          );
          if (resultado.rows.length > 0) break;
          return res.status(409).json({ error: 'No hay calendarios disponibles en ese horario' });
        } catch (insErr) {
          lastErr = insErr;
          if (insErr && insErr.code === '23505') {
            // Carrera entre dos reservas simultáneas: reintenta y busca otro calendario libre.
            continue;
          }
          throw insErr;
        }
      }
      if (!resultado || resultado.rows.length === 0) {
        if (lastErr && lastErr.code === '23505') {
          return res.status(409).json({ error: 'Ese horario ya no está disponible. Probá otro.' });
        }
        return res.status(409).json({ error: 'No hay calendarios disponibles en ese horario' });
      }
      ridAsignado = resultado.rows[0].recurso_id;
    }

    let nombreRecursoAsignado = null;
    if (resultado?.rows?.[0]?.recurso_id) {
      const resNombreRecurso = await db.query('SELECT nombre FROM recursos WHERE id = $1', [
        resultado.rows[0].recurso_id
      ]);
      if (resNombreRecurso.rows.length > 0) {
        nombreRecursoAsignado = resNombreRecurso.rows[0].nombre;
      }
    }

    const publicApiBase = getPublicApiBase();
    const tokenConfirmar = jwt.sign(
      { tid: resultado.rows[0].id, act: 'confirmar' },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    const tokenCancelar = jwt.sign(
      { tid: resultado.rows[0].id, act: 'cancelar' },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    const confirmarUrl = `${publicApiBase}/api/public/turnos/confirmar?token=${encodeURIComponent(tokenConfirmar)}`;
    const cancelarUrl = `${publicApiBase}/api/public/turnos/cancelar?token=${encodeURIComponent(tokenCancelar)}`;

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
      enviarMailConfirmacion(email_cliente, nombre_cliente, fecha_hora, nombreNegocio, {
        turnoId: resultado.rows[0].id,
        direccion: direccionNegocio,
        recursoNombre: nombreRecursoAsignado,
        confirmarUrl,
        cancelarUrl
      }).catch(() => console.log('⚠️ Aviso: no se pudo enviar el correo de confirmación.'));
    } else {
      console.log('⚠️ ALERTA: email_cliente llegó vacío, se cancela el envío.');
    }

  } catch (error) {
    console.error('ERROR COMPLETO AL GUARDAR EL TURNO:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Hubo un problema al guardar el turno' });
    }
  }
});


// ==========================================
// RUTA PARA EL DASHBOARD: OBTENER TURNOS (solo el negocio del token)
// ==========================================
app.get('/api/turnos', verificarToken, async (req, res) => {
  try {
    const negocio_id = req.negocioLogueado.id;

    const query = `
      SELECT t.id, t.servicio_id, t.recurso_id, t.fecha_hora, t.nombre_cliente, t.email_cliente, t.whatsapp_cliente,
             t.estado, t.precio, t.asistencia_confirmada, t.asistencia_confirmada_at,
             s.nombre AS servicio_nombre,
             r.nombre AS recurso_nombre
      FROM turnos t
      LEFT JOIN servicios s ON s.id = t.servicio_id
      LEFT JOIN recursos r ON r.id = t.recurso_id
      WHERE t.negocio_id = $1
      ORDER BY t.fecha_hora ASC
    `;
    const resultado = await db.query(query, [negocio_id]);

    res.status(200).json(resultado.rows);

  } catch (error) {
    console.error('ERROR AL TRAER LOS TURNOS:', error);
    res.status(500).json({ error: 'Hubo un problema al consultar la base de datos' });
  }
});

// Cambiar estado del turno (pendiente ↔ completado) — no reemplaza cancelar (con mail)
app.put('/api/turnos/:id/estado', verificarToken, async (req, res) => {
  const turnoId = Number(req.params.id);
  const { estado } = req.body;
  const negocio_id = req.negocioLogueado.id;

  if (!Number.isInteger(turnoId) || turnoId < 1) {
    return res.status(400).json({ error: 'ID de turno inválido' });
  }
  if (estado !== 'pendiente' && estado !== 'completado') {
    return res.status(400).json({ error: 'Solo se admite estado pendiente o completado' });
  }

  try {
    const resultado = await db.query(
      `UPDATE turnos SET estado = $1
       WHERE id = $2 AND negocio_id = $3 AND estado != 'cancelado'
       RETURNING *`,
      [estado, turnoId, negocio_id]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Turno no encontrado o está cancelado' });
    }
    res.json({ turno: resultado.rows[0] });
  } catch (error) {
    console.error('Error actualizando estado:', error);
    res.status(500).json({ error: 'No se pudo actualizar el estado' });
  }
});

// ==========================================
//    RUTA PARA CANCELAR UN TURNO 
// ==========================================
// Usamos PUT porque estamos "actualizando" un dato existente, y :id en la URL
app.put('/api/turnos/:id/cancelar', verificarToken, async (req, res) => {
  const turno_id = req.params.id;
  const negocio_id = req.negocioLogueado.id;

  try {
    const query = `
      UPDATE turnos t
      SET estado = 'cancelado' 
      FROM negocios n
      WHERE t.id = $1 AND t.negocio_id = n.id AND t.negocio_id = $2
      RETURNING t.nombre_cliente, t.email_cliente, t.fecha_hora, n.nombre as nombre_negocio, n.direccion as direccion_negocio;
    `;
    
    const resultado = await db.query(query, [turno_id, negocio_id]);

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Turno no encontrado o no pertenece a tu negocio' });
    }

    const infoTurno = resultado.rows[0];

    if (infoTurno.email_cliente) {
        enviarMailCancelacion(
            infoTurno.email_cliente,
            infoTurno.nombre_cliente,
            infoTurno.fecha_hora,
            infoTurno.nombre_negocio,
            infoTurno.direccion_negocio
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
  const { negocio_id, fecha, recurso_id } = req.query;
  let recursoObjetivo = null;

  if (!negocio_id || !fecha) {
    return res.status(400).json({ error: 'Faltan parámetros: negocio_id y fecha' });
  }
  const rid =
    recurso_id === undefined || recurso_id === null || recurso_id === '' ? null : Number(recurso_id);
  if (rid !== null && (!Number.isInteger(rid) || rid < 1)) {
    return res.status(400).json({ error: 'recurso_id inválido' });
  }

  try {
    if (rid !== null) {
      const chk = await db.query(
        'SELECT id, hora_apertura, hora_cierre, dias_habilitados FROM recursos WHERE id = $1 AND negocio_id = $2',
        [rid, negocio_id]
      );
      if (chk.rows.length === 0) {
        return res.status(404).json({ error: 'Calendario no encontrado para este negocio' });
      }
      recursoObjetivo = chk.rows[0];
    }

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

    const diaSemana = diaSemanaDesdeFecha(fecha);
    let horariosLibres = [];
    if (rid !== null) {
      // Modo calendario específico
      const queryOcupados = `
      SELECT TO_CHAR(fecha_hora, 'HH24:MI') as hora_ocupada
      FROM turnos
      WHERE negocio_id = $1 
        AND recurso_id = $3
        AND DATE(fecha_hora) = $2::date
        AND estado != 'cancelado'
    `;
      const resOcupados = await db.query(queryOcupados, [negocio_id, fecha, rid]);
      const turnosOcupados = resOcupados.rows.map(row => row.hora_ocupada);
      horariosLibres = horariosPosibles.filter(
        hora =>
          recursoHabilitadoEnHorario(recursoObjetivo, diaSemana, hora, config.duracion_turno_minutos) &&
          !turnosOcupados.includes(hora)
      );
    } else {
      // Modo "cualquiera disponible": libre si existe al menos un calendario libre en esa hora.
      const recursosRes = await db.query(
        'SELECT id, hora_apertura, hora_cierre, dias_habilitados FROM recursos WHERE negocio_id = $1',
        [negocio_id]
      );
      const recursos = recursosRes.rows || [];
      const totalRecursos = recursos.length;
      if (totalRecursos === 0) {
        return res.json({
          fecha: fecha,
          configuracion_local: {
            apertura: config.hora_apertura,
            cierre: config.hora_cierre,
            duracion_minutos: config.duracion_turno_minutos
          },
          disponibles: []
        });
      }
      const ocupadosPorHoraRes = await db.query(
        `
        SELECT TO_CHAR(fecha_hora, 'HH24:MI') AS hora_ocupada, COUNT(DISTINCT recurso_id)::int AS ocupados
        FROM turnos
        WHERE negocio_id = $1
          AND DATE(fecha_hora) = $2::date
          AND estado != 'cancelado'
        GROUP BY TO_CHAR(fecha_hora, 'HH24:MI')
      `,
        [negocio_id, fecha]
      );
      const ocupadosMap = new Map(ocupadosPorHoraRes.rows.map(r => [r.hora_ocupada, r.ocupados]));
      horariosLibres = horariosPosibles.filter(hora => {
        const habilitados = recursos.filter((r) =>
          recursoHabilitadoEnHorario(r, diaSemana, hora, config.duracion_turno_minutos)
        );
        if (habilitados.length === 0) return false;
        return (ocupadosMap.get(hora) || 0) < habilitados.length;
      });
    }

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

  const negocio_id = req.negocioLogueado.id;
  const { mes, anio } = req.query;

  if (!mes || !anio) {
    return res.status(400).json({ error: 'Faltan parámetros: mes o anio' });
  }

  try {
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
  const negocio_id = req.negocioLogueado.id;
  const { dias_inactividad } = req.query;

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