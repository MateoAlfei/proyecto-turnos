import { useState, useEffect } from 'react';

export default function ReservaCliente() {
  const [servicios, setServicios] = useState([]);
  const [cargando, setCargando] = useState(true);
  
  const [servicioSeleccionado, setServicioSeleccionado] = useState(null);
  const [datosCliente, setDatosCliente] = useState({
    nombre: '',
    email: '',
    whatsapp: '',
    fecha_hora: ''
  });
  const [enviando, setEnviando] = useState(false);

  // --- NUEVO: CALCULAMOS LA FECHA ACTUAL ---
  // Esto saca la fecha y hora de hoy en el formato exacto que pide el input de HTML (YYYY-MM-DDTHH:mm)
  const obtenerFechaMinima = () => {
    const hoy = new Date();
    // Le restamos el desfasaje horario para que coincida con Argentina/tu país
    hoy.setMinutes(hoy.getMinutes() - hoy.getTimezoneOffset());
    return hoy.toISOString().slice(0, 16);
  };

  const handleInputChange = (e) => {
    setDatosCliente({
      ...datosCliente,
      [e.target.name]: e.target.value
    });
  };

  useEffect(() => {
    fetch('https://proyecto-turnos.onrender.com/api/servicios?negocio_id=1')
      .then((respuesta) => respuesta.json())
      .then((datos) => {
        setServicios(datos);
        setCargando(false);
      })
      .catch((error) => console.error("Error:", error));
  }, []);

  const intentarReservar = async () => {
    // --- NUEVO: VALIDACIÓN DE HORARIO DE COMERCIO ---
    const fechaElegida = new Date(datosCliente.fecha_hora);
    const hora = fechaElegida.getHours();
    
    // Si elige antes de las 9 AM o después de las 20 PM (8 PM), lo rebotamos.
    if (hora < 9 || hora >= 20) {
      alert("⚠️ La peluquería solo atiende de 09:00 a 20:00 hs. Por favor, elegí otro horario.");
      return; // Cortamos la función acá, no mandamos nada a Render
    }

    setEnviando(true); 

    const turnoNuevo = {
      negocio_id: 1,
      servicio_id: servicioSeleccionado,
      fecha_hora: datosCliente.fecha_hora.replace('T', ' '),
      nombre_cliente: datosCliente.nombre,
      email_cliente: datosCliente.email,
      whatsapp_cliente: datosCliente.whatsapp
    };

    try {
      const respuesta = await fetch('https://proyecto-turnos.onrender.com/api/turnos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(turnoNuevo)
      });

      if (respuesta.status === 201) {
        alert("¡Turno guardado con éxito! 🎉");
        window.location.reload(); 
      } else {
        alert("Uy, hubo un problema al guardar el turno.");
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Error de conexión.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto bg-white p-6 sm:p-8 rounded-2xl shadow-lg border border-gray-100">
        
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Peluquería Raineri ✂️</h1>
          <p className="text-gray-500">Reservá tu turno online en segundos</p>
        </div>

        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-700 mb-4">1. Elegí un servicio</h2>
          {cargando ? (
            <p className="text-center text-gray-500 animate-pulse">Cargando...</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {servicios.map((servicio) => {
                const estaSeleccionado = servicioSeleccionado === servicio.id;
                return (
                  <div 
                    key={servicio.id} 
                    onClick={() => setServicioSeleccionado(servicio.id)}
                    className={`border-2 rounded-xl p-4 cursor-pointer transition-colors ${
                      estaSeleccionado ? 'border-blue-600 bg-blue-50' : 'border-gray-100 hover:border-blue-300'
                    }`}
                  >
                    <h3 className={`font-bold ${estaSeleccionado ? 'text-blue-800' : 'text-gray-700'}`}>
                      {servicio.nombre}
                    </h3>
                    <p className={`font-medium mt-1 ${estaSeleccionado ? 'text-blue-600' : 'text-gray-500'}`}>
                      ${servicio.precio}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-700 mb-4">2. Tus datos y horario</h2>
          <div className="space-y-4">
            <input type="text" name="nombre" placeholder="Tu Nombre" onChange={handleInputChange} className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-blue-500 outline-none" />
            <input type="email" name="email" placeholder="Tu Email" onChange={handleInputChange} className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-blue-500 outline-none" />
            <input type="tel" name="whatsapp" placeholder="Tu WhatsApp (Ej: 549351...)" onChange={handleInputChange} className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-blue-500 outline-none" />
            
            {/* NUEVO: Le agregamos el atributo "min" al calendario */}
            <input 
              type="datetime-local" 
              name="fecha_hora" 
              min={obtenerFechaMinima()} 
              onChange={handleInputChange} 
              className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-blue-500 outline-none text-gray-600" 
            />
            <p className="text-xs text-gray-400 mt-1">Horario de atención: 09:00 a 20:00 hs.</p>
          </div>
        </div>

        <button 
          onClick={intentarReservar}
          disabled={!servicioSeleccionado || !datosCliente.nombre || !datosCliente.fecha_hora || enviando}
          className="w-full bg-gray-900 text-white font-bold py-4 rounded-xl mt-2 hover:bg-black transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {enviando ? 'Procesando turno...' : 'Confirmar Turno'}
        </button>

      </div>
    </div>
  );
}