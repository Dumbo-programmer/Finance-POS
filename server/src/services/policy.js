export class PolicyError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.code = code;
    this.status = 409;
    this.details = details;
  }
}

export const DEFAULT_SUPERVISOR_PIN = '4321';

export async function checkSupervisorPin(t, pin) {
  const row = await t.get("SELECT value FROM settings WHERE key = 'supervisor_pin'");
  const expected = row?.value || DEFAULT_SUPERVISOR_PIN;
  return String(pin || '') === String(expected);
}

export function parseRestrictions(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Enforces parental controls. Returns { restricted: [...] } and throws PolicyError
 * unless a valid supervisor override is supplied.
 */
export async function enforcePurchasePolicy(t, {
  student,
  items,
  totalCents,
  override,
}) {
  const restrictions = parseRestrictions(student.restrictions);
  const normalize = (value) => String(value || '').toLowerCase().replace(/[_-]+/g, ' ').trim();
  const rules = restrictions.map(normalize).filter(Boolean);
  const restricted = items.filter((item) =>
    rules.some((rule) =>
      [item.product_id, item.sku, item.category, item.name]
        .filter(Boolean)
        .some((value) => {
          const candidate = normalize(value);
          return candidate === rule || candidate.includes(rule);
        })
    )
  );

  if (restricted.length) {
    if (!override?.pin) {
      throw new PolicyError(
        'RESTRICTED_ITEM',
        `Restricted item${restricted.length > 1 ? 's' : ''}: ${restricted.map((i) => i.name).join(', ')}`,
        { items: restricted.map((i) => ({ name: i.name, category: i.category })), restrictions }
      );
    }
    if (!(await checkSupervisorPin(t, override.pin))) {
      throw new PolicyError('INVALID_OVERRIDE', 'Invalid supervisor PIN');
    }
  }

  if (student.daily_limit_cents && Number(student.daily_limit_cents) > 0) {
    const today = new Date().toISOString().slice(0, 10);
    const row = await t.get(
      `SELECT COALESCE(SUM(total_cents), 0) AS spent FROM transactions
       WHERE student_id = ? AND kind = 'retail' AND status = 'completed' AND created_at >= ?`,
      [student.id, `${today}T00:00:00.000Z`]
    );
    const spent = Number(row?.spent || 0);
    if (spent + totalCents > Number(student.daily_limit_cents)) {
      if (!override?.pin) {
        throw new PolicyError(
          'DAILY_LIMIT',
          `Daily spending cap exceeded (spent ${fmt(spent)} of ${fmt(student.daily_limit_cents)})`,
          { spent_cents: spent, limit_cents: Number(student.daily_limit_cents), attempted_cents: totalCents }
        );
      }
      if (!(await checkSupervisorPin(t, override.pin))) {
        throw new PolicyError('INVALID_OVERRIDE', 'Invalid supervisor PIN');
      }
    }
  }

  return { restrictions, restricted };
}

function fmt(cents) {
  return `$${(Number(cents) / 100).toFixed(2)}`;
}
