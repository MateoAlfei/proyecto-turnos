import { useState, useEffect } from 'react';

export default function ReservaCliente() {
  const [servicios, setServicios] = useState([]);
  const [cargando, setCargando] = useState(true);
  
  // Memoria del formulario
  const [servicioSeleccionado, setServicioSeleccionado] = useState(null);
  const [datosCliente, setDatosCliente] = useState({
    nombre: '',
    email: '',
    whatsapp: '',
    fecha_hora: ''
  });

  // Nuevo estado para saber si estamos esperando a Render
  const [enviando, setEnviando] = useState(false);

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

  // --- LA MAGIA REAL ---
  const intentarReservar = async () => {
    setEnviando(true); // Apagamos el botón momentáneamente

    // Armamos el paquete EXACTO como lo pide tu backend
    const turnoNuevo = {
      negocio_id: 1,
      servicio_id: servicioSeleccionado,
      fecha_hora: datosCliente.fecha_hora.replace('T', ' '), // Acomodamos la T que pone HTML en las fechas
      nombre_cliente: datosCliente.nombre,
      email_cliente: datosCliente.email,
      whatsapp_cliente: datosCliente.whatsapp
    };

    try {
      // Le pegamos a tu ruta POST
      const respuesta = await fetch('https://proyecto-turnos.onrender.com/api/turnos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(turnoNuevo)
      });

      if (respuesta.status === 201) {
        alert("¡Turno guardado con éxito! 🎉 Revisá tu bandeja de entrada.");
        // Opcional: acá podrías recargar la página o vaciar el formulario
        window.location.reload(); 
      } else {
        alert("Uy, hubo un problema al guardar el turno. Intentá de nuevo.");
      }
    } catch (error) {
      console.error("Error al enviar el turno:", error);
      alert("Error de conexión con el servidor.");
    } finally {
      setEnviando(false); // Volvemos a prender el botón
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto bg-white p-6 sm:p-8 rounded-2xl shadow-lg border border-gray-100">
        
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Peluquería Raineri ✂️</h1>
          <p className="text-gray-500">Reservá tu turno online en segundos</p>
        </div>

        {/* Sección Servicios */}
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

        {/* Sección Datos */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-700 mb-4">2. Tus datos y horario</h2>
          <div className="space-y-4">
            <input type="text" name="nombre" placeholder="Tu Nombre" onChange={handleInputChange} className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-blue-500 outline-none" />
            <input type="email" name="email" placeholder="Tu Email (Para recibir el ticket)" onChange={handleInputChange} className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-blue-500 outline-none" />
            <input type="tel" name="whatsapp" placeholder="Tu WhatsApp" onChange={handleInputChange} className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-blue-500 outline-none" />
            <input type="datetime-local" name="fecha_hora" onChange={handleInputChange} className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-blue-500 outline-none text-gray-600" />
          </div>
        </div>

        {/* Botón Final */}
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