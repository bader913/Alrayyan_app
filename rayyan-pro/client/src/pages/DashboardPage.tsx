import React, { useState, useEffect } from 'react';
import { dashboardApi, type DashboardStats } from '../api/dashboard.ts';
import { useAuthStore } from '../store/authStore.ts';
import {
  ShoppingCart, TrendingUp, Package, AlertTriangle,
  DollarSign, Users, Truck, ArrowUp, ArrowDown,
} from 'lucide-react';

const fmt  = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtN = (v: number) => v.toLocaleString('en-US');
const fmtDate = (d: string) => new Date(d).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

const ROLE_LABELS: Record<string, string> = { admin: 'مدير عام', manager: 'مدير', cashier: 'كاشير', warehouse: 'مخزن' };

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const isManager = user?.role === 'admin' || user?.role === 'manager';

  const [stats, setStats]   = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isManager) { setLoading(false); return; }
    dashboardApi.getStats().then(res => {
      setStats(res.stats);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [isManager]);

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-black text-white">مرحباً، {user?.full_name} 👋</h1>
        <p className="text-slate-400 text-sm mt-0.5">{ROLE_LABELS[user?.role ?? ''] ?? user?.role} — نظام ريان برو</p>
      </div>

      {!isManager && (
        <div className="bg-slate-800 rounded-xl p-8 text-center border border-slate-700">
          <Package className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400">لا تتوفر إحصائيات لدورك الحالي. استخدم القائمة للوصول إلى صلاحياتك.</p>
        </div>
      )}

      {isManager && loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-slate-800 rounded-xl h-28 animate-pulse border border-slate-700" />
          ))}
        </div>
      )}

      {isManager && !loading && stats && (
        <>
          {/* KPI Cards — Row 1 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              icon={<ShoppingCart className="w-5 h-5" />}
              color="text-blue-400" bg="bg-blue-900/20"
              label="مبيعات اليوم"
              value={`$${fmt(stats.sales.today.total)}`}
              sub={`${fmtN(stats.sales.today.count)} فاتورة`}
            />
            <KpiCard
              icon={<TrendingUp className="w-5 h-5" />}
              color="text-green-400" bg="bg-green-900/20"
              label="مبيعات الشهر"
              value={`$${fmt(stats.sales.month.total)}`}
              sub={`${fmtN(stats.sales.month.count)} فاتورة`}
            />
            <KpiCard
              icon={<Truck className="w-5 h-5" />}
              color="text-amber-400" bg="bg-amber-900/20"
              label="مشتريات الشهر"
              value={`$${fmt(stats.purchases.month.total)}`}
              sub={`${fmtN(stats.purchases.month.count)} فاتورة`}
            />
            <KpiCard
              icon={<DollarSign className="w-5 h-5" />}
              color={stats.cashFlow.net >= 0 ? 'text-emerald-400' : 'text-red-400'}
              bg={stats.cashFlow.net >= 0 ? 'bg-emerald-900/20' : 'bg-red-900/20'}
              label="صافي التدفق النقدي"
              value={`${stats.cashFlow.net >= 0 ? '+' : ''}$${fmt(stats.cashFlow.net)}`}
              sub="للشهر الحالي"
            />
          </div>

          {/* KPI Cards — Row 2 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-red-400" />
                <span className="text-sm text-slate-400">ديون العملاء</span>
              </div>
              <p className="text-2xl font-bold text-red-400">${fmt(stats.receivables.customerDebt)}</p>
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Truck className="w-4 h-4 text-orange-400" />
                <span className="text-sm text-slate-400">مستحقات الموردين</span>
              </div>
              <p className="text-2xl font-bold text-orange-400">${fmt(stats.receivables.supplierBalance)}</p>
            </div>
          </div>

          {/* Bottom Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Top Products */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <ArrowUp className="w-4 h-4 text-green-400" /> أكثر المنتجات مبيعاً (الشهر)
              </h3>
              {stats.topProducts.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">لا توجد بيانات</p>
              ) : (
                <div className="space-y-2">
                  {stats.topProducts.map((p, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 w-5">{i + 1}</span>
                        <span className="text-sm text-white truncate max-w-36">{p.product_name}</span>
                      </div>
                      <div className="text-left">
                        <span className="text-sm font-semibold text-green-400">{fmtN(parseFloat(p.total_qty))}</span>
                        <span className="text-xs text-slate-500 mr-1">وحدة</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Low Stock */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400" /> تنبيهات المخزون
              </h3>
              {stats.lowStock.length === 0 ? (
                <p className="text-green-400 text-sm text-center py-4">✓ المخزون بخير</p>
              ) : (
                <div className="space-y-2">
                  {stats.lowStock.map(p => (
                    <div key={p.id} className="flex items-center justify-between">
                      <span className="text-sm text-white truncate max-w-36">{p.name}</span>
                      <span className="text-sm font-bold text-yellow-400">{p.stock_quantity}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Sales */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <ArrowDown className="w-4 h-4 text-blue-400" /> آخر المبيعات
              </h3>
              {stats.recentSales.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">لا توجد مبيعات</p>
              ) : (
                <div className="space-y-2">
                  {stats.recentSales.map(s => (
                    <div key={s.id} className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-mono text-blue-400">{s.invoice_number}</p>
                        <p className="text-xs text-slate-500">{s.customer_name ?? 'زبون نقدي'}</p>
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-white">${fmt(parseFloat(s.total_amount))}</p>
                        <p className="text-xs text-slate-500">{fmtDate(s.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({ icon, color, bg, label, value, sub }: {
  icon: React.ReactNode; color: string; bg: string; label: string; value: string; sub: string;
}) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <div className={`inline-flex items-center justify-center w-9 h-9 rounded-lg ${bg} ${color} mb-3`}>
        {icon}
      </div>
      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
    </div>
  );
}
