import { Router } from 'express';
import { db } from '../db/index.js';
import { asyncHandler } from '../lib/http.js';
import { auditLogs, logs, overview, revenue } from '../models/reports.js';

const router = Router();

router.get('/overview', asyncHandler(async (_req, res) => {
  res.json(await overview(db));
}));

router.get('/revenue', asyncHandler(async (req, res) => {
  const range = ['today', '7d', '30d', '90d'].includes(String(req.query.range)) ? String(req.query.range) : 'today';
  res.json(await revenue(db, range));
}));

router.get('/logs', asyncHandler(async (req, res) => {
  res.json(await logs(db, {
    studentId: req.query.student_id ? String(req.query.student_id) : undefined,
    kind: req.query.kind ? String(req.query.kind) : undefined,
    from: req.query.from ? String(req.query.from) : undefined,
    to: req.query.to ? String(req.query.to) : undefined,
    q: req.query.q ? String(req.query.q) : undefined,
    limit: req.query.limit,
  }));
}));

router.get('/audit', asyncHandler(async (req, res) => {
  res.json(await auditLogs(db, { limit: req.query.limit }));
}));

export default router;
