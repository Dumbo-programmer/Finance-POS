import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useStore = create(
  persist(
    (set, get) => ({
      theme: 'dark',
      cashier: 'Jordan Lee',
      terminal: 'Accounts',
      settings: { school_name: 'Northfield Academy', db: 'sqlite' },

      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set({ theme: get().theme === 'dark' ? 'light' : 'dark' }),
      setCashier: (cashier) => set({ cashier }),
      setTerminal: (terminal) => set({ terminal }),
      setSettings: (settings) => set({ settings }),
    }),
    {
      name: 'sms-admin-ui-v3',
      partialize: (state) => ({
        theme: state.theme,
        cashier: state.cashier,
        terminal: state.terminal,
        settings: state.settings,
      }),
    }
  )
);
