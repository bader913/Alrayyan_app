import { useAuthStore } from '../store/authStore.ts';

const ROLE_LABELS: Record<string, string> = {
  admin:     'مدير عام',
  manager:   'مدير',
  cashier:   'كاشير',
  warehouse: 'مخزن',
};

const phases = [
  { phase: '0', name: 'الهيكل والإعداد',          status: 'done' },
  { phase: '1', name: 'المستخدمون والصلاحيات',    status: 'done' },
  { phase: '2', name: 'المنتجات والفئات',          status: 'next' },
  { phase: '3', name: 'POS والمبيعات',            status: 'pending' },
  { phase: '4', name: 'المشتريات والمرتجعات',      status: 'pending' },
  { phase: '5', name: 'الحسابات والذمم',           status: 'pending' },
  { phase: '6', name: 'التقارير ولوحة التحكم',     status: 'pending' },
  { phase: '7', name: 'Audit Log والإعدادات',      status: 'pending' },
  { phase: '8', name: 'الصقل والأداء',             status: 'pending' },
];

const techCards = [
  { label: 'قاعدة البيانات', value: 'PostgreSQL', icon: '🗄️', color: '#0ea5e9' },
  { label: 'المصادقة',       value: 'JWT + Refresh', icon: '🔐', color: '#8b5cf6' },
  { label: 'الواجهة',        value: 'React + Vite',  icon: '⚛️', color: '#059669' },
  { label: 'الخادم',         value: 'Fastify',        icon: '⚡', color: '#f59e0b' },
];

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="p-8" dir="rtl">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl font-black text-slate-800 mb-1">
          مرحباً، {user?.full_name} 👋
        </h1>
        <p className="text-slate-400 text-sm font-medium">
          {ROLE_LABELS[user?.role ?? ''] ?? user?.role} — نظام ريان برو
        </p>
      </div>

      {/* Tech Stack Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {techCards.map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-2xl border p-5 shadow-sm"
            style={{ borderColor: '#e2e8f0' }}
          >
            <div className="text-3xl mb-3">{card.icon}</div>
            <div className="text-base font-black" style={{ color: card.color }}>{card.value}</div>
            <div className="text-xs text-slate-400 font-medium mt-0.5">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Phase Roadmap */}
      <div
        className="bg-white rounded-2xl border p-6 shadow-sm"
        style={{ borderColor: '#e2e8f0' }}
      >
        <h2 className="font-black text-slate-600 mb-5 text-xs uppercase tracking-wider">
          خطة المراحل
        </h2>
        <div className="space-y-3">
          {phases.map((item) => (
            <div key={item.phase} className="flex items-center gap-4">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
                style={{
                  background:
                    item.status === 'done'    ? '#059669' :
                    item.status === 'next'    ? '#f59e0b' : '#e2e8f0',
                  color:
                    item.status === 'done'    ? '#fff' :
                    item.status === 'next'    ? '#fff' : '#94a3b8',
                }}
              >
                {item.status === 'done' ? '✓' : item.phase}
              </div>

              <span
                className={`text-sm font-bold flex-1 ${
                  item.status === 'done'    ? 'text-slate-700' :
                  item.status === 'next'    ? 'text-amber-600' : 'text-slate-300'
                }`}
              >
                {item.name}
              </span>

              {item.status === 'done' && (
                <span className="text-[10px] text-emerald-500 font-black uppercase tracking-wider">مكتملة</span>
              )}
              {item.status === 'next' && (
                <span className="text-[10px] text-amber-500 font-black uppercase tracking-wider">التالية</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
