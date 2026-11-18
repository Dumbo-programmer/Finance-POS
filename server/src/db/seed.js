import { randomUUID } from 'crypto';
import { postLedger } from '../services/ledger.js';
import { DEFAULT_SUPERVISOR_PIN } from '../services/policy.js';

const now = () => new Date().toISOString();

const PRODUCTS = [
  ['Canteen', 'Chicken Wrap', 750, 0, '🌯', 10],
  ['Canteen', 'Jollof Rice', 650, 0, '🍛', 20],
  ['Canteen', 'Fruit Cup', 350, 0, '🍓', 30],
  ['Canteen', 'Bottled Water', 150, 0, '💧', 40],
  ['Snacks', 'Chocolate Bar', 250, 0, '🍫', 50],
  ['Snacks', 'Energy Drink', 300, 800, '⚡', 60],
  ['Snacks', 'Granola Bar', 200, 0, '🥜', 70],
  ['Bookstore', 'Math Textbook', 4500, 0, '📘', 80],
  ['Bookstore', 'Literature Novel', 2800, 0, '📖', 90],
  ['Bookstore', 'Revision Guide', 1900, 0, '📚', 100],
  ['Stationery', 'Notebook', 325, 0, '📓', 110],
  ['Stationery', 'Ballpoint Pen', 100, 0, '🖊️', 120],
  ['Stationery', 'Geometry Set', 1200, 0, '📐', 130],
  ['Stationery', 'USB Drive 16GB', 1500, 0, '💾', 140],
  ['Uniform', 'PE Shirt', 2500, 0, '👕', 150],
  ['Uniform', 'School Tie', 1200, 0, '👔', 160],
  ['Uniform', 'Blazer', 6500, 0, '🧥', 170],
];

const STUDENTS = [
  { no: 'S-1001', name: 'Alex Mensah', grade: 'Grade 10', section: 'A', card: 'RFID-1001', wallet: 12500, limit: 5000, low: 2000, restrictions: ['energy_drink'], phone: '+1 555 0101', emergency: 'Grace Mensah · +1 555 0199' },
  { no: 'S-1002', name: 'Maya Chen', grade: 'Grade 11', section: 'B', card: 'RFID-1002', wallet: 4800, limit: 10000, low: 1500, restrictions: ['snacks'], phone: '+1 555 0102', emergency: 'Wei Chen · +1 555 0188' },
  { no: 'S-1003', name: 'Noah Okafor', grade: 'Grade 9', section: 'C', card: 'RFID-1003', wallet: 300, limit: 2500, low: 1000, restrictions: [], phone: '+1 555 0103', emergency: 'Ada Okafor · +1 555 0177' },
];

const FEES = [
  { student: 'S-1001', title: 'Term 3 Tuition', category: 'tuition', amount: 30000, hold: 'exam_admit', due: '2026-12-01' },
  { student: 'S-1001', title: 'Library Fine', category: 'library', amount: 750, hold: null, due: '2026-11-30' },
  { student: 'S-1002', title: 'Science Lab Fee', category: 'lab', amount: 4500, hold: null, due: '2026-12-05' },
  { student: 'S-1003', title: 'Transport · Term 3', category: 'transport', amount: 12000, hold: 'library_clearance', due: '2026-11-28' },
];

export async function seed(adapter) {
  const seeded = await adapter.get("SELECT value FROM meta WHERE key = 'seeded_v2'");
  if (seeded) return;

  await adapter.tx(async (t) => {
    await t.run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value', ['supervisor_pin', DEFAULT_SUPERVISOR_PIN]);
    await t.run("INSERT INTO settings (key, value) VALUES ('school_name', 'Northfield Academy') ON CONFLICT (key) DO NOTHING");

    const count = await t.get('SELECT COUNT(*) AS c FROM products');
    if (Number(count.c) === 0) {
      for (const [category, name, price, tax, icon, order] of PRODUCTS) {
        const sku = `SKU-${String(order).padStart(4, '0')}`;
        await t.run(
          'INSERT INTO products (id, sku, name, category, price_cents, tax_bps, icon, active, sort_order, created_at) VALUES (?,?,?,?,?,?,?,1,?,?)',
          [randomUUID(), sku, name, category, price, tax, icon, order, now()]
        );
      }
    }

    const studentCount = await t.get('SELECT COUNT(*) AS c FROM students');
    if (Number(studentCount.c) === 0) {
      for (const s of STUDENTS) {
        const id = randomUUID();
        await t.run(
          `INSERT INTO students (id, student_no, name, grade, section, card_uid, phone, emergency_contact, status, wallet_balance_cents, ledger_balance_cents, daily_limit_cents, low_balance_cents, restrictions, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,'active',0,0,?,?,?,?,?)`,
          [id, s.no, s.name, s.grade, s.section, s.card, s.phone, s.emergency, s.limit, s.low, JSON.stringify(s.restrictions), now(), now()]
        );
        if (s.wallet > 0) {
          await postLedger(t, {
            studentId: id,
            kind: 'topup',
            category: 'wallet',
            description: 'Opening wallet deposit',
            creditCents: s.wallet,
            walletDeltaCents: s.wallet,
            method: 'cash',
            cashier: 'system',
            terminal: 'Accounts',
          });
        }
      }

      for (const f of FEES) {
        const student = await t.get('SELECT id FROM students WHERE student_no = ?', [f.student]);
        if (!student) continue;
        const feeId = randomUUID();
        await t.run(
          `INSERT INTO fees (id, student_id, title, category, amount_cents, paid_cents, waived_cents, status, due_date, hold_reason, created_at)
           VALUES (?,?,?,?,?,0,0,'open',?,?,?)`,
          [feeId, student.id, f.title, f.category, f.amount, f.due, f.hold, now()]
        );
        await postLedger(t, {
          studentId: student.id,
          kind: 'fee_invoice',
          category: f.category,
          description: `Invoice: ${f.title}`,
          debitCents: f.amount,
          reference: feeId,
          cashier: 'system',
        });
        if (f.hold) {
          await t.run(
            'INSERT INTO holds (id, student_id, fee_id, reason, active, created_at) VALUES (?,?,?,?,1,?)',
            [randomUUID(), student.id, feeId, f.hold, now()]
          );
        }
      }

      const alex = await t.get("SELECT id FROM students WHERE student_no = 'S-1001'");
      if (alex) {
        await t.run(
          "INSERT INTO meal_plans (id, student_id, name, remaining, created_at) VALUES (?,?,?,5,?)",
          [randomUUID(), alex.id, 'Lunch Plan · Term 3', now()]
        );
      }
    }

    await t.run("INSERT INTO meta (key, value) VALUES ('seeded_v2', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value", [now()]);
  });
}
