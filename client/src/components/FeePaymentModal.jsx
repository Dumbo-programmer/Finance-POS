import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { HandCoins, Wallet } from 'lucide-react';
import { api } from '../lib/api';
import { centsToDollars, dateOnly, dollarsToCents, money } from '../lib/format';
import { useStore } from '../store/store';
import { Badge, Button, Field, Input, Modal, Select } from './ui';
import ReceiptModal from './ReceiptModal';

export default function FeePaymentModal({ fee, open, onClose, onPaid }) {
  const cashier = useStore((s) => s.cashier);
  const terminal = useStore((s) => s.terminal);
  const [amount, setAmount] = useState('');
  const [waiver, setWaiver] = useState('0');
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState(null);

  const remaining = Number(fee?.remaining_cents ?? 0);

  useEffect(() => {
    if (open && fee) {
      setAmount(centsToDollars(fee.remaining_cents));
      setWaiver('0');
      setMethod('cash');
      setReference('');
      setError('');
      setBusy(false);
    }
  }, [open, fee]);

  if (!fee) return null;

  const submit = async (event) => {
    event.preventDefault();
    const paidCents = dollarsToCents(amount);
    const waiverCents = dollarsToCents(waiver);
    if (paidCents < 0 || waiverCents < 0) return setError('Amounts cannot be negative');
    if (!paidCents && !waiverCents) return setError('Enter a payment or a financial-aid waiver');
    if (paidCents + waiverCents > remaining) return setError(`Exceeds remaining balance of ${money(remaining)}`);
    setBusy(true);
    setError('');
    try {
      const result = await api.fees.pay(fee.id, {
        payments: paidCents > 0 ? [{ method, amount_cents: paidCents }] : [],
        waiver_cents: waiverCents,
        cashier,
        terminal,
        reference: reference || undefined,
      });
      toast.success(
        result.settled
          ? `Invoice settled${fee.hold_reason ? ' · administrative hold cleared' : ''}`
          : `Payment posted · ${money(remaining - paidCents - waiverCents)} remaining`
      );
      onPaid?.(result);
      if (result.receipt) setReceipt(result.receipt);
      else onClose?.();
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Post fee payment"
        subtitle={`${fee.title} · ${fee.student_name || ''}`}
        icon={HandCoins}
        footer={
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Remaining <strong className="text-slate-900 dark:text-white">{money(remaining)}</strong>
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button size="sm" type="submit" form="fee-payment-form" loading={busy}>
                Post payment
              </Button>
            </div>
          </div>
        }
      >
        <form id="fee-payment-form" onSubmit={submit} className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{fee.student_name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {fee.student_no} · Due {fee.due_date ? dateOnly(fee.due_date) : 'on receipt'}
                </p>
              </div>
              <Badge tone={fee.status === 'partial' ? 'amber' : 'rose'}>{fee.status}</Badge>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-white p-2 dark:bg-slate-900">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">Invoice</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{money(fee.amount_cents)}</p>
              </div>
              <div className="rounded-lg bg-white p-2 dark:bg-slate-900">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">Paid</p>
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{money(fee.paid_cents)}</p>
              </div>
              <div className="rounded-lg bg-white p-2 dark:bg-slate-900">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">Waived</p>
                <p className="text-sm font-bold text-violet-600 dark:text-violet-400">{money(fee.waived_cents)}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Payment amount (USD)">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
              />
            </Field>
            <Field label="Financial aid / waiver (USD)" hint="Applied instantly against this invoice">
              <Input type="number" min="0" step="0.01" value={waiver} onChange={(e) => setWaiver(e.target.value)} />
            </Field>
            <Field label="Payment method">
              <Select value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="transfer">Bank transfer</option>
                <option value="wallet">Student wallet</option>
              </Select>
            </Field>
            <Field label="Reference / note">
              <Input placeholder="Receipt ref, scholarship ID…" value={reference} onChange={(e) => setReference(e.target.value)} />
            </Field>
          </div>

          {fee.hold_reason ? (
            <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              <Wallet className="h-4 w-4 shrink-0" />
              Hold <strong>{fee.hold_reason.replaceAll('_', ' ')}</strong> clears automatically when this invoice is fully settled.
            </div>
          ) : null}

          {error ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">{error}</p> : null}
        </form>
      </Modal>

      <ReceiptModal receipt={receipt} open={Boolean(receipt)} onClose={() => { setReceipt(null); onClose?.(); }} />
    </>
  );
}
