import { BrowserRouter, Routes, Route } from 'react-router-dom';
// Importamos la página que acabamos de crear:
import ReservaCliente from './pages/ReservaCliente';

// (Dejamos estas dos de prueba para después)
const PantallaLogin = () => <h1>Acceso para Dueños 🔐</h1>;
const Dashboard = () => <h1>Panel de Control 📊 (Solo Dueños)</h1>;

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Ahora la ruta principal apunta a nuestro componente de verdad */}
        <Route path="/" element={<ReservaCliente />} />
        
        <Route path="/admin" element={<PantallaLogin />} />
        <Route path="/admin/dashboard" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;