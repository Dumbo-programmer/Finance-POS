import { randomUUID } from 'crypto';

export async function listProducts(t, { category, q, includeInactive } = {}) {
  let sql = 'SELECT * FROM products WHERE 1=1';
  const params = [];
  if (!includeInactive) sql += ' AND active = 1';
  if (category && category !== 'All') { sql += ' AND category = ?'; params.push(category); }
  if (q?.trim()) {
    sql += ' AND (LOWER(name) LIKE ? OR LOWER(sku) LIKE ?)';
    const like = `%${q.trim().toLowerCase()}%`;
    params.push(like, like);
  }
  sql += ' ORDER BY sort_order, name';
  return t.all(sql, params);
}

export async function listCategories(t) {
  const rows = await t.all('SELECT DISTINCT category FROM products WHERE active = 1 ORDER BY category');
  return rows.map((r) => r.category);
}

export async function createProduct(t, data, actor) {
  const id = randomUUID();
  await t.run(
    'INSERT INTO products (id, sku, name, category, price_cents, tax_bps, icon, active, sort_order, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [id, data.sku, data.name, data.category, data.price_cents, data.tax_bps || 0, data.icon || '🛍️', data.active === false ? 0 : 1, data.sort_order || 0, new Date().toISOString()]
  );
  return t.get('SELECT * FROM products WHERE id = ?', [id]);
}

export async function updateProduct(t, id, data) {
  const fields = [];
  const values = [];
  for (const key of ['name', 'category', 'price_cents', 'tax_bps', 'icon', 'active', 'sort_order']) {
    if (data[key] === undefined) continue;
    fields.push(`${key} = ?`);
    values.push(key === 'active' ? (data[key] ? 1 : 0) : data[key]);
  }
  if (!fields.length) return t.get('SELECT * FROM products WHERE id = ?', [id]);
  values.push(id);
  await t.run(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, values);
  return t.get('SELECT * FROM products WHERE id = ?', [id]);
}
