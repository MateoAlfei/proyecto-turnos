import { HashRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import ReservaCliente from './pages/ReservaCliente';
import Registro from './pages/Registro';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/reservar/:slug" element={<ReservaCliente />} />
        <Route path="/registro" element={<Registro />} />
        <Route path="/admin" element={<Login />} />
        <Route path="/admin/dashboard" element={<Dashboard />} />
      </Routes>
    </HashRouter>
  );
}

export default App;