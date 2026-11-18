import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BadgeDollarSign,
  BarChart3,
  CalendarDays,
  CreditCard,
  FileText,
  GraduationCap,
  ReceiptText,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { api } from '../lib/api';
import { dateOnly, dateTime, money, moneyShort, titleCase } from '../lib/format';
import { useStore } from '../store/store';
import ReceiptModal from '../components/ReceiptModal';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Progress,
  Skeleton,
  Stat,
  cn,
} from '../components/ui';

const quickActions = [
  {
    label: 'New invoice',
    description: 'Fees, waivers, installments',
    icon: ReceiptText,
    to: '/fees',
    tone: 'from-indigo-500 to-violet-500',
  },
  {
    label: 'Record fee payment',
    description: 'Invoices, waivers, receipts',
    icon: ReceiptText,
    to: '/fees',
    tone: 'from-emerald-500 to-teal-500',
  },
  {
    label: 'Student accounts',
    description: 'Wallets, holds, controls',
    icon: Users,
    to: '/students',
    tone: 'from-cyan-500 to-sky-500',
  },
  {
    label: 'Reconcile drawer',
    description: 'Z-reports and audit logs',
    icon: BarChart3,
    to: '/reports',
    tone: 'from-amber-500 to-orange-500',
  },
];

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Dashboard() {
  const navigate = useNavigate();
  const cashier = useStore((state) => state.cashier);
  const terminal = useStore((state) => state.terminal);
  const schoolName = useStore((state) => state.settings.school_name) || 'Northfield Academy';
  const [overview, setOverview] = useState(null);
  const [revenue, setRevenue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [receiptOpen, setReceiptOpen] = useState(false);

  const load = ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    Promise.all([api.reports.overview(), api.reports.revenue('7d')])
      .then(([head, rev]) => {
        setOverview(head);
        setRevenue(rev);
      })
      .catch((error) => toast.error(error.message))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    load();
  }, []);

  const weekTotal = useMemo(
    () => Number(revenue?.totals?.retail_cents || 0) + Number(revenue?.totals?.fees_cents || 0),
    [revenue]
  );
  const weekAverage = revenue?.daily?.length ? Math.round(weekTotal / revenue.daily.length) : 0;

  const openReceipt = async (transaction) => {
    try {
      const full = await api.pos.transaction(transaction.id);
      setReceipt(full);
      setReceiptOpen(true);
    } catch (error) {
      toast.error(error.message);
    }
  };

  if (loading) {
    return (
      <div>
        <PageHeader eyebrow="Command center" title={`${greeting()}, ${cashier.split(' ')[0]}`} subtitle="Loading today's campus activity…" />
        <Skeleton className="mb-4 h-36" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Command center"
        title={`${greeting()}, ${cashier.split(' ')[0]}`}
        subtitle={`${schoolName} · ${terminal} terminal · ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`}
        actions={
          <>
            <Button variant="secondary" icon={RefreshCw} loading={refreshing} onClick={() => load({ silent: true })}>
              Refresh
            </Button>
            <Button icon={ReceiptText} onClick={() => navigate('/fees')}>
              New invoice
            </Button>
          </>
        }
      />

      <Card className="relative mb-4 overflow-hidden p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-32 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <Badge tone="emerald" dot>Live workspace</Badge>
            <h2 className="mt-3 text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
              One ledger for wallets, fees, and student accounts.
            </h2>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
              Issue invoices, post wallet top-ups, manage controls, and reconcile accounts — every movement is recorded atomically in the student ledger.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => navigate(action.to)}
                  className="group flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-left transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/70 dark:hover:border-indigo-500/40"
                >
                  <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm', action.tone)}>
                    <action.icon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-xs font-bold text-slate-900 dark:text-white">{action.label}</span>
                    <span className="block text-[10px] text-slate-500 dark:text-slate-400">{action.description}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 lg:w-[340px]">
            <div className="rounded-xl border border-slate-200 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-900/70">
              <GraduationCap className="h-4 w-4 text-indigo-500" />
              <p className="mt-2 text-lg font-bold text-slate-900 dark:text-white">{overview?.active_students || 0}</p>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Students</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-900/70">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              <p className="mt-2 text-lg font-bold text-slate-900 dark:text-white">{overview?.active_holds || 0}</p>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Holds</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-900/70">
              <AlertTriangle className="h-4 w-4 text-rose-500" />
              <p className="mt-2 text-lg font-bold text-slate-900 dark:text-white">{overview?.low_balance_count || 0}</p>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Low balances</p>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Today's revenue"
          value={money(overview?.today_revenue_cents || 0)}
          sub={`${overview?.today_transactions || 0} completed transactions`}
          icon={TrendingUp}
          tone="indigo"
        />
        <Stat label="Campus retail" value={money(overview?.today_retail_cents || 0)} sub="Canteen, bookstore, uniforms" icon={CreditCard} tone="cyan" />
        <Stat label="Fee collections" value={money(overview?.today_fees_cents || 0)} sub="Tuition, transport, fines" icon={BadgeDollarSign} tone="emerald" />
        <Stat
          label="Outstanding fees"
          value={money(overview?.outstanding_cents || 0)}
          sub={`${overview?.active_holds || 0} active hold${overview?.active_holds === 1 ? '' : 's'} linked`}
          icon={FileText}
          tone="amber"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Last 7 days</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Retail and fee collections across all terminals</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">{money(weekTotal)}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">≈ {money(weekAverage)} / day</p>
            </div>
          </div>
          <div className="mt-4 h-[270px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenue?.daily || []} margin={{ top: 6, right: 8, left: -14, bottom: 0 }}>
                <defs>
                  <linearGradient id="dashRetail" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="dashFees" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#94a3b8" strokeOpacity={0.18} vertical={false} />
                <XAxis
                  dataKey="day"
                  tickFormatter={(value) => new Date(`${value}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tickFormatter={moneyShort} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={56} />
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
                <Area type="monotone" dataKey="retail_cents" stroke="#6366f1" strokeWidth={2} fill="url(#dashRetail)" />
                <Area type="monotone" dataKey="fees_cents" stroke="#10b981" strokeWidth={2} fill="url(#dashFees)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
            <span className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-indigo-500" /> Retail {money(revenue?.totals?.retail_cents || 0)}</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Fees {money(revenue?.totals?.fees_cents || 0)}</span>
            </span>
            <button type="button" onClick={() => navigate('/reports')} className="flex items-center gap-1 font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
              Full analytics <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Wallet attention</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Below the alert threshold</p>
              </div>
              <Badge tone={(overview?.low_balance_count || 0) > 0 ? 'rose' : 'emerald'}>{overview?.low_balance_count || 0}</Badge>
            </div>
            {!overview?.low_balance_students?.length ? (
              <div className="rounded-xl bg-emerald-50 p-3 text-center text-xs text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                Every wallet is above its alert threshold.
              </div>
            ) : (
              <div className="space-y-1">
                {overview.low_balance_students.map((student) => (
                  <button
                    key={student.id}
                    type="button"
                    onClick={() => navigate(`/students/${student.id}`)}
                    className="flex w-full items-center gap-2.5 rounded-xl px-1.5 py-1.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  >
                    <Avatar name={student.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">{student.name}</p>
                      <p className="text-[10px] text-slate-500">{student.student_no}</p>
                    </div>
                    <span className="text-xs font-bold text-rose-600 dark:text-rose-400">{money(student.wallet_balance_cents)}</span>
                  </button>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Accounts receivable</h3>
              <Wallet className="h-4 w-4 text-slate-400" />
            </div>
            <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{money(overview?.outstanding_cents || 0)}</p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Unpaid balances across open and partial invoices</p>
            <Progress
              className="mt-3"
              value={overview?.active_students ? ((overview.low_balance_count || 0) / overview.active_students) * 100 : 0}
              tone="amber"
            />
            <div className="mt-3 flex gap-2">
              <Button size="xs" variant="soft" className="flex-1" onClick={() => navigate('/fees')}>
                Billing desk
              </Button>
              <Button size="xs" variant="secondary" className="flex-1" onClick={() => navigate('/students')}>
                Find student
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Recent activity</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Fee payments and account activity across the school</p>
            </div>
            <Button variant="ghost" size="xs" icon={ArrowUpRight} onClick={() => navigate('/reports')}>
              View all
            </Button>
          </div>
          {!overview?.recent_transactions?.length ? (
            <EmptyState icon={ReceiptText} title="No activity yet" description="The first fee payment or top-up will appear here." action={<Button size="sm" onClick={() => navigate('/fees')}>Create invoice</Button>} />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {overview.recent_transactions.map((transaction) => (
                <button
                  key={transaction.id}
                  type="button"
                  onClick={() => openReceipt(transaction)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <span
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                      transaction.kind === 'fee'
                        ? 'bg-violet-500/10 text-violet-600 dark:text-violet-300'
                        : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300'
                    )}
                  >
                    {transaction.kind === 'fee' ? <FileText className="h-4 w-4" /> : <ReceiptText className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                      {transaction.student_name || 'Walk-in customer'}
                      <span className="ml-1.5 font-normal text-slate-400">· {transaction.receipt_no}</span>
                    </p>
                    <p className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                      {titleCase(transaction.kind)} · {transaction.terminal} · {dateTime(transaction.created_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{money(transaction.total_cents)}</p>
                    <Badge tone={transaction.status === 'completed' ? 'emerald' : 'amber'} className="mt-0.5">{transaction.status}</Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Daily rhythm</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">What needs a human today</p>
            </div>
          </div>
          <div className="mt-4 space-y-2.5">
            <button type="button" onClick={() => navigate('/reports')} className="flex w-full items-center gap-2.5 rounded-xl border border-slate-200 p-3 text-left transition hover:border-indigo-300 dark:border-slate-800 dark:hover:border-indigo-500/40">
              <CalendarDays className="h-4 w-4 shrink-0 text-indigo-500" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-900 dark:text-white">Reconcile the drawer</p>
                <p className="text-[10px] text-slate-500">Close the shift and archive the Z-report</p>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
            </button>
            <button type="button" onClick={() => navigate('/students')} className="flex w-full items-center gap-2.5 rounded-xl border border-slate-200 p-3 text-left transition hover:border-indigo-300 dark:border-slate-800 dark:hover:border-indigo-500/40">
              <Users className="h-4 w-4 shrink-0 text-cyan-500" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-900 dark:text-white">Review low balances</p>
                <p className="text-[10px] text-slate-500">{overview?.low_balance_count || 0} students may need a top-up</p>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
            </button>
            <button type="button" onClick={() => navigate('/fees')} className="flex w-full items-center gap-2.5 rounded-xl border border-slate-200 p-3 text-left transition hover:border-indigo-300 dark:border-slate-800 dark:hover:border-indigo-500/40">
              <ShieldAlert className="h-4 w-4 shrink-0 text-amber-500" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-900 dark:text-white">Clear fee holds</p>
                <p className="text-[10px] text-slate-500">{overview?.active_holds || 0} holds auto-clear once invoices settle</p>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
            </button>
          </div>
          <div className="mt-4 rounded-xl bg-slate-50 p-3 dark:bg-slate-950/50">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Ledger integrity</p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              Every wallet and account movement is append-only with a balance snapshot, so statements always reconcile.
            </p>
          </div>
        </Card>
      </div>

      <ReceiptModal receipt={receipt} open={receiptOpen} onClose={() => setReceiptOpen(false)} />
    </div>
  );
}
