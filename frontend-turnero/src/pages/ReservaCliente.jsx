import { useState, useEffect } from 'react';
import { API_BASE, NEGOCIO_PUBLICO_ID } from '../config';

export default function ReservaCliente() {
  const [servicios, setServicios] = useState([]);
  const [cargandoServicios, setCargandoServicios] = useState(true);
  
  // Memoria del cliente
  const [servicioSeleccionado, setServicioSeleccionado] = useState(null);
  const [datosCliente, setDatosCliente] = useState({ nombre: '', email: '', whatsapp: '' });
  
  // Memoria de fechas (Dinámico)
  const [fechaElegida, setFechaElegida] = useState(''); 
  const [horariosDisponibles, setHorariosDisponibles] = useState([]); 
  const [horaSeleccionada, setHoraSeleccionada] = useState(null); 
  const [cargandoHorarios, setCargandoHorarios] = useState(false);
  const [enviando, setEnviando] = useState(false);

  // 1. Al entrar, traemos los servicios
  useEffect(() => {
    fetch(`${API_BASE}/api/servicios?negocio_id=${NEGOCIO_PUBLICO_ID}`)
      .then((res) => res.json())
      .then((datos) => {
        setServicios(datos);
        setCargandoServicios(false);
      })
      .catch((error) => console.error("Error:", error));
  }, []);

  // 2. EFECTO MÁGICO: Cuando el cliente elige una fecha en el input nativo
  const handleFechaChange = (e) => {
    const nuevaFecha = e.target.value; // Formato YYYY-MM-DD
    setFechaElegida(nuevaFecha);
    setHoraSeleccionada(null); // Reseteamos la hora si cambia de día
    setCargandoHorarios(true);
    
    fetch(`${API_BASE}/api/turnos/disponibles?negocio_id=${NEGOCIO_PUBLICO_ID}&fecha=${nuevaFecha}`)
      .then((res) => res.json())
      .then((datos) => {
        const lista = Array.isArray(datos.disponibles) ? datos.disponibles : [];
        setHorariosDisponibles(lista);
        setCargandoHorarios(false);
      })
      .catch((error) => {
        console.error("Error trayendo horarios:", error);
        setCargandoHorarios(false);
      });
  };

  const handleInputChange = (e) => {
    setDatosCliente({ ...datosCliente, [e.target.name]: e.target.value });
  };

  // Función para que no puedan elegir días del pasado
  const obtenerFechaMinima = () => {
    const hoy = new Date();
    hoy.setMinutes(hoy.getMinutes() - hoy.getTimezoneOffset());
    return hoy.toISOString().split('T')[0]; // Devuelve solo "YYYY-MM-DD"
  };

  const intentarReservar = async () => {
    setEnviando(true); 

    // Unimos la fecha y la hora elegida
    const fechaHoraFinal = `${fechaElegida} ${horaSeleccionada}`;

    const turnoNuevo = {
      negocio_id: Number(NEGOCIO_PUBLICO_ID),
      servicio_id: servicioSeleccionado,
      fecha_hora: fechaHoraFinal,
      nombre_cliente: datosCliente.nombre,
      email_cliente: datosCliente.email,
      whatsapp_cliente: datosCliente.whatsapp
    };

    try {
      const respuesta = await fetch(`${API_BASE}/api/turnos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(turnoNuevo)
      });

      if (respuesta.status === 201) {
        alert("¡Turno guardado con éxito! 🎉");
        window.location.reload(); 
      } else {
        alert("Hubo un problema al guardar el turno.");
      }
    } catch (error) {
      alert("Error de conexión.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-4xl mx-auto bg-white p-6 sm:p-8 rounded-2xl shadow-lg border border-gray-100">
        
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Peluquería Raineri ✂️</h1>
          <p className="text-gray-500">Reservá tu turno online en segundos</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          
          {/* COLUMNA IZQUIERDA: Servicio y Datos */}
          <div>
            <h2 className="text-xl font-bold text-gray-700 mb-4">1. Elegí un servicio</h2>
            {cargandoServicios ? <p className="animate-pulse">Cargando...</p> : (
              <div className="grid grid-cols-1 gap-3 mb-8">
                {servicios.map((servicio) => (
                  <div 
                    key={servicio.id} onClick={() => setServicioSeleccionado(servicio.id)}
                    className={`border-2 rounded-xl p-4 cursor-pointer transition-colors ${servicioSeleccionado === servicio.id ? 'border-blue-600 bg-blue-50' : 'border-gray-100 hover:border-blue-300'}`}
                  >
                    <h3 className="font-bold text-gray-700">{servicio.nombre}</h3>
                    <p className="font-medium mt-1 text-gray-500">${servicio.precio}</p>
                  </div>
                ))}
              </div>
            )}

            <h2 className="text-xl font-bold text-gray-700 mb-4">2. Tus datos</h2>
            <div className="space-y-3">
              <input type="text" name="nombre" placeholder="Tu Nombre" onChange={handleInputChange} className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-blue-500 outline-none" />
              <input type="email" name="email" placeholder="Tu Email" onChange={handleInputChange} className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-blue-500 outline-none" />
              <input type="tel" name="whatsapp" placeholder="Tu WhatsApp (Ej: 549351...)" onChange={handleInputChange} className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-blue-500 outline-none" />
            </div>
          </div>

          {/* COLUMNA DERECHA: Calendario Nativo y Horarios */}
          <div>
            <h2 className="text-xl font-bold text-gray-700 mb-4">3. Elegí fecha y hora</h2>
            
            {/* Calendario Nativo de HTML (A prueba de balas) */}
            <input 
              type="date" 
              min={obtenerFechaMinima()} 
              onChange={handleFechaChange}
              className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-blue-500 outline-none text-gray-700 mb-6 cursor-pointer"
            />

            {/* Grilla de Horarios Dinámica */}
            {fechaElegida && (
              <div>
                <h3 className="font-bold text-gray-700 mb-3 text-center">
                  Horarios para el {fechaElegida.split('-').reverse().join('/')}
                </h3>
                
                {cargandoHorarios ? (
                  <p className="text-center text-gray-500 animate-pulse">Buscando disponibilidad...</p>
                ) : horariosDisponibles.length === 0 ? (
                  <p className="text-center text-red-500 font-bold bg-red-50 p-3 rounded-xl">No hay turnos disponibles 😢</p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {horariosDisponibles.map((hora) => (
                      <button
                        key={hora}
                        onClick={() => setHoraSeleccionada(hora)}
                        className={`py-2 rounded-lg font-bold transition-all ${horaSeleccionada === hora ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
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

        {/* Botón Final */}
        <button 
          onClick={intentarReservar}
          disabled={!servicioSeleccionado || !datosCliente.nombre || !fechaElegida || !horaSeleccionada || enviando}
          className="w-full bg-gray-900 text-white text-lg font-bold py-4 rounded-xl mt-8 hover:bg-black transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {enviando ? 'Procesando turno...' : 'Confirmar Turno'}
        </button>

      </div>
    </div>
  );
}