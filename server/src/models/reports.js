function rangeStart(range = 'today') {
  const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 1;
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return { start: start.toISOString(), days };
}

export async function overview(t) {
  const today = `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`;
  const [retail, feesPaid, txCount, outstanding, holds, students, lowBalance, recent, lowBalanceStudents] = await Promise.all([
    t.get("SELECT COALESCE(SUM(total_cents),0) AS v FROM transactions WHERE kind='retail' AND status='completed' AND created_at >= ?", [today]),
    t.get("SELECT COALESCE(SUM(amount_cents),0) AS v FROM payments WHERE fee_id IS NOT NULL AND created_at >= ?", [today]),
    t.get("SELECT COUNT(*) AS v FROM transactions WHERE created_at >= ? AND status='completed'", [today]),
    t.get("SELECT COALESCE(SUM(amount_cents - paid_cents - waived_cents),0) AS v FROM fees WHERE status IN ('open','partial')"),
    t.get('SELECT COUNT(*) AS v FROM holds WHERE active = 1'),
    t.get("SELECT COUNT(*) AS v FROM students WHERE status='active'"),
    t.get('SELECT COUNT(*) AS v FROM students WHERE wallet_balance_cents < low_balance_cents'),
    t.all(`SELECT tr.*, s.name AS student_name, s.student_no FROM transactions tr
           LEFT JOIN students s ON s.id = tr.student_id ORDER BY tr.created_at DESC LIMIT 8`),
    t.all('SELECT id, name, student_no, wallet_balance_cents, low_balance_cents FROM students WHERE wallet_balance_cents < low_balance_cents ORDER BY wallet_balance_cents LIMIT 5'),
  ]);
  return {
    today_revenue_cents: Number(retail.v) + Number(feesPaid.v),
    today_retail_cents: Number(retail.v),
    today_fees_cents: Number(feesPaid.v),
    today_transactions: Number(txCount.v),
    outstanding_cents: Number(outstanding.v),
    active_holds: Number(holds.v),
    active_students: Number(students.v),
    low_balance_count: Number(lowBalance.v),
    recent_transactions: recent,
    low_balance_students: lowBalanceStudents,
  };
}

export async function revenue(t, range = 'today') {
  const { start, days } = rangeStart(range);

  const [retailCats, feeCats, retailDaily, feeDaily, methods, retailTotal, feeTotal, waived, topups] = await Promise.all([
    t.all(`SELECT ti.category AS category, SUM(ti.line_total_cents) AS v
           FROM transaction_items ti JOIN transactions tr ON tr.id = ti.transaction_id
           WHERE tr.kind='retail' AND tr.status='completed' AND tr.created_at >= ?
           GROUP BY ti.category`, [start]),
    t.all(`SELECT f.category AS category, SUM(p.amount_cents) AS v
           FROM payments p JOIN fees f ON f.id = p.fee_id JOIN transactions tr ON tr.id = p.transaction_id
           WHERE tr.kind='fee' AND tr.status='completed' AND p.created_at >= ?
           GROUP BY f.category`, [start]),
    t.all(`SELECT substr(created_at,1,10) AS day, SUM(total_cents) AS v
           FROM transactions WHERE kind='retail' AND status='completed' AND created_at >= ?
           GROUP BY substr(created_at,1,10)`, [start]),
    t.all(`SELECT substr(created_at,1,10) AS day, SUM(amount_cents) AS v
           FROM payments WHERE fee_id IS NOT NULL AND created_at >= ?
           GROUP BY substr(created_at,1,10)`, [start]),
    t.all(`SELECT method, SUM(amount_cents) AS v FROM payments
           WHERE created_at >= ? AND (fee_id IS NOT NULL OR transaction_id IN (SELECT id FROM transactions WHERE kind='retail'))
           GROUP BY method`, [start]),
    t.get("SELECT COALESCE(SUM(total_cents),0) AS v FROM transactions WHERE kind='retail' AND status='completed' AND created_at >= ?", [start]),
    t.get('SELECT COALESCE(SUM(amount_cents),0) AS v FROM payments WHERE fee_id IS NOT NULL AND created_at >= ?', [start]),
    t.get("SELECT COALESCE(SUM(credit_cents),0) AS v FROM ledger_entries WHERE kind='waiver' AND created_at >= ?", [start]),
    t.get("SELECT COALESCE(SUM(credit_cents),0) AS v FROM ledger_entries WHERE kind='topup' AND created_at >= ?", [start]),
  ]);

  const catMap = new Map();
  for (const row of [...retailCats, ...feeCats]) {
    catMap.set(row.category, (catMap.get(row.category) || 0) + Number(row.v));
  }
  const categories = [...catMap.entries()]
    .map(([category, amount_cents]) => ({ category, amount_cents }))
    .sort((a, b) => b.amount_cents - a.amount_cents);

  const dayMap = new Map();
  const base = new Date(start);
  for (let i = 0; i < days; i += 1) {
    const d = new Date(base);
    d.setUTCDate(base.getUTCDate() + i);
    dayMap.set(d.toISOString().slice(0, 10), { day: d.toISOString().slice(0, 10), retail_cents: 0, fees_cents: 0 });
  }
  for (const row of retailDaily) {
    const entry = dayMap.get(row.day);
    if (entry) entry.retail_cents = Number(row.v);
  }
  for (const row of feeDaily) {
    const entry = dayMap.get(row.day);
    if (entry) entry.fees_cents = Number(row.v);
  }

  return {
    range,
    totals: {
      retail_cents: Number(retailTotal.v),
      fees_cents: Number(feeTotal.v),
      waived_cents: Number(waived.v),
      topups_cents: Number(topups.v),
      revenue_cents: Number(retailTotal.v) + Number(feeTotal.v),
    },
    categories,
    daily: [...dayMap.values()].sort((a, b) => a.day.localeCompare(b.day)),
    methods: methods.map((m) => ({ method: m.method, amount_cents: Number(m.v) })),
  };
}

export async function logs(t, { studentId, kind, from, to, q, limit = 200 } = {}) {
  let sql = `SELECT l.*, s.name AS student_name, s.student_no
             FROM ledger_entries l JOIN students s ON s.id = l.student_id WHERE 1=1`;
  const params = [];
  if (studentId) { sql += ' AND l.student_id = ?'; params.push(studentId); }
  if (kind && kind !== 'all') { sql += ' AND l.kind = ?'; params.push(kind); }
  if (from) { sql += ' AND l.created_at >= ?'; params.push(from); }
  if (to) { sql += ' AND l.created_at <= ?'; params.push(to); }
  if (q?.trim()) {
    sql += ' AND (LOWER(l.description) LIKE ? OR LOWER(s.name) LIKE ? OR LOWER(s.student_no) LIKE ?)';
    const like = `%${q.trim().toLowerCase()}%`;
    params.push(like, like, like);
  }
  sql += ' ORDER BY l.created_at DESC LIMIT ?';
  params.push(Math.min(Number(limit) || 200, 500));
  return t.all(sql, params);
}

export async function auditLogs(t, { limit = 100 } = {}) {
  return t.all('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?', [Math.min(Number(limit) || 100, 300)]);
}
