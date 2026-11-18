import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ChevronRight, Search, UserPlus, Users as UsersIcon } from 'lucide-react';
import { api } from '../lib/api';
import { dollarsToCents, money } from '../lib/format';
import { useDebounced } from '../hooks/useOnline';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Skeleton,
  Modal,
} from '../components/ui';

const blankStudent = {
  student_no: '',
  name: '',
  grade: '',
  section: '',
  card_uid: '',
  phone: '',
  emergency_contact: '',
  daily_limit: '',
  low_balance: '20.00',
};

export default function Students() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounced(query, 250);
  const [students, setStudents] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blankStudent);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.students
      .list(debouncedQuery)
      .then((rows) => active && setStudents(rows))
      .catch((err) => toast.error(err.message));
    return () => {
      active = false;
    };
  }, [debouncedQuery]);

  const createStudent = async (event) => {
    event.preventDefault();
    if (!form.student_no.trim() || !form.name.trim()) return setError('Student number and full name are required');
    setBusy(true);
    setError('');
    try {
      const student = await api.students.create({
        student_no: form.student_no.trim(),
        name: form.name.trim(),
        grade: form.grade.trim() || undefined,
        section: form.section.trim() || undefined,
        card_uid: form.card_uid.trim() || undefined,
        phone: form.phone.trim() || undefined,
        emergency_contact: form.emergency_contact.trim() || undefined,
        daily_limit_cents: form.daily_limit === '' ? null : dollarsToCents(form.daily_limit),
        low_balance_cents: dollarsToCents(form.low_balance || 0),
        restrictions: [],
      });
      toast.success(`${student.name} added`);
      setOpen(false);
      setForm(blankStudent);
      navigate(`/students/${student.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Student management"
        title="Student directory"
        subtitle="Unified academic profiles, wallets, holds, and family controls"
        actions={
          <Button icon={UserPlus} onClick={() => setOpen(true)}>
            New student
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, student no, or card UID"
              className="pl-9"
            />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {students ? `${students.length} student${students.length === 1 ? '' : 's'}` : 'Loading…'}
          </p>
        </div>

        {!students ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-14" />
            ))}
          </div>
        ) : students.length === 0 ? (
          <EmptyState
            icon={UsersIcon}
            title="No students found"
            description="Add a student or try a different search."
            action={<Button icon={UserPlus} onClick={() => setOpen(true)}>New student</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead className="table-head">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Grade</th>
                  <th className="px-4 py-3">Card / RFID</th>
                  <th className="px-4 py-3 text-right">Wallet</th>
                  <th className="px-4 py-3 text-right">Outstanding</th>
                  <th className="px-4 py-3">Controls</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="w-10 px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {students.map((student) => {
                  const low = Number(student.wallet_balance_cents) < Number(student.low_balance_cents);
                  return (
                    <tr
                      key={student.id}
                      onClick={() => navigate(`/students/${student.id}`)}
                      className="cursor-pointer border-t border-slate-100 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={student.name} size="sm" />
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white">{student.name}</p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">{student.student_no}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {student.grade || '—'} {student.section || ''}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">{student.card_uid || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={low ? 'font-bold text-rose-600 dark:text-rose-400' : 'font-semibold text-slate-900 dark:text-white'}>
                          {money(student.wallet_balance_cents)}
                        </span>
                        {low ? <p className="text-[10px] font-medium text-rose-500">below threshold</p> : null}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={Number(student.outstanding_cents) > 0 ? 'font-semibold text-amber-600 dark:text-amber-400' : 'text-slate-500'}>
                          {money(student.outstanding_cents)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {Number(student.holds_count) > 0 ? <Badge tone="amber">{student.holds_count} hold</Badge> : <Badge tone="emerald">clear</Badge>}
                          {student.daily_limit_cents ? <Badge tone="slate">{money(student.daily_limit_cents)}/day</Badge> : null}
                          {student.restrictions?.length ? <Badge tone="rose">{student.restrictions.length} block</Badge> : null}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={student.status === 'active' ? 'emerald' : 'rose'}>{student.status}</Badge>
                      </td>
                      <td className="px-3 py-3 text-slate-400">
                        <ChevronRight className="h-4 w-4" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New student profile"
        subtitle="Creates a unified academic and financial account"
        icon={UserPlus}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button size="sm" type="submit" form="student-form" loading={busy}>
              Create student
            </Button>
          </div>
        }
      >
        <form id="student-form" onSubmit={createStudent} className="grid gap-4 sm:grid-cols-2">
          <Field label="Student number *">
            <Input value={form.student_no} onChange={(e) => setForm({ ...form, student_no: e.target.value })} placeholder="S-1004" autoFocus />
          </Field>
          <Field label="Full name *">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Amara Bello" />
          </Field>
          <Field label="Grade">
            <Select value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })}>
              <option value="">Select grade</option>
              {['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'].map((grade) => <option key={grade}>{grade}</option>)}
            </Select>
          </Field>
          <Field label="Section">
            <Input value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} placeholder="A" />
          </Field>
          <Field label="RFID / card UID" hint="Scan the badge here if available">
            <Input value={form.card_uid} onChange={(e) => setForm({ ...form, card_uid: e.target.value })} placeholder="RFID-1004" className="font-mono" />
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1 555 0104" />
          </Field>
          <Field label="Daily spending cap (USD)" className="sm:col-span-2">
            <Input type="number" min="0" step="0.01" value={form.daily_limit} onChange={(e) => setForm({ ...form, daily_limit: e.target.value })} placeholder="50.00" />
          </Field>
          <Field label="Low-balance alert threshold (USD)">
            <Input type="number" min="0" step="0.01" value={form.low_balance} onChange={(e) => setForm({ ...form, low_balance: e.target.value })} />
          </Field>
          <Field label="Emergency contact">
            <Input value={form.emergency_contact} onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })} placeholder="Name · phone" />
          </Field>
          {error ? <p className="sm:col-span-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">{error}</p> : null}
        </form>
      </Modal>
    </div>
  );
}
