import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { config } from '../config.js';
import { asyncHandler, validate } from '../lib/http.js';
import { checkout, findByOfflineId, getReceipt } from '../models/transactions.js';
import { receiptPdf } from '../services/pdf.js';

const router = Router();

const tender = z.object({
  method: z.enum(['wallet', 'cash', 'card', 'transfer']),
  amount_cents: z.number().int().positive().max(10_000_000),
});

const toCheckoutPayload = (body) => ({
  studentId: body.student_id,
  terminal: body.terminal,
  cashier: body.cashier,
  items: body.items,
  payments: body.payments,
  discountCents: body.discount_cents,
  override: body.override,
  offlineId: body.offline_id,
  notes: body.notes,
});

const checkoutSchema = z.object({
  student_id: z.string().min(1),
  terminal: z.string().min(1).max(80).default('Canteen'),
  cashier: z.string().min(1).max(80).default('Cashier'),
  items: z.array(z.object({
    product_id: z.string().min(1),
    qty: z.number().int().min(1).max(99).default(1),
    note: z.string().max(120).optional(),
  })).min(1).max(60),
  payments: z.array(tender).min(1).max(4),
  discount_cents: z.number().int().min(0).max(10_000_000).optional(),
  notes: z.string().max(240).optional(),
  offline_id: z.string().max(80).optional(),
  override: z.object({
    pin: z.string().min(1).max(12),
    reason: z.string().max(160).optional(),
  }).optional(),
});

router.post('/checkout', validate(checkoutSchema), asyncHandler(async (req, res) => {
  const receipt = await db.tx((t) => checkout(t, toCheckoutPayload(req.body), req.body.cashier));
  res.status(201).json(receipt);
}));

router.post('/sync', validate(z.object({ transactions: z.array(checkoutSchema.extend({ offline_id: z.string().min(1).max(80) })).max(50) })), asyncHandler(async (req, res) => {
  const results = [];
  for (const queued of req.body.transactions) {
    try {
      const duplicate = await db.tx(async (t) => {
        const existing = await findByOfflineId(t, queued.offline_id);
        if (existing) return { status: 'duplicate', transaction_id: existing.id };
        const receipt = await checkout(t, toCheckoutPayload(queued), queued.cashier || 'offline-sync');
        return { status: 'synced', transaction_id: receipt.transaction.id, receipt_no: receipt.transaction.receipt_no };
      });
      results.push({ offline_id: queued.offline_id, ...duplicate });
    } catch (error) {
      results.push({
        offline_id: queued.offline_id,
        status: 'error',
        code: error.code || 'SYNC_ERROR',
        error: error.message,
      });
    }
  }
  res.json({ results });
}));

router.get('/transactions/:id', asyncHandler(async (req, res) => {
  const receipt = await getReceipt(db, req.params.id);
  if (!receipt) return res.status(404).json({ error: 'Transaction not found', code: 'NOT_FOUND' });
  res.json(receipt);
}));

router.get('/transactions/:id/receipt.pdf', asyncHandler(async (req, res) => {
  const receipt = await getReceipt(db, req.params.id);
  if (!receipt) return res.status(404).json({ error: 'Transaction not found', code: 'NOT_FOUND' });
  const setting = await db.get("SELECT value FROM settings WHERE key = 'school_name'");
  const pdf = await receiptPdf({ receipt, schoolName: setting?.value || config.schoolName });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${receipt.transaction.receipt_no}.pdf"`);
  res.send(pdf);
}));

export default router;
