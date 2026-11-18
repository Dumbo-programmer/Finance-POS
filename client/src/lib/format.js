export const money = (cents, { sign = false } = {}) => {
  const value = Number(cents || 0) / 100;
  const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(value));
  if (value < 0) return `-${formatted}`;
  return sign && value > 0 ? `+${formatted}` : formatted;
};

export const moneyShort = (cents) => {
  const value = Number(cents || 0) / 100;
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
};

export const dollarsToCents = (value) => Math.round(Number(value || 0) * 100);
export const centsToDollars = (cents) => (Number(cents || 0) / 100).toFixed(2);

export const dateTime = (iso) =>
  iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';

export const dateOnly = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

export const timeOnly = (iso) =>
  iso ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—';

export const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';

export const titleCase = (value = '') =>
  String(value)
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

export const percent = (value, total) => {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
};
