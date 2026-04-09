import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-4xl font-bold text-slate-800 mb-3">Turnero</h1>
      <p className="text-slate-600 max-w-md mb-8">
        Reservas online para tu negocio: agenda, mails automáticos y WhatsApp con mensaje listo.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          to="/registro"
          className="bg-slate-900 text-white font-semibold px-6 py-3 rounded-xl hover:bg-black transition-colors"
        >
          Crear mi negocio
        </Link>
        <Link
          to="/admin"
          className="bg-white border-2 border-slate-200 text-slate-700 font-semibold px-6 py-3 rounded-xl hover:bg-slate-50 transition-colors"
        >
          Entrar al panel
        </Link>
      </div>
      <p className="text-sm text-slate-400 mt-10 max-w-md">
        Cada negocio obtiene un enlace público del tipo <code className="text-slate-500">/reservar/tu-slug</code> al
        registrarse.
      </p>
    </div>
  );
}
