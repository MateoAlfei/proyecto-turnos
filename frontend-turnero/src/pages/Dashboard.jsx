import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE, getAuthHeaders } from '../config';
import { exportarAgendaCsv } from '../csvExport';

const MESES = [
  { v: '1', l: 'Enero' },
  { v: '2', l: 'Febrero' },
  { v: '3', l: 'Marzo' },
  { v: '4', l: 'Abril' },
  { v: '5', l: 'Mayo' },
  { v: '6', l: 'Junio' },
  { v: '7', l: 'Julio' },
  { v: '8', l: 'Agosto' },
  { v: '9', l: 'Septiembre' },
  { v: '10', l: 'Octubre' },
  { v: '11', l: 'Noviembre' },
  { v: '12', l: 'Diciembre' }
];

/** YYYY-MM-DD en calendario local (para comparar con fecha_hora del turno). */
function fechaLocalKey(val) {
  if (val == null) return '';
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) {
    return val.slice(0, 10);
  }
  const parsed = new Date(val);
  if (Number.isNaN(parsed.getTime())) return '';
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  const d = String(parsed.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Fecha del turno para comparar rangos (hora local). */
function parseTurnoFecha(fecha_hora) {
  if (fecha_hora == null) return null;
  if (fecha_hora instanceof Date) {
    return Number.isNaN(fecha_hora.getTime()) ? null : fecha_hora;
  }
  const d = new Date(fecha_hora);
  if (!Number.isNaN(d.getTime())) return d;
  if (typeof fecha_hora === 'string' && /^\d{4}-\d{2}-\d{2}/.test(fecha_hora)) {
    const d2 = new Date(`${fecha_hora.slice(0, 10)}T12:00:00`);
    return Number.isNaN(d2.getTime()) ? null : d2;
  }
  return null;
}

/** Lunes 00:00 de la semana que contiene `ref` (calendario local). */
function inicioSemanaLunes(ref = new Date()) {
  const x = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const dow = x.getDay();
  const delta = dow === 0 ? -6 : 1 - dow;
  x.setDate(x.getDate() + delta);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Domingo 23:59:59.999 de esa misma semana. */
function finSemanaDomingo(ref = new Date()) {
  const start = inicioSemanaLunes(ref);
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999);
}

function enMesCalendario(d, ref = new Date()) {
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
}

function cumpleVistaAgenda(turno, vista) {
  const d = parseTurnoFecha(turno.fecha_hora);
  if (!d) return false;
  const ref = new Date();
  if (vista === 'hoy') return fechaLocalKey(d) === fechaLocalKey(ref);
  if (vista === 'semana') {
    const a = inicioSemanaLunes(ref);
    const b = finSemanaDomingo(ref);
    return d >= a && d <= b;
  }
  if (vista === 'mes') return enMesCalendario(d, ref);
  return false;
}

function badgeEstado(estado) {
  const base = 'text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap';
  if (estado === 'completado') return `${base} bg-emerald-100 text-emerald-800`;
  if (estado === 'cancelado') return `${base} bg-gray-200 text-gray-600`;
  return `${base} bg-amber-100 text-amber-800`;
}

export default function Dashboard() {
  const [turnos, setTurnos] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [cargandoServicios, setCargandoServicios] = useState(true);
  const [nombreNegocio, setNombreNegocio] = useState('');
  const [nuevoServicio, setNuevoServicio] = useState({ nombre: '', precio: '' });
  const [guardandoServicio, setGuardandoServicio] = useState(false);
  const [filtroAgenda, setFiltroAgenda] = useState('hoy');
  const ahora = new Date();
  const [mesSel, setMesSel] = useState(String(ahora.getMonth() + 1));
  const [anioSel, setAnioSel] = useState(String(ahora.getFullYear()));
  const [metricas, setMetricas] = useState(null);
  const [retencion, setRetencion] = useState(null);
  const [cargandoMetricas, setCargandoMetricas] = useState(false);
  const [perfilForm, setPerfilForm] = useState({
    nombre: '',
    direccion: '',
    telefono_aviso: '',
    hora_apertura: '09:00',
    hora_cierre: '18:00',
    duracion_turno_minutos: 30
  });
  const [emailNegocio, setEmailNegocio] = useState('');
  const [perfilCargando, setPerfilCargando] = useState(true);
  const [perfilGuardando, setPerfilGuardando] = useState(false);
  const navigate = useNavigate();

  const turnosVisibles = useMemo(
    () => turnos.filter((t) => cumpleVistaAgenda(t, filtroAgenda)),
    [turnos, filtroAgenda]
  );

  const cargarTurnos = useCallback(async () => {
    const token = localStorage.getItem('turnero_token');
    if (!token) {
      navigate('/admin');
      return;
    }
    setCargando(true);
    try {
      const res = await fetch(`${API_BASE}/api/turnos`, { headers: getAuthHeaders() });
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('turnero_token');
        localStorage.removeItem('turnero_negocio_id');
        localStorage.removeItem('turnero_nombre');
        localStorage.removeItem('turnero_slug');
        navigate('/admin');
        return;
      }
      const datos = await res.json();
      if (datos.error) throw new Error(datos.error);
      setTurnos(Array.isArray(datos) ? datos : []);
    } catch {
      setTurnos([]);
    } finally {
      setCargando(false);
    }
  }, [navigate]);

  const cargarServicios = useCallback(async () => {
    const token = localStorage.getItem('turnero_token');
    if (!token) return;
    setCargandoServicios(true);
    try {
      const res = await fetch(`${API_BASE}/api/servicios/propios`, { headers: getAuthHeaders() });
      if (res.status === 401 || res.status === 403) return;
      const datos = await res.json();
      setServicios(Array.isArray(datos) ? datos : []);
    } catch {
      setServicios([]);
    } finally {
      setCargandoServicios(false);
    }
  }, []);

  const cargarPerfil = useCallback(async () => {
    const token = localStorage.getItem('turnero_token');
    if (!token) return;
    setPerfilCargando(true);
    try {
      const res = await fetch(`${API_BASE}/api/negocio/perfil`, { headers: getAuthHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setEmailNegocio(data.email || '');
      setPerfilForm({
        nombre: data.nombre || '',
        direccion: data.direccion || '',
        telefono_aviso: data.telefono_aviso === '0' ? '' : data.telefono_aviso || '',
        hora_apertura: (data.hora_apertura || '09:00').toString().slice(0, 5),
        hora_cierre: (data.hora_cierre || '18:00').toString().slice(0, 5),
        duracion_turno_minutos: data.duracion_turno_minutos ?? 30
      });
    } catch {
      /* silencioso */
    } finally {
      setPerfilCargando(false);
    }
  }, []);

  const cargarInsights = useCallback(async () => {
    const token = localStorage.getItem('turnero_token');
    if (!token) return;
    setCargandoMetricas(true);
    try {
      const q = new URLSearchParams({ mes: mesSel, anio: anioSel });
      const [resM, resR] = await Promise.all([
        fetch(`${API_BASE}/api/dashboard/metricas?${q}`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/api/dashboard/retencion?dias_inactividad=30`, { headers: getAuthHeaders() })
      ]);
      if (resM.ok) setMetricas(await resM.json());
      else setMetricas(null);
      if (resR.ok) setRetencion(await resR.json());
      else setRetencion(null);
    } catch {
      setMetricas(null);
      setRetencion(null);
    } finally {
      setCargandoMetricas(false);
    }
  }, [mesSel, anioSel]);

  const slugPublico = typeof window !== 'undefined' ? localStorage.getItem('turnero_slug') : null;

  useEffect(() => {
    setNombreNegocio(localStorage.getItem('turnero_nombre') || 'Tu negocio');
    cargarTurnos();
    cargarServicios();
    cargarPerfil();
  }, [cargarTurnos, cargarServicios, cargarPerfil]);

  useEffect(() => {
    cargarInsights();
  }, [cargarInsights]);

  const cerrarSesion = () => {
    localStorage.removeItem('turnero_token');
    localStorage.removeItem('turnero_negocio_id');
    localStorage.removeItem('turnero_nombre');
    localStorage.removeItem('turnero_slug');
    navigate('/admin');
  };

  const linkReservas =
    slugPublico && typeof window !== 'undefined'
      ? `${window.location.origin}/#/reservar/${encodeURIComponent(slugPublico)}`
      : null;

  const cancelarTurno = async (id) => {
    if (!window.confirm('¿Cancelar este turno? Se enviará un mail al cliente si tiene email.')) return;
    try {
      const res = await fetch(`${API_BASE}/api/turnos/${id}/cancelar`, {
        method: 'PUT',
        headers: getAuthHeaders()
      });
      if (res.status === 401 || res.status === 403) {
        cerrarSesion();
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'No se pudo cancelar');
        return;
      }
      await cargarTurnos();
    } catch {
      alert('Error de conexión');
    }
  };

  const cambiarEstadoTurno = async (id, estado) => {
    try {
      const res = await fetch(`${API_BASE}/api/turnos/${id}/estado`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ estado })
      });
      if (res.status === 401 || res.status === 403) {
        cerrarSesion();
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'No se pudo actualizar');
        return;
      }
      await cargarTurnos();
    } catch {
      alert('Error de conexión');
    }
  };

  const agregarServicio = async (e) => {
    e.preventDefault();
    const nombre = nuevoServicio.nombre.trim();
    const precio = nuevoServicio.precio;
    if (!nombre || precio === '') {
      alert('Completá nombre y precio');
      return;
    }
    setGuardandoServicio(true);
    try {
      const res = await fetch(`${API_BASE}/api/servicios`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ nombre, precio: Number(precio) })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'No se pudo crear el servicio');
        return;
      }
      setNuevoServicio({ nombre: '', precio: '' });
      await cargarServicios();
    } catch {
      alert('Error de conexión');
    } finally {
      setGuardandoServicio(false);
    }
  };

  const guardarPerfil = async (e) => {
    e.preventDefault();
    setPerfilGuardando(true);
    try {
      const res = await fetch(`${API_BASE}/api/negocio/perfil`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          nombre: perfilForm.nombre.trim(),
          direccion: perfilForm.direccion.trim(),
          telefono_aviso: perfilForm.telefono_aviso.trim() || '0',
          hora_apertura: perfilForm.hora_apertura,
          hora_cierre: perfilForm.hora_cierre,
          duracion_turno_minutos: Number(perfilForm.duracion_turno_minutos)
        })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'No se pudo guardar');
        return;
      }
      if (data.perfil?.nombre) {
        localStorage.setItem('turnero_nombre', data.perfil.nombre);
        setNombreNegocio(data.perfil.nombre);
      }
      alert('Datos del negocio guardados');
    } catch {
      alert('Error de conexión');
    } finally {
      setPerfilGuardando(false);
    }
  };

  const exportarCsv = () => {
    if (!turnosVisibles.length) {
      alert('No hay turnos en esta vista para exportar');
      return;
    }
    exportarAgendaCsv(turnosVisibles, filtroAgenda);
  };

  const eliminarServicio = async (id) => {
    if (!window.confirm('¿Eliminar este servicio del catálogo?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/servicios/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'No se pudo eliminar');
        return;
      }
      await cargarServicios();
    } catch {
      alert('Error de conexión');
    }
  };

  const textoWhatsApp = (turno) =>
    `¡Hola ${turno.nombre_cliente}! 💈\nTe confirmamos tu turno para el día y hora: ${turno.fecha_hora} en ${nombreNegocio}.\n¡Te esperamos!`;

  const textoWhatsAppRetencion = (nombre) =>
    `¡Hola ${nombre}! Hace un tiempo que no te vemos en ${nombreNegocio}. ¿Te gustaría reservar un turno?`;

  const maxCantidadHora =
    metricas?.distribucion_horaria?.length > 0
      ? Math.max(...metricas.distribucion_horaria.map((r) => Number(r.cantidad_turnos) || 0), 1)
      : 1;

  const resumenMes = metricas?.resumen;
  const facturadoNum = resumenMes ? Number(resumenMes.total_facturado) : 0;
  const turnosCompletadosMes = resumenMes ? Number(resumenMes.total_turnos) : 0;

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Panel de control</h1>
          <p className="text-gray-500">{nombreNegocio}</p>
          {linkReservas && (
            <p className="text-sm text-green-700 mt-2 break-all">
              Link público:{' '}
              <a href={linkReservas} className="font-semibold underline" target="_blank" rel="noreferrer">
                {linkReservas}
              </a>
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={cerrarSesion}
          className="bg-white border-2 border-gray-200 text-gray-600 px-4 py-2 rounded-lg font-bold hover:bg-gray-50"
        >
          Cerrar sesión
        </button>
      </div>

      <div className="max-w-6xl mx-auto space-y-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gray-50 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <h2 className="text-xl font-bold text-gray-700">Resumen del mes</h2>
              <div className="flex flex-wrap gap-2 items-center">
                <select
                  value={mesSel}
                  onChange={(e) => setMesSel(e.target.value)}
                  className="border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-medium bg-white"
                >
                  {MESES.map((m) => (
                    <option key={m.v} value={m.v}>
                      {m.l}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={2020}
                  max={2035}
                  value={anioSel}
                  onChange={(e) => setAnioSel(e.target.value)}
                  className="w-24 border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-medium"
                />
              </div>
            </div>

            {cargandoMetricas ? (
              <p className="text-gray-400 text-sm animate-pulse">Cargando métricas…</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                  <p className="text-sm text-emerald-800 font-medium">Facturación (turnos completados)</p>
                  <p className="text-2xl font-bold text-emerald-900 mt-1">
                    {facturadoNum.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                  </p>
                  <p className="text-xs text-emerald-700 mt-1">{turnosCompletadosMes} turnos en el período</p>
                </div>
                <div className="sm:col-span-2 bg-slate-50 border border-slate-100 rounded-xl p-4">
                  <p className="text-sm font-semibold text-slate-700 mb-3">Horarios con más turnos (histórico, no cancelados)</p>
                  {metricas?.distribucion_horaria?.length > 0 ? (
                    <ul className="space-y-2">
                      {metricas.distribucion_horaria.slice(0, 6).map((row) => {
                        const n = Number(row.cantidad_turnos) || 0;
                        const pct = Math.round((n / maxCantidadHora) * 100);
                        return (
                          <li key={row.hora} className="flex items-center gap-3 text-sm">
                            <span className="w-14 font-mono text-slate-600 shrink-0">{row.hora}</span>
                            <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-slate-600 rounded-full transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-slate-500 w-8 text-right shrink-0">{n}</span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-slate-500 text-sm">Todavía no hay datos de horarios.</p>
                  )}
                </div>
              </div>
            )}

            {retencion && retencion.clientes_recuperables > 0 && (
              <div className="border border-amber-100 bg-amber-50/80 rounded-xl p-4">
                <p className="text-sm font-semibold text-amber-900">
                  {retencion.clientes_recuperables} cliente{retencion.clientes_recuperables !== 1 ? 's' : ''} sin turno
                  completado hace más de 30 días
                </p>
                <ul className="mt-2 space-y-1 text-sm text-amber-950">
                  {retencion.lista.slice(0, 5).map((c, i) => (
                    <li key={`${c.nombre_cliente}-${i}`} className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{c.nombre_cliente}</span>
                      {c.whatsapp_cliente && (
                        <a
                          href={`https://wa.me/${c.whatsapp_cliente}?text=${encodeURIComponent(textoWhatsAppRetencion(c.nombre_cliente))}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-700 font-semibold underline"
                        >
                          WhatsApp
                        </a>
                      )}
                    </li>
                  ))}
                  {retencion.lista.length > 5 && (
                    <li className="text-amber-800 text-xs">…y {retencion.lista.length - 5} más</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gray-50">
            <h2 className="text-xl font-bold text-gray-700">Agenda</h2>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-lg border-2 border-gray-200 overflow-hidden flex-wrap sm:flex-nowrap">
                {[
                  { id: 'hoy', label: 'Hoy' },
                  { id: 'semana', label: 'Semana' },
                  { id: 'mes', label: 'Mes' }
                ].map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setFiltroAgenda(id)}
                    className={`px-3 sm:px-4 py-2 text-sm font-bold transition-colors flex-1 sm:flex-none min-w-[4.5rem] ${
                      filtroAgenda === id ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <span className="bg-blue-100 text-blue-800 text-sm font-bold px-3 py-1 rounded-full whitespace-nowrap">
                {turnos.length !== turnosVisibles.length
                  ? `${turnosVisibles.length} en vista · ${turnos.length} total`
                  : `${turnosVisibles.length} turnos`}
              </span>
              <button
                type="button"
                onClick={exportarCsv}
                className="text-sm font-bold text-slate-700 border-2 border-slate-200 bg-white px-3 py-2 rounded-lg hover:bg-slate-50"
              >
                Exportar CSV
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="bg-white border-b text-gray-500 text-sm uppercase tracking-wider">
                  <th className="p-4 font-semibold">Estado</th>
                  <th className="p-4 font-semibold">Horario</th>
                  <th className="p-4 font-semibold">Cliente</th>
                  <th className="p-4 font-semibold">Servicio</th>
                  <th className="p-4 font-semibold">Contacto</th>
                  <th className="p-4 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cargando ? (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-gray-400">
                      Cargando agenda…
                    </td>
                  </tr>
                ) : turnosVisibles.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-gray-500">
                      {turnos.length > 0
                        ? filtroAgenda === 'hoy'
                          ? 'No hay turnos para hoy.'
                          : filtroAgenda === 'semana'
                            ? 'No hay turnos en esta semana (lun–dom).'
                            : 'No hay turnos en este mes.'
                        : 'No hay turnos para mostrar.'}
                    </td>
                  </tr>
                ) : (
                  turnosVisibles.map((turno) => {
                    const estado = turno.estado || 'pendiente';
                    return (
                      <tr key={turno.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4">
                          <span className={badgeEstado(estado)}>{estado}</span>
                        </td>
                        <td className="p-4 font-bold text-gray-800 whitespace-nowrap">{turno.fecha_hora}</td>
                        <td className="p-4 font-medium text-gray-600">{turno.nombre_cliente}</td>
                        <td className="p-4 text-gray-600 text-sm">
                          {turno.servicio_nombre ? (
                            <>
                              {turno.servicio_nombre}
                              {turno.precio != null && (
                                <span className="text-gray-400"> · ${turno.precio}</span>
                              )}
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="p-4 text-gray-500">
                          {turno.whatsapp_cliente ? (
                            <a
                              href={`https://wa.me/${turno.whatsapp_cliente}?text=${encodeURIComponent(textoWhatsApp(turno))}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-green-600 hover:underline font-bold"
                            >
                              WhatsApp
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-2">
                            {estado === 'pendiente' && (
                              <button
                                type="button"
                                onClick={() => cambiarEstadoTurno(turno.id, 'completado')}
                                className="text-emerald-600 hover:text-emerald-800 font-bold text-sm"
                              >
                                Marcar hecho
                              </button>
                            )}
                            {estado === 'completado' && (
                              <button
                                type="button"
                                onClick={() => cambiarEstadoTurno(turno.id, 'pendiente')}
                                className="text-amber-600 hover:text-amber-800 font-bold text-sm"
                              >
                                Volver a pendiente
                              </button>
                            )}
                            {estado !== 'cancelado' && (
                              <button
                                type="button"
                                onClick={() => cancelarTurno(turno.id)}
                                className="text-red-500 hover:text-red-700 font-bold text-sm"
                              >
                                Cancelar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gray-50">
            <h2 className="text-xl font-bold text-gray-700">Servicios (página de reservas)</h2>
            <p className="text-sm text-gray-500 mt-1">
              Los clientes eligen de esta lista al reservar. Sin servicios, no pueden confirmar turno.
            </p>
          </div>

          <div className="p-6">
            <form onSubmit={agregarServicio} className="flex flex-col sm:flex-row gap-3 mb-6">
              <input
                type="text"
                placeholder="Nombre del servicio"
                value={nuevoServicio.nombre}
                onChange={(e) => setNuevoServicio({ ...nuevoServicio, nombre: e.target.value })}
                className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 outline-none"
              />
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Precio"
                value={nuevoServicio.precio}
                onChange={(e) => setNuevoServicio({ ...nuevoServicio, precio: e.target.value })}
                className="w-full sm:w-36 border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 outline-none"
              />
              <button
                type="submit"
                disabled={guardandoServicio}
                className="bg-gray-900 text-white font-bold px-6 py-3 rounded-xl hover:bg-black disabled:bg-gray-400"
              >
                {guardandoServicio ? 'Guardando…' : 'Agregar'}
              </button>
            </form>

            {cargandoServicios ? (
              <p className="text-gray-400 animate-pulse">Cargando servicios…</p>
            ) : servicios.length === 0 ? (
              <p className="text-amber-800 bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm">
                Todavía no cargaste servicios. Agregá al menos uno para que los clientes puedan reservar.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
                {servicios.map((s) => (
                  <li
                    key={s.id}
                    className="flex justify-between items-center gap-4 px-4 py-3 bg-white hover:bg-gray-50"
                  >
                    <div>
                      <span className="font-semibold text-gray-800">{s.nombre}</span>
                      <span className="text-gray-500 ml-2">${s.precio}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => eliminarServicio(s.id)}
                      className="text-red-500 hover:text-red-700 text-sm font-bold shrink-0"
                    >
                      Eliminar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gray-50">
            <h2 className="text-xl font-bold text-gray-700">Mi negocio</h2>
            <p className="text-sm text-gray-500 mt-1">
              Nombre, dirección (sale en mails), horarios de la grilla de reservas y WhatsApp de avisos.
            </p>
          </div>
          <div className="p-6">
            {perfilCargando ? (
              <p className="text-gray-400 text-sm animate-pulse">Cargando…</p>
            ) : (
              <form onSubmit={guardarPerfil} className="space-y-4 max-w-xl">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del local</label>
                  <input
                    type="text"
                    value={perfilForm.nombre}
                    onChange={(e) => setPerfilForm({ ...perfilForm, nombre: e.target.value })}
                    required
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email de acceso</label>
                  <input
                    type="email"
                    value={emailNegocio}
                    disabled
                    className="w-full border-2 border-gray-100 rounded-xl px-4 py-3 bg-gray-50 text-gray-500 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-400 mt-1">Solo lectura.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                  <input
                    type="text"
                    value={perfilForm.direccion}
                    onChange={(e) => setPerfilForm({ ...perfilForm, direccion: e.target.value })}
                    placeholder="Calle, ciudad"
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp del local</label>
                  <input
                    type="tel"
                    value={perfilForm.telefono_aviso}
                    onChange={(e) => setPerfilForm({ ...perfilForm, telefono_aviso: e.target.value })}
                    placeholder="54911…"
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 outline-none"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Apertura</label>
                    <input
                      type="time"
                      value={perfilForm.hora_apertura}
                      onChange={(e) => setPerfilForm({ ...perfilForm, hora_apertura: e.target.value })}
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cierre</label>
                    <input
                      type="time"
                      value={perfilForm.hora_cierre}
                      onChange={(e) => setPerfilForm({ ...perfilForm, hora_cierre: e.target.value })}
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Duración turno (min)</label>
                    <input
                      type="number"
                      min={5}
                      max={480}
                      step={5}
                      value={perfilForm.duracion_turno_minutos}
                      onChange={(e) =>
                        setPerfilForm({ ...perfilForm, duracion_turno_minutos: Number(e.target.value) })
                      }
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={perfilGuardando}
                  className="bg-gray-900 text-white font-bold px-6 py-3 rounded-xl hover:bg-black disabled:bg-gray-400"
                >
                  {perfilGuardando ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
