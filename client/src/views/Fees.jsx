import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CalendarClock, HandCoins, Plus, ReceiptText, Search, TrendingUp, Wallet } from 'lucide-react';
import { api } from '../lib/api';
import { dateOnly, dollarsToCents, money, titleCase } from '../lib/format';
import { useDebounced } from '../hooks/useOnline';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Skeleton,
  Stat,
  Tabs,
  Textarea,
} from '../components/ui';
import FeePaymentModal from '../components/FeePaymentModal';

const blankInvoice = {
  student_id: '',
  title: '',
  category: 'tuition',
  amount: '',
  due_date: '',
  hold_reason: '',
  notes: '',
};

export default function Fees() {
  const [searchParams] = useSearchParams();
  const initialStudent = searchParams.get('student') || '';
  const [fees, setFees] = useState(null);
  const [students, setStudents] = useState([]);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounced(query, 250);
  const [status, setStatus] = useState('all');
  const [createOpen, setCreateOpen] = useState(Boolean(initialStudent));
  const [form, setForm] = useState({ ...blankInvoice, student_id: initialStudent });
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const [payFee, setPayFee] = useState(null);

  const loadFees = () => {
    api.fees
      .list({ q: debouncedQuery, status })
      .then(setFees)
      .catch((error) => toast.error(error.message));
  };

  useEffect(() => {
    loadFees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, status]);

  useEffect(() => {
    api.students.list().then(setStudents).catch((error) => toast.error(error.message));
  }, []);

  const stats = useMemo(() => {
    const rows = fees || [];
    const outstanding = rows
      .filter((fee) => fee.status === 'open' || fee.status === 'partial')
      .reduce((sum, fee) => sum + Number(fee.remaining_cents), 0);
    const collected = rows.reduce((sum, fee) => sum + Number(fee.paid_cents), 0);
    const waived = rows.reduce((sum, fee) => sum + Number(fee.waived_cents), 0);
    const today = new Date().toISOString().slice(0, 10);
    const overdue = rows.filter((fee) => (fee.status === 'open' || fee.status === 'partial') && fee.due_date && fee.due_date.slice(0, 10) < today).length;
    return { outstanding, collected, waived, overdue };
  }, [fees]);

  const createInvoice = async (event) => {
    event.preventDefault();
    if (!form.student_id) return setFormError('Select a student');
    if (!form.title.trim()) return setFormError('Invoice title is required');
    if (dollarsToCents(form.amount) <= 0) return setFormError('Enter a positive amount');
    setCreating(true);
    setFormError('');
    try {
      await api.fees.create({
        student_id: form.student_id,
        title: form.title.trim(),
        category: form.category,
        amount_cents: dollarsToCents(form.amount),
        due_date: form.due_date || null,
        hold_reason: form.hold_reason.trim() || null,
        notes: form.notes.trim() || null,
      });
      toast.success('Invoice created · debit posted to ledger');
      setCreateOpen(false);
      setForm(blankInvoice);
      loadFees();
    } catch (error) {
      setFormError(error.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Billing desk"
        title="Fees & billing"
        subtitle="Invoices, installments, waivers, and instant hold clearance"
        actions={
          <Button icon={Plus} onClick={() => setCreateOpen(true)}>
            New invoice
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Outstanding" value={money(stats.outstanding)} sub={`${stats.overdue} overdue invoice(s)`} icon={ReceiptText} tone="amber" />
        <Stat label="Collected" value={money(stats.collected)} sub="Current result set" icon={TrendingUp} tone="emerald" />
        <Stat label="Financial aid" value={money(stats.waived)} sub="Waivers applied" icon={HandCoins} tone="violet" />
        <Stat label="Invoices" value={fees ? fees.length : '—'} sub={status === 'all' ? 'All statuses' : titleCase(status)} icon={Wallet} tone="indigo" />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search student, student no, or invoice" className="pl-9" />
          </div>
          <Tabs
            value={status}
            onChange={setStatus}
            tabs={[
              { value: 'all', label: 'All' },
              { value: 'open', label: 'Open' },
              { value: 'partial', label: 'Partial' },
              { value: 'paid', label: 'Paid' },
            ]}
          />
        </div>

        {!fees ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-14" />)}
          </div>
        ) : fees.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title="No invoices found"
            description="Create an invoice or adjust the filters."
            action={<Button icon={Plus} onClick={() => setCreateOpen(true)}>New invoice</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-sm">
              <thead className="table-head">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Waived</th>
                  <th className="px-4 py-3 text-right">Remaining</th>
                  <th className="px-4 py-3">Due</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {fees.map((fee) => (
                  <tr key={fee.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900 dark:text-white">{fee.student_name}</p>
                      <p className="text-[10px] text-slate-500">{fee.student_no}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800 dark:text-slate-100">{fee.title}</p>
                      {fee.hold_reason ? (
                        <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">Hold · {titleCase(fee.hold_reason)}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 capitalize text-slate-600 dark:text-slate-300">{fee.category}</td>
                    <td className="px-4 py-3 text-right">{money(fee.amount_cents)}</td>
                    <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">{money(fee.paid_cents)}</td>
                    <td className="px-4 py-3 text-right text-violet-600 dark:text-violet-400">{money(fee.waived_cents)}</td>
                    <td className="px-4 py-3 text-right font-bold">{money(fee.remaining_cents)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1"><CalendarClock className="h-3 w-3" /> {fee.due_date ? dateOnly(fee.due_date) : '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={fee.status === 'paid' ? 'emerald' : fee.status === 'partial' ? 'amber' : 'rose'}>{fee.status}</Badge>
                    </td>
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
        )}
      </Card>

      <Modal
        open={createOpen}
        onClose={() => { setCreateOpen(false); setForm(blankInvoice); setFormError(''); }}
        title="Create invoice"
        subtitle="Posts a debit to the student ledger and can attach an academic hold"
        icon={ReceiptText}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => { setCreateOpen(false); setForm(blankInvoice); }} disabled={creating}>Cancel</Button>
            <Button size="sm" type="submit" form="invoice-form" loading={creating}>Create invoice</Button>
          </div>
        }
      >
        <form id="invoice-form" onSubmit={createInvoice} className="grid gap-4 sm:grid-cols-2">
          <Field label="Student *" className="sm:col-span-2">
            <Select value={form.student_id} onChange={(event) => setForm({ ...form, student_id: event.target.value })} autoFocus>
              <option value="">Select a student</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name} · {student.student_no} · wallet {money(student.wallet_balance_cents)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Invoice title *">
            <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Term 3 Tuition" />
          </Field>
          <Field label="Category">
            <Select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
              {['tuition', 'lab', 'transport', 'library', 'exam', 'fines', 'other'].map((category) => (
                <option key={category} value={category}>{titleCase(category)}</option>
              ))}
            </Select>
          </Field>
          <Field label="Amount (USD) *">
            <Input type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="300.00" />
          </Field>
          <Field label="Due date">
            <Input type="date" value={form.due_date} onChange={(event) => setForm({ ...form, due_date: event.target.value })} />
          </Field>
          <Field label="Academic hold" hint="Clears automatically when fully settled" className="sm:col-span-2">
            <Input value={form.hold_reason} onChange={(event) => setForm({ ...form, hold_reason: event.target.value })} placeholder="exam_admit, library_clearance, transcript…" />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Installment terms, scholarship reference…" />
          </Field>
          {formError ? <p className="sm:col-span-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">{formError}</p> : null}
        </form>
      </Modal>

      <FeePaymentModal fee={payFee} open={Boolean(payFee)} onClose={() => setPayFee(null)} onPaid={loadFees} />
    </div>
  );
}
