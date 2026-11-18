import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { asyncHandler, validate } from '../lib/http.js';
import { audit } from '../services/ledger.js';
import { checkSupervisorPin } from '../services/policy.js';

const router = Router();

router.get('/', asyncHandler(async (_req, res) => {
  const [school, pin, terms] = await Promise.all([
    db.get("SELECT value FROM settings WHERE key = 'school_name'"),
    db.get("SELECT value FROM settings WHERE key = 'supervisor_pin'"),
    db.get("SELECT value FROM settings WHERE key = 'receipt_terms'"),
  ]);
  res.json({
    school_name: school?.value || 'Northfield Academy',
    pin_set: Boolean(pin?.value),
    receipt_terms: terms?.value || 'Thank you. This receipt is generated from the unified student ledger.',
    db: db.kind,
  });
}));

router.patch('/', validate(z.object({
  current_pin: z.string().min(1).max(12),
  new_pin: z.string().regex(/^\d{4,8}$/).optional(),
  school_name: z.string().min(2).max(100).optional(),
})), asyncHandler(async (req, res) => {
  if (!(await checkSupervisorPin(db, req.body.current_pin))) {
    return res.status(401).json({ error: 'Invalid supervisor PIN', code: 'INVALID_PIN' });
  }
  await db.tx(async (t) => {
    if (req.body.new_pin) {
      await t.run("INSERT INTO settings (key, value) VALUES ('supervisor_pin', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value", [req.body.new_pin]);
    }
    if (req.body.school_name) {
      await t.run("INSERT INTO settings (key, value) VALUES ('school_name', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value", [req.body.school_name]);
    }
    await audit(t, {
      actor: 'admin',
      action: 'settings.update',
      entity: 'settings',
      details: { pin_changed: Boolean(req.body.new_pin), school_name: req.body.school_name || null },
    });
  });
  res.json({ ok: true });
}));

export default router;
