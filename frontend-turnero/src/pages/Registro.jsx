import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE } from '../config';

export default function Registro() {
  const [form, setForm] = useState({
    nombre: '',
    email: '',
    password: '',
    telefono_aviso: '',
    direccion: '',
    slug: ''
  });
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const navigate = useNavigate();

  const onChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/registro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: form.nombre.trim(),
          email: form.email.trim(),
          password: form.password,
          telefono_aviso: form.telefono_aviso.trim() || '0',
          direccion: form.direccion.trim() || undefined,
          slug: form.slug.trim() || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'No se pudo registrar');
        return;
      }

      const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email.trim(), password: form.password })
      });
      const loginData = await loginRes.json();
      if (!loginRes.ok) {
        setError('Registro ok, pero no pudimos iniciar sesión. Entrá desde “Acceso dueños”.');
        navigate('/admin');
        return;
      }
      localStorage.setItem('turnero_token', loginData.token);
      localStorage.setItem('turnero_negocio_id', String(loginData.negocio_id));
      localStorage.setItem('turnero_nombre', loginData.nombre || '');
      localStorage.setItem('turnero_slug', data.negocio?.slug || '');
      navigate('/admin/dashboard');
    } catch {
      setError('Error de conexión');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">Alta de negocio</h1>
        <p className="text-gray-500 text-sm mb-6">
          Después el panel te muestra el link para clientes (formato{' '}
          <code className="bg-gray-100 px-1 rounded">/#/reservar/tu-slug</code>).
        </p>

        <form onSubmit={enviar} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del local</label>
            <input
              name="nombre"
              value={form.nombre}
              onChange={onChange}
              required
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email (usuario)</label>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={onChange}
              required
              autoComplete="email"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña (mín. 6)</label>
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={onChange}
              required
              minLength={6}
              autoComplete="new-password"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp del local (avisos)</label>
            <input
              name="telefono_aviso"
              value={form.telefono_aviso}
              onChange={onChange}
              placeholder="Ej: 54911..."
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dirección (opcional, sale en el mail)</label>
            <input
              name="direccion"
              value={form.direccion}
              onChange={onChange}
              placeholder="Calle y número, ciudad"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Enlace público <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <input
              name="slug"
              value={form.slug}
              onChange={onChange}
              placeholder="mi-peluqueria — si lo dejás vacío lo generamos nosotros"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 outline-none"
            />
          </div>

          {error && (
            <p className="text-red-600 text-sm bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={cargando}
            className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl hover:bg-black disabled:bg-gray-400"
          >
            {cargando ? 'Creando…' : 'Registrar y entrar al panel'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          ¿Ya tenés cuenta?{' '}
          <Link to="/admin" className="text-blue-600 font-semibold hover:underline">
            Iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
