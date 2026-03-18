import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, Package,
  Users, BarChart2, Settings, LogOut, ChevronLeft,
  Truck, RotateCcw,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore.ts';
import { authApi } from '../api/client.ts';

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
  { icon: Users,           label: 'المستخدمون',  path: '/users',      roles: ['admin', 'manager'],                         ready: true },
  { icon: BarChart2,       label: 'التقارير',    path: '/reports',    roles: ['admin', 'manager'],                         ready: false },
  { icon: Settings,        label: 'الإعدادات',   path: '/settings',   roles: ['admin'],                                    ready: false },
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
    <div className="min-h-screen flex" dir="rtl" style={{ background: '#f1f5f9' }}>
      {/* Sidebar */}
      <aside
        className="w-64 flex flex-col flex-shrink-0 border-l"
        style={{ background: '#fff', borderColor: '#e2e8f0', boxShadow: '2px 0 8px rgba(0,0,0,0.04)' }}
      >
        {/* Logo */}
        <div className="p-5 border-b" style={{ borderColor: '#e2e8f0' }}>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-lg flex-shrink-0"
              style={{ background: '#059669' }}
            >
              ر
            </div>
            <div>
              <div className="font-black text-slate-800 text-sm leading-tight">ريان برو</div>
              <div className="text-[10px] text-slate-400 font-medium mt-0.5">Rayyan Pro v0.1.0</div>
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
                    isActive
                      ? 'text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                  }`
                }
                style={({ isActive }) =>
                  isActive ? { background: '#059669' } : {}
                }
              >
                <item.icon size={17} className="flex-shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            ) : (
              <div
                key={item.path}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-300 cursor-not-allowed select-none"
              >
                <item.icon size={17} className="flex-shrink-0" />
                <span>{item.label}</span>
                <span className="mr-auto text-[9px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded font-black uppercase tracking-wider">
                  قريباً
                </span>
              </div>
            )
          )}
        </nav>

        {/* User + Logout */}
        <div className="p-3 border-t" style={{ borderColor: '#e2e8f0' }}>
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 mb-1.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-xs flex-shrink-0"
              style={{ background: '#059669' }}
            >
              {user?.full_name?.[0] || 'م'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-black text-slate-700 truncate">{user?.full_name}</div>
              <div className="text-[10px] text-slate-400 font-semibold">
                {ROLE_LABELS[user?.role ?? ''] ?? user?.role}
              </div>
            </div>
            <ChevronLeft size={14} className="text-slate-300 flex-shrink-0" />
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
