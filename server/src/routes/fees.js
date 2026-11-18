import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { asyncHandler, validate } from '../lib/http.js';
import { createInvoice, getFee, listFees, payFee } from '../models/fees.js';

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  res.json(await listFees(db, {
    studentId: req.query.student_id ? String(req.query.student_id) : undefined,
    status: req.query.status ? String(req.query.status) : undefined,
    q: String(req.query.q || ''),
  }));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const fee = await getFee(db, req.params.id);
  if (!fee) return res.status(404).json({ error: 'Invoice not found', code: 'NOT_FOUND' });
  res.json(fee);
}));

const invoiceSchema = z.object({
  student_id: z.string().min(1),
  title: z.string().min(1).max(140),
  category: z.enum(['tuition', 'lab', 'transport', 'library', 'exam', 'fines', 'other']).default('tuition'),
  amount_cents: z.number().int().positive().max(10_000_000),
  due_date: z.string().max(20).nullish(),
  hold_reason: z.string().max(80).nullish(),
  notes: z.string().max(240).nullish(),
});

router.post('/', validate(invoiceSchema), asyncHandler(async (req, res) => {
  const fee = await db.tx((t) => createInvoice(t, req.body, 'accounts'));
  res.status(201).json(fee);
}));

const paySchema = z.object({
  payments: z.array(z.object({
    method: z.enum(['wallet', 'cash', 'card', 'transfer']),
    amount_cents: z.number().int().positive().max(10_000_000),
  })).max(4).default([]),
  waiver_cents: z.number().int().min(0).max(10_000_000).default(0),
  cashier: z.string().max(80).optional(),
  terminal: z.string().max(80).optional(),
  reference: z.string().max(160).optional(),
});

router.post('/:id/pay', validate(paySchema), asyncHandler(async (req, res) => {
  const result = await db.tx((t) => payFee(t, {
    feeId: req.params.id,
    payments: req.body.payments,
    waiverCents: req.body.waiver_cents,
    cashier: req.body.cashier || 'accounts',
    terminal: req.body.terminal || 'Accounts',
    reference: req.body.reference,
  }, 'accounts'));
  res.status(201).json(result);
}));

export default router;
