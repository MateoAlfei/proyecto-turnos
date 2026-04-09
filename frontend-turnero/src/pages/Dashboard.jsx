import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE, getAuthHeaders } from '../config';

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
  const navigate = useNavigate();

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

  const slugPublico = typeof window !== 'undefined' ? localStorage.getItem('turnero_slug') : null;

  useEffect(() => {
    setNombreNegocio(localStorage.getItem('turnero_nombre') || 'Tu negocio');
    cargarTurnos();
    cargarServicios();
  }, [cargarTurnos, cargarServicios]);

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
          <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50">
            <h2 className="text-xl font-bold text-gray-700">Agenda</h2>
            <span className="bg-blue-100 text-blue-800 text-sm font-bold px-3 py-1 rounded-full">
              {turnos.length} turnos
            </span>
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
                ) : turnos.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-gray-500">
                      No hay turnos para mostrar.
                    </td>
                  </tr>
                ) : (
                  turnos.map((turno) => {
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
      </div>
    </div>
  );
}
