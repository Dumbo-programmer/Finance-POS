import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Ban,
  CalendarClock,
  CreditCard,
  FileDown,
  HandCoins,
  Lock,
  Phone,
  Plus,
  ReceiptText,
  Save,
  ShieldAlert,
  Sparkles,
  UserCog,
  Utensils,
  Wallet,
} from 'lucide-react';
import { api } from '../lib/api';
import { centsToDollars, dateOnly, dateTime, dollarsToCents, money, percent, titleCase } from '../lib/format';
import { useStore } from '../store/store';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Progress,
  Select,
  Skeleton,
  Stat,
  Tabs,
  Modal,
  cn,
} from '../components/ui';
import FeePaymentModal from '../components/FeePaymentModal';

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

export default function Profile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState('ledger');
  const [topupOpen, setTopupOpen] = useState(false);
  const [payFee, setPayFee] = useState(null);
  const [categories, setCategories] = useState([]);
  const [controls, setControls] = useState(null);
  const [customRule, setCustomRule] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const data = await api.students.profile(id);
      setProfile(data);
      setControls({
        daily_limit: data.student.daily_limit_cents == null ? '' : centsToDollars(data.student.daily_limit_cents),
        low_balance: centsToDollars(data.student.low_balance_cents),
        restrictions: data.student.restrictions || [],
        status: data.student.status,
        phone: data.student.phone || '',
        emergency_contact: data.student.emergency_contact || '',
      });
      setNotFound(false);
    } catch (error) {
      if (error.status === 404) setNotFound(true);
      else toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    load();
    api.products.categories().then(setCategories).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const saveControls = async (event) => {
    event.preventDefault();
    if (!controls) return;
    setSaving(true);
    try {
      await api.students.controls(profile.student.id, {
        daily_limit_cents: controls.daily_limit === '' ? null : dollarsToCents(controls.daily_limit),
        low_balance_cents: dollarsToCents(controls.low_balance || 0),
        restrictions: controls.restrictions,
        status: controls.status,
        phone: controls.phone || null,
        emergency_contact: controls.emergency_contact || null,
      });
      toast.success('Controls updated · policy engine is live');
      await load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleRestriction = (rule) => {
    setControls((previous) => {
      const exists = previous.restrictions.includes(rule);
      return {
        ...previous,
        restrictions: exists ? previous.restrictions.filter((value) => value !== rule) : [...previous.restrictions, rule],
      };
    });
  };

  const addCustomRule = () => {
    const value = customRule.trim();
    if (!value) return;
    if (!controls.restrictions.includes(value)) {
      setControls((previous) => ({ ...previous, restrictions: [...previous.restrictions, value] }));
    }
    setCustomRule('');
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <EmptyState
          icon={UserCog}
          title="Student not found"
          description="The profile may have been removed or the lookup is incorrect."
          action={<Button variant="secondary" icon={ArrowLeft} onClick={() => navigate('/students')}>Back to directory</Button>}
        />
      </div>
    );
  }

  const { student, stats, ledger, fees, holds, meal_plans: meals } = profile;
  const low = Number(student.wallet_balance_cents) < Number(student.low_balance_cents);
  const capUsed = student.daily_limit_cents ? percent(stats.today_spend_cents, student.daily_limit_cents) : 0;

  return (
    <div>
      <div className="mb-4">
        <button type="button" onClick={() => navigate('/students')} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400">
          <ArrowLeft className="h-3.5 w-3.5" /> Student directory
        </button>
      </div>

      <PageHeader
        eyebrow="360° student profile"
        title={student.name}
        subtitle={`${student.student_no} · ${student.grade || 'No grade'} ${student.section || ''}`}
        actions={
          <>
            <Button variant="secondary" size="sm" icon={FileDown} onClick={() => window.open(api.students.statementUrl(student.id), '_blank')}>
              Statement PDF
            </Button>
            <Button variant="secondary" size="sm" icon={ReceiptText} onClick={() => navigate(`/fees?student=${student.id}`)}>
              New invoice
            </Button>
            <Button size="sm" icon={Wallet} onClick={() => setTopupOpen(true)}>
              Top-up wallet
            </Button>
          </>
        }
      />

      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar name={student.name} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">{student.name}</h2>
              <Badge tone={student.status === 'active' ? 'emerald' : 'rose'} dot>{student.status}</Badge>
              {low ? <Badge tone="rose">Low balance</Badge> : null}
              {student.restrictions?.length ? <Badge tone="amber">{student.restrictions.length} restriction{student.restrictions.length === 1 ? '' : 's'}</Badge> : null}
            </div>
            <div className="mt-3 grid gap-x-6 gap-y-2 text-xs text-slate-500 dark:text-slate-400 sm:grid-cols-2 lg:grid-cols-3">
              <span className="flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5" /> {student.card_uid || 'No card linked'}</span>
              <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {student.phone || 'No phone'}</span>
              <span className="flex items-center gap-1.5"><ShieldAlert className="h-3.5 w-3.5" /> {student.emergency_contact || 'No emergency contact'}</span>
              <span className="flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" /> Enrolled {dateOnly(student.created_at)}</span>
              <span className="flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5" /> Alert threshold {money(student.low_balance_cents)}</span>
              <span className="flex items-center gap-1.5"><Ban className="h-3.5 w-3.5" /> {student.daily_limit_cents ? `${money(student.daily_limit_cents)} daily cap` : 'No daily cap'}</span>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800 sm:min-w-[190px]">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Today's cap usage</p>
            <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
              {money(stats.today_spend_cents)} <span className="text-xs font-medium text-slate-400">/ {student.daily_limit_cents ? money(student.daily_limit_cents) : '∞'}</span>
            </p>
            <Progress className="mt-2" value={capUsed} tone={capUsed > 85 ? 'rose' : capUsed > 60 ? 'amber' : 'emerald'} />
          </div>
        </div>
      </Card>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Wallet balance" value={money(stats.wallet_balance_cents)} sub={low ? `Below ${money(student.low_balance_cents)} alert` : 'Stored value available'} icon={Wallet} tone={low ? 'rose' : 'emerald'} />
        <Stat label="Outstanding fees" value={money(stats.outstanding_cents)} sub={`${fees.filter((fee) => fee.status === 'open' || fee.status === 'partial').length} active invoice(s)`} icon={ReceiptText} tone="amber" />
        <Stat label="Today's spend" value={money(stats.today_spend_cents)} sub={student.daily_limit_cents ? `${capUsed}% of daily cap` : 'No cap configured'} icon={Sparkles} tone="cyan" />
        <Stat label="Active holds" value={stats.holds_count} sub={holds.length ? holds.map((hold) => titleCase(hold.reason)).join(', ') : 'No academic blocks'} icon={ShieldAlert} tone={holds.length ? 'rose' : 'emerald'} />
      </div>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                { value: 'ledger', label: `Ledger · ${ledger.length}` },
                { value: 'invoices', label: `Invoices · ${fees.length}` },
                { value: 'controls', label: 'Controls' },
              ]}
            />
            {tab === 'ledger' ? <span className="text-[11px] text-slate-500 dark:text-slate-400">Debit = charge · Credit = payment/prepaid · negative = credit</span> : null}
          </div>

          {tab === 'ledger' ? (
            ledger.length === 0 ? (
              <EmptyState icon={ReceiptText} title="No ledger activity" description="Wallet top-ups, purchases, invoices, and payments appear here instantly." />
            ) : (
              <div className="max-h-[560px] overflow-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="table-head sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-2.5">Date</th>
                      <th className="px-4 py-2.5">Type</th>
                      <th className="px-4 py-2.5">Description</th>
                      <th className="px-4 py-2.5 text-right">Debit</th>
                      <th className="px-4 py-2.5 text-right">Credit</th>
                      <th className="px-4 py-2.5 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.map((entry) => (
                      <tr key={entry.id} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400">{dateTime(entry.created_at)}</td>
                        <td className="px-4 py-2.5"><Badge tone={kindTone[entry.kind] || 'slate'}>{titleCase(entry.kind)}</Badge></td>
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-slate-800 dark:text-slate-100">{entry.description}</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">{titleCase(entry.category)}{entry.method ? ` · ${entry.method}` : ''}{entry.terminal ? ` · ${entry.terminal}` : ''}</p>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs">{Number(entry.debit_cents) ? money(entry.debit_cents) : <span className="text-slate-300 dark:text-slate-700">—</span>}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs text-emerald-600 dark:text-emerald-400">{Number(entry.credit_cents) ? money(entry.credit_cents) : <span className="text-slate-300 dark:text-slate-700">—</span>}</td>
                        <td className={cn('px-4 py-2.5 text-right font-mono text-xs font-bold', Number(entry.balance_after_cents) < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white')}>
                          {money(entry.balance_after_cents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : null}

          {tab === 'invoices' ? (
            fees.length === 0 ? (
              <EmptyState
                icon={ReceiptText}
                title="No invoices"
                description="Create tuition, lab, transport, or library invoices from the billing desk."
                action={<Button size="sm" variant="secondary" onClick={() => navigate(`/fees?student=${student.id}`)}>Create invoice</Button>}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="table-head">
                    <tr>
                      <th className="px-4 py-2.5">Invoice</th>
                      <th className="px-4 py-2.5">Category</th>
                      <th className="px-4 py-2.5 text-right">Amount</th>
                      <th className="px-4 py-2.5 text-right">Paid</th>
                      <th className="px-4 py-2.5 text-right">Waived</th>
                      <th className="px-4 py-2.5 text-right">Remaining</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {fees.map((fee) => (
                      <tr key={fee.id} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900 dark:text-white">{fee.title}</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">
                            {fee.due_date ? `Due ${dateOnly(fee.due_date)}` : 'No due date'}
                            {fee.hold_reason ? ` · hold: ${titleCase(fee.hold_reason)}` : ''}
                          </p>
                        </td>
                        <td className="px-4 py-3 capitalize text-slate-600 dark:text-slate-300">{fee.category}</td>
                        <td className="px-4 py-3 text-right font-medium">{money(fee.amount_cents)}</td>
                        <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">{money(fee.paid_cents)}</td>
                        <td className="px-4 py-3 text-right text-violet-600 dark:text-violet-400">{money(fee.waived_cents)}</td>
                        <td className="px-4 py-3 text-right font-bold">{money(fee.amount_cents - fee.paid_cents - fee.waived_cents)}</td>
                        <td className="px-4 py-3"><Badge tone={fee.status === 'paid' ? 'emerald' : fee.status === 'partial' ? 'amber' : 'rose'}>{fee.status}</Badge></td>
                        <td className="px-4 py-3 text-right">
                          {fee.status !== 'paid' && fee.status !== 'waived' ? (
                            <Button size="xs" variant="secondary" icon={HandCoins} onClick={() => setPayFee(fee)}>Pay</Button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : null}

          {tab === 'controls' && controls ? (
            <form onSubmit={saveControls}>
              <div className="grid gap-4 p-4 sm:grid-cols-2">
                <Field label="Daily spending cap (USD)" hint="Leave blank for unlimited. Wallet purchases are validated before capture.">
                  <Input type="number" min="0" step="0.01" value={controls.daily_limit} onChange={(event) => setControls({ ...controls, daily_limit: event.target.value })} placeholder="Unlimited" />
                </Field>
                <Field label="Low-balance alert threshold (USD)">
                  <Input type="number" min="0" step="0.01" value={controls.low_balance} onChange={(event) => setControls({ ...controls, low_balance: event.target.value })} />
                </Field>
                <Field label="Account status">
                  <Select value={controls.status} onChange={(event) => setControls({ ...controls, status: event.target.value })}>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="inactive">Inactive</option>
                  </Select>
                </Field>
                <Field label="Phone">
                  <Input value={controls.phone} onChange={(event) => setControls({ ...controls, phone: event.target.value })} />
                </Field>
                <Field label="Emergency contact" className="sm:col-span-2">
                  <Input value={controls.emergency_contact} onChange={(event) => setControls({ ...controls, emergency_contact: event.target.value })} placeholder="Name · phone" />
                </Field>
              </div>

              <div className="border-t border-slate-200 p-4 dark:border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">Restricted categories & items</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Parental controls enforced instantly across every account station.</p>
                  </div>
                  <Badge tone={controls.restrictions.length ? 'amber' : 'emerald'}>{controls.restrictions.length} active rule(s)</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {categories.map((category) => {
                    const active = controls.restrictions.includes(category);
                    return (
                      <button
                        key={category}
                        type="button"
                        onClick={() => toggleRestriction(category)}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                          active
                            ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300'
                        )}
                      >
                        {active ? <Lock className="h-3 w-3" /> : null}
                        {category}
                      </button>
                    );
                  })}
                </div>
                {controls.restrictions.some((rule) => !categories.includes(rule)) ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {controls.restrictions.filter((rule) => !categories.includes(rule)).map((rule) => (
                      <button key={rule} type="button" onClick={() => toggleRestriction(rule)} className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                        <Lock className="h-3 w-3" /> {rule} ×
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="mt-3 flex gap-2">
                  <Input value={customRule} onChange={(event) => setCustomRule(event.target.value)} placeholder="Custom rule: product SKU, item name, or category" onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addCustomRule(); } }} />
                  <Button type="button" variant="secondary" size="md" icon={Plus} onClick={addCustomRule}>Add</Button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Changes are audited and applied to the policy engine immediately.</p>
                <Button type="submit" size="sm" icon={Save} loading={saving}>Save controls</Button>
              </div>
            </form>
          ) : null}
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Administrative holds</h3>
              <Badge tone={holds.length ? 'amber' : 'emerald'}>{holds.length ? `${holds.length} active` : 'clear'}</Badge>
            </div>
            {holds.length === 0 ? (
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">No academic blocks. Holds lift automatically when linked invoices settle.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {holds.map((hold) => (
                  <div key={hold.id} className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 dark:border-amber-500/30 dark:bg-amber-500/10">
                    <p className="text-xs font-bold text-amber-800 dark:text-amber-200">{titleCase(hold.reason)}</p>
                    <p className="mt-0.5 text-[10px] text-amber-700/80 dark:text-amber-300/80">Since {dateOnly(hold.created_at)} · auto-clears on payment</p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Meal plans</h3>
              <Utensils className="h-4 w-4 text-slate-400" />
            </div>
            {meals.length === 0 ? (
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">No meal plans assigned.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {meals.map((meal) => (
                  <div key={meal.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950/50">
                    <div>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">{meal.name}</p>
                      <p className="text-[10px] text-slate-500">Prepaid credits</p>
                    </div>
                    <Badge tone={meal.remaining > 0 ? 'emerald' : 'rose'}>{meal.remaining} left</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Account signals</h3>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Wallet status</span>
                <Badge tone={low ? 'rose' : 'emerald'}>{low ? 'Low balance' : 'Healthy'}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Ledger position</span>
                <span className={cn('font-mono font-bold', Number(student.ledger_balance_cents) < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white')}>{money(student.ledger_balance_cents)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Linked card</span>
                <span className="font-mono text-slate-800 dark:text-slate-200">{student.card_uid || '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Parent visibility</span>
                <Badge tone="cyan">Live</Badge>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <TopUpModal
        open={topupOpen}
        student={student}
        onClose={() => setTopupOpen(false)}
        onDone={() => { setTopupOpen(false); load(); }}
      />

      <FeePaymentModal
        fee={payFee}
        open={Boolean(payFee)}
        onClose={() => setPayFee(null)}
        onPaid={() => load()}
      />
    </div>
  );
}

function TopUpModal({ open, student, onClose, onDone }) {
  const cashier = useStore((state) => state.cashier);
  const terminal = useStore((state) => state.terminal);
  const [amount, setAmount] = useState('25.00');
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setAmount('25.00');
      setMethod('cash');
      setReference('');
      setError('');
    }
  }, [open]);

  const submit = async (event) => {
    event.preventDefault();
    const cents = dollarsToCents(amount);
    if (cents <= 0) return setError('Enter a positive amount');
    setBusy(true);
    setError('');
    try {
      await api.students.topup(student.id, {
        amount_cents: cents,
        method,
        reference: reference || undefined,
        cashier,
        terminal,
      });
      toast.success(`${money(cents)} credited to ${student.name}'s wallet`);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Wallet quick top-up"
      subtitle={`${student.name} · current ${money(student.wallet_balance_cents)}`}
      icon={Wallet}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button size="sm" type="submit" form="topup-form" loading={busy}>Credit wallet</Button>
        </div>
      }
    >
      <form id="topup-form" onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-4 gap-2">
          {[10, 25, 50, 100].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setAmount(preset.toFixed(2))}
              className={cn(
                'rounded-xl border py-2 text-sm font-bold transition',
                dollarsToCents(amount) === preset * 100
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300'
              )}
            >
              ${preset}
            </button>
          ))}
        </div>
        <Field label="Amount (USD)">
          <Input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} autoFocus />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Funding method">
            <Select value={method} onChange={(event) => setMethod(event.target.value)}>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="transfer">Bank transfer</option>
            </Select>
          </Field>
          <Field label="Reference">
            <Input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Optional" />
          </Field>
        </div>
        <div className="rounded-xl bg-emerald-50 px-3 py-2.5 text-xs text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          Creates an immutable ledger credit and credits the stored-value wallet instantly.
        </div>
        {error ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">{error}</p> : null}
      </form>
    </Modal>
  );
}
