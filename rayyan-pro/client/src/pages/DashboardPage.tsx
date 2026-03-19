import React, { useState, useEffect } from 'react';
import { dashboardApi, type DashboardStats } from '../api/dashboard.ts';
import { useAuthStore } from '../store/authStore.ts';
import { useCurrency } from '../hooks/useCurrency.ts';
import {
  ShoppingCart, TrendingUp, Package, AlertTriangle,
  DollarSign, Users, Truck, ArrowUp, ArrowDown, RefreshCw,
} from 'lucide-react';

const fmtN    = (v: number) => v.toLocaleString('en-US');
const fmtDate = (d: string) => new Date(d).toLocaleDateString('ar-EG-u-nu-latn', {
  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
});
const ROLE_LABELS: Record<string, string> = {
  admin: 'مدير عام', manager: 'مدير', cashier: 'كاشير', warehouse: 'مخزن',
};

const cs = {
  card:   { background: 'var(--bg-card)',    borderColor: 'var(--border)', border: '1px solid var(--border)' },
  muted:  { background: 'var(--bg-muted)',   borderColor: 'var(--border)', border: '1px solid var(--border)' },
  h:      { color: 'var(--text-heading)' },
  body:   { color: 'var(--text-body)'    },
  sec:    { color: 'var(--text-secondary)' },
  mute:   { color: 'var(--text-muted)'   },
};

export default function DashboardPage() {
  const user      = useAuthStore((s) => s.user);
  const isManager = user?.role === 'admin' || user?.role === 'manager';
  const { fmt }   = useCurrency();

  const [stats,   setStats]   = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isManager) { setLoading(false); return; }
    dashboardApi.getStats()
      .then(res => { setStats(res.data.stats); setLoading(false); })
      .catch(() => setLoading(false));
  }, [isManager]);

  return (
    <div className="p-6 space-y-6" dir="rtl">

      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-black" style={cs.h}>
          مرحباً، {user?.full_name} 👋
        </h1>
        <p className="text-sm mt-0.5" style={cs.sec}>
          {ROLE_LABELS[user?.role ?? ''] ?? user?.role} — نظام ريان برو
        </p>
      </div>

      {/* Non-manager */}
      {!isManager && (
        <div className="rounded-xl p-8 text-center" style={cs.card}>
          <Package className="w-12 h-12 mx-auto mb-3" style={cs.mute} />
          <p className="text-sm" style={cs.sec}>
            لا تتوفر إحصائيات لدورك الحالي. استخدم القائمة للوصول إلى صلاحياتك.
          </p>
        </div>
      )}

      {/* Loading skeletons */}
      {isManager && loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl h-28 animate-pulse" style={cs.card} />
          ))}
        </div>
      )}

      {isManager && !loading && stats && (
        <>
          {/* KPI Row 1 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard icon={<ShoppingCart className="w-5 h-5" />}
              iconBg="#dbeafe" iconColor="#1d4ed8"
              label="مبيعات اليوم"
              value={fmt(stats.sales.today.total)}
              sub={`${fmtN(stats.sales.today.count)} فاتورة`} />
            <KpiCard icon={<TrendingUp className="w-5 h-5" />}
              iconBg="#d1fae5" iconColor="#065f46"
              label="مبيعات الشهر"
              value={fmt(stats.sales.month.total)}
              sub={`${fmtN(stats.sales.month.count)} فاتورة`} />
            <KpiCard icon={<Truck className="w-5 h-5" />}
              iconBg="#fef3c7" iconColor="#92400e"
              label="مشتريات الشهر"
              value={fmt(stats.purchases.month.total)}
              sub={`${fmtN(stats.purchases.month.count)} فاتورة`} />
            <KpiCard
              icon={<DollarSign className="w-5 h-5" />}
              iconBg={stats.cashFlow.net >= 0 ? '#d1fae5' : '#fee2e2'}
              iconColor={stats.cashFlow.net >= 0 ? '#065f46' : '#991b1b'}
              label="صافي التدفق النقدي"
              value={`${stats.cashFlow.net >= 0 ? '+' : ''}${fmt(stats.cashFlow.net)}`}
              sub="للشهر الحالي"
              valueColor={stats.cashFlow.net >= 0 ? '#10b981' : '#ef4444'} />
          </div>

          {/* KPI Row 2 — Debts */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl p-4 border" style={cs.card}>
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-red-500 flex-shrink-0" />
                <span className="text-sm" style={cs.sec}>ديون العملاء</span>
              </div>
              <p className="text-2xl font-bold text-red-500">{fmt(stats.receivables.customerDebt)}</p>
            </div>
            <div className="rounded-xl p-4 border" style={cs.card}>
              <div className="flex items-center gap-2 mb-3">
                <Truck className="w-4 h-4 text-orange-500 flex-shrink-0" />
                <span className="text-sm" style={cs.sec}>مستحقات الموردين</span>
              </div>
              <p className="text-2xl font-bold text-orange-500">{fmt(stats.receivables.supplierBalance)}</p>
            </div>
          </div>

          {/* Bottom Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Top Products */}
            <div className="rounded-xl p-5 border" style={cs.card}>
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={cs.body}>
                <ArrowUp className="w-4 h-4 text-emerald-500" />
                أكثر المنتجات مبيعاً (الشهر)
              </h3>
              {stats.topProducts.length === 0 ? (
                <p className="text-sm text-center py-4" style={cs.mute}>لا توجد بيانات</p>
              ) : (
                <div className="space-y-2.5">
                  {stats.topProducts.map((p, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs w-5 font-bold" style={cs.mute}>{i + 1}</span>
                        <span className="text-sm truncate max-w-36" style={cs.h}>{p.product_name}</span>
                      </div>
                      <div className="text-left">
                        <span className="text-sm font-semibold text-emerald-500">{fmtN(parseFloat(p.total_qty))}</span>
                        <span className="text-xs mr-1" style={cs.mute}>وحدة</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Low Stock */}
            <div className="rounded-xl p-5 border" style={cs.card}>
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={cs.body}>
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                تنبيهات المخزون
              </h3>
              {stats.lowStock.length === 0 ? (
                <p className="text-sm text-center py-4 text-emerald-500">✓ المخزون بخير</p>
              ) : (
                <div className="space-y-2.5">
                  {stats.lowStock.map(p => (
                    <div key={p.id} className="flex items-center justify-between">
                      <span className="text-sm truncate max-w-36" style={cs.h}>{p.name}</span>
                      <span className="text-sm font-bold text-amber-500">{p.stock_quantity}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Sales */}
            <div className="rounded-xl p-5 border" style={cs.card}>
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={cs.body}>
                <ArrowDown className="w-4 h-4 text-blue-500" />
                آخر المبيعات
              </h3>
              {stats.recentSales.length === 0 ? (
                <p className="text-sm text-center py-4" style={cs.mute}>لا توجد مبيعات</p>
              ) : (
                <div className="space-y-3">
                  {stats.recentSales.map(s => (
                    <div key={s.id} className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-mono text-blue-500">{s.invoice_number}</p>
                        <p className="text-xs" style={cs.mute}>{s.customer_name ?? 'زبون نقدي'}</p>
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-semibold" style={cs.h}>{fmt(parseFloat(s.total_amount))}</p>
                        <p className="text-xs" style={cs.mute}>{fmtDate(s.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </>
      )}

      {isManager && !loading && !stats && (
        <div className="rounded-xl p-8 text-center border" style={cs.card}>
          <RefreshCw className="w-8 h-8 mx-auto mb-3" style={cs.mute} />
          <p className="text-sm" style={cs.sec}>تعذّر تحميل الإحصائيات</p>
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon, iconBg, iconColor, label, value, sub, valueColor }: {
  icon: React.ReactNode; iconBg: string; iconColor: string;
  label: string; value: string; sub: string; valueColor?: string;
}) {
  return (
    <div className="rounded-xl p-4 border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg mb-3 flex-shrink-0"
        style={{ background: iconBg, color: iconColor }}>
        {icon}
      </div>
      <p className="text-xs mb-0.5" style={{ color: 'var(--text-secondary)' }}>{label}</p>
      <p className="text-xl font-bold" style={{ color: valueColor ?? 'var(--text-heading)' }}>{value}</p>
      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</p>
    </div>
  );
}
