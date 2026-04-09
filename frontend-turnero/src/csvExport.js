function csvEscape(cell) {
  const s = cell == null ? '' : String(cell);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Descarga CSV de turnos (vista actual: hoy / semana / mes).
 * @param {string} vista - 'hoy' | 'semana' | 'mes'
 */
export function exportarAgendaCsv(turnos, vista) {
  if (!turnos.length) return false;
  const headers = [
    'estado',
    'fecha_hora',
    'nombre_cliente',
    'email_cliente',
    'whatsapp_cliente',
    'servicio',
    'precio'
  ];
  const rows = turnos.map((t) => [
    t.estado || 'pendiente',
    t.fecha_hora,
    t.nombre_cliente,
    t.email_cliente ?? '',
    t.whatsapp_cliente ?? '',
    t.servicio_nombre ?? '',
    t.precio ?? ''
  ]);
  const lines = [headers.join(','), ...rows.map((r) => r.map(csvEscape).join(','))];
  const blob = new Blob([`\ufeff${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  a.download = `agenda-${vista}-${stamp}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  return true;
}
