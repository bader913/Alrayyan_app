import React, { useEffect, useState, useCallback } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Lock, RefreshCw } from 'lucide-react';
import { useAuthStore } from './store/authStore.ts';
import { LicenseContext } from './context/LicenseContext.ts';
import { licenseApi } from './api/license.ts';
import Layout from './components/Layout.tsx';
import LoginPage from './pages/LoginPage.tsx';
import LicensePage from './pages/LicensePage.tsx';
import DashboardPage from './pages/DashboardPage.tsx';
import UsersPage from './pages/UsersPage.tsx';
import ProductsPage from './pages/ProductsPage.tsx';
import POSPage from './pages/POSPage.tsx';
import PurchasesPage from './pages/PurchasesPage.tsx';
import ReturnsPage from './pages/ReturnsPage.tsx';
import SuppliersPage from './pages/SuppliersPage.tsx';
import CustomersPage from './pages/CustomersPage.tsx';
import ReportsPage from './pages/ReportsPage.tsx';
import AuditLogPage from './pages/AuditLogPage.tsx';
import SettingsPage from './pages/SettingsPage.tsx';
import SubscriptionPage from './pages/SubscriptionPage.tsx';
import ExpensesPage      from './pages/ExpensesPage.tsx';
import InvoicesPage      from './pages/InvoicesPage.tsx';
import ProfitCalcPage    from './pages/ProfitCalcPage.tsx';
import BarcodePage       from './pages/BarcodePage.tsx';
import PriceTagsPage     from './pages/PriceTagsPage.tsx';
import QrCodePage        from './pages/QrCodePage.tsx';
import CurrencyCalcPage  from './pages/CurrencyCalcPage.tsx';

// ── Global toast for write-blocked actions ────────────────────────────────────
function LicenseBlockToast() {
  const [msg, setMsg] = useState<string | null>(null);

  const show = useCallback((e: Event) => {
    setMsg((e as CustomEvent).detail ?? 'غير مسموح في وضع القراءة فقط');
    setTimeout(() => setMsg(null), 4000);
  }, []);

  useEffect(() => {
    window.addEventListener('license:expired-write', show);
    window.addEventListener('license:required',      show);
    return () => {
      window.removeEventListener('license:expired-write', show);
      window.removeEventListener('license:required',      show);
    };
  }, [show]);

  if (!msg) return null;
  return (
    <div
      dir="rtl"
      style={{
        position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 9999,
        background: '#7f1d1d', color: '#fecaca',
        padding: '0.75rem 1.25rem',
        borderRadius: '0.75rem',
        boxShadow: '0 4px 24px rgba(0,0,0,.4)',
        display: 'flex', alignItems: 'center', gap: '0.6rem',
        fontWeight: 700, fontSize: '0.875rem',
        maxWidth: '420px',
      }}
    >
      <Lock size={16} style={{ flexShrink: 0, color: '#fca5a5' }} />
      {msg}
    </div>
  );
}

// ── License Guard ─────────────────────────────────────────────────────────────
function LicenseGuard({ children }: { children: React.ReactNode }) {
  const [checking,  setChecking]  = useState(true);
  const [licensed,  setLicensed]  = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    licenseApi.getStatus()
      .then((res) => {
        const { active, expired } = res.data;
        setLicensed(active || !!expired);   // expired → show app in read-only
        setIsExpired(!!expired && !active);
      })
      .catch(() => { setLicensed(false); setIsExpired(false); })
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4"
        style={{ background: 'var(--bg-page)' }}>
        <RefreshCw className="animate-spin w-10 h-10 text-emerald-500" />
        <p style={{ color: 'var(--text-secondary)' }}>جاري التحقق من الترخيص...</p>
      </div>
    );
  }

  // No license at all → activation page
  if (!licensed) return <LicensePage />;

  // Active or expired → render app (expired shows read-only banner via context)
  return (
    <LicenseContext.Provider value={{ isExpired }}>
      <LicenseBlockToast />
      {children}
    </LicenseContext.Provider>
  );
}

// ── Auth Guards ───────────────────────────────────────────────────────────────
function RequireAuth() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function RequireGuest() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

function RequireRole({ roles }: { roles: string[] }) {
  const user = useAuthStore((s) => s.user);
  if (!user || !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <LicenseGuard>
      <Routes>
        {/* License page — always accessible */}
        <Route path="/license" element={<LicensePage />} />

        {/* Guest-only */}
        <Route element={<RequireGuest />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        {/* Authenticated — wrapped in Layout */}
        <Route element={<RequireAuth />}>
          <Route element={<Layout />}>

            <Route path="/dashboard" element={<DashboardPage />} />

            <Route element={<RequireRole roles={['admin', 'manager']} />}>
              <Route path="/users" element={<UsersPage />} />
            </Route>

            <Route element={<RequireRole roles={['admin', 'manager', 'warehouse']} />}>
              <Route path="/products" element={<ProductsPage />} />
            </Route>

            <Route element={<RequireRole roles={['admin', 'manager', 'cashier']} />}>
              <Route path="/pos" element={<POSPage />} />
            </Route>

            <Route element={<RequireRole roles={['admin', 'manager', 'warehouse']} />}>
              <Route path="/purchases" element={<PurchasesPage />} />
            </Route>

            <Route element={<RequireRole roles={['admin', 'manager', 'cashier']} />}>
              <Route path="/returns" element={<ReturnsPage />} />
            </Route>

            <Route element={<RequireRole roles={['admin', 'manager', 'warehouse']} />}>
              <Route path="/suppliers" element={<SuppliersPage />} />
            </Route>

            <Route element={<RequireRole roles={['admin', 'manager', 'cashier']} />}>
              <Route path="/customers" element={<CustomersPage />} />
            </Route>

            <Route element={<RequireRole roles={['admin', 'manager']} />}>
              <Route path="/reports" element={<ReportsPage />} />
            </Route>

            <Route element={<RequireRole roles={['admin', 'manager']} />}>
              <Route path="/audit-logs" element={<AuditLogPage />} />
            </Route>

            {/* Subscription — All roles */}
            <Route path="/subscription" element={<SubscriptionPage />} />

            {/* Settings — Admin only */}
            <Route element={<RequireRole roles={['admin']} />}>
              <Route path="/settings" element={<SettingsPage />} />
            </Route>

            {/* Tools — admin + manager only */}
            <Route element={<RequireRole roles={['admin', 'manager']} />}>
              <Route path="/expenses"   element={<ExpensesPage />} />
              <Route path="/invoices"   element={<InvoicesPage />} />
              <Route path="/profit-calc" element={<ProfitCalcPage />} />
            </Route>

            {/* Tools — admin + manager + warehouse */}
            <Route element={<RequireRole roles={['admin', 'manager', 'warehouse']} />}>
              <Route path="/barcodes"   element={<BarcodePage />} />
              <Route path="/price-tags" element={<PriceTagsPage />} />
            </Route>

            {/* Tools — all roles */}
            <Route path="/qr-codes"       element={<QrCodePage />} />
            <Route path="/currency-calc"  element={<CurrencyCalcPage />} />

          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </LicenseGuard>
  );
}
