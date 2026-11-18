import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { config } from '../config.js';
import { asyncHandler, validate } from '../lib/http.js';
import { closeSession, currentSession, listSessions, openSession, sessionPreview } from '../models/drawer.js';
import { zReportPdf } from '../services/pdf.js';

const router = Router();

router.get('/current', asyncHandler(async (req, res) => {
  const terminal = String(req.query.terminal || 'Accounts');
  const session = await currentSession(db, terminal);
  res.json(session ? await sessionPreview(db, session.id) : null);
}));

router.get('/sessions', asyncHandler(async (req, res) => {
  res.json(await listSessions(db, { limit: req.query.limit }));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  res.json(await sessionPreview(db, req.params.id));
}));

router.post('/open', validate(z.object({
  terminal: z.string().min(1).max(80).default('Accounts'),
  cashier: z.string().min(1).max(80),
  opening_float_cents: z.number().int().min(0).max(10_000_000).default(0),
})), asyncHandler(async (req, res) => {
  const session = await db.tx((t) => openSession(t, {
    terminal: req.body.terminal,
    cashier: req.body.cashier,
    openingFloatCents: req.body.opening_float_cents,
  }, req.body.cashier));
  res.status(201).json(session);
}));

router.post('/close', validate(z.object({
  session_id: z.string().min(1),
  counted_cash_cents: z.number().int().min(0).max(10_000_000),
})), asyncHandler(async (req, res) => {
  const session = await db.tx((t) => closeSession(t, {
    sessionId: req.body.session_id,
    countedCashCents: req.body.counted_cash_cents,
  }, 'cashier'));
  res.json(session);
}));

router.get('/:id/z-report.pdf', asyncHandler(async (req, res) => {
  const session = await sessionPreview(db, req.params.id);
  const setting = await db.get("SELECT value FROM settings WHERE key = 'school_name'");
  const pdf = await zReportPdf({ session, schoolName: setting?.value || config.schoolName });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="z-report-${session.id.slice(0, 8)}.pdf"`);
  res.send(pdf);
}));

export default router;
