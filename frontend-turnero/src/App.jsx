import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ReservaCliente from './pages/ReservaCliente';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ReservaCliente />} />
        
        <Route path="/admin" element={<Login />} />
        
        {/* Cambiamos el texto de prueba por nuestra página real */}
        <Route path="/admin/dashboard" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;