import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from './store/authStore.ts';
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
import { licenseApi } from './api/license.ts';
import { RefreshCw } from 'lucide-react';

// ============ License Guard ============

function LicenseGuard({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [licensed, setLicensed] = useState(false);

  useEffect(() => {
    licenseApi.getStatus()
      .then((res) => setLicensed(res.data.active))
      .catch(() => setLicensed(false))
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

  if (!licensed) return <LicensePage />;

  return <>{children}</>;
}

// ============ Auth Guards ============

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

// ============ App ============

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

            {/* All authenticated roles */}
            <Route path="/dashboard" element={<DashboardPage />} />

            {/* Admin + Manager only */}
            <Route element={<RequireRole roles={['admin', 'manager']} />}>
              <Route path="/users" element={<UsersPage />} />
            </Route>

            {/* Admin + Manager + Warehouse */}
            <Route element={<RequireRole roles={['admin', 'manager', 'warehouse']} />}>
              <Route path="/products" element={<ProductsPage />} />
            </Route>

            {/* POS — Admin + Manager + Cashier */}
            <Route element={<RequireRole roles={['admin', 'manager', 'cashier']} />}>
              <Route path="/pos" element={<POSPage />} />
            </Route>

            {/* Purchases — Admin + Manager + Warehouse */}
            <Route element={<RequireRole roles={['admin', 'manager', 'warehouse']} />}>
              <Route path="/purchases" element={<PurchasesPage />} />
            </Route>

            {/* Returns — Admin + Manager + Cashier */}
            <Route element={<RequireRole roles={['admin', 'manager', 'cashier']} />}>
              <Route path="/returns" element={<ReturnsPage />} />
            </Route>

            {/* Suppliers — Admin + Manager + Warehouse */}
            <Route element={<RequireRole roles={['admin', 'manager', 'warehouse']} />}>
              <Route path="/suppliers" element={<SuppliersPage />} />
            </Route>

            {/* Customers — Admin + Manager + Cashier */}
            <Route element={<RequireRole roles={['admin', 'manager', 'cashier']} />}>
              <Route path="/customers" element={<CustomersPage />} />
            </Route>

            {/* Reports — Admin + Manager */}
            <Route element={<RequireRole roles={['admin', 'manager']} />}>
              <Route path="/reports" element={<ReportsPage />} />
            </Route>

            {/* Audit Log — Admin + Manager */}
            <Route element={<RequireRole roles={['admin', 'manager']} />}>
              <Route path="/audit-logs" element={<AuditLogPage />} />
            </Route>

            {/* Subscription — All roles */}
            <Route path="/subscription" element={<SubscriptionPage />} />

            {/* Settings — Admin only */}
            <Route element={<RequireRole roles={['admin']} />}>
              <Route path="/settings" element={<SettingsPage />} />
            </Route>

          </Route>
        </Route>

        {/* Fallback */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </LicenseGuard>
  );
}
