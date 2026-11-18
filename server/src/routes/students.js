import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { config } from '../config.js';
import { asyncHandler, validate } from '../lib/http.js';
import { createStudent, findStudent, getStudent, listStudents, studentProfile, topUp, updateStudent } from '../models/students.js';
import { statementPdf } from '../services/pdf.js';

const router = Router();

const createSchema = z.object({
  student_no: z.string().min(1).max(40),
  name: z.string().min(1).max(120),
  grade: z.string().max(40).nullish(),
  section: z.string().max(20).nullish(),
  card_uid: z.string().max(80).nullish(),
  photo_url: z.string().max(500).nullish(),
  email: z.string().email().nullish(),
  phone: z.string().max(40).nullish(),
  emergency_contact: z.string().max(160).nullish(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
  daily_limit_cents: z.number().int().min(0).max(10_000_000).nullish(),
  low_balance_cents: z.number().int().min(0).max(10_000_000).optional(),
  restrictions: z.array(z.string().min(1).max(60)).max(50).optional(),
});

router.get('/', asyncHandler(async (req, res) => {
  res.json(await listStudents(db, { q: String(req.query.q || '') }));
}));

router.post('/', validate(createSchema), asyncHandler(async (req, res) => {
  const student = await db.tx((t) => createStudent(t, req.body, req.body.name || 'admin'));
  res.status(201).json(student);
}));

router.get('/:lookup/profile', asyncHandler(async (req, res) => {
  const profile = await studentProfile(db, req.params.lookup);
  if (!profile) return res.status(404).json({ error: 'Student not found', code: 'NOT_FOUND' });
  res.json(profile);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const student = await getStudent(db, req.params.id);
  if (!student) return res.status(404).json({ error: 'Student not found', code: 'NOT_FOUND' });
  res.json(student);
}));

const updateSchema = createSchema.omit({ student_no: true }).partial();
router.patch('/:id', validate(updateSchema), asyncHandler(async (req, res) => {
  res.json(await db.tx((t) => updateStudent(t, req.params.id, req.body, 'admin')));
}));

const controlsSchema = z.object({
  daily_limit_cents: z.number().int().min(0).max(10_000_000).nullable().optional(),
  low_balance_cents: z.number().int().min(0).max(10_000_000).optional(),
  restrictions: z.array(z.string().min(1).max(60)).max(50).optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
  phone: z.string().max(40).nullish(),
  emergency_contact: z.string().max(160).nullish(),
});

router.patch('/:id/controls', validate(controlsSchema), asyncHandler(async (req, res) => {
  res.json(await db.tx((t) => updateStudent(t, req.params.id, req.body, 'admin')));
}));

const topupSchema = z.object({
  amount_cents: z.number().int().positive().max(5_000_000),
  method: z.enum(['cash', 'card', 'transfer']),
  reference: z.string().max(120).optional(),
  cashier: z.string().max(80).optional(),
  terminal: z.string().max(80).optional(),
});

router.post('/:id/topup', validate(topupSchema), asyncHandler(async (req, res) => {
  const result = await db.tx((t) => topUp(t, {
    studentId: req.params.id,
    amountCents: req.body.amount_cents,
    method: req.body.method,
    reference: req.body.reference,
    cashier: req.body.cashier || 'admin',
    terminal: req.body.terminal || 'Accounts',
  }, 'admin'));
  res.status(201).json(result);
}));

router.get('/:id/statement.pdf', asyncHandler(async (req, res) => {
  const profile = await studentProfile(db, req.params.id);
  if (!profile) return res.status(404).json({ error: 'Student not found', code: 'NOT_FOUND' });
  const setting = await db.get("SELECT value FROM settings WHERE key = 'school_name'");
  const pdf = await statementPdf({ profile, schoolName: setting?.value || config.schoolName });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="statement-${profile.student.student_no}.pdf"`);
  res.send(pdf);
}));

export default router;
