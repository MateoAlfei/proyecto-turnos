import { useState, useEffect } from 'react';

export default function Dashboard() {
  const [turnos, setTurnos] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Cuando el dueño entra, traemos los turnos de la base de datos
  useEffect(() => {
    // Nota: Si esta ruta todavía no existe en tu backend, después la creamos, 
    // por ahora dejamos el molde listo.
    fetch('https://proyecto-turnos.onrender.com/api/turnos?negocio_id=1')
      .then((res) => res.json())
      .then((datos) => {
        // Si el backend devuelve un error (porque no existe la ruta aún), ponemos un array vacío
        if (datos.error) throw new Error("Ruta no creada");
        setTurnos(datos);
        setCargando(false);
      })
      .catch((error) => {
        console.log("Aviso: Probablemente falta crear la ruta GET /api/turnos en el backend");
        setTurnos([]); // Dejamos la tabla vacía por ahora
        setCargando(false);
      });
  }, []);

  const cancelarTurno = (id) => {
    if(window.confirm("¿Estás seguro de cancelar este turno?")) {
      alert(`Acá le pegaríamos a la ruta PUT /api/turnos/${id}/cancelar`);
      // Lógica de cancelación que conectaremos después
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-8">
      
      {/* Barra superior */}
      <div className="max-w-6xl mx-auto flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Panel de Control 📊</h1>
          <p className="text-gray-500">Peluquería Raineri</p>
        </div>
        <button className="bg-white border-2 border-gray-200 text-gray-600 px-4 py-2 rounded-lg font-bold hover:bg-gray-50">
          Cerrar Sesión
        </button>
      </div>

      {/* Contenido Principal */}
      <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold text-gray-700">Turnos de Hoy</h2>
          <span className="bg-blue-100 text-blue-800 text-sm font-bold px-3 py-1 rounded-full">
            {turnos.length} turnos
          </span>
        </div>

        {/* Tabla de Turnos */}
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
                  <td colSpan="4" className="p-8 text-center text-gray-400">Cargando agenda...</td>
                </tr>
              ) : turnos.length === 0 ? (
                <tr>
                  <td colSpan="4" className="p-8 text-center text-gray-500">
                    <p className="text-lg mb-2">No hay turnos para mostrar. 📭</p>
                    <p className="text-sm text-gray-400">(O todavía no armamos la ruta en el Backend)</p>
                  </td>
                </tr>
              ) : (
                turnos.map((turno) => (
                  <tr key={turno.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 font-bold text-gray-800">{turno.fecha_hora}</td>
                    <td className="p-4 font-medium text-gray-600">{turno.nombre_cliente}</td>
                    <td className="p-4 text-gray-500">
                      <a href={`https://wa.me/${turno.whatsapp_cliente}`} target="_blank" className="text-green-600 hover:underline">
                        {turno.whatsapp_cliente}
                      </a>
                    </td>
                    <td className="p-4">
                      <button 
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