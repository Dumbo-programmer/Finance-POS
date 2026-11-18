import { randomUUID } from 'crypto';
import { postLedger, audit } from '../services/ledger.js';
import { parseRestrictions } from '../services/policy.js';

const now = () => new Date().toISOString();

const baseSelect = `
  SELECT s.*,
    (SELECT COUNT(*) FROM holds h WHERE h.student_id = s.id AND h.active = 1) AS holds_count,
    (SELECT COALESCE(SUM(f.amount_cents - f.paid_cents - f.waived_cents), 0) FROM fees f
      WHERE f.student_id = s.id AND f.status IN ('open','partial')) AS outstanding_cents
  FROM students s`;

function hydrate(row) {
  if (!row) return null;
  return { ...row, restrictions: parseRestrictions(row.restrictions) };
}

export async function listStudents(t, { q = '' } = {}) {
  let sql = baseSelect;
  const params = [];
  if (q.trim()) {
    sql += ` WHERE LOWER(s.name) LIKE ? OR LOWER(s.student_no) LIKE ? OR LOWER(s.card_uid) LIKE ?`;
    const like = `%${q.trim().toLowerCase()}%`;
    params.push(like, like, like);
  }
  sql += ' ORDER BY s.name LIMIT 100';
  const rows = await t.all(sql, params);
  return rows.map(hydrate);
}

export async function findStudent(t, lookup, { lock = false } = {}) {
  const suffix = lock && t.kind === 'pg' ? ' FOR UPDATE' : '';
  const row = await t.get(
    `SELECT * FROM students WHERE id = ? OR student_no = ? OR card_uid = ?${suffix}`,
    [lookup, lookup, lookup]
  );
  return hydrate(row);
}

export async function getStudent(t, id) {
  return hydrate(await t.get('SELECT * FROM students WHERE id = ?', [id]));
}

export async function createStudent(t, data, actor) {
  const id = randomUUID();
  const timestamp = now();
  await t.run(
    `INSERT INTO students (id, student_no, name, grade, section, photo_url, card_uid, email, phone, emergency_contact, status, wallet_balance_cents, ledger_balance_cents, daily_limit_cents, low_balance_cents, restrictions, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,0,0,?,?,?,?,?)`,
    [
      id,
      data.student_no,
      data.name,
      data.grade || null,
      data.section || null,
      data.photo_url || null,
      data.card_uid || null,
      data.email || null,
      data.phone || null,
      data.emergency_contact || null,
      data.status || 'active',
      data.daily_limit_cents ?? null,
      data.low_balance_cents ?? 2000,
      JSON.stringify(data.restrictions || []),
      timestamp,
      timestamp,
    ]
  );
  await audit(t, { actor, action: 'student.create', entity: 'student', entityId: id, details: { name: data.name, student_no: data.student_no } });
  return getStudent(t, id);
}

export async function updateStudent(t, id, data, actor) {
  const existing = await getStudent(t, id);
  if (!existing) throw Object.assign(new Error('Student not found'), { status: 404 });
  const fields = [];
  const values = [];
  const allowed = ['name', 'grade', 'section', 'photo_url', 'card_uid', 'email', 'phone', 'emergency_contact', 'status', 'daily_limit_cents', 'low_balance_cents', 'restrictions'];
  for (const key of allowed) {
    if (data[key] === undefined) continue;
    fields.push(`${key} = ?`);
    values.push(key === 'restrictions' ? JSON.stringify(data[key] || []) : data[key]);
  }
  if (!fields.length) return existing;
  fields.push('updated_at = ?');
  values.push(now(), id);
  await t.run(`UPDATE students SET ${fields.join(', ')} WHERE id = ?`, values);
  await audit(t, { actor, action: 'student.update', entity: 'student', entityId: id, details: data });
  return getStudent(t, id);
}

export async function topUp(t, { studentId, amountCents, method, reference, cashier, terminal }, actor) {
  if (amountCents <= 0) throw Object.assign(new Error('Amount must be positive'), { status: 400 });
  const student = await getStudent(t, studentId);
  if (!student) throw Object.assign(new Error('Student not found'), { status: 404 });
  const entry = await postLedger(t, {
    studentId,
    kind: 'topup',
    category: 'wallet',
    description: 'Wallet top-up',
    creditCents: amountCents,
    walletDeltaCents: amountCents,
    method,
    reference,
    cashier,
    terminal,
  });
  await t.run(
    'INSERT INTO payments (id, transaction_id, student_id, method, amount_cents, terminal, reference, created_at) VALUES (?,NULL,?,?,?,?,?,?)',
    [randomUUID(), studentId, method, amountCents, terminal || 'Accounts', reference || null, now()]
  );
  await audit(t, { actor, action: 'wallet.topup', entity: 'student', entityId: studentId, details: { amount_cents: amountCents, method } });
  return { entry, student: await getStudent(t, studentId) };
}

export async function studentProfile(t, lookup) {
  const student = await findStudent(t, lookup);
  if (!student) return null;
  const [ledger, fees, holds, meals, transactions, daily] = await Promise.all([
    t.all('SELECT * FROM ledger_entries WHERE student_id = ? ORDER BY created_at DESC, id DESC LIMIT 200', [student.id]),
    t.all('SELECT * FROM fees WHERE student_id = ? ORDER BY created_at DESC', [student.id]),
    t.all('SELECT * FROM holds WHERE student_id = ? AND active = 1 ORDER BY created_at DESC', [student.id]),
    t.all('SELECT * FROM meal_plans WHERE student_id = ?', [student.id]),
    t.all('SELECT * FROM transactions WHERE student_id = ? ORDER BY created_at DESC LIMIT 10', [student.id]),
    t.get(
      `SELECT COALESCE(SUM(total_cents),0) AS spent FROM transactions
       WHERE student_id = ? AND kind = 'retail' AND status = 'completed' AND created_at >= ?`,
      [student.id, `${now().slice(0, 10)}T00:00:00.000Z`]
    ),
  ]);
  const outstanding = fees
    .filter((f) => f.status === 'open' || f.status === 'partial')
    .reduce((sum, f) => sum + Number(f.amount_cents) - Number(f.paid_cents) - Number(f.waived_cents), 0);
  return {
    student,
    ledger,
    fees,
    holds,
    meal_plans: meals,
    transactions,
    stats: {
      outstanding_cents: outstanding,
      today_spend_cents: Number(daily?.spent || 0),
      holds_count: holds.length,
      wallet_balance_cents: Number(student.wallet_balance_cents),
    },
  };
}
