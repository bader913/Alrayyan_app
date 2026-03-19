import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, Package,
  Users, UserCheck, BarChart2, Settings, LogOut, ChevronLeft,
  Truck, RotateCcw, Contact, Shield, BadgeCheck, AlertTriangle,
  Receipt, FileText, TrendingUp, Barcode, Tag, QrCode, ArrowLeftRight,
  Bell, PackageX, Clock, Play, Square,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore.ts';
import { authApi, apiClient } from '../api/client.ts';
import { useQuery } from '@tanstack/react-query';
import { settingsApi } from '../api/settings.ts';
import { shiftsApi } from '../api/shifts.ts';
import { useEffect, useState, useRef } from 'react';
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
  { icon: Clock,           label: 'الورديات',     path: '/shifts',         roles: ['admin', 'manager', 'cashier', 'warehouse'],  ready: true },
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

  /* ── Low stock notifications ── */
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const { data: lowStockData } = useQuery({
    queryKey: ['low-stock-notif'],
    queryFn: () => apiClient.get('/products', { params: { low_stock: true, limit: 50 } })
      .then((r) => (r.data as { products: { id: number; name: string; stock_quantity: string; min_stock_level: string; unit: string | null }[] }).products),
    refetchInterval: 60000,
    staleTime: 30000,
  });
  const lowStockItems = lowStockData ?? [];

  /* ── Current shift (all roles) ── */
  const { data: currentShift } = useQuery({
    queryKey: ['current-shift'],
    queryFn: () => shiftsApi.getCurrent().then((r) => r.data.shift),
    refetchInterval: 60000,
    staleTime: 30000,
  });

  /* Close notif dropdown on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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

        {/* ── Top bar: notifications + shift status ── */}
        <div
          className="flex items-center justify-end gap-3 px-5 py-2 flex-shrink-0 border-b"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', minHeight: '44px' }}
        >
          {/* Shift status pill */}
          <NavLink to="/shifts" className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black transition-colors"
            style={currentShift
              ? { background: 'rgba(16,185,129,0.12)', color: '#059669', border: '1px solid rgba(16,185,129,0.3)' }
              : { background: 'var(--bg-muted)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
            {currentShift ? <><Clock size={12} /> وردية مفتوحة</> : <><Play size={12} /> لا توجد وردية</>}
          </NavLink>

          {/* Notifications bell */}
          <div ref={notifRef} className="relative">
            <button
              onClick={() => setNotifOpen((o) => !o)}
              className="relative w-8 h-8 flex items-center justify-center rounded-xl transition-colors"
              style={{ background: notifOpen ? 'var(--bg-muted)' : 'transparent', color: 'var(--text-secondary)' }}
              title="إشعارات المخزون"
            >
              <Bell size={17} />
              {lowStockItems.length > 0 && (
                <span
                  className="absolute -top-0.5 -left-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full text-[9px] font-black text-white px-0.5"
                  style={{ background: '#ef4444' }}
                >
                  {lowStockItems.length > 99 ? '99+' : lowStockItems.length}
                </span>
              )}
            </button>

            {/* Dropdown */}
            {notifOpen && (
              <div
                className="absolute top-full left-0 mt-2 w-80 rounded-2xl shadow-2xl z-50 overflow-hidden"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-2">
                    <PackageX size={15} className="text-orange-500" />
                    <span className="text-sm font-black" style={{ color: 'var(--text-heading)' }}>
                      مخزون منخفض
                    </span>
                  </div>
                  {lowStockItems.length > 0 && (
                    <span className="text-xs font-black px-2 py-0.5 rounded-full text-white" style={{ background: '#ef4444' }}>
                      {lowStockItems.length}
                    </span>
                  )}
                </div>

                {lowStockItems.length === 0 ? (
                  <div className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    ✓ جميع المنتجات مستوى مخزونها كافٍ
                  </div>
                ) : (
                  <div className="max-h-72 overflow-y-auto divide-y" style={{ borderColor: 'var(--border)' }}>
                    {lowStockItems.map((p) => {
                      const qty = parseFloat(p.stock_quantity);
                      const min = parseFloat(p.min_stock_level);
                      const pct = min > 0 ? Math.min(100, (qty / min) * 100) : 0;
                      const isEmpty = qty <= 0;
                      return (
                        <div key={p.id} className="px-4 py-2.5 flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: isEmpty ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)' }}
                          >
                            <PackageX size={14} style={{ color: isEmpty ? '#ef4444' : '#f59e0b' }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                              {p.name}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-muted)' }}>
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{ width: `${pct}%`, background: isEmpty ? '#ef4444' : '#f59e0b' }}
                                />
                              </div>
                              <span className="text-[10px] font-black flex-shrink-0"
                                style={{ color: isEmpty ? '#ef4444' : '#f59e0b' }}>
                                {qty.toLocaleString()} {p.unit ?? ''}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="px-4 py-2 border-t" style={{ borderColor: 'var(--border)' }}>
                  <NavLink
                    to="/products"
                    onClick={() => setNotifOpen(false)}
                    className="block text-center text-xs font-black py-2 rounded-xl transition-colors"
                    style={{ background: 'var(--primary)', color: '#fff' }}
                  >
                    إدارة المخزون
                  </NavLink>
                </div>
              </div>
            )}
          </div>
        </div>

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
