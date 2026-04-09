export const API_BASE = import.meta.env.VITE_API_URL || 'https://proyecto-turnos.onrender.com';

export function getAuthHeaders() {
  const token = localStorage.getItem('turnero_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}
