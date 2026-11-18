import { randomUUID } from 'crypto';
import { postLedger, audit } from '../services/ledger.js';
import { PolicyError, checkSupervisorPin, enforcePurchasePolicy } from '../services/policy.js';
import { nextReceiptNo } from '../services/receiptNo.js';

const now = () => new Date().toISOString();

async function receiptPayload(t, transactionId) {
  const transaction = await t.get('SELECT * FROM transactions WHERE id = ?', [transactionId]);
  if (!transaction) return null;
  const [items, payments, student] = await Promise.all([
    t.all('SELECT * FROM transaction_items WHERE transaction_id = ? ORDER BY name', [transactionId]),
    t.all('SELECT * FROM payments WHERE transaction_id = ? ORDER BY created_at', [transactionId]),
    transaction.student_id ? t.get('SELECT id, student_no, name, grade, section, wallet_balance_cents FROM students WHERE id = ?', [transaction.student_id]) : null,
  ]);
  return { transaction, items, payments, student };
}

export async function getReceipt(t, transactionId) {
  return receiptPayload(t, transactionId);
}

export async function findByOfflineId(t, offlineId) {
  if (!offlineId) return null;
  return t.get('SELECT id FROM transactions WHERE offline_id = ?', [offlineId]);
}

export async function checkout(t, payload, actor = 'cashier') {
  const { studentId, terminal, cashier, items, payments, discountCents = 0, override, offlineId, notes } = payload;

  const student = await t.get(
    t.kind === 'pg' ? 'SELECT * FROM students WHERE id = ? FOR UPDATE' : 'SELECT * FROM students WHERE id = ?',
    [studentId]
  );
  if (!student) throw Object.assign(new Error('Student not found'), { status: 404 });
  if (student.status !== 'active') throw new PolicyError('INACTIVE_STUDENT', 'Student account is not active');

  if (!items?.length) throw Object.assign(new Error('Cart is empty'), { status: 400 });

  const resolved = [];
  for (const line of items) {
    const qty = Math.max(1, Math.min(99, Number(line.qty || 1)));
    const product = await t.get('SELECT * FROM products WHERE id = ? AND active = 1', [line.product_id]);
    if (!product) throw Object.assign(new Error('Product unavailable'), { status: 400, details: { product_id: line.product_id } });
    const lineTotal = Number(product.price_cents) * qty;
    const taxCents = Math.round((lineTotal * Number(product.tax_bps || 0)) / 10000);
    resolved.push({
      product_id: product.id,
      sku: product.sku,
      name: product.name,
      category: product.category,
      note: line.note ? String(line.note).slice(0, 120) : null,
      qty,
      unit_price_cents: Number(product.price_cents),
      tax_cents: taxCents,
      line_total_cents: lineTotal,
    });
  }

  const subtotal = resolved.reduce((sum, i) => sum + i.line_total_cents, 0);
  const tax = resolved.reduce((sum, i) => sum + i.tax_cents, 0);
  const discount = Math.max(0, Math.min(Number(discountCents || 0), subtotal + tax));
  const total = subtotal + tax - discount;
  if (total <= 0) throw Object.assign(new Error('Total must be greater than zero'), { status: 400 });

  let overrideBy = null;
  if (override?.pin) {
    if (!(await checkSupervisorPin(t, override.pin))) {
      throw new PolicyError('INVALID_OVERRIDE', 'Invalid supervisor PIN');
    }
    overrideBy = actor;
  }
  await enforcePurchasePolicy(t, { student, items: resolved, totalCents: total, override });

  const tenders = (payments || []).map((p) => ({
    method: p.method,
    amount_cents: Math.round(Number(p.amount_cents || 0)),
  })).filter((p) => p.amount_cents > 0);
  const allowed = ['wallet', 'cash', 'card', 'transfer'];
  if (!tenders.length || tenders.some((p) => !allowed.includes(p.method))) {
    throw Object.assign(new Error('At least one valid payment method is required'), { status: 400 });
  }
  const tenderTotal = tenders.reduce((sum, p) => sum + p.amount_cents, 0);
  if (tenderTotal !== total) {
    throw Object.assign(new Error(`Payments (${(tenderTotal / 100).toFixed(2)}) must equal total (${(total / 100).toFixed(2)})`), { status: 400, code: 'TENDER_MISMATCH', details: { total_cents: total, tender_cents: tenderTotal } });
  }
  const walletTender = tenders.filter((p) => p.method === 'wallet').reduce((sum, p) => sum + p.amount_cents, 0);
  if (walletTender > Number(student.wallet_balance_cents)) {
    throw new PolicyError('INSUFFICIENT_WALLET', `Wallet balance is only $${(Number(student.wallet_balance_cents) / 100).toFixed(2)}`, {
      wallet_balance_cents: Number(student.wallet_balance_cents),
      requested_cents: walletTender,
    });
  }

  const id = randomUUID();
  const receiptNo = await nextReceiptNo(t);
  const createdAt = now();
  await t.run(
    `INSERT INTO transactions (id, receipt_no, student_id, terminal, cashier, kind, subtotal_cents, discount_cents, tax_cents, total_cents, status, offline_id, override_by, override_reason, created_at)
     VALUES (?,?,?,?,?,'retail',?,?,?,?,'completed',?,?,?,?)`,
    [id, receiptNo, student.id, terminal, cashier, subtotal, discount, tax, total, offlineId || null, overrideBy, override?.reason || null, createdAt]
  );

  for (const item of resolved) {
    await t.run(
      `INSERT INTO transaction_items (id, transaction_id, product_id, sku, name, category, note, qty, unit_price_cents, tax_cents, line_total_cents)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [randomUUID(), id, item.product_id, item.sku, item.name, item.category, item.note, item.qty, item.unit_price_cents, item.tax_cents, item.line_total_cents]
    );
  }
  for (const tender of tenders) {
    await t.run(
      'INSERT INTO payments (id, transaction_id, student_id, method, amount_cents, terminal, created_at) VALUES (?,?,?,?,?,?,?)',
      [randomUUID(), id, student.id, tender.method, tender.amount_cents, terminal, createdAt]
    );
  }

  const nonWallet = tenderTotal - walletTender;
  await postLedger(t, {
    studentId: student.id,
    kind: 'purchase',
    category: 'retail',
    description: notes || `POS purchase · ${terminal}`,
    debitCents: total,
    creditCents: nonWallet,
    walletDeltaCents: -walletTender,
    method: tenders.length > 1 ? 'split' : tenders[0].method,
    terminal,
    cashier,
    reference: id,
    metadata: { receipt_no: receiptNo, items: resolved.map((i) => ({ name: i.name, category: i.category, qty: i.qty })), override: overrideBy ? { reason: override?.reason } : null },
  });

  await audit(t, {
    actor,
    action: 'pos.checkout',
    entity: 'transaction',
    entityId: id,
    details: { receipt_no: receiptNo, total_cents: total, tenders, offline_id: offlineId || null, override: overrideBy ? override?.reason : null },
  });

  return receiptPayload(t, id);
}
