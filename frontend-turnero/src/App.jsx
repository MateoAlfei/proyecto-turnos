import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ReservaCliente from './pages/ReservaCliente';
import Dashboard from './pages/Dashboard'; // <-- Importamos la página nueva

const PantallaLogin = () => <h1>Acceso para Dueños 🔐 (Lo armamos después)</h1>;

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ReservaCliente />} />
        
        <Route path="/admin" element={<PantallaLogin />} />
        
        {/* Cambiamos el texto de prueba por nuestra página real */}
        <Route path="/admin/dashboard" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;