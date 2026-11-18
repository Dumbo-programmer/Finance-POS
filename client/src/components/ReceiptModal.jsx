import React from 'react';
import { Download, Printer, ReceiptText } from 'lucide-react';
import { api } from '../lib/api';
import { dateTime, money, titleCase } from '../lib/format';
import { useStore } from '../store/store';
import { Badge, Button, Modal } from './ui';

export default function ReceiptModal({ receipt, open, onClose }) {
  const schoolName = useStore((s) => s.settings.school_name);
  if (!receipt) return null;
  const { transaction, items, payments, student } = receipt;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Payment receipt"
      subtitle={transaction.receipt_no}
      icon={ReceiptText}
      size="lg"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {transaction.kind === 'fee' ? 'Fee payment' : 'Campus retail'} · {dateTime(transaction.created_at)}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" icon={Printer} onClick={() => window.print()}>
              Print
            </Button>
            <a href={api.pos.receiptUrl(transaction.id)} target="_blank" rel="noreferrer">
              <Button variant="secondary" size="sm" icon={Download}>
                PDF
              </Button>
            </a>
            <Button size="sm" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      }
    >
      <div className="print-area rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-extrabold tracking-tight">{schoolName}</p>
            <p className="text-xs text-slate-500">Student Accounts & Campus Retail</p>
            <p className="mt-3 text-sm font-bold">{student?.name || 'Walk-in customer'}</p>
            <p className="text-xs text-slate-500">
              {student?.student_no || ''} {student?.grade ? `· ${student.grade}` : ''} {student?.section || ''}
            </p>
          </div>
          <div className="text-right">
            <Badge tone={transaction.kind === 'fee' ? 'violet' : 'emerald'}>{titleCase(transaction.kind)}</Badge>
            <p className="mt-2 font-mono text-xs font-bold">{transaction.receipt_no}</p>
            <p className="text-[11px] text-slate-500">{dateTime(transaction.created_at)}</p>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2 text-center">Qty</th>
                <th className="px-3 py-2 text-right">Price</th>
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    <p className="font-medium">{item.name}</p>
                    {item.note ? <p className="text-[11px] text-slate-500">{item.note}</p> : null}
                  </td>
                  <td className="px-3 py-2 text-center text-slate-600">{item.qty}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{money(item.unit_price_cents)}</td>
                  <td className="px-3 py-2 text-right font-medium">{money(item.line_total_cents + item.tax_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 ml-auto max-w-xs space-y-1.5 text-sm">
          <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{money(transaction.subtotal_cents)}</span></div>
          {Number(transaction.discount_cents) > 0 ? (
            <div className="flex justify-between text-emerald-600"><span>Discount</span><span>-{money(transaction.discount_cents)}</span></div>
          ) : null}
          {Number(transaction.tax_cents) > 0 ? (
            <div className="flex justify-between text-slate-600"><span>Tax</span><span>{money(transaction.tax_cents)}</span></div>
          ) : null}
          <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold">
            <span>Total</span><span>{money(transaction.total_cents)}</span>
          </div>
          <div className="flex flex-wrap justify-end gap-1.5 pt-1">
            {payments.map((payment) => (
              <Badge key={payment.id} tone="slate">
                {titleCase(payment.method)} {money(payment.amount_cents)}
              </Badge>
            ))}
          </div>
        </div>

        {transaction.override_by ? (
          <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Supervisor override · {transaction.override_reason || 'Policy exception approved'}
          </div>
        ) : null}

        <div className="mt-5 flex items-center justify-between border-t border-dashed border-slate-200 pt-3 text-[10px] text-slate-500">
          <span>Terminal {transaction.terminal} · Cashier {transaction.cashier}</span>
          <span>Thank you · Keep this receipt</span>
        </div>
      </div>
    </Modal>
  );
}
