import { randomUUID } from 'crypto';

/**
 * Append-only ledger posting. Must be called inside db.tx().
 * Balance semantics: debits are charges, credits are payments/prepayments.
 * `walletDeltaCents` is applied separately to the stored-value wallet.
 */
export async function postLedger(t, entry) {
  const now = new Date().toISOString();
  const selectSql = t.kind === 'pg'
    ? 'SELECT wallet_balance_cents, ledger_balance_cents FROM students WHERE id = ? FOR UPDATE'
    : 'SELECT wallet_balance_cents, ledger_balance_cents FROM students WHERE id = ?';
  const student = await t.get(selectSql, [entry.studentId]);
  if (!student) throw Object.assign(new Error('Student not found'), { status: 404 });

  const debit = Number(entry.debitCents || 0);
  const credit = Number(entry.creditCents || 0);
  const walletDelta = Number(entry.walletDeltaCents || 0);
  const nextLedger = Number(student.ledger_balance_cents) + debit - credit;
  const nextWallet = Number(student.wallet_balance_cents) + walletDelta;

  await t.run(
    'UPDATE students SET wallet_balance_cents = ?, ledger_balance_cents = ?, updated_at = ? WHERE id = ?',
    [nextWallet, nextLedger, now, entry.studentId]
  );

  const id = randomUUID();
  await t.run(
    `INSERT INTO ledger_entries
      (id, student_id, kind, category, description, debit_cents, credit_cents, balance_after_cents, method, terminal, cashier, reference, metadata, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      entry.studentId,
      entry.kind,
      entry.category,
      entry.description,
      debit,
      credit,
      nextLedger,
      entry.method || null,
      entry.terminal || null,
      entry.cashier || null,
      entry.reference || null,
      JSON.stringify(entry.metadata || {}),
      now,
    ]
  );

  return {
    id,
    student_id: entry.studentId,
    kind: entry.kind,
    category: entry.category,
    description: entry.description,
    debit_cents: debit,
    credit_cents: credit,
    balance_after_cents: nextLedger,
    wallet_balance_cents: nextWallet,
    method: entry.method || null,
    terminal: entry.terminal || null,
    cashier: entry.cashier || null,
    reference: entry.reference || null,
    metadata: JSON.stringify(entry.metadata || {}),
    created_at: now,
  };
}

export async function lockStudent(t, studentId) {
  const sql = t.kind === 'pg'
    ? 'SELECT * FROM students WHERE id = ? FOR UPDATE'
    : 'SELECT * FROM students WHERE id = ?';
  const student = await t.get(sql, [studentId]);
  if (!student) throw Object.assign(new Error('Student not found'), { status: 404 });
  return student;
}

export async function audit(t, { actor, action, entity, entityId, details }) {
  await t.run(
    'INSERT INTO audit_logs (id, actor, action, entity, entity_id, details, created_at) VALUES (?,?,?,?,?,?,?)',
    [randomUUID(), actor || null, action, entity || null, entityId || null, JSON.stringify(details || {}), new Date().toISOString()]
  );
}
