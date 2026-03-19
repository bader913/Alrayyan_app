import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, Package,
  Users, UserCheck, BarChart2, Settings, LogOut, ChevronLeft,
  Truck, RotateCcw, Contact, Shield, BadgeCheck, AlertTriangle,
  Receipt, FileText, TrendingUp, Barcode, Tag, QrCode, ArrowLeftRight,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore.ts';
import { authApi } from '../api/client.ts';
import { useQuery } from '@tanstack/react-query';
import { settingsApi } from '../api/settings.ts';
import { useEffect, useState } from 'react';
import { useLicense } from '../context/LicenseContext.ts';
import { usePosStore } from '../store/posStore.ts';

const ZOOM_STEP = 5;
const ZOOM_MIN  = 70;
const ZOOM_MAX  = 130;

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  roles: string[];
  ready: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { icon: LayoutDashboard, label: 'لوحة التحكم', path: '/dashboard',  roles: ['admin', 'manager', 'cashier', 'warehouse'], ready: true },
  { icon: ShoppingCart,    label: 'نقطة البيع',  path: '/pos',        roles: ['admin', 'manager', 'cashier'],              ready: true },
  { icon: Package,         label: 'المنتجات',    path: '/products',   roles: ['admin', 'manager', 'warehouse'],            ready: true },
  { icon: Truck,           label: 'المشتريات',   path: '/purchases',  roles: ['admin', 'manager', 'warehouse'],            ready: true },
  { icon: RotateCcw,       label: 'المرتجعات',   path: '/returns',    roles: ['admin', 'manager', 'cashier'],              ready: true },
  { icon: Contact,         label: 'الموردون',    path: '/suppliers',  roles: ['admin', 'manager', 'warehouse'],            ready: true },
  { icon: UserCheck,       label: 'العملاء',     path: '/customers',  roles: ['admin', 'manager', 'cashier'],              ready: true },
  { icon: Users,           label: 'المستخدمون',  path: '/users',      roles: ['admin', 'manager'],                         ready: true },
  { icon: BarChart2,       label: 'التقارير',    path: '/reports',    roles: ['admin', 'manager'],                         ready: true },
  { icon: Shield,          label: 'سجل العمليات', path: '/audit-logs',     roles: ['admin', 'manager'],                         ready: true },
  { icon: Receipt,         label: 'المصاريف',     path: '/expenses',       roles: ['admin', 'manager'],                         ready: true },
  { icon: FileText,        label: 'الفواتير',     path: '/invoices',       roles: ['admin', 'manager'],                         ready: true },
  { icon: TrendingUp,      label: 'حاسبة الربح',  path: '/profit-calc',    roles: ['admin', 'manager'],                         ready: true },
  { icon: Barcode,         label: 'الباركود',     path: '/barcodes',       roles: ['admin', 'manager', 'warehouse'],             ready: true },
  { icon: Tag,             label: 'طباعة الأسعار',path: '/price-tags',     roles: ['admin', 'manager', 'warehouse'],             ready: true },
  { icon: QrCode,          label: 'QR كود',       path: '/qr-codes',       roles: ['admin', 'manager', 'cashier', 'warehouse'],  ready: true },
  { icon: ArrowLeftRight,  label: 'محول العملات', path: '/currency-calc',  roles: ['admin', 'manager', 'cashier', 'warehouse'],  ready: true },
  { icon: BadgeCheck,      label: 'الاشتراك',     path: '/subscription',   roles: ['admin', 'manager', 'cashier', 'warehouse'],  ready: true },
  { icon: Settings,        label: 'الإعدادات',    path: '/settings',       roles: ['admin'],                                     ready: true },
];

const ROLE_LABELS: Record<string, string> = {
  admin:     'مدير عام',
  manager:   'مدير',
  cashier:   'كاشير',
  warehouse: 'مخزن',
};

export default function Layout() {
  const { user, refreshToken, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const { isExpired } = useLicense();

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.getAll().then((r) => r.data.settings),
    staleTime: 0,
  });

  useEffect(() => {
    if (!settings) return;
    const color = settings.theme_color || '#059669';
    document.documentElement.style.setProperty('--primary', color);
    if (settings.theme_mode === 'dark') {
      document.documentElement.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
    }
  }, [settings]);

  /* ── Cart nav guard ── */
  const location = useLocation();
  const cartCount = usePosStore((s) => s.cartCount);
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  /* ── Zoom ── */
  const [zoom, setZoom] = useState<number>(() => {
    const saved = localStorage.getItem('ui-zoom');
    return saved ? parseInt(saved, 10) : 100;
  });
  useEffect(() => {
    document.documentElement.style.zoom = `${zoom}%`;
    localStorage.setItem('ui-zoom', String(zoom));
  }, [zoom]);
  const zoomIn    = () => setZoom(z => Math.min(z + ZOOM_STEP, ZOOM_MAX));
  const zoomOut   = () => setZoom(z => Math.max(z - ZOOM_STEP, ZOOM_MIN));
  const zoomReset = () => setZoom(100);

  const primary = 'var(--primary)';

  /* Intercept sidebar nav when POS has items in cart */
  const handleNavClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    targetPath: string,
  ) => {
    if (cartCount > 0 && location.pathname === '/pos' && targetPath !== '/pos') {
      e.preventDefault();
      setPendingPath(targetPath);
    }
  };

  const handleLogout = async () => {
    if (refreshToken) {
      try { await authApi.logout(refreshToken); } catch {}
    }
    clearAuth();
    navigate('/login', { replace: true });
  };

  const visibleItems = NAV_ITEMS.filter((item) =>
    user ? item.roles.includes(user.role) : false
  );

  return (
    <div className="min-h-screen flex" dir="rtl" style={{ background: 'var(--bg-page)' }}>
      {/* Sidebar */}
      <aside
        className="w-64 flex flex-col flex-shrink-0 border-l"
        style={{
          background: 'var(--bg-sidebar)',
          borderColor: 'var(--border)',
          boxShadow: 'var(--shadow-sidebar)',
        }}
      >
        {/* Logo */}
        <div className="p-5 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-lg flex-shrink-0"
              style={{ background: primary }}
            >
              ر
            </div>
            <div>
              <div className="font-black text-sm leading-tight" style={{ color: 'var(--text-heading)' }}>ريان برو</div>
              <div className="text-[10px] font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>Rayyan Pro v1.0.0</div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {visibleItems.map((item) =>
            item.ready ? (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={(e) => handleNavClick(e, item.path)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all group ${
                    isActive ? 'text-white shadow-sm' : ''
                  }`
                }
                style={({ isActive }) =>
                  isActive
                    ? { background: primary }
                    : { color: 'var(--text-secondary)' }
                }
                onMouseEnter={(e) => {
                  const el = e.currentTarget;
                  if (!el.classList.contains('text-white')) {
                    el.style.background = 'var(--bg-muted)';
                    el.style.color = 'var(--text-heading)';
                  }
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget;
                  if (!el.classList.contains('text-white')) {
                    el.style.background = '';
                    el.style.color = 'var(--text-secondary)';
                  }
                }}
              >
                <item.icon size={17} className="flex-shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            ) : (
              <div
                key={item.path}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold cursor-not-allowed select-none"
                style={{ color: 'var(--text-muted)' }}
              >
                <item.icon size={17} className="flex-shrink-0" />
                <span>{item.label}</span>
                <span className="mr-auto text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider"
                  style={{ background: 'var(--bg-muted)', color: 'var(--text-muted)' }}>
                  قريباً
                </span>
              </div>
            )
          )}
        </nav>

        {/* User + Logout */}
        <div className="p-3 border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1.5"
            style={{ background: 'var(--bg-muted)' }}>
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-xs flex-shrink-0"
              style={{ background: primary }}
            >
              {user?.full_name?.[0] || 'م'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-black truncate" style={{ color: 'var(--text-body)' }}>{user?.full_name}</div>
              <div className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                {ROLE_LABELS[user?.role ?? ''] ?? user?.role}
              </div>
            </div>
            <ChevronLeft size={14} style={{ color: 'var(--text-muted)' }} className="flex-shrink-0" />
          </div>
          {/* Zoom Controls */}
          <div
            className="flex items-center justify-between rounded-xl px-3 py-2 mb-1"
            style={{ background: 'var(--bg-muted)' }}
          >
            <button
              onClick={zoomOut}
              disabled={zoom <= ZOOM_MIN}
              title="تصغير"
              className="w-7 h-7 flex items-center justify-center rounded-lg text-base font-black transition-colors disabled:opacity-30"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-card)')}
              onMouseLeave={e => (e.currentTarget.style.background = '')}
            >−</button>

            <button
              onClick={zoomReset}
              title="إعادة تعيين الحجم"
              className="text-xs font-black tabular-nums transition-colors px-1"
              style={{ color: zoom === 100 ? 'var(--text-muted)' : 'var(--primary)' }}
            >
              {zoom}%
            </button>

            <button
              onClick={zoomIn}
              disabled={zoom >= ZOOM_MAX}
              title="تكبير"
              className="w-7 h-7 flex items-center justify-center rounded-lg text-base font-black transition-colors disabled:opacity-30"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-card)')}
              onMouseLeave={e => (e.currentTarget.style.background = '')}
            >+</button>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold text-rose-500 hover:bg-rose-50 transition-colors"
          >
            <LogOut size={15} />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-auto flex flex-col">
        {/* Read-only banner when license expired */}
        {isExpired && (
          <div
            className="flex items-center gap-3 px-5 py-2.5 text-sm font-bold flex-shrink-0"
            style={{ background: '#7f1d1d', color: '#fecaca' }}
          >
            <AlertTriangle size={16} className="flex-shrink-0 text-red-300" />
            <span className="flex-1">
              انتهت صلاحية الترخيص — <strong className="text-white">وضع القراءة فقط</strong>، لا يمكن إضافة أو تعديل أو حذف أي بيانات
            </span>
            <NavLink
              to="/subscription"
              className="px-3 py-1 rounded-lg text-xs font-black text-white border border-red-400 hover:bg-red-800 transition-colors flex-shrink-0"
            >
              تجديد الاشتراك
            </NavLink>
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-auto">
          <Outlet />
        </div>
      </main>

      {/* ─── Cart Guard Dialog ───────────────────────────────────────────────── */}
      {pendingPath && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.55)' }}
        >
          <div
            className="w-[340px] rounded-2xl shadow-2xl p-6 flex flex-col gap-4"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <div className="flex flex-col items-center gap-3 text-center">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(239,68,68,0.12)' }}
              >
                <AlertTriangle size={28} className="text-red-500" />
              </div>
              <h2 className="text-base font-black" style={{ color: 'var(--text-primary)' }}>
                السلة تحتوي على منتجات
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                لديك{' '}
                <span className="font-black text-red-500">{cartCount}</span>
                {' '}منتج في السلة.
                <br />
                إذا غادرت الآن ستُمسح السلة بالكامل.
                <br />
                هل أنت متأكد؟
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  const path = pendingPath;
                  setPendingPath(null);
                  navigate(path);
                }}
                className="flex-1 py-2.5 rounded-xl text-sm font-black text-white transition-opacity hover:opacity-90"
                style={{ background: '#ef4444' }}
              >
                نعم، امسح وانتقل
              </button>
              <button
                onClick={() => setPendingPath(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-black transition-colors"
                style={{
                  background: 'var(--bg-muted)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
