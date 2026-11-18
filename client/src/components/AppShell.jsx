import React, { useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Cloud,
  GraduationCap,
  HardDrive,
  LayoutDashboard,
  ReceiptText,
  Settings,
  Sun,
  Moon,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { api } from '../lib/api';
import { useOnline } from '../hooks/useOnline';
import { useStore } from '../store/store';
import { Avatar, Badge, cn } from './ui';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/students', label: 'Students', icon: Users },
  { to: '/fees', label: 'Fees & Billing', icon: ReceiptText },
  { to: '/reports', label: 'Reports & Z', icon: BarChart3 },
];

const pageTitles = [
  ['/students', 'Student Directory'],
  ['/fees', 'Fees & Billing'],
  ['/reports', 'Reports & Reconciliation'],
  ['/settings', 'Settings'],
  ['/', 'Overview'],
];

export default function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const cashier = useStore((s) => s.cashier);
  const terminal = useStore((s) => s.terminal);
  const online = useOnline();

  useEffect(() => {
    api
      .health()
      .then((health) => setSettings({ ...settings, school_name: health.school_name, db: health.db }))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pageTitle = pageTitles.find(([path]) => (path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)))?.[1] || 'Overview';
  const dbLabel = settings.db === 'pg' ? 'PostgreSQL' : 'SQLite';
  const DbIcon = settings.db === 'pg' ? Cloud : HardDrive;

  return (
    <div className="min-h-screen lg:flex">
      <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:sticky lg:top-0 lg:flex">
        <div className="flex items-center gap-3 px-5 py-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/25">
            <GraduationCap className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-tight text-slate-900 dark:text-white">{settings.school_name || 'Northfield Academy'}</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Student accounts</p>
          </div>
        </div>

        <div className="px-3">
          <p className="px-2 pb-2 pt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Workspace</p>
          <nav className="space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
                  )
                }
              >
                <item.icon className="h-[18px] w-[18px]" />
                <span className="flex-1">{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="mt-auto space-y-3 p-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/50">
            <div className="flex items-center justify-between text-[11px] font-semibold">
              <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                <DbIcon className="h-3.5 w-3.5" /> {dbLabel}
              </span>
              <span className={cn('flex items-center gap-1', online ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500')}>
                {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                {online ? 'Online' : 'Offline'}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>Register</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">{terminal}</span>
            </div>
          </div>

          <NavLink
            to="/settings"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl border p-2.5 transition',
                isActive
                  ? 'border-indigo-200 bg-indigo-50 dark:border-indigo-500/30 dark:bg-indigo-500/10'
                  : 'border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60'
              )
            }
          >
            <Avatar name={cashier} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-slate-900 dark:text-white">{cashier}</p>
              <p className="truncate text-[10px] text-slate-500 dark:text-slate-400">Settings & profile</p>
            </div>
            <Settings className="h-4 w-4 text-slate-400" />
          </NavLink>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-slate-200 px-4 dark:border-slate-800 sm:px-6 lg:px-8">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white lg:hidden">
            <GraduationCap className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold tracking-tight text-slate-900 dark:text-white sm:text-lg">{pageTitle}</h1>
            <p className="hidden text-[11px] text-slate-500 dark:text-slate-400 sm:block">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Badge tone={online ? 'emerald' : 'rose'} dot className="hidden sm:inline-flex">
              {online ? 'Live' : 'Offline'}
            </Badge>
            <Badge tone="slate" className="hidden md:inline-flex">
              <DbIcon className="h-3 w-3" /> {dbLabel}
            </Badge>
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button type="button" onClick={() => navigate('/settings')} className="rounded-full ring-2 ring-transparent transition hover:ring-indigo-500/40">
              <Avatar name={cashier} size="sm" />
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 pb-24 pt-5 sm:px-6 lg:px-8 lg:pb-10 lg:pt-7">
          <Outlet />
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white/95 px-2 py-1.5 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/95 lg:hidden">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[10px] font-semibold transition',
                isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'
              )
            }
          >
            <item.icon className="h-5 w-5" />
            {item.label.split(' ')[0]}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
