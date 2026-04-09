function slugify(text) {
  if (!text || typeof text !== 'string') return 'local';
  const s = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return s || 'local';
}

async function elegirSlugUnico(db, base) {
  const limpio = slugify(base).slice(0, 60) || 'local';
  for (let n = 0; n < 100; n++) {
    const candidate = n === 0 ? limpio : `${limpio}-${n}`;
    const r = await db.query('SELECT id FROM negocios WHERE slug = $1', [candidate]);
    if (r.rows.length === 0) return candidate;
  }
  return `${limpio}-${Date.now()}`;
}

module.exports = { slugify, elegirSlugUnico };
