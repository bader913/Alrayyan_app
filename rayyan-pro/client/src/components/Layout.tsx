import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, Package,
  Users, UserCheck, BarChart2, Settings, LogOut, ChevronLeft,
  Truck, RotateCcw, Contact, Shield, BadgeCheck,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore.ts';
import { authApi } from '../api/client.ts';
import { useQuery } from '@tanstack/react-query';
import { settingsApi } from '../api/settings.ts';
import { useEffect } from 'react';

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
  { icon: Shield,          label: 'سجل العمليات',path: '/audit-logs',     roles: ['admin', 'manager'],                         ready: true },
  { icon: BadgeCheck,      label: 'الاشتراك',    path: '/subscription',   roles: ['admin', 'manager', 'cashier', 'warehouse'], ready: true },
  { icon: Settings,        label: 'الإعدادات',   path: '/settings',       roles: ['admin'],                                    ready: true },
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

  const primary = 'var(--primary)';

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
      <main className="flex-1 min-w-0 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
