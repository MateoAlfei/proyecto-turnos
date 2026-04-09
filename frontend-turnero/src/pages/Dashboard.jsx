import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE, getAuthHeaders } from '../config';

export default function Dashboard() {
  const [turnos, setTurnos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [nombreNegocio, setNombreNegocio] = useState('');
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

  const slugPublico = typeof window !== 'undefined' ? localStorage.getItem('turnero_slug') : null;

  useEffect(() => {
    setNombreNegocio(localStorage.getItem('turnero_nombre') || 'Tu negocio');
    cargarTurnos();
  }, [cargarTurnos]);

  const cerrarSesion = () => {
    localStorage.removeItem('turnero_token');
    localStorage.removeItem('turnero_negocio_id');
    localStorage.removeItem('turnero_nombre');
    localStorage.removeItem('turnero_slug');
    navigate('/admin');
  };

  /* HashRouter: el # evita 404 en hosting estático (p. ej. Render) sin reglas de rewrite */
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

      <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold text-gray-700">Agenda</h2>
          <span className="bg-blue-100 text-blue-800 text-sm font-bold px-3 py-1 rounded-full">
            {turnos.length} turnos
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b text-gray-500 text-sm uppercase tracking-wider">
                <th className="p-4 font-semibold">Horario</th>
                <th className="p-4 font-semibold">Cliente</th>
                <th className="p-4 font-semibold">Contacto</th>
                <th className="p-4 font-semibold">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cargando ? (
                <tr>
                  <td colSpan="4" className="p-8 text-center text-gray-400">
                    Cargando agenda…
                  </td>
                </tr>
              ) : turnos.length === 0 ? (
                <tr>
                  <td colSpan="4" className="p-8 text-center text-gray-500">
                    No hay turnos para mostrar.
                  </td>
                </tr>
              ) : (
                turnos.map((turno) => (
                  <tr key={turno.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 font-bold text-gray-800">{turno.fecha_hora}</td>
                    <td className="p-4 font-medium text-gray-600">{turno.nombre_cliente}</td>
                    <td className="p-4 text-gray-500">
                      {turno.whatsapp_cliente ? (
                        <a
                          href={`https://wa.me/${turno.whatsapp_cliente}?text=${encodeURIComponent(textoWhatsApp(turno))}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-600 hover:underline font-bold flex items-center gap-1"
                        >
                          {turno.whatsapp_cliente}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="p-4">
                      <button
                        type="button"
                        onClick={() => cancelarTurno(turno.id)}
                        className="text-red-500 hover:text-red-700 font-bold text-sm"
                      >
                        Cancelar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
