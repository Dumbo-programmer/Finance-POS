import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  Banknote,
  BarChart3,
  Building2,
  Calculator,
  CreditCard,
  FileText,
  Printer,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { api } from '../lib/api';
import {
  centsToDollars,
  dateOnly,
  dateTime,
  dollarsToCents,
  money,
  moneyShort,
  percent,
  titleCase,
} from '../lib/format';
import { useStore } from '../store/store';
import { useDebounced } from '../hooks/useOnline';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Progress,
  Select,
  Skeleton,
  Stat,
  Tabs,
  cn,
} from '../components/ui';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6', '#f43f5e', '#84cc16'];
const METHOD_ICONS = { cash: Banknote, wallet: Wallet, card: CreditCard, transfer: Building2, waiver: ShieldCheck };

const kindTone = {
  topup: 'emerald',
  purchase: 'indigo',
  fee_payment: 'violet',
  fee_invoice: 'amber',
  waiver: 'cyan',
  refund: 'cyan',
  adjustment: 'slate',
  meal: 'slate',
};

function startIso(range) {
  const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 1;
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return start.toISOString();
}

function shortDay(value) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function Reports() {
  const navigate = useNavigate();
  const terminal = useStore((s) => s.terminal);
  const cashier = useStore((s) => s.cashier);
  const [range, setRange] = useState('7d');
  const [tab, setTab] = useState('analytics');
  const [overview, setOverview] = useState(null);
  const [revenue, setRevenue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [logKind, setLogKind] = useState('all');
  const [logQuery, setLogQuery] = useState('');
  const debouncedLogQuery = useDebounced(logQuery, 250);
  const [logs, setLogs] = useState(null);
  const [audit, setAudit] = useState(null);

  const [current, setCurrent] = useState(null);
  const [sessions, setSessions] = useState(null);
  const [openOpen, setOpenOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [floatAmount, setFloatAmount] = useState('100.00');
  const [counted, setCounted] = useState('');
  const [drawerBusy, setDrawerBusy] = useState(false);
  const [zReport, setZReport] = useState(null);

  const loadCore = async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const [head, rev, auditRows] = await Promise.all([
        api.reports.overview(),
        api.reports.revenue(range),
        api.reports.audit(),
      ]);
      setOverview(head);
      setRevenue(rev);
      setAudit(auditRows);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadCore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  useEffect(() => {
    let active = true;
    api.reports
      .logs({ from: startIso(range), kind: logKind === 'all' ? undefined : logKind, q: debouncedLogQuery || undefined })
      .then((rows) => active && setLogs(rows))
      .catch((error) => toast.error(error.message));
    return () => {
      active = false;
    };
  }, [range, logKind, debouncedLogQuery]);

  const loadDrawer = () => {
    Promise.all([api.drawer.current(terminal), api.drawer.sessions()])
      .then(([head, rows]) => {
        setCurrent(head);
        setSessions(rows);
      })
      .catch((error) => toast.error(error.message));
  };

  useEffect(() => {
    loadDrawer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terminal]);

  const beginClose = () => {
    setCounted(centsToDollars(current?.expected_cash_cents || 0));
    setCloseOpen(true);
  };

  const openDrawerSession = async (event) => {
    event.preventDefault();
    setDrawerBusy(true);
    try {
      await api.drawer.open({
        terminal,
        cashier,
        opening_float_cents: dollarsToCents(floatAmount),
      });
      toast.success(`${terminal} drawer opened`);
      setOpenOpen(false);
      loadDrawer();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setDrawerBusy(false);
    }
  };

  const closeDrawerSession = async (event) => {
    event.preventDefault();
    if (!current) return;
    const countedCents = dollarsToCents(counted);
    if (countedCents < 0) return toast.error('Counted cash cannot be negative');
    setDrawerBusy(true);
    try {
      const closed = await api.drawer.close({ session_id: current.id, counted_cash_cents: countedCents });
      const variance = Number(closed.variance_cents || 0);
      toast.success(variance === 0 ? 'Drawer balanced · Z-report generated' : `Drawer closed · variance ${money(variance)}`, {
        duration: 5000,
      });
      setCloseOpen(false);
      setZReport(closed);
      loadDrawer();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setDrawerBusy(false);
    }
  };

  const viewZReport = async (session) => {
    try {
      const full = await api.drawer.get(session.id);
      setZReport(full);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const categoryTotal = useMemo(
    () => (revenue?.categories || []).reduce((sum, row) => sum + Number(row.amount_cents), 0),
    [revenue]
  );
  const methodTotal = useMemo(
    () => (revenue?.methods || []).reduce((sum, row) => sum + Number(row.amount_cents), 0),
    [revenue]
  );
  const variancePreview = current ? dollarsToCents(counted) - Number(current.expected_cash_cents || 0) : 0;

  return (
    <div>
      <PageHeader
        eyebrow="Analytics & reconciliation"
        title="Reports & Z-reports"
        subtitle="Cross-departmental revenue, immutable ledger logs, audit trail, and cash-drawer control"
        actions={
          <>
            <Tabs
              value={range}
              onChange={setRange}
              tabs={[
                { value: 'today', label: 'Today' },
                { value: '7d', label: '7 days' },
                { value: '30d', label: '30 days' },
                { value: '90d', label: '90 days' },
              ]}
            />
            <Button variant="secondary" size="sm" icon={RefreshCw} loading={refreshing} onClick={() => loadCore({ silent: true })}>
              Refresh
            </Button>
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Gross revenue" value={money(revenue?.totals?.revenue_cents || 0)} sub="Retail + fee collections" icon={TrendingUp} tone="indigo" />
        <Stat label="Campus retail" value={money(revenue?.totals?.retail_cents || 0)} sub="Canteen, bookstore, uniforms" icon={BarChart3} tone="cyan" />
        <Stat label="Fee collections" value={money(revenue?.totals?.fees_cents || 0)} sub="Tuition, transport, fines" icon={FileText} tone="emerald" />
        <Stat label="Financial aid" value={money(revenue?.totals?.waived_cents || 0)} sub="Waivers applied in range" icon={ShieldCheck} tone="violet" />
      </div>

      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'analytics', label: 'Analytics' },
          { value: 'ledger', label: 'Ledger logs' },
          { value: 'drawer', label: 'Drawer & Z' },
          { value: 'audit', label: 'Audit trail' },
        ]}
      />

      {tab === 'analytics' ? (
        loading || !revenue ? (
          <div className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <Skeleton className="h-80" />
              <Skeleton className="h-80" />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Skeleton className="h-56" />
              <Skeleton className="h-56" />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <Card className="p-4 sm:p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Revenue trend</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Retail and fee collections by day</p>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-500">
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-indigo-500" /> Retail</span>
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Fees</span>
                  </div>
                </div>
                <div className="h-[292px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenue.daily} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
                      <defs>
                        <linearGradient id="retailFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="feeFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#94a3b8" strokeOpacity={0.18} vertical={false} />
                      <XAxis dataKey="day" tickFormatter={shortDay} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={moneyShort} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={58} />
                      <Tooltip
                        formatter={(value, name) => [money(value), name === 'retail_cents' ? 'Retail' : 'Fees']}
                        labelFormatter={(value) => dateOnly(`${value}T00:00:00Z`)}
                        contentStyle={{
                          background: '#0f172a',
                          border: '1px solid rgba(148,163,184,0.25)',
                          borderRadius: 10,
                          fontSize: 12,
                          color: '#f8fafc',
                        }}
                        itemStyle={{ color: '#e2e8f0' }}
                      />
                      <Area type="monotone" dataKey="retail_cents" stroke="#6366f1" strokeWidth={2} fill="url(#retailFill)" />
                      <Area type="monotone" dataKey="fees_cents" stroke="#10b981" strokeWidth={2} fill="url(#feeFill)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-4 sm:p-5">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Revenue by category</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Combined retail and fees</p>
                </div>
                {revenue.categories.length === 0 ? (
                  <EmptyState icon={BarChart3} title="No revenue yet" description="Record a fee payment or top-up to populate analytics." />
                ) : (
                  <>
                    <div className="mx-auto h-[210px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={revenue.categories}
                            dataKey="amount_cents"
                            nameKey="category"
                            innerRadius={54}
                            outerRadius={86}
                            paddingAngle={2}
                            stroke="none"
                          >
                            {revenue.categories.map((entry, index) => (
                              <Cell key={entry.category} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value, name) => [money(value), titleCase(name)]}
                            contentStyle={{
                              background: '#0f172a',
                              border: '1px solid rgba(148,163,184,0.25)',
                              borderRadius: 10,
                              fontSize: 12,
                              color: '#f8fafc',
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-1.5">
                      {revenue.categories.map((row, index) => (
                        <div key={row.category} className="flex items-center justify-between gap-2 text-xs">
                          <span className="flex min-w-0 items-center gap-2 text-slate-600 dark:text-slate-300">
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: COLORS[index % COLORS.length] }} />
                            <span className="truncate">{titleCase(row.category)}</span>
                          </span>
                          <span className="shrink-0 font-semibold text-slate-900 dark:text-white">
                            {money(row.amount_cents)}
                            <span className="ml-1 text-[10px] font-medium text-slate-400">{percent(row.amount_cents, categoryTotal)}%</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="p-4 sm:p-5">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Tender mix</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Collected by payment method</p>
                  </div>
                  <Badge tone="slate">{money(methodTotal)}</Badge>
                </div>
                {revenue.methods.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-500">No payments in this range.</p>
                ) : (
                  <div className="space-y-3">
                    {revenue.methods.map((row) => {
                      const Icon = METHOD_ICONS[row.method] || Banknote;
                      return (
                        <div key={row.method}>
                          <div className="mb-1 flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1.5 font-semibold capitalize text-slate-700 dark:text-slate-200">
                              <Icon className="h-3.5 w-3.5 text-slate-400" /> {row.method}
                            </span>
                            <span className="font-bold text-slate-900 dark:text-white">{money(row.amount_cents)}</span>
                          </div>
                          <Progress value={percent(row.amount_cents, methodTotal)} tone={row.method === 'wallet' ? 'indigo' : row.method === 'cash' ? 'emerald' : 'cyan'} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              <Card className="p-4 sm:p-5">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Account attention</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Low wallet balances · {overview?.active_holds || 0} active holds</p>
                  </div>
                  <Badge tone={(overview?.low_balance_count || 0) > 0 ? 'rose' : 'emerald'}>
                    {overview?.low_balance_count || 0} low
                  </Badge>
                </div>
                {!overview?.low_balance_students?.length ? (
                  <p className="py-6 text-center text-xs text-slate-500">Every wallet is above its alert threshold.</p>
                ) : (
                  <div className="space-y-1">
                    {overview.low_balance_students.map((student) => (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => navigate(`/students/${student.id}`)}
                        className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      >
                        <Avatar name={student.name} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">{student.name}</p>
                          <p className="text-[10px] text-slate-500">{student.student_no} · alert at {money(student.low_balance_cents)}</p>
                        </div>
                        <span className="text-xs font-bold text-rose-600 dark:text-rose-400">{money(student.wallet_balance_cents)}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-slate-50 p-2.5 text-center dark:bg-slate-950/50">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">Outstanding fees</p>
                    <p className="text-sm font-bold text-amber-600 dark:text-amber-400">{money(overview?.outstanding_cents || 0)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2.5 text-center dark:bg-slate-950/50">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">Today</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{overview?.today_transactions || 0} tx</p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )
      ) : null}

      {tab === 'ledger' ? (
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={logQuery} onChange={(event) => setLogQuery(event.target.value)} placeholder="Search description or student" className="pl-9" />
            </div>
            <div className="flex items-center gap-2">
              <Select value={logKind} onChange={(event) => setLogKind(event.target.value)} className="w-44">
                <option value="all">All entry types</option>
                {['purchase', 'topup', 'fee_invoice', 'fee_payment', 'waiver', 'adjustment'].map((kind) => (
                  <option key={kind} value={kind}>{titleCase(kind)}</option>
                ))}
              </Select>
              <Badge tone="slate">{logs ? `${logs.length} entries` : 'Loading'}</Badge>
            </div>
          </div>
          {!logs ? (
            <div className="space-y-3 p-4">{Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-12" />)}</div>
          ) : logs.length === 0 ? (
            <EmptyState icon={FileText} title="No ledger entries" description="Entries matching this range and filter will appear here." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="table-head">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3 text-right">Debit</th>
                    <th className="px-4 py-3 text-right">Credit</th>
                    <th className="px-4 py-3 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((entry) => (
                    <tr key={entry.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400">{dateTime(entry.created_at)}</td>
                      <td className="px-4 py-2.5">
                        <button type="button" onClick={() => navigate(`/students/${entry.student_id}`)} className="text-left hover:text-indigo-600 dark:hover:text-indigo-400">
                          <p className="text-xs font-semibold text-slate-900 dark:text-white">{entry.student_name}</p>
                          <p className="text-[10px] text-slate-500">{entry.student_no}</p>
                        </button>
                      </td>
                      <td className="px-4 py-2.5"><Badge tone={kindTone[entry.kind] || 'slate'}>{titleCase(entry.kind)}</Badge></td>
                      <td className="px-4 py-2.5">
                        <p className="text-xs font-medium text-slate-800 dark:text-slate-100">{entry.description}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">{titleCase(entry.category)}{entry.method ? ` · ${entry.method}` : ''}{entry.terminal ? ` · ${entry.terminal}` : ''}</p>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs">{Number(entry.debit_cents) ? money(entry.debit_cents) : '—'}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs text-emerald-600 dark:text-emerald-400">{Number(entry.credit_cents) ? money(entry.credit_cents) : '—'}</td>
                      <td className={cn('px-4 py-2.5 text-right font-mono text-xs font-bold', Number(entry.balance_after_cents) < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white')}>
                        {money(entry.balance_after_cents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : null}

      {tab === 'drawer' ? (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
            <Card className="p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-600 dark:text-indigo-400">Drawer control</p>
                  <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{terminal} terminal</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Opening float, cash expectations, variance, and Z-report archive</p>
                </div>
                <Badge tone={current ? 'emerald' : 'slate'} dot>{current ? 'Drawer open' : 'Drawer closed'}</Badge>
              </div>

              {current ? (
                <>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">Opening float</p>
                      <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{money(current.opening_float_cents)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">Expected cash</p>
                      <p className="mt-1 text-lg font-bold text-emerald-600 dark:text-emerald-400">{money(current.expected_cash_cents)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">Opened</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{dateTime(current.opened_at)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">Cashier</p>
                      <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-white">{current.cashier}</p>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    {(current.methods || []).map((method) => (
                      <div key={method.method} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-950/50">
                        <span className="flex items-center gap-1.5 font-semibold capitalize text-slate-600 dark:text-slate-300">
                          {React.createElement(METHOD_ICONS[method.method] || Banknote, { className: 'h-3.5 w-3.5 text-slate-400' })}
                          {method.method}
                        </span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">{money(method.amount_cents)} <span className="font-sans text-[10px] font-medium text-slate-400">({method.count})</span></span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button icon={Calculator} onClick={beginClose}>Close drawer & reconcile</Button>
                    <Button variant="secondary" icon={RefreshCw} onClick={loadDrawer}>Refresh</Button>
                  </div>
                </>
              ) : (
                <div className="mt-4">
                  <EmptyState
                    icon={Scale}
                    title="No open drawer session"
                    description={`Open a session for ${terminal} before taking cash payments, so the Z-report can reconcile expected cash.`}
                    action={<Button icon={Wallet} onClick={() => setOpenOpen(true)}>Open drawer</Button>}
                  />
                </div>
              )}
            </Card>

            <Card className="p-4 sm:p-5">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Reconciliation policy</h3>
              <div className="mt-3 space-y-3 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-300"><Banknote className="h-3.5 w-3.5" /></span>
                  <p><strong className="text-slate-800 dark:text-slate-200">Expected cash</strong> = opening float + cash transactions + cash fee payments + cash top-ups recorded on this terminal.</p>
                </div>
                <div className="flex gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"><CheckIcon /></span>
                  <p><strong className="text-slate-800 dark:text-slate-200">Zero variance</strong> means the physical count matches the ledger. Any variance is flagged and archived.</p>
                </div>
                <div className="flex gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-300"><AlertTriangle className="h-3.5 w-3.5" /></span>
                  <p><strong className="text-slate-800 dark:text-slate-200">Immutable audit</strong>: closing writes a signed audit entry with counted, expected, variance, and tender totals.</p>
                </div>
              </div>
              <div className="mt-4 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Today</p>
                <div className="mt-2 flex items-end justify-between">
                  <div>
                    <p className="text-xs text-slate-500">Collections</p>
                    <p className="text-xl font-bold text-slate-900 dark:text-white">{money(overview?.today_revenue_cents || 0)}</p>
                  </div>
                  <Badge tone="indigo">{overview?.today_transactions || 0} tx</Badge>
                </div>
              </div>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Drawer history</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Archived sessions and Z-report downloads</p>
              </div>
              <Button variant="ghost" size="xs" icon={RefreshCw} onClick={loadDrawer}>Refresh</Button>
            </div>
            {!sessions ? (
              <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-12" />)}</div>
            ) : sessions.length === 0 ? (
              <EmptyState icon={Scale} title="No drawer sessions" description="Open a drawer to begin tracking shift cash and Z-reports." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[940px] text-sm">
                  <thead className="table-head">
                    <tr>
                      <th className="px-4 py-3">Opened</th>
                      <th className="px-4 py-3">Terminal</th>
                      <th className="px-4 py-3">Cashier</th>
                      <th className="px-4 py-3 text-right">Float</th>
                      <th className="px-4 py-3 text-right">Expected</th>
                      <th className="px-4 py-3 text-right">Counted</th>
                      <th className="px-4 py-3 text-right">Variance</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((session) => {
                      const variance = Number(session.variance_cents || 0);
                      return (
                        <tr key={session.id} className="border-t border-slate-100 dark:border-slate-800">
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{dateTime(session.opened_at)}</td>
                          <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{session.terminal}</td>
                          <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">{session.cashier}</td>
                          <td className="px-4 py-3 text-right font-mono text-xs">{money(session.opening_float_cents)}</td>
                          <td className="px-4 py-3 text-right font-mono text-xs">{session.expected_cash_cents == null ? '—' : money(session.expected_cash_cents)}</td>
                          <td className="px-4 py-3 text-right font-mono text-xs">{session.counted_cash_cents == null ? '—' : money(session.counted_cash_cents)}</td>
                          <td className={cn('px-4 py-3 text-right font-mono text-xs font-bold', variance === 0 ? 'text-emerald-600 dark:text-emerald-400' : variance > 0 ? 'text-amber-600' : 'text-rose-600')}>
                            {session.status === 'closed' ? money(variance) : '—'}
                          </td>
                          <td className="px-4 py-3"><Badge tone={session.status === 'open' ? 'emerald' : 'slate'}>{session.status}</Badge></td>
                          <td className="px-4 py-3 text-right">
                            {session.status === 'closed' ? (
                              <Button size="xs" variant="secondary" icon={FileText} onClick={() => viewZReport(session)}>Z-report</Button>
                            ) : session.id === current?.id ? (
                              <Button size="xs" icon={Calculator} onClick={beginClose}>Close</Button>
                            ) : (
                              <span className="text-[10px] text-slate-400">Other terminal</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      ) : null}

      {tab === 'audit' ? (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Audit trail</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Policy overrides, transactions, holds, and drawer events</p>
            </div>
            <Badge tone="slate">{audit ? `${audit.length} events` : 'Loading'}</Badge>
          </div>
          {!audit ? (
            <div className="space-y-2 p-4">{Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-11" />)}</div>
          ) : audit.length === 0 ? (
            <EmptyState icon={ShieldCheck} title="No audit events" description="Sensitive actions will be recorded here." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="table-head">
                  <tr>
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Actor</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Entity</th>
                    <th className="px-4 py-3">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((entry) => (
                    <tr key={entry.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400">{dateTime(entry.created_at)}</td>
                      <td className="px-4 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100">{entry.actor || 'system'}</td>
                      <td className="px-4 py-2.5"><Badge tone={entry.action.startsWith('drawer') ? 'cyan' : entry.action.startsWith('pos') ? 'indigo' : entry.action.startsWith('fee') ? 'violet' : 'slate'}>{entry.action}</Badge></td>
                      <td className="px-4 py-2.5 font-mono text-[10px] text-slate-500 dark:text-slate-400">{entry.entity || '—'}{entry.entity_id ? ` · ${entry.entity_id.slice(0, 8)}` : ''}</td>
                      <td className="max-w-[360px] px-4 py-2.5 font-mono text-[10px] text-slate-500 dark:text-slate-400">
                        <span className="line-clamp-2 break-all">{entry.details}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : null}

      <Modal
        open={openOpen}
        onClose={() => setOpenOpen(false)}
        title="Open cash drawer"
        subtitle={`${terminal} · ${cashier}`}
        icon={Wallet}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setOpenOpen(false)} disabled={drawerBusy}>Cancel</Button>
            <Button size="sm" type="submit" form="open-drawer-form" loading={drawerBusy}>Open drawer</Button>
          </div>
        }
      >
        <form id="open-drawer-form" onSubmit={openDrawerSession} className="space-y-4">
          <Field label="Opening float (USD)" hint="Physical cash placed in the drawer at shift start">
            <Input type="number" min="0" step="0.01" value={floatAmount} onChange={(event) => setFloatAmount(event.target.value)} autoFocus />
          </Field>
          <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-500 dark:bg-slate-950/50 dark:text-slate-400">
            Only one open session is allowed per terminal. Cash transactions, fee payments, and top-ups roll into this session's expected cash.
          </div>
        </form>
      </Modal>

      <Modal
        open={closeOpen}
        onClose={() => setCloseOpen(false)}
        title="Close drawer & reconcile"
        subtitle={`${current?.terminal || terminal} · opened ${current ? dateTime(current.opened_at) : ''}`}
        icon={Scale}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setCloseOpen(false)} disabled={drawerBusy}>Cancel</Button>
            <Button size="sm" type="submit" form="close-drawer-form" loading={drawerBusy}>Close & generate Z</Button>
          </div>
        }
      >
        <form id="close-drawer-form" onSubmit={closeDrawerSession} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Expected cash</p>
              <p className="mt-1 text-lg font-bold text-emerald-600 dark:text-emerald-400">{money(current?.expected_cash_cents || 0)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Variance preview</p>
              <p className={cn('mt-1 text-lg font-bold', variancePreview === 0 ? 'text-slate-900 dark:text-white' : variancePreview > 0 ? 'text-amber-600' : 'text-rose-600')}>
                {money(variancePreview)}
              </p>
            </div>
          </div>
          <Field label="Counted cash (USD)" hint="Enter the physical cash counted in the drawer">
            <Input type="number" min="0" step="0.01" value={counted} onChange={(event) => setCounted(event.target.value)} autoFocus />
          </Field>
          {current?.methods?.length ? (
            <div className="space-y-1.5">
              {current.methods.map((method) => (
                <div key={method.method} className="flex justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-xs dark:bg-slate-950/50">
                  <span className="capitalize text-slate-500">{method.method} · {method.count} tx</span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-white">{money(method.amount_cents)}</span>
                </div>
              ))}
            </div>
          ) : null}
          <p className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5" /> Closing locks the session and writes an immutable audit log entry.
          </p>
        </form>
      </Modal>

      <ZReportModal session={zReport} onClose={() => setZReport(null)} />
    </div>
  );
}

function CheckIcon() {
  return <ShieldCheck className="h-3.5 w-3.5" />;
}

function ZReportModal({ session, onClose }) {
  const schoolName = useStore((state) => state.settings.school_name);
  if (!session) return null;
  const variance = Number(session.variance_cents || 0);
  const methods = session.methods || session.totals?.methods || [];
  const total = methods.reduce((sum, method) => sum + Number(method.amount_cents || 0), 0);

  return (
    <Modal
      open={Boolean(session)}
      onClose={onClose}
      title="Z-report"
      subtitle={`${session.terminal} · ${dateOnly(session.closed_at)}`}
      icon={FileText}
      size="lg"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">Recorded in the audit trail</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" icon={Printer} onClick={() => window.print()}>Print</Button>
            <a href={api.drawer.zReportUrl(session.id)} target="_blank" rel="noreferrer">
              <Button variant="secondary" size="sm" icon={FileText}>PDF</Button>
            </a>
            <Button size="sm" onClick={onClose}>Done</Button>
          </div>
        </div>
      }
    >
      <div className="print-area rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-extrabold tracking-tight">{schoolName}</p>
            <p className="text-xs text-slate-500">Z-Report · Drawer Reconciliation</p>
            <p className="mt-2 text-sm font-bold">{session.terminal} terminal</p>
            <p className="text-xs text-slate-500">Cashier {session.cashier}</p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p>Opened {dateTime(session.opened_at)}</p>
            <p>Closed {dateTime(session.closed_at)}</p>
            <p className="mt-1 font-mono text-[10px]">{session.id.slice(0, 12).toUpperCase()}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Opening float</p>
            <p className="mt-1 text-sm font-bold">{money(session.opening_float_cents)}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Expected cash</p>
            <p className="mt-1 text-sm font-bold">{money(session.expected_cash_cents)}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Counted cash</p>
            <p className="mt-1 text-sm font-bold">{money(session.counted_cash_cents)}</p>
          </div>
        </div>

        <div className={cn('mt-3 rounded-xl px-3 py-2.5 text-sm font-bold', variance === 0 ? 'bg-emerald-50 text-emerald-700' : variance > 0 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700')}>
          Variance {money(variance)} {variance === 0 ? '· balanced' : variance > 0 ? '· over' : '· short'}
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2">Tender</th>
                <th className="px-3 py-2 text-right">Count</th>
                <th className="px-3 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {methods.map((method) => (
                <tr key={method.method} className="border-t border-slate-100">
                  <td className="px-3 py-2 capitalize">{method.method}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{method.count}</td>
                  <td className="px-3 py-2 text-right font-medium">{money(method.amount_cents)}</td>
                </tr>
              ))}
              <tr className="border-t border-slate-200 bg-slate-50">
                <td className="px-3 py-2 font-bold" colSpan={2}>Total tenders</td>
                <td className="px-3 py-2 text-right font-bold">{money(total)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-dashed border-slate-200 pt-3 text-[10px] text-slate-500">
          <span>Drawer closed by {session.cashier}</span>
          <span>Immutable audit record</span>
        </div>
      </div>
    </Modal>
  );
}
