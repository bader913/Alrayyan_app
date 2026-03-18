import { useAuthStore } from '../store/authStore.ts';
import { authApi } from '../api/client.ts';
import { useNavigate } from 'react-router-dom';
import { LogOut, LayoutDashboard, ShoppingCart, Package, Users, BarChart2, Settings } from 'lucide-react';

const menuItems = [
  { icon: LayoutDashboard, label: 'لوحة التحكم', active: true },
  { icon: ShoppingCart,    label: 'نقطة البيع',  active: false },
  { icon: Package,         label: 'المنتجات',    active: false },
  { icon: Users,           label: 'العملاء',     active: false },
  { icon: BarChart2,       label: 'التقارير',    active: false },
  { icon: Settings,        label: 'الإعدادات',   active: false },
];

export default function DashboardPage() {
  const { user, refreshToken, clearAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    if (refreshToken) {
      try { await authApi.logout(refreshToken); } catch {}
    }
    clearAuth();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex" dir="rtl" style={{ background: '#f8fafc' }}>
      <aside
        className="w-64 flex flex-col border-l shadow-sm"
        style={{ background: '#fff', borderColor: '#e2e8f0' }}
      >
        <div className="p-5 border-b" style={{ borderColor: '#e2e8f0' }}>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-lg"
              style={{ background: '#059669' }}
            >
              ر
            </div>
            <div>
              <div className="font-black text-slate-800 text-sm">ريان برو</div>
              <div className="text-[10px] text-slate-400 font-medium">v0.1.0 — المرحلة 0</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.label}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all text-right ${
                item.active
                  ? 'text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
              style={item.active ? { background: '#059669' } : {}}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
              {!item.active && (
                <span className="mr-auto text-[9px] text-slate-300 font-medium uppercase tracking-wider">قريباً</span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t" style={{ borderColor: '#e2e8f0' }}>
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 mb-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-xs"
              style={{ background: '#059669' }}
            >
              {user?.full_name?.[0] || 'م'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-black text-slate-700 truncate">{user?.full_name}</div>
              <div className="text-[10px] text-slate-400 font-medium">{user?.role}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-rose-500 hover:bg-rose-50 transition-colors"
          >
            <LogOut size={16} />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      <main className="flex-1 p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-black text-slate-800 mb-1">مرحباً، {user?.full_name} 👋</h1>
          <p className="text-slate-400 text-sm font-medium">
            المرحلة 0 مكتملة — الهيكل الأساسي يعمل بنجاح
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {[
            { label: 'قاعدة البيانات', value: 'PostgreSQL', icon: '🗄️', color: '#0ea5e9' },
            { label: 'المصادقة', value: 'JWT + Refresh', icon: '🔐', color: '#8b5cf6' },
            { label: 'الواجهة', value: 'React + Vite', icon: '⚛️', color: '#059669' },
            { label: 'الخادم', value: 'Fastify', icon: '⚡', color: '#f59e0b' },
          ].map((card) => (
            <div
              key={card.label}
              className="bg-white rounded-2xl border p-5 shadow-sm"
              style={{ borderColor: '#e2e8f0' }}
            >
              <div className="text-3xl mb-3">{card.icon}</div>
              <div className="text-lg font-black" style={{ color: card.color }}>{card.value}</div>
              <div className="text-sm text-slate-400 font-medium mt-0.5">{card.label}</div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border p-6 shadow-sm" style={{ borderColor: '#e2e8f0' }}>
          <h2 className="font-black text-slate-700 mb-4 text-sm uppercase tracking-wider">
            خطة المراحل
          </h2>
          <div className="space-y-3">
            {[
              { phase: '0', name: 'الهيكل والإعداد', status: 'done' },
              { phase: '1', name: 'Auth والمستخدمين', status: 'next' },
              { phase: '2', name: 'المنتجات والفئات', status: 'pending' },
              { phase: '3', name: 'POS والمبيعات', status: 'pending' },
              { phase: '4', name: 'المشتريات والمرتجعات', status: 'pending' },
              { phase: '5', name: 'الحسابات والذمم', status: 'pending' },
              { phase: '6', name: 'التقارير ولوحة التحكم', status: 'pending' },
              { phase: '7', name: 'Audit Log والإعدادات', status: 'pending' },
              { phase: '8', name: 'الصقل والأداء', status: 'pending' },
            ].map((item) => (
              <div key={item.phase} className="flex items-center gap-4">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
                  style={{
                    background:
                      item.status === 'done' ? '#059669' :
                      item.status === 'next' ? '#f59e0b' : '#e2e8f0',
                    color:
                      item.status === 'done' ? '#fff' :
                      item.status === 'next' ? '#fff' : '#94a3b8',
                  }}
                >
                  {item.status === 'done' ? '✓' : item.phase}
                </div>
                <span
                  className={`text-sm font-bold ${
                    item.status === 'done' ? 'text-slate-700' :
                    item.status === 'next' ? 'text-amber-600' : 'text-slate-300'
                  }`}
                >
                  {item.name}
                </span>
                {item.status === 'done' && (
                  <span className="mr-auto text-[10px] text-emerald-500 font-black uppercase tracking-wider">مكتملة</span>
                )}
                {item.status === 'next' && (
                  <span className="mr-auto text-[10px] text-amber-500 font-black uppercase tracking-wider">التالية</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
