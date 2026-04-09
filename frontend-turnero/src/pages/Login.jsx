import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../config';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const navigate = useNavigate();

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'No se pudo iniciar sesión');
        return;
      }
      localStorage.setItem('turnero_token', data.token);
      localStorage.setItem('turnero_negocio_id', String(data.negocio_id));
      localStorage.setItem('turnero_nombre', data.nombre || '');
      navigate('/admin/dashboard');
    } catch {
      setError('Error de conexión con el servidor');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <h1 className="text-2xl font-bold text-gray-800 text-center mb-2">Acceso dueños</h1>
        <p className="text-gray-500 text-center text-sm mb-6">Ingresá con el email del negocio</p>

        <form onSubmit={enviar} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 outline-none"
            />
          </div>
          {error && (
            <p className="text-red-600 text-sm bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          )}
          <button
            type="submit"
            disabled={cargando}
            className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl hover:bg-black disabled:bg-gray-400 transition-colors"
          >
            {cargando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
