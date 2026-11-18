import React, { useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useStore } from './store/store';
import AppShell from './components/AppShell';
import Dashboard from './views/Dashboard';
import Students from './views/Students';
import Profile from './views/Profile';
import Fees from './views/Fees';
import Reports from './views/Reports';
import Settings from './views/Settings';

function NotFound() {
  return (
    <div className="card mx-auto max-w-lg p-10 text-center">
      <p className="text-5xl font-black text-indigo-500">404</p>
      <h1 className="mt-3 text-xl font-bold text-slate-900 dark:text-white">Page not found</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Use the navigation to return to the workspace.</p>
    </div>
  );
}

export default function App() {
  const theme = useStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;
  }, [theme]);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="students" element={<Students />} />
          <Route path="students/:id" element={<Profile />} />
          <Route path="fees" element={<Fees />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      <Toaster
        position="top-right"
        gutter={10}
        toastOptions={{
          duration: 3800,
          style: {
            background: '#0f172a',
            color: '#f8fafc',
            border: '1px solid rgba(148,163,184,0.22)',
            borderRadius: '12px',
            fontSize: '13px',
            fontWeight: 500,
            boxShadow: '0 18px 40px -20px rgba(0,0,0,0.6)',
          },
          success: { iconTheme: { primary: '#10b981', secondary: '#0f172a' } },
          error: { iconTheme: { primary: '#f43f5e', secondary: '#0f172a' }, duration: 5000 },
        }}
      />
    </BrowserRouter>
  );
}
