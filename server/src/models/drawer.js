import { randomUUID } from 'crypto';
import { audit } from '../services/ledger.js';

const now = () => new Date().toISOString();

export async function currentSession(t, terminal) {
  return t.get(
    "SELECT * FROM drawer_sessions WHERE status = 'open' AND terminal = ? ORDER BY opened_at DESC LIMIT 1",
    [terminal]
  );
}

export async function openSession(t, { terminal, cashier, openingFloatCents }, actor) {
  const existing = await currentSession(t, terminal);
  if (existing) throw Object.assign(new Error('A drawer session is already open for this terminal'), { status: 409, code: 'DRAWER_OPEN' });
  const id = randomUUID();
  await t.run(
    `INSERT INTO drawer_sessions (id, terminal, cashier, opening_float_cents, totals, status, opened_at)
     VALUES (?,?,?,?,'{}','open',?)`,
    [id, terminal, cashier, openingFloatCents, now()]
  );
  await audit(t, { actor, action: 'drawer.open', entity: 'drawer', entityId: id, details: { terminal, opening_float_cents: openingFloatCents } });
  return t.get('SELECT * FROM drawer_sessions WHERE id = ?', [id]);
}

async function paymentTotals(t, terminal, from, to) {
  let sql = 'SELECT method, COUNT(*) AS count, SUM(amount_cents) AS amount_cents FROM payments WHERE terminal = ? AND created_at >= ?';
  const params = [terminal, from];
  if (to) { sql += ' AND created_at <= ?'; params.push(to); }
  sql += ' GROUP BY method ORDER BY method';
  const rows = await t.all(sql, params);
  const methods = rows.map((r) => ({ method: r.method, count: Number(r.count), amount_cents: Number(r.amount_cents) }));
  const byMethod = Object.fromEntries(methods.map((m) => [m.method, m.amount_cents]));
  return { methods, byMethod, total: methods.reduce((sum, m) => sum + m.amount_cents, 0) };
}

export async function closeSession(t, { sessionId, countedCashCents }, actor) {
  const session = await t.get(t.kind === 'pg' ? 'SELECT * FROM drawer_sessions WHERE id = ? FOR UPDATE' : 'SELECT * FROM drawer_sessions WHERE id = ?', [sessionId]);
  if (!session) throw Object.assign(new Error('Drawer session not found'), { status: 404 });
  if (session.status !== 'open') throw Object.assign(new Error('Drawer session is already closed'), { status: 409 });

  const closedAt = now();
  const totals = await paymentTotals(t, session.terminal, session.opened_at, closedAt);
  const expectedCash = Number(session.opening_float_cents) + Number(totals.byMethod.cash || 0);
  const variance = Number(countedCashCents) - expectedCash;
  await t.run(
    `UPDATE drawer_sessions SET status='closed', expected_cash_cents=?, counted_cash_cents=?, variance_cents=?, totals=?, closed_at=? WHERE id=?`,
    [expectedCash, countedCashCents, variance, JSON.stringify(totals), closedAt, sessionId]
  );
  await audit(t, {
    actor,
    action: 'drawer.close',
    entity: 'drawer',
    entityId: sessionId,
    details: { expected_cash_cents: expectedCash, counted_cash_cents: countedCashCents, variance_cents: variance, methods: totals.methods },
  });
  const closed = await t.get('SELECT * FROM drawer_sessions WHERE id = ?', [sessionId]);
  return { ...closed, totals: JSON.parse(closed.totals || '{}'), methods: totals.methods };
}

export async function sessionPreview(t, sessionId) {
  const session = await t.get('SELECT * FROM drawer_sessions WHERE id = ?', [sessionId]);
  if (!session) throw Object.assign(new Error('Drawer session not found'), { status: 404 });
  const totals = await paymentTotals(t, session.terminal, session.opened_at, session.closed_at || now());
  const expectedCash = Number(session.opening_float_cents) + Number(totals.byMethod.cash || 0);
  return { ...session, totals: JSON.parse(session.totals || '{}'), methods: totals.methods, expected_cash_cents: expectedCash };
}

export async function listSessions(t, { limit = 20 } = {}) {
  return t.all('SELECT * FROM drawer_sessions ORDER BY opened_at DESC LIMIT ?', [Math.min(Number(limit) || 20, 100)]);
}
