# Student Accounts Suite

A production-style school administration platform: unified student wallets, an immutable ledger, fee billing, policy controls, and cash-drawer reconciliation. POS checkout APIs remain available for compatibility, but the web UI is administration-focused.

## Highlights

- **Unified ledger**: wallet top-ups, fee invoices, payments, waivers, retail entries, and adjustments post atomically with immutable balance snapshots.
- **Wallet + split tenders**: wallet, cash, card, and transfer are supported by the API for top-ups and fee payments.
- **Policy engine**: restricted items/categories and daily spending caps, with supervisor PIN override and full audit logging.
- **Automatic hold clearance**: holds linked to a fee are cleared when the invoice is fully paid or waived.
- **Reports & Z-reports**: revenue analytics, ledger/audit logs, and cash-drawer open/close reconciliation with printable PDFs.
- **Dual storage**: local SQLite (`better-sqlite3`) or PostgreSQL (`pg`).
- **Modern UI**: Tailwind CSS, Lucide icons, Recharts, light/dark themes, toasts, skeletons, and optimistic interactions.

## Architecture

```text
server/
  src/config.js          env-driven configuration
  src/db/                schema v2, migrations/seeds, SQLite + PG adapters
  src/models/            students, products, transactions, fees, reports, drawer
  src/services/          ledger, policy, PDF, receipt numbers
  src/routes/            REST endpoints
client/
  src/components/        AppShell, design system, receipt modal
  src/views/             Dashboard, Students, Profile, Fees, Reports, Settings
  src/hooks/             online status, debounce
  src/store/             Zustand preferences store
  src/lib/               API client, formatting
```

All monetary values are stored as integer cents (`*_cents`) in the database and API payloads.

## Run locally

```bash
npm install
cp server/.env.example server/.env   # optional; SQLite is the default
npm run dev
```

- Web: http://localhost:5173
- API: http://localhost:4000/api/health

Build the client and serve the production bundle from the API:

```bash
npm run build
npm start
```

## Environment (`server/.env`)

```env
PORT=4000
DB_CLIENT=sqlite          # sqlite | pg
DATABASE_URL=             # required when DB_CLIENT=pg
SQLITE_PATH=./data/local.db
CORS_ORIGIN=http://localhost:5173
SCHOOL_NAME=Northfield Academy
```

SQLite is zero-setup. The app creates `server/data/local.db` and seeds demo data on first start. A legacy baseline database is detected and reset automatically because schema v2 renamed monetary columns.

## Demo data

| Student | ID | Card | Wallet | Notes |
| --- | --- | --- | --- | --- |
| Alex Mensah | S-1001 | RFID-1001 | $125.00 | Blocked from Energy Drinks; tuition invoice with exam hold |
| Maya Chen | S-1002 | RFID-1002 | $48.00 | Blocked from Snacks; lab fee |
| Noah Okafor | S-1003 | RFID-1003 | $3.00 | Transport invoice with library hold |

Default supervisor override PIN: **4321** (change it in Settings).

## API surface

| Group | Endpoints |
| --- | --- |
| Health | `GET /api/health` |
| Students | `GET/POST /api/students`, `GET /api/students/:id`, `GET /api/students/:lookup/profile`, `PATCH /api/students/:id/controls`, `POST /api/students/:id/topup`, `GET /api/students/:id/statement.pdf` |
| Products | `GET/POST /api/products`, `GET /api/products/categories` |
| POS | `POST /api/pos/checkout`, `POST /api/pos/sync`, `GET /api/pos/transactions/:id`, `GET /api/pos/transactions/:id/receipt.pdf` |
| Fees | `GET/POST /api/fees`, `GET /api/fees/:id`, `POST /api/fees/:id/pay` |
| Reports | `GET /api/reports/overview`, `GET /api/reports/revenue?range=today\|7d\|30d\|90d`, `GET /api/reports/logs`, `GET /api/reports/audit` |
| Drawer | `GET /api/drawer/current?terminal=…`, `POST /api/drawer/open`, `POST /api/drawer/close`, `GET /api/drawer/sessions`, `GET /api/drawer/:id`, `GET /api/drawer/:id/z-report.pdf` |
| Settings | `GET/PATCH /api/settings` |

Checkout tenders must sum exactly to the server-computed total; wallet tenders cannot exceed the student wallet balance. Overrides require a valid supervisor PIN and are written to the audit trail.

## Data integrity notes

- SQLite writes run through a serialized async mutex with `BEGIN IMMEDIATE`.
- PostgreSQL uses dedicated clients, `BEGIN`/`COMMIT`, and row locks (`FOR UPDATE`) for student/fee updates.
- Ledger entries are append-only and store `balance_after_cents`; drawer close and override events also produce audit records.
- Cash drawer expected cash = opening float + cash payments recorded on that terminal, including cash top-ups and cash fee payments.

## Scripts

```bash
npm run dev          # API + Vite dev server
npm run dev:server   # API only
npm run dev:client   # Vite only
npm run build        # production client bundle
npm start            # production API/server
```
