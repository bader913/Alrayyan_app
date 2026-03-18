import React, { useState } from 'react';
import { reportsApi } from '../api/reports.ts';
import { useCurrency } from '../hooks/useCurrency.ts';
import { BarChart2, FileText, Package, TrendingUp, Search, Download } from 'lucide-react';

const fmtUSD  = (v: string | number) => `${parseFloat(String(v)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
const fmtDate = (d: string) => new Date(d).toLocaleDateString('ar-EG-u-nu-latn', { year: 'numeric', month: 'short', day: 'numeric' });

const today    = new Date().toISOString().split('T')[0];
const monthStart = new Date(new Date().setDate(1)).toISOString().split('T')[0];

type ReportTab = 'sales' | 'purchases' | 'stock' | 'profit';

export default function ReportsPage() {
  const { fmt } = useCurrency();
  const [tab, setTab] = useState<ReportTab>('sales');

  // Dates
  const [from, setFrom] = useState(monthStart);
  const [to, setTo]     = useState(today);

  // Sales report state
  const [salesData, setSalesData] = useState<Awaited<ReturnType<typeof reportsApi.sales>>['data'] | null>(null);
  const [salesLoading, setSalesLoading] = useState(false);

  // Purchases report state
  const [purData, setPurData] = useState<Awaited<ReturnType<typeof reportsApi.purchases>>['data'] | null>(null);
  const [purLoading, setPurLoading] = useState(false);

  // Stock report state
  const [stockData, setStockData] = useState<Awaited<ReturnType<typeof reportsApi.stock>>['data'] | null>(null);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockQ, setStockQ] = useState('');
  const [showLowStock, setShowLowStock] = useState(false);

  // Profit report state
  const [profitData, setProfitData] = useState<Awaited<ReturnType<typeof reportsApi.profit>>['data'] | null>(null);
  const [profitLoading, setProfitLoading] = useState(false);

  const loadSales = async () => {
    setSalesLoading(true);
    try { setSalesData((await reportsApi.sales({ from, to })).data); } catch { /* ignore */ }
    setSalesLoading(false);
  };

  const loadPurchases = async () => {
    setPurLoading(true);
    try { setPurData((await reportsApi.purchases({ from, to })).data); } catch { /* ignore */ }
    setPurLoading(false);
  };

  const loadStock = async () => {
    setStockLoading(true);
    try { setStockData((await reportsApi.stock({ q: stockQ || undefined, low_stock: showLowStock || undefined })).data); } catch { /* ignore */ }
    setStockLoading(false);
  };

  const loadProfit = async () => {
    setProfitLoading(true);
    try { setProfitData((await reportsApi.profit({ from, to })).data); } catch { /* ignore */ }
    setProfitLoading(false);
  };

  const exportCSV = (headers: string[], rows: string[][], filename: string) => {
    const bom = '\uFEFF';
    const content = bom + [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const TABS: Array<{ key: ReportTab; label: string; icon: React.ReactNode }> = [
    { key: 'sales',     label: 'المبيعات',    icon: <FileText  className="w-4 h-4" /> },
    { key: 'purchases', label: 'المشتريات',   icon: <BarChart2 className="w-4 h-4" /> },
    { key: 'stock',     label: 'المخزون',     icon: <Package   className="w-4 h-4" /> },
    { key: 'profit',    label: 'الربح والخسارة', icon: <TrendingUp className="w-4 h-4" /> },
  ];

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <BarChart2 className="w-7 h-7 text-sky-400" />
        <h1 className="text-2xl font-bold text-white">التقارير</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition
              ${tab === t.key ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ─── Sales Report ─── */}
      {tab === 'sales' && (
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap items-end">
            <DateRange from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
            <button onClick={loadSales} disabled={salesLoading}
              className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold transition">
              <Search className="w-4 h-4" /> {salesLoading ? 'جاري...' : 'عرض'}
            </button>
          </div>

          {salesData && (
            <>
              <SummaryCards cards={[
                { label: 'إجمالي المبيعات',    value: fmt(salesData.summary.totalRevenue),  color: 'text-green-400' },
                { label: 'المبالغ المحصلة',    value: fmt(salesData.summary.totalPaid),     color: 'text-blue-400'  },
                { label: 'إجمالي الخصومات',    value: fmt(salesData.summary.totalDiscount), color: 'text-yellow-400'},
                { label: 'عدد الفواتير',        value: String(salesData.summary.invoiceCount),    color: 'text-white'     },
              ]} />
              <TableHeader title={`${salesData.total} فاتورة`} onExport={() => exportCSV(
                ['رقم الفاتورة', 'العميل', 'الكاشير', 'الإجمالي', 'المدفوع', 'الحالة', 'التاريخ'],
                salesData.data.map(r => [r.invoice_number, r.customer_name ?? '—', r.cashier_name ?? '—',
                  r.total_amount, r.paid_amount, r.payment_status, fmtDate(r.created_at)]),
                `sales_${from}_${to}.csv`
              )} />
              <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-700/60 text-slate-300 text-right">
                      <th className="px-4 py-3">رقم الفاتورة</th>
                      <th className="px-4 py-3">العميل</th>
                      <th className="px-4 py-3">الكاشير</th>
                      <th className="px-4 py-3 text-left">الإجمالي</th>
                      <th className="px-4 py-3 text-left">المدفوع</th>
                      <th className="px-4 py-3">الحالة</th>
                      <th className="px-4 py-3">التاريخ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesData.data.length === 0
                      ? <tr><td colSpan={7} className="text-center py-8 text-slate-500">لا توجد بيانات</td></tr>
                      : salesData.data.map(r => (
                        <tr key={r.id} className="border-t border-slate-700">
                          <td className="px-4 py-2 font-mono text-blue-400 text-xs">{r.invoice_number}</td>
                          <td className="px-4 py-2 text-slate-300">{r.customer_name ?? 'زبون نقدي'}</td>
                          <td className="px-4 py-2 text-slate-400 text-xs">{r.cashier_name ?? '—'}</td>
                          <td className="px-4 py-2 text-left text-white font-medium">{fmt(r.total_amount)}</td>
                          <td className="px-4 py-2 text-left text-green-400">{fmt(r.paid_amount)}</td>
                          <td className="px-4 py-2">
                            <StatusBadge status={r.payment_status} />
                          </td>
                          <td className="px-4 py-2 text-slate-400 text-xs">{fmtDate(r.created_at)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── Purchases Report ─── */}
      {tab === 'purchases' && (
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap items-end">
            <DateRange from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
            <button onClick={loadPurchases} disabled={purLoading}
              className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold transition">
              <Search className="w-4 h-4" /> {purLoading ? 'جاري...' : 'عرض'}
            </button>
          </div>

          {purData && (
            <>
              <SummaryCards cards={[
                { label: 'إجمالي المشتريات', value: fmt(purData.summary.totalAmount), color: 'text-amber-400' },
                { label: 'المدفوع للموردين', value: fmt(purData.summary.totalPaid),   color: 'text-green-400' },
                { label: 'المستحق للموردين', value: fmt(purData.summary.totalDebt),   color: 'text-red-400'   },
                { label: 'عدد الفواتير',     value: String(purData.summary.count),           color: 'text-white'     },
              ]} />
              <TableHeader title={`${purData.total} فاتورة`} onExport={() => exportCSV(
                ['رقم الفاتورة', 'المورد', 'الإجمالي', 'المدفوع', 'الحالة', 'التاريخ'],
                purData.data.map(r => [r.invoice_number, r.supplier_name ?? '—',
                  r.total_amount, r.paid_amount, r.payment_status, fmtDate(r.created_at)]),
                `purchases_${from}_${to}.csv`
              )} />
              <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-700/60 text-slate-300 text-right">
                      <th className="px-4 py-3">رقم الفاتورة</th>
                      <th className="px-4 py-3">المورد</th>
                      <th className="px-4 py-3 text-left">الإجمالي</th>
                      <th className="px-4 py-3 text-left">المدفوع</th>
                      <th className="px-4 py-3">الحالة</th>
                      <th className="px-4 py-3">التاريخ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purData.data.length === 0
                      ? <tr><td colSpan={6} className="text-center py-8 text-slate-500">لا توجد بيانات</td></tr>
                      : purData.data.map(r => (
                        <tr key={r.id} className="border-t border-slate-700">
                          <td className="px-4 py-2 font-mono text-amber-400 text-xs">{r.invoice_number}</td>
                          <td className="px-4 py-2 text-slate-300">{r.supplier_name ?? '—'}</td>
                          <td className="px-4 py-2 text-left text-white font-medium">{fmt(r.total_amount)}</td>
                          <td className="px-4 py-2 text-left text-green-400">{fmt(r.paid_amount)}</td>
                          <td className="px-4 py-2"><StatusBadge status={r.payment_status} /></td>
                          <td className="px-4 py-2 text-slate-400 text-xs">{fmtDate(r.created_at)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── Stock Report ─── */}
      {tab === 'stock' && (
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap items-end">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input value={stockQ} onChange={e => setStockQ(e.target.value)}
                placeholder="بحث بالاسم أو الكود..."
                className="bg-slate-800 border border-slate-700 rounded-lg pr-9 pl-4 py-2 text-white text-sm focus:outline-none focus:border-sky-500 w-64" />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input type="checkbox" checked={showLowStock} onChange={e => setShowLowStock(e.target.checked)}
                className="rounded border-slate-600" />
              منتجات نفاد المخزون فقط
            </label>
            <button onClick={loadStock} disabled={stockLoading}
              className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold transition">
              <Search className="w-4 h-4" /> {stockLoading ? 'جاري...' : 'عرض'}
            </button>
          </div>

          {stockData && (
            <>
              <SummaryCards cards={[
                { label: 'عدد الأصناف',     value: String(stockData.summary.totalProducts),            color: 'text-white'     },
                { label: 'قيمة المخزون',    value: fmtUSD(stockData.summary.totalStockValue),       color: 'text-blue-400'  },
                { label: 'أصناف قاربت النفاد', value: String(stockData.summary.lowStockCount),           color: 'text-yellow-400'},
              ]} />
              <TableHeader title={`${stockData.data.length} صنف`} onExport={() => exportCSV(
                ['الكود', 'المنتج', 'الفئة', 'الكمية', 'الحد الأدنى', 'سعر التكلفة', 'سعر الجملة', 'سعر التجزئة'],
                stockData.data.map(r => [r.barcode, r.name, r.category_name ?? '—', r.stock_quantity,
                  r.min_stock_level, r.purchase_price, r.wholesale_price, r.retail_price]),
                'stock_report.csv'
              )} />
              <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-700/60 text-slate-300 text-right">
                      <th className="px-4 py-3">الكود</th>
                      <th className="px-4 py-3">المنتج</th>
                      <th className="px-4 py-3">الفئة</th>
                      <th className="px-4 py-3 text-left">الكمية</th>
                      <th className="px-4 py-3 text-left">الحد الأدنى</th>
                      <th className="px-4 py-3 text-left">تكلفة</th>
                      <th className="px-4 py-3 text-left">جملة</th>
                      <th className="px-4 py-3 text-left">تجزئة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockData.data.length === 0
                      ? <tr><td colSpan={8} className="text-center py-8 text-slate-500">لا توجد بيانات</td></tr>
                      : stockData.data.map(r => {
                        const isLow = parseFloat(r.stock_quantity) <= parseFloat(r.min_stock_level);
                        return (
                          <tr key={r.id} className={`border-t border-slate-700 ${isLow ? 'bg-yellow-900/10' : ''}`}>
                            <td className="px-4 py-2 font-mono text-slate-400 text-xs">{r.barcode}</td>
                            <td className="px-4 py-2 text-white">{r.name}</td>
                            <td className="px-4 py-2 text-slate-400 text-xs">{r.category_name ?? '—'}</td>
                            <td className={`px-4 py-2 text-left font-bold ${isLow ? 'text-yellow-400' : 'text-white'}`}>
                              {r.stock_quantity}
                            </td>
                            <td className="px-4 py-2 text-left text-slate-400">{r.min_stock_level}</td>
                            <td className="px-4 py-2 text-left text-slate-300">{fmtUSD(r.purchase_price)}</td>
                            <td className="px-4 py-2 text-left text-slate-300">{fmtUSD(r.wholesale_price)}</td>
                            <td className="px-4 py-2 text-left text-slate-300">{fmtUSD(r.retail_price)}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── Profit Report ─── */}
      {tab === 'profit' && (
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap items-end">
            <DateRange from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
            <button onClick={loadProfit} disabled={profitLoading}
              className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold transition">
              <Search className="w-4 h-4" /> {profitLoading ? 'جاري...' : 'عرض'}
            </button>
          </div>

          {profitData && (
            <>
              <SummaryCards cards={[
                { label: 'إجمالي الإيرادات', value: fmt(profitData.summary.totalRevenue), color: 'text-green-400'  },
                { label: 'إجمالي التكلفة',  value: fmt(profitData.summary.totalCost),    color: 'text-red-400'    },
                { label: 'إجمالي الربح',     value: fmt(profitData.summary.grossProfit),  color: profitData.summary.grossProfit >= 0 ? 'text-emerald-400' : 'text-red-400' },
                { label: 'هامش الربح',       value: `${profitData.summary.margin}%`,            color: 'text-sky-400'    },
              ]} />
              <TableHeader title={`${profitData.data.length} منتج`} onExport={() => exportCSV(
                ['المنتج', 'الكود', 'الكمية المباعة', 'الإيرادات', 'التكلفة', 'الربح الإجمالي'],
                profitData.data.map(r => [r.product_name, r.barcode, r.total_sold,
                  r.total_revenue, r.total_cost, r.gross_profit]),
                `profit_${from}_${to}.csv`
              )} />
              <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-700/60 text-slate-300 text-right">
                      <th className="px-4 py-3">المنتج</th>
                      <th className="px-4 py-3">الكود</th>
                      <th className="px-4 py-3 text-left">الكمية</th>
                      <th className="px-4 py-3 text-left">الإيرادات</th>
                      <th className="px-4 py-3 text-left">التكلفة</th>
                      <th className="px-4 py-3 text-left">الربح</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profitData.data.length === 0
                      ? <tr><td colSpan={6} className="text-center py-8 text-slate-500">لا توجد بيانات</td></tr>
                      : profitData.data.map(r => {
                        const profit = parseFloat(String(r.gross_profit));
                        return (
                          <tr key={r.id} className="border-t border-slate-700">
                            <td className="px-4 py-2 text-white">{r.product_name}</td>
                            <td className="px-4 py-2 font-mono text-slate-400 text-xs">{r.barcode}</td>
                            <td className="px-4 py-2 text-left text-slate-300">{r.total_sold}</td>
                            <td className="px-4 py-2 text-left text-green-400">{fmt(r.total_revenue)}</td>
                            <td className="px-4 py-2 text-left text-red-400">{fmt(r.total_cost)}</td>
                            <td className={`px-4 py-2 text-left font-bold ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {fmt(r.gross_profit)}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function DateRange({ from, to, onFromChange, onToChange }: { from: string; to: string; onFromChange: (v: string) => void; onToChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <div>
        <label className="block text-xs text-slate-500 mb-1">من</label>
        <input type="date" value={from} onChange={e => onFromChange(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500" />
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">إلى</label>
        <input type="date" value={to} onChange={e => onToChange(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500" />
      </div>
    </div>
  );
}

function SummaryCards({ cards }: { cards: Array<{ label: string; value: string; color: string }> }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(c => (
        <div key={c.label} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <p className="text-xs text-slate-400 mb-1">{c.label}</p>
          <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}

function TableHeader({ title, onExport }: { title: string; onExport: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-400">{title}</span>
      <button onClick={onExport}
        className="flex items-center gap-1.5 text-sm text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg transition">
        <Download className="w-4 h-4" /> تصدير CSV
      </button>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  paid:        'bg-green-900/40 text-green-400',
  partial:     'bg-yellow-900/40 text-yellow-400',
  unpaid:      'bg-red-900/40 text-red-400',
  cancelled:   'bg-slate-700 text-slate-400',
};
const STATUS_LABELS: Record<string, string> = {
  paid: 'مدفوع', partial: 'جزئي', unpaid: 'غير مدفوع', cancelled: 'ملغي',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status] ?? 'bg-slate-700 text-slate-400'}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
