# Workspace: Two Systems

## System 1 — AlRayyan (نظام الريان) — READ ONLY

An Arabic-language integrated management system for supermarkets and pharmacies with full RTL support.

**DO NOT MODIFY Alrayyan_app/ — Reference Only**

### Architecture
- **Frontend**: React 19 + Vite (port 5000) with Tailwind CSS v4, Framer Motion, React Router DOM v7
- **Backend**: Express.js + TypeScript server (port 3131) with SQLite databases
- **Workflow**: `Start application` — `cd Alrayyan_app && npx concurrently "npx tsx server.ts" "npx vite --port 5000 --host 0.0.0.0"`

### Key Features
- POS with dual currency support (USD/SYP/TRY/SAR/AED)
- Inventory (weighted/fractional products), barcode/QR generator
- Customer & supplier management, purchases, expenses
- Licensing system with device fingerprinting, AI via Gemini

### Structure
```
Alrayyan_app/
├── server.ts           # Express backend (port 3131)
├── vite.config.ts      # Vite config (port 5000, proxies /api → :3131)
├── src/                # React frontend source
│   ├── components/     # Feature components (POS, Dashboard, etc.)
│   └── types.ts        # TypeScript interfaces
├── supermarket.db      # Main SQLite database
└── auth.db             # Auth/licensing database
```

---

## System 2 — Rayyan Pro — ACTIVE DEVELOPMENT

A new professional system built from scratch with PostgreSQL, proper auth, audit logs, and multi-terminal POS.

### Architecture
- **Frontend**: React 19 + TypeScript + Vite (port 3000) + Tailwind v4 + TanStack Query + Zustand
- **Backend**: Fastify + TypeScript (port 3200) + PostgreSQL
- **Auth**: JWT access token (15min) + refresh token (7 days, stored in user_sessions table)
- **Concurrency**: SELECT FOR UPDATE inside withTransaction()
- **Workflow**: `Rayyan Pro` — `cd rayyan-pro && npm run dev`

### Stack
| Layer | Tech |
|---|---|
| Server | Fastify 5, TypeScript, tsx watch |
| Client | React 19, Vite 6, Tailwind v4, Zustand, TanStack Query |
| DB | PostgreSQL (via DATABASE_URL env var) |
| Auth | @fastify/jwt + bcryptjs + crypto refresh tokens |
| Validation | Zod |

### Default Credentials (seed)
- `admin` / `admin123` — المدير العام
- `cashier1` / `cashier123` — موظف كاشير
- `warehouse1` / `warehouse123` — موظف مخزن

### Structure
```
rayyan-pro/
├── package.json            # Root: concurrently dev runner
├── migrations/
│   ├── 001_initial_schema.sql  # Full PostgreSQL schema
│   └── 002_stock_movements.sql # حركات المخزون (14 حقل، 4 indexes)
├── server/
│   ├── package.json        # Fastify dependencies + dotenv
│   └── src/
│       ├── index.ts        # Entry: imports dotenv, starts Fastify
│       ├── app.ts          # Fastify app builder, auth decorator
│       ├── shared/
│       │   ├── db/
│       │   │   ├── pool.ts     # PostgreSQL pool, dbGet/dbAll/dbRun/withTransaction
│       │   │   ├── migrate.ts  # Migration runner
│       │   │   └── seed.ts     # Seed: users, categories, terminals, settings
│       │   ├── middleware/
│       │   │   └── errorHandler.ts
│       │   └── utils/
│       │       └── invoiceNumber.ts  # INV-YEAR-000001 format
│       └── modules/
│           ├── auth/
│           │   ├── auth.router.ts   # POST /api/auth/login, /refresh, /logout, GET /me
│           │   └── auth.service.ts  # Login, refreshToken, logout + TODO: httpOnly cookie
│           └── users/
│               ├── users.router.ts  # GET/POST /api/users, PUT/PATCH /:id
│               └── users.service.ts # CRUD + toggleActive + changePassword
└── client/
    ├── package.json        # React + Vite dependencies
    ├── vite.config.ts      # Port 3000, proxy /api → :3200, allowedHosts: all
    ├── index.html          # RTL, lang=ar
    └── src/
        ├── main.tsx        # QueryClient + BrowserRouter + StrictMode
        ├── App.tsx         # Routes: /login, /dashboard, / → /dashboard
        ├── index.css       # Tailwind v4 + RTL defaults
        ├── api/
        │   └── client.ts   # Axios instance + JWT interceptor + auto-refresh
        ├── store/
        │   └── authStore.ts  # Zustand: user, accessToken, refreshToken (persisted)
        ├── components/
        │   └── Layout.tsx         # Shared sidebar + Outlet (NavLink active states)
        └── pages/
            ├── LoginPage.tsx      # Arabic login form
            ├── DashboardPage.tsx  # Phase roadmap cards (no sidebar — uses Layout)
            └── UsersPage.tsx      # Users table + Create/Edit/Password modals
```

### Invoice Sequences
| Prefix | Usage |
|---|---|
| INV | Sales invoices |
| RET | Return invoices |
| PUR | Purchase invoices |

### Phase Roadmap
| Phase | Module | Status |
|---|---|---|
| 0 | Infrastructure + Auth foundation | **DONE** |
| 1 | Users + Roles + Permissions | **DONE** |
| 2 | Products, Categories, Suppliers, Stock | **DONE** |
| 3 | POS & Sales | Pending |
| 4 | Purchases & Returns | Pending |
| 5 | Accounts & Receivables | Pending |
| 6 | Reports & Dashboard | Pending |
| 7 | Audit Log & Settings | Pending |
| 8 | Polish & Performance | Pending |

### Running Commands
```bash
# Dev (both server + client)
cd rayyan-pro && npm run dev

# Database
cd rayyan-pro && npm run migrate
cd rayyan-pro && npm run seed

# Server only
cd rayyan-pro/server && npm run dev

# Client only
cd rayyan-pro/client && npm run dev
```

### Environment Variables
- `DATABASE_URL` — PostgreSQL connection string (provisioned by Replit)
- `JWT_ACCESS_SECRET` — JWT signing secret (set in env secrets)
- `JWT_ACCESS_EXPIRES_IN` — Token expiry (default: 15m)
- `PORT` — Server port (default: 3200)
