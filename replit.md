# AlRayyan - نظام إدارة سوبر ماركت وصيدلية

An Arabic-language integrated management system for supermarkets and pharmacies with full RTL support.

## Architecture

- **Frontend**: React 19 + Vite (port 5000) with Tailwind CSS v4, Framer Motion, React Router DOM v7
- **Backend**: Express.js + TypeScript server (port 3131) with SQLite databases
- **Runtime**: Node.js 20

## Key Features
- POS (Point of Sale) with dual currency support
- Inventory management (including weighted/fractional products)
- Purchases, expenses, invoices, and financial reports
- Customer and supplier management
- Barcode/QR generator, price label printing
- Licensing system with device fingerprinting
- AI integration via Google Gemini API

## Project Structure

```
Alrayyan_app/
├── server.ts           # Express backend (port 3131)
├── vite.config.ts      # Vite config (port 5000, proxies /api to :3131)
├── electron-main.cjs   # Electron entry (for desktop builds)
├── src/                # React frontend source
│   ├── App.tsx         # Main app with routing and auth
│   ├── components/     # Feature components (POS, Dashboard, etc.)
│   ├── lib/            # Utilities
│   └── types.ts        # TypeScript interfaces
├── supermarket.db      # Main SQLite database
├── auth.db             # Auth/licensing database
└── license.dat         # License file
```

## Running the Project

The "Start application" workflow runs both services concurrently:
```
cd Alrayyan_app && npx concurrently "npx tsx server.ts" "npx vite --port 5000 --host 0.0.0.0"
```

## Configuration Notes

- Vite proxies `/api/*` requests to `http://localhost:3131`
- Frontend uses relative `/api/` paths throughout
- Backend listens on `localhost:3131`
- `better-sqlite3` native module — install with `--ignore-scripts` to avoid electron-builder postinstall issues
