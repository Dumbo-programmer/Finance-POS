import { randomUUID } from 'crypto';
import { postLedger, audit } from '../services/ledger.js';
import { PolicyError } from '../services/policy.js';
import { nextReceiptNo } from '../services/receiptNo.js';
import { getReceipt } from './transactions.js';

const now = () => new Date().toISOString();
const remainder = (f) => Number(f.amount_cents) - Number(f.paid_cents) - Number(f.waived_cents);

export async function listFees(t, { studentId, status, q } = {}) {
  let sql = `SELECT f.*, s.name AS student_name, s.student_no,
    (f.amount_cents - f.paid_cents - f.waived_cents) AS remaining_cents
    FROM fees f JOIN students s ON s.id = f.student_id WHERE 1=1`;
  const params = [];
  if (studentId) { sql += ' AND f.student_id = ?'; params.push(studentId); }
  if (status && status !== 'all') { sql += ' AND f.status = ?'; params.push(status); }
  if (q?.trim()) {
    sql += ' AND (LOWER(s.name) LIKE ? OR LOWER(f.title) LIKE ? OR LOWER(s.student_no) LIKE ?)';
    const like = `%${q.trim().toLowerCase()}%`;
    params.push(like, like, like);
  }
  sql += ' ORDER BY CASE f.status WHEN \'open\' THEN 0 WHEN \'partial\' THEN 1 ELSE 2 END, f.created_at DESC';
  return t.all(sql, params);
}

export async function getFee(t, id) {
  return t.get(
    `SELECT f.*, (f.amount_cents - f.paid_cents - f.waived_cents) AS remaining_cents
     FROM fees f WHERE f.id = ?`,
    [id]
  );
}

export async function createInvoice(t, data, actor) {
  const id = randomUUID();
  await t.run(
    `INSERT INTO fees (id, student_id, title, category, amount_cents, paid_cents, waived_cents, status, due_date, hold_reason, notes, created_at)
     VALUES (?,?,?,?,?,0,0,'open',?,?,?,?)`,
    [id, data.student_id, data.title, data.category || 'tuition', data.amount_cents, data.due_date || null, data.hold_reason || null, data.notes || null, now()]
  );
  await postLedger(t, {
    studentId: data.student_id,
    kind: 'fee_invoice',
    category: data.category || 'tuition',
    description: `Invoice: ${data.title}`,
    debitCents: data.amount_cents,
    reference: id,
    cashier: actor,
  });
  if (data.hold_reason) {
    await t.run(
      'INSERT INTO holds (id, student_id, fee_id, reason, active, created_at) VALUES (?,?,?,?,1,?)',
      [randomUUID(), data.student_id, id, data.hold_reason, now()]
    );
  }
  await audit(t, { actor, action: 'fee.invoice', entity: 'fee', entityId: id, details: { amount_cents: data.amount_cents, title: data.title, hold: data.hold_reason || null } });
  return getFee(t, id);
}

export async function payFee(t, { feeId, payments = [], waiverCents = 0, cashier, terminal = 'Accounts', reference }, actor) {
  const lock = t.kind === 'pg' ? 'FOR UPDATE' : '';
  const fee = await t.get(`SELECT * FROM fees WHERE id = ? ${lock}`, [feeId]);
  if (!fee) throw Object.assign(new Error('Invoice not found'), { status: 404 });
  if (fee.status === 'paid' || fee.status === 'waived') throw new PolicyError('FEE_SETTLED', 'Invoice is already settled');

  const student = await t.get(t.kind === 'pg' ? 'SELECT * FROM students WHERE id = ? FOR UPDATE' : 'SELECT * FROM students WHERE id = ?', [fee.student_id]);
  if (!student) throw Object.assign(new Error('Student not found'), { status: 404 });

  const tenders = payments.map((p) => ({ method: p.method, amount_cents: Math.round(Number(p.amount_cents || 0)) })).filter((p) => p.amount_cents > 0);
  const allowed = ['wallet', 'cash', 'card', 'transfer'];
  if (tenders.some((p) => !allowed.includes(p.method))) throw Object.assign(new Error('Invalid payment method'), { status: 400 });
  const paid = tenders.reduce((sum, p) => sum + p.amount_cents, 0);
  const waiver = Math.max(0, Math.round(Number(waiverCents || 0)));
  const due = remainder(fee);
  if (paid + waiver <= 0) throw Object.assign(new Error('Enter a payment or waiver amount'), { status: 400 });
  if (paid + waiver > due) {
    throw Object.assign(new Error(`Amount exceeds remaining balance of $${(due / 100).toFixed(2)}`), { status: 400, code: 'OVERPAYMENT', details: { remaining_cents: due } });
  }
  const walletTender = tenders.filter((p) => p.method === 'wallet').reduce((sum, p) => sum + p.amount_cents, 0);
  if (walletTender > Number(student.wallet_balance_cents)) {
    throw new PolicyError('INSUFFICIENT_WALLET', 'Wallet balance is insufficient for this payment', {
      wallet_balance_cents: Number(student.wallet_balance_cents), requested_cents: walletTender,
    });
  }

  let receipt = null;
  if (paid > 0) {
    const txId = randomUUID();
    const receiptNo = await nextReceiptNo(t);
    const createdAt = now();
    await t.run(
      `INSERT INTO transactions (id, receipt_no, student_id, terminal, cashier, kind, subtotal_cents, discount_cents, tax_cents, total_cents, status, created_at)
       VALUES (?,?,?,?,?,'fee',?,0,0,?,'completed',?)`,
      [txId, receiptNo, fee.student_id, terminal, cashier, paid, paid, createdAt]
    );
    await t.run(
      'INSERT INTO transaction_items (id, transaction_id, product_id, sku, name, category, note, qty, unit_price_cents, tax_cents, line_total_cents) VALUES (?,?,NULL,?,?,?,NULL,1,?,0,?)',
      [randomUUID(), txId, 'FEE', fee.title, fee.category, paid, paid]
    );
    for (const tender of tenders) {
      await t.run(
        'INSERT INTO payments (id, transaction_id, fee_id, student_id, method, amount_cents, terminal, created_at) VALUES (?,?,?,?,?,?,?,?)',
        [randomUUID(), txId, fee.id, fee.student_id, tender.method, tender.amount_cents, terminal, createdAt]
      );
    }
    await postLedger(t, {
      studentId: fee.student_id,
      kind: 'fee_payment',
      category: fee.category,
      description: `Payment: ${fee.title}`,
      creditCents: paid,
      walletDeltaCents: -walletTender,
      method: tenders.length > 1 ? 'split' : tenders[0].method,
      terminal,
      cashier,
      reference: txId,
      metadata: { fee_id: fee.id, receipt_no: receiptNo },
    });
    receipt = await getReceipt(t, txId);
  }

  if (waiver > 0) {
    await postLedger(t, {
      studentId: fee.student_id,
      kind: 'waiver',
      category: fee.category,
      description: `Financial aid / waiver: ${fee.title}`,
      creditCents: waiver,
      method: 'waiver',
      terminal,
      cashier,
      reference: fee.id,
      metadata: { fee_id: fee.id, reason: reference || 'Financial aid' },
    });
  }

  const newPaid = Number(fee.paid_cents) + paid;
  const newWaived = Number(fee.waived_cents) + waiver;
  const settled = newPaid + newWaived >= Number(fee.amount_cents);
  const status = settled ? 'paid' : 'partial';
  await t.run('UPDATE fees SET paid_cents = ?, waived_cents = ?, status = ? WHERE id = ?', [newPaid, newWaived, status, fee.id]);

  if (settled) {
    await t.run(
      "UPDATE holds SET active = 0, cleared_at = ? WHERE fee_id = ? AND active = 1",
      [now(), fee.id]
    );
  }

  await audit(t, {
    actor,
    action: 'fee.payment',
    entity: 'fee',
    entityId: fee.id,
    details: { paid_cents: paid, waiver_cents: waiver, tenders, settled, hold_cleared: settled && Boolean(fee.hold_reason) },
  });

  return { fee: await getFee(t, fee.id), receipt, settled };
}

export async function clearHolds(t, feeId) {
  await t.run('UPDATE holds SET active = 0, cleared_at = ? WHERE fee_id = ? AND active = 1', [now(), feeId]);
}
