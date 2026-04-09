export const API_BASE = import.meta.env.VITE_API_URL || 'https://proyecto-turnos.onrender.com';

/** ID del negocio en la página pública de reservas (configurable por deploy). */
export const NEGOCIO_PUBLICO_ID = import.meta.env.VITE_NEGOCIO_ID || '1';

export function getAuthHeaders() {
  const token = localStorage.getItem('turnero_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}
