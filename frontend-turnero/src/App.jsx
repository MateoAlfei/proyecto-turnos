import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import ReservaCliente from './pages/ReservaCliente';
import Registro from './pages/Registro';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/reservar/:slug" element={<ReservaCliente />} />
        <Route path="/registro" element={<Registro />} />
        <Route path="/admin" element={<Login />} />
        <Route path="/admin/dashboard" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;