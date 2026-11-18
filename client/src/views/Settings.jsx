import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Cloud,
  Database,
  GraduationCap,
  HardDrive,
  KeyRound,
  LockKeyhole,
  Monitor,
  Moon,
  Palette,
  Save,
  ShieldCheck,
  Sun,
  Terminal,
  UserRound,
  Wifi,
} from 'lucide-react';
import { api } from '../lib/api';
import { dateTime } from '../lib/format';
import { useStore } from '../store/store';
import { Badge, Button, Card, Field, Input, PageHeader, Skeleton, cn } from '../components/ui';

export default function Settings() {
  const theme = useStore((state) => state.theme);
  const setTheme = useStore((state) => state.setTheme);
  const cashier = useStore((state) => state.cashier);
  const terminal = useStore((state) => state.terminal);
  const setCashier = useStore((state) => state.setCashier);
  const setTerminal = useStore((state) => state.setTerminal);
  const settings = useStore((state) => state.settings);
  const setSettings = useStore((state) => state.setSettings);

  const [remote, setRemote] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cashierDraft, setCashierDraft] = useState(cashier);
  const [terminalDraft, setTerminalDraft] = useState(terminal);
  const [schoolName, setSchoolName] = useState(settings.school_name || 'Northfield Academy');
  const [schoolPin, setSchoolPin] = useState('');
  const [schoolBusy, setSchoolBusy] = useState(false);
  const [schoolError, setSchoolError] = useState('');

  const [pinForm, setPinForm] = useState({ current: '', next: '', confirm: '' });
  const [pinBusy, setPinBusy] = useState(false);
  const [pinError, setPinError] = useState('');

  const loadSettings = () => {
    setLoading(true);
    Promise.all([api.settings.get(), api.health()])
      .then(([config, status]) => {
        setRemote(config);
        setHealth(status);
        setSchoolName(config.school_name);
        setSettings({ ...useStore.getState().settings, school_name: config.school_name, db: config.db });
      })
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setCashierDraft(cashier);
    setTerminalDraft(terminal);
  }, [cashier, terminal]);

  const saveOperator = (event) => {
    event.preventDefault();
    if (!cashierDraft.trim()) return toast.error('Cashier name is required');
    if (!terminalDraft.trim()) return toast.error('Terminal name is required');
    setCashier(cashierDraft.trim());
    setTerminal(terminalDraft.trim());
    toast.success('Operator preferences saved to this device');
  };

  const updateSchool = async (event) => {
    event.preventDefault();
    if (!schoolPin) return setSchoolError('Enter your supervisor PIN to authorize this change');
    if (schoolName.trim().length < 2) return setSchoolError('School name must be at least 2 characters');
    setSchoolBusy(true);
    setSchoolError('');
    try {
      await api.settings.update({ current_pin: schoolPin, school_name: schoolName.trim() });
      setSettings({ ...useStore.getState().settings, school_name: schoolName.trim() });
      setSchoolPin('');
      toast.success('School profile updated');
      loadSettings();
    } catch (error) {
      setSchoolError(error.message);
    } finally {
      setSchoolBusy(false);
    }
  };

  const changePin = async (event) => {
    event.preventDefault();
    if (!/^\d{4,8}$/.test(pinForm.next)) return setPinError('New PIN must be 4–8 digits');
    if (pinForm.next !== pinForm.confirm) return setPinError('New PIN and confirmation do not match');
    setPinBusy(true);
    setPinError('');
    try {
      await api.settings.update({ current_pin: pinForm.current, new_pin: pinForm.next });
      setPinForm({ current: '', next: '', confirm: '' });
      toast.success('Supervisor PIN updated · audit entry written');
      loadSettings();
    } catch (error) {
      setPinError(error.message);
    } finally {
      setPinBusy(false);
    }
  };

  const dbLabel = remote?.db === 'pg' ? 'PostgreSQL' : 'SQLite';
  const DbIcon = remote?.db === 'pg' ? Cloud : HardDrive;

  return (
    <div>
      <PageHeader
        eyebrow="Workspace configuration"
        title="Settings"
        subtitle="Operator identity, appearance, school profile, supervisor security, and system health"
        actions={
          <Badge tone={health?.ok ? 'emerald' : 'rose'} dot>
            {health?.ok ? 'API connected' : 'API unavailable'}
          </Badge>
        }
      />

      {loading ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-4">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
            <Skeleton className="h-72" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-48" />
            <Skeleton className="h-72" />
            <Skeleton className="h-64" />
          </div>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-4">
            <Card className="p-5">
              <SectionHeader icon={UserRound} title="Operator & terminal" description="This identity is stamped on receipts, ledger entries, and audit logs." />
              <form onSubmit={saveOperator} className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field label="Cashier name" hint="Shown on receipts and drawer sessions">
                  <Input value={cashierDraft} onChange={(event) => setCashierDraft(event.target.value)} placeholder="Jordan Lee" />
                </Field>
                <Field label="Terminal" hint="Use one name per physical till">
                  <Input value={terminalDraft} onChange={(event) => setTerminalDraft(event.target.value)} placeholder="Canteen" />
                </Field>
                <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Saved locally for this device and stamped on receipts, ledger entries, and drawer sessions.
                  </p>
                  <Button type="submit" size="sm" icon={Save}>Save operator</Button>
                </div>
              </form>
            </Card>

            <Card className="p-5">
              <SectionHeader icon={Building2} title="School profile" description="Appears on receipts, statements, and Z-reports. Changes require the supervisor PIN." />
              <form onSubmit={updateSchool} className="mt-4 space-y-3">
                <Field label="School name">
                  <Input value={schoolName} onChange={(event) => setSchoolName(event.target.value)} placeholder="Northfield Academy" />
                </Field>
                <Field label="Supervisor PIN" hint="Required to authorize this change" error={schoolError}>
                  <Input
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    value={schoolPin}
                    onChange={(event) => setSchoolPin(event.target.value.replace(/\D/g, '').slice(0, 8))}
                    placeholder="••••"
                  />
                </Field>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    <LockKeyhole className="h-3.5 w-3.5" /> Authorized admin action
                  </span>
                  <Button type="submit" size="sm" icon={Save} loading={schoolBusy}>Update school</Button>
                </div>
              </form>
            </Card>

            <Card className="p-5">
              <SectionHeader icon={KeyRound} title="Supervisor override PIN" description="Authorizes policy overrides and protected administrative actions." />
              <form onSubmit={changePin} className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field label="Current PIN" className="sm:col-span-2">
                  <Input
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    value={pinForm.current}
                    onChange={(event) => setPinForm({ ...pinForm, current: event.target.value.replace(/\D/g, '').slice(0, 8) })}
                    placeholder="••••"
                  />
                </Field>
                <Field label="New PIN" hint="4–8 digits">
                  <Input
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    value={pinForm.next}
                    onChange={(event) => setPinForm({ ...pinForm, next: event.target.value.replace(/\D/g, '').slice(0, 8) })}
                    placeholder="••••"
                  />
                </Field>
                <Field label="Confirm new PIN">
                  <Input
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    value={pinForm.confirm}
                    onChange={(event) => setPinForm({ ...pinForm, confirm: event.target.value.replace(/\D/g, '').slice(0, 8) })}
                    placeholder="••••"
                  />
                </Field>
                {pinError ? (
                  <p className="sm:col-span-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">{pinError}</p>
                ) : null}
                <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    <ShieldCheck className="h-3.5 w-3.5" /> Every change is written to the audit trail.
                  </p>
                  <Button type="submit" size="sm" icon={KeyRound} loading={pinBusy}>Change PIN</Button>
                </div>
              </form>
              <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Demo default is <strong>4321</strong>. Change it before using the terminal with real student accounts.</span>
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="p-5">
              <SectionHeader icon={Palette} title="Appearance" description="High-contrast themes for bright canteens and dim back offices." />
              <div className="mt-4 grid grid-cols-2 gap-2">
                <ThemeOption
                  active={theme === 'light'}
                  onClick={() => setTheme('light')}
                  icon={Sun}
                  label="Light"
                  previewClass="bg-slate-100 border-slate-200"
                  barClass="bg-slate-300"
                />
                <ThemeOption
                  active={theme === 'dark'}
                  onClick={() => setTheme('dark')}
                  icon={Moon}
                  label="Dark"
                  previewClass="bg-slate-950 border-slate-700"
                  barClass="bg-slate-700"
                />
              </div>
            </Card>

            <Card className="p-5">
              <SectionHeader icon={Database} title="System status" description="Storage engine and API connectivity." />
              <div className="mt-4 space-y-2">
                <StatusRow icon={Wifi} label="API" value={health?.ok ? 'Connected' : 'Unavailable'} tone={health?.ok ? 'emerald' : 'rose'} />
                <StatusRow icon={DbIcon} label="Database" value={dbLabel} tone="indigo" />
                <StatusRow icon={Terminal} label="Terminal" value={terminal} tone="slate" />
                <StatusRow icon={Monitor} label="API version" value={health?.version || '—'} tone="slate" />
              </div>
              <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 text-[11px] text-slate-500 dark:bg-slate-950/50 dark:text-slate-400">
                <p>School profile: <strong className="text-slate-700 dark:text-slate-200">{remote?.school_name}</strong></p>
                <p className="mt-1">Server time: {health?.time ? dateTime(health.time) : '—'}</p>
                <p className="mt-1 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  Supervisor PIN {remote?.pin_set ? 'configured' : 'using demo default'}
                </p>
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white">
                  <GraduationCap className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">Student Accounts Suite</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Version {health?.version || '0.2.0'} · unified school ledger</p>
                </div>
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                Wallet top-ups, fee invoices, waivers, policy holds, drawer sessions, and audit events all post through one atomic ledger.
              </p>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ icon: Icon, title, description }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</p>
      </div>
    </div>
  );
}

function ThemeOption({ active, onClick, icon: Icon, label, previewClass, barClass }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-xl border p-2 text-left transition',
        active
          ? 'border-indigo-500 ring-2 ring-indigo-500/20'
          : 'border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700'
      )}
    >
      <div className={cn('mb-2 rounded-lg border p-2', previewClass)}>
        <div className={cn('h-2 w-3/4 rounded-full', barClass)} />
        <div className={cn('mt-1.5 h-2 w-1/2 rounded-full', barClass)} />
        <div className="mt-2 flex gap-1">
          <div className="h-3 w-3 rounded bg-indigo-500" />
          <div className="h-3 flex-1 rounded bg-emerald-500/60" />
        </div>
      </div>
      <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
        <Icon className="h-3.5 w-3.5" /> {label}
        {active ? <CheckCircle2 className="ml-auto h-3.5 w-3.5 text-indigo-500" /> : null}
      </span>
    </button>
  );
}

function StatusRow({ icon: Icon, label, value, tone }) {
  const tones = {
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
    rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-300',
    indigo: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300',
    slate: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300',
  };
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
      <span className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
        <span className={cn('flex h-6 w-6 items-center justify-center rounded-md', tones[tone])}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        {label}
      </span>
      <span className="text-xs font-semibold text-slate-900 dark:text-white">{value}</span>
    </div>
  );
}
