const BASE = import.meta.env.VITE_API || '/api';

export class ApiError extends Error {
  constructor(message, { code = 'ERROR', details, status } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

async function request(path, { method = 'GET', body, signal } = {}) {
  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      signal,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    const network = new ApiError('Network unavailable', { code: 'NETWORK' });
    network.isNetwork = true;
    throw network;
  }
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json().catch(() => ({})) : null;
  if (!response.ok) {
    throw new ApiError(payload?.error || response.statusText || 'Request failed', {
      code: payload?.code,
      details: payload?.details || (payload?.issues ? { issues: payload.issues } : undefined),
      status: response.status,
    });
  }
  return payload;
}

const qs = (params = {}) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, value);
  }
  const value = search.toString();
  return value ? `?${value}` : '';
};

export const api = {
  health: () => request('/health'),
  settings: {
    get: () => request('/settings'),
    update: (body) => request('/settings', { method: 'PATCH', body }),
  },
  students: {
    list: (q = '') => request(`/students${qs({ q })}`),
    get: (id) => request(`/students/${encodeURIComponent(id)}`),
    profile: (lookup) => request(`/students/${encodeURIComponent(lookup)}/profile`),
    create: (body) => request('/students', { method: 'POST', body }),
    controls: (id, body) => request(`/students/${id}/controls`, { method: 'PATCH', body }),
    topup: (id, body) => request(`/students/${id}/topup`, { method: 'POST', body }),
    statementUrl: (id) => `${BASE}/students/${encodeURIComponent(id)}/statement.pdf`,
  },
  products: {
    list: (params) => request(`/products${qs(params)}`),
    categories: () => request('/products/categories'),
    create: (body) => request('/products', { method: 'POST', body }),
  },
  pos: {
    checkout: (body) => request('/pos/checkout', { method: 'POST', body }),
    sync: (transactions) => request('/pos/sync', { method: 'POST', body: { transactions } }),
    transaction: (id) => request(`/pos/transactions/${id}`),
    receiptUrl: (id) => `${BASE}/pos/transactions/${id}/receipt.pdf`,
  },
  fees: {
    list: (params) => request(`/fees${qs(params)}`),
    get: (id) => request(`/fees/${id}`),
    create: (body) => request('/fees', { method: 'POST', body }),
    pay: (id, body) => request(`/fees/${id}/pay`, { method: 'POST', body }),
  },
  reports: {
    overview: () => request('/reports/overview'),
    revenue: (range = 'today') => request(`/reports/revenue${qs({ range })}`),
    logs: (params) => request(`/reports/logs${qs(params)}`),
    audit: () => request('/reports/audit'),
  },
  drawer: {
    current: (terminal) => request(`/drawer/current${qs({ terminal })}`),
    open: (body) => request('/drawer/open', { method: 'POST', body }),
    close: (body) => request('/drawer/close', { method: 'POST', body }),
    sessions: () => request('/drawer/sessions'),
    get: (id) => request(`/drawer/${id}`),
    zReportUrl: (id) => `${BASE}/drawer/${id}/z-report.pdf`,
  },
};
