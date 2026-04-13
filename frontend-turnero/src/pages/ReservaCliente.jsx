import { useState, useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { API_BASE } from '../config';

export default function ReservaCliente() {
  const { slug } = useParams();
  const [negocio, setNegocio] = useState(null);
  const [errorNegocio, setErrorNegocio] = useState(false);
  const [servicios, setServicios] = useState([]);
  const [cargandoServicios, setCargandoServicios] = useState(true);
  const [recursos, setRecursos] = useState([]);
  const [cargandoRecursos, setCargandoRecursos] = useState(true);

  const [servicioSeleccionado, setServicioSeleccionado] = useState(null);
  const [recursoSeleccionado, setRecursoSeleccionado] = useState(null);
  const [datosCliente, setDatosCliente] = useState({ nombre: '', email: '', whatsapp: '' });

  const [fechaElegida, setFechaElegida] = useState('');
  const [horariosDisponibles, setHorariosDisponibles] = useState([]);
  const [horaSeleccionada, setHoraSeleccionada] = useState(null);
  const [cargandoHorarios, setCargandoHorarios] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setErrorNegocio(false);
    setNegocio(null);
    fetch(`${API_BASE}/api/public/negocios/${encodeURIComponent(slug)}`)
      .then((res) => {
        if (!res.ok) throw new Error('notfound');
        return res.json();
      })
      .then(setNegocio)
      .catch(() => setErrorNegocio(true));
  }, [slug]);

  useEffect(() => {
    if (!negocio?.id) {
      setServicios([]);
      setCargandoServicios(false);
      return;
    }
    setCargandoServicios(true);
    fetch(`${API_BASE}/api/servicios?negocio_id=${negocio.id}`)
      .then((res) => res.json())
      .then((datos) => {
        setServicios(Array.isArray(datos) ? datos : []);
        setCargandoServicios(false);
      })
      .catch(() => {
        setServicios([]);
        setCargandoServicios(false);
      });
  }, [negocio?.id]);

  useEffect(() => {
    if (!negocio?.id) {
      setRecursos([]);
      setCargandoRecursos(false);
      return;
    }
    setCargandoRecursos(true);
    fetch(`${API_BASE}/api/recursos?negocio_id=${negocio.id}`)
      .then((res) => res.json())
      .then((datos) => {
        setRecursos(Array.isArray(datos) ? datos : []);
        setCargandoRecursos(false);
      })
      .catch(() => {
        setRecursos([]);
        setCargandoRecursos(false);
      });
  }, [negocio?.id]);

  const recursoParam = useMemo(() => {
    if (!recursoSeleccionado || recursoSeleccionado === 'any') return null;
    return Number(recursoSeleccionado);
  }, [recursoSeleccionado]);

  const cargarDisponibilidad = (nuevaFecha, recursoValue) => {
    if (!negocio?.id || !nuevaFecha || !recursoValue) return;
    setCargandoHorarios(true);
    const qs = new URLSearchParams({
      negocio_id: String(negocio.id),
      fecha: nuevaFecha
    });
    if (recursoValue !== 'any') {
      qs.set('recurso_id', String(recursoValue));
    }
    fetch(`${API_BASE}/api/turnos/disponibles?${qs.toString()}`)
      .then((res) => res.json())
      .then((datos) => {
        const lista = Array.isArray(datos.disponibles) ? datos.disponibles : [];
        setHorariosDisponibles(lista);
        setCargandoHorarios(false);
      })
      .catch(() => {
        setHorariosDisponibles([]);
        setCargandoHorarios(false);
      });
  };

  const handleFechaChange = (e) => {
    const nuevaFecha = e.target.value;
    setFechaElegida(nuevaFecha);
    setHoraSeleccionada(null);
    if (!negocio?.id || !nuevaFecha || !recursoSeleccionado) return;
    cargarDisponibilidad(nuevaFecha, recursoSeleccionado);
  };

  const handleInputChange = (e) => {
    setDatosCliente({ ...datosCliente, [e.target.name]: e.target.value });
  };

  const obtenerFechaMinima = () => {
    const hoy = new Date();
    hoy.setMinutes(hoy.getMinutes() - hoy.getTimezoneOffset());
    return hoy.toISOString().split('T')[0];
  };

  const intentarReservar = async () => {
    if (!negocio?.id) return;
    setEnviando(true);

    const fechaHoraFinal = `${fechaElegida} ${horaSeleccionada}`;

    const turnoNuevo = {
      negocio_id: negocio.id,
      servicio_id: servicioSeleccionado,
      fecha_hora: fechaHoraFinal,
      nombre_cliente: datosCliente.nombre,
      email_cliente: datosCliente.email,
      whatsapp_cliente: datosCliente.whatsapp
    };
    if (recursoParam) {
      turnoNuevo.recurso_id = recursoParam;
    }

    try {
      const respuesta = await fetch(`${API_BASE}/api/turnos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(turnoNuevo)
      });

      if (respuesta.status === 201) {
        alert('¡Turno guardado con éxito!');
        window.location.reload();
      } else {
        const err = await respuesta.json().catch(() => ({}));
        alert(err.error || 'No se pudo guardar el turno.');
      }
    } catch {
      alert('Error de conexión.');
    } finally {
      setEnviando(false);
    }
  };

  if (errorNegocio) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-xl font-bold text-gray-800 mb-2">No encontramos este negocio</h1>
        <p className="text-gray-500 mb-6">Revisá el enlace o pedile al dueño la URL correcta.</p>
        <Link to="/" className="text-green-700 font-semibold hover:underline">
          Volver al inicio
        </Link>
      </div>
    );
  }

  if (!negocio) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 animate-pulse">Cargando…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-4xl mx-auto bg-white p-6 sm:p-8 rounded-2xl shadow-lg border border-gray-100">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">{negocio.nombre}</h1>
          <p className="text-gray-500">Reservá tu turno online</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div>
            <h2 className="text-xl font-bold text-gray-700 mb-4">1. Elegí un servicio</h2>
            {cargandoServicios ? (
              <p className="animate-pulse text-gray-500">Cargando…</p>
            ) : servicios.length === 0 ? (
              <p className="text-amber-800 bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm">
                Este local todavía no cargó servicios. Volvé más tarde o contactá al negocio.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 mb-8">
                {servicios.map((servicio) => (
                  <div
                    key={servicio.id}
                    onClick={() => setServicioSeleccionado(servicio.id)}
                    className={`border-2 rounded-xl p-4 cursor-pointer transition-colors ${
                      servicioSeleccionado === servicio.id
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-100 hover:border-blue-300'
                    }`}
                  >
                    <h3 className="font-bold text-gray-700">{servicio.nombre}</h3>
                    <p className="font-medium mt-1 text-gray-500">${servicio.precio}</p>
                  </div>
                ))}
              </div>
            )}

            <h2 className="text-xl font-bold text-gray-700 mb-4">2. Calendario</h2>
            <p className="text-sm text-gray-500 mb-3">
              Elegí un calendario puntual o "Cualquiera disponible" para asignación automática.
            </p>
            {cargandoRecursos ? (
              <p className="animate-pulse text-gray-500 mb-8">Cargando…</p>
            ) : recursos.length === 0 ? (
              <p className="text-amber-800 bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm mb-8">
                Este local todavía no configuró calendarios. Contactá al negocio.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 mb-8">
                <div
                  onClick={() => {
                    setRecursoSeleccionado('any');
                    setFechaElegida('');
                    setHoraSeleccionada(null);
                    setHorariosDisponibles([]);
                  }}
                  className={`border-2 rounded-xl p-4 cursor-pointer transition-colors ${
                    recursoSeleccionado === 'any'
                      ? 'border-violet-600 bg-violet-50'
                      : 'border-gray-100 hover:border-violet-300'
                  }`}
                >
                  <h3 className="font-bold text-gray-700">Cualquiera disponible</h3>
                  <p className="text-xs text-gray-500 mt-1">Te asignamos automáticamente el primer calendario libre.</p>
                </div>
                {recursos.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => {
                      setRecursoSeleccionado(r.id);
                      setFechaElegida('');
                      setHoraSeleccionada(null);
                      setHorariosDisponibles([]);
                    }}
                    className={`border-2 rounded-xl p-4 cursor-pointer transition-colors ${
                      recursoSeleccionado === r.id
                        ? 'border-violet-600 bg-violet-50'
                        : 'border-gray-100 hover:border-violet-300'
                    }`}
                  >
                    <h3 className="font-bold text-gray-700">{r.nombre}</h3>
                  </div>
                ))}
              </div>
            )}

            <h2 className="text-xl font-bold text-gray-700 mb-4">3. Tus datos</h2>
            <div className="space-y-3">
              <input
                type="text"
                name="nombre"
                placeholder="Tu nombre"
                onChange={handleInputChange}
                className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-blue-500 outline-none"
              />
              <input
                type="email"
                name="email"
                placeholder="Tu email"
                onChange={handleInputChange}
                className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-blue-500 outline-none"
              />
              <input
                type="tel"
                name="whatsapp"
                placeholder="WhatsApp (ej. 549351...)"
                onChange={handleInputChange}
                className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-700 mb-4">4. Fecha y hora</h2>
            {!recursoSeleccionado ? (
              <p className="text-gray-500 text-sm mb-4">Primero elegí un calendario en el paso 2.</p>
            ) : null}
            <input
              type="date"
              min={obtenerFechaMinima()}
              value={fechaElegida}
              onChange={handleFechaChange}
              disabled={!recursoSeleccionado}
              className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-blue-500 outline-none text-gray-700 mb-6 cursor-pointer disabled:bg-gray-100 disabled:cursor-not-allowed"
            />

            {fechaElegida && recursoSeleccionado && (
              <div>
                <h3 className="font-bold text-gray-700 mb-3 text-center">
                  Horarios el {fechaElegida.split('-').reverse().join('/')}
                </h3>
                {recursoSeleccionado === 'any' && (
                  <p className="text-xs text-gray-500 text-center mb-3">
                    Mostramos horarios donde hay al menos un calendario libre.
                  </p>
                )}

                {cargandoHorarios ? (
                  <p className="text-center text-gray-500 animate-pulse">Buscando disponibilidad…</p>
                ) : horariosDisponibles.length === 0 ? (
                  <p className="text-center text-red-500 font-bold bg-red-50 p-3 rounded-xl">
                    No hay turnos disponibles ese día
                  </p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {horariosDisponibles.map((hora) => (
                      <button
                        key={hora}
                        type="button"
                        onClick={() => setHoraSeleccionada(hora)}
                        className={`py-2 rounded-lg font-bold transition-all ${
                          horaSeleccionada === hora
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {hora}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={intentarReservar}
          disabled={
            !servicioSeleccionado ||
            !recursoSeleccionado ||
            !datosCliente.nombre ||
            !fechaElegida ||
            !horaSeleccionada ||
            enviando ||
            servicios.length === 0 ||
            recursos.length === 0
          }
          className="w-full bg-gray-900 text-white text-lg font-bold py-4 rounded-xl mt-8 hover:bg-black transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {enviando ? 'Procesando…' : 'Confirmar turno'}
        </button>
      </div>
    </div>
  );
}
