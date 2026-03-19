import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { reportsApi } from '../api/reports.ts';
import { useCurrency } from '../hooks/useCurrency.ts';
import CustomerLedgerModal from '../components/CustomerLedgerModal.tsx';
import SupplierLedgerModal from '../components/SupplierLedgerModal.tsx';
import { BarChart2, FileText, Package, TrendingUp, Search, Download } from 'lucide-react';

const fmtUSD  = (v: string | number) => `${parseFloat(String(v)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
const fmtDate = (d: string) => new Date(d).toLocaleDateString('ar-EG-u-nu-latn', { year: 'numeric', month: 'short', day: 'numeric' });

const today      = new Date().toISOString().split('T')[0];
const monthStart = new Date(new Date().setDate(1)).toISOString().split('T')[0];

type ReportTab = 'sales' | 'purchases' | 'stock' | 'profit';

const cs = {
  card:    { background: 'var(--bg-card)',   border: '1px solid var(--border)'  },
  muted:   { background: 'var(--bg-muted)',  border: '1px solid var(--border)'  },
  input:   { background: 'var(--bg-input)',  borderColor: 'var(--border)', color: 'var(--text-heading)' },
  h:       { color: 'var(--text-heading)'   },
  body:    { color: 'var(--text-body)'      },
  sec:     { color: 'var(--text-secondary)' },
  mute:    { color: 'var(--text-muted)'     },
};

const STATUS_COLORS_LIGHT: Record<string, { bg: string; color: string }> = {
  paid:      { bg: '#d1fae5', color: '#065f46' },
  partial:   { bg: '#fef3c7', color: '#92400e' },
  unpaid:    { bg: '#fee2e2', color: '#991b1b' },
  cancelled: { bg: '#f1f5f9', color: '#64748b' },
};
const STATUS_LABELS: Record<string, string> = {
  paid: 'مدفوع', partial: 'جزئي', unpaid: 'غير مدفوع', cancelled: 'ملغي',
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_COLORS_LIGHT[status] ?? { bg: '#f1f5f9', color: '#64748b' };
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: s.bg, color: s.color }}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function exportExcel(headers: string[], rows: (string | number)[][], filename: string, sheetName = 'تقرير') {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  // Style header row bold + set RTL
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  ws['!cols'] = headers.map(() => ({ wch: 20 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename.replace(/\.csv$/, '.xlsx'));
}

export default function ReportsPage() {
  const { fmt } = useCurrency();

  const [tab, setTab] = useState<ReportTab>('sales');
  const [from, setFrom] = useState(monthStart);
  const [to,   setTo]   = useState(today);

  const [salesData, setSalesData]     = useState<Awaited<ReturnType<typeof reportsApi.sales>>['data'] | null>(null);
  const [salesLoading, setSalesLoading] = useState(false);

  const [purData, setPurData]       = useState<Awaited<ReturnType<typeof reportsApi.purchases>>['data'] | null>(null);
  const [purLoading, setPurLoading] = useState(false);

  const [stockData, setStockData]       = useState<Awaited<ReturnType<typeof reportsApi.stock>>['data'] | null>(null);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockQ,      setStockQ]        = useState('');
  const [showLowStock, setShowLowStock] = useState(false);

  const [profitData, setProfitData]       = useState<Awaited<ReturnType<typeof reportsApi.profit>>['data'] | null>(null);
  const [profitLoading, setProfitLoading] = useState(false);

  const [customerLedger, setCustomerLedger] = useState<{ id: number; name: string } | null>(null);
  const [supplierLedger, setSupplierLedger] = useState<{ id: number; name: string } | null>(null);

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

  const TABS: Array<{ key: ReportTab; label: string; icon: React.ReactNode }> = [
    { key: 'sales',     label: 'المبيعات',       icon: <FileText   className="w-4 h-4" /> },
    { key: 'purchases', label: 'المشتريات',      icon: <BarChart2  className="w-4 h-4" /> },
    { key: 'stock',     label: 'المخزون',        icon: <Package    className="w-4 h-4" /> },
    { key: 'profit',    label: 'الربح والخسارة', icon: <TrendingUp className="w-4 h-4" /> },
  ];

  const inputCls = 'rounded-xl px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:ring-sky-500';

  return (
    <div className="p-6 space-y-5" dir="rtl">

      {/* Header */}
      <div className="flex items-center gap-3">
        <BarChart2 className="w-7 h-7 text-sky-500" />
        <h1 className="text-2xl font-black" style={cs.h}>التقارير</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition"
            style={tab === t.key
              ? { background: '#0ea5e9', color: '#fff' }
              : { background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-body)' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ─── Sales ─── */}
      {tab === 'sales' && (
        <div className="space-y-4">
          <DateFilterBar from={from} to={to} onFromChange={setFrom} onToChange={setTo}
            onSearch={loadSales} loading={salesLoading} />

          {salesData && (
            <>
              <SummaryRow cards={[
                { label: 'إجمالي المبيعات',  value: fmt(salesData.summary.totalRevenue),  color: '#10b981' },
                { label: 'المبالغ المحصلة',  value: fmt(salesData.summary.totalPaid),     color: '#3b82f6' },
                { label: 'إجمالي الخصومات',  value: fmt(salesData.summary.totalDiscount), color: '#f59e0b' },
                { label: 'عدد الفواتير',      value: String(salesData.summary.invoiceCount), color: 'var(--text-heading)' },
              ]} />
              <TableToolbar
                title={`${salesData.total} فاتورة`}
                onExport={() => exportExcel(
                  ['رقم الفاتورة', 'العميل', 'الكاشير', 'الإجمالي', 'المدفوع', 'الحالة', 'التاريخ'],
                  salesData.data.map(r => [r.invoice_number, r.customer_name ?? '—', r.cashier_name ?? '—',
                    r.total_amount, r.paid_amount, r.payment_status, fmtDate(r.created_at)]),
                  `sales_${from}_${to}.xlsx`
                )} />
              <ReportTable cols={['رقم الفاتورة', 'العميل', 'الكاشير', 'الإجمالي', 'المدفوع', 'الحالة', 'التاريخ']}>
                {salesData.data.length === 0
                  ? <EmptyRow cols={7} />
                  : salesData.data.map(r => (
                    <tr key={r.id} className="border-t transition-colors"
                      style={{ borderColor: 'var(--border)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-muted)')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}>
                      <td className="px-4 py-2.5 font-mono text-xs text-sky-500">{r.invoice_number}</td>
                      <td className="px-4 py-2.5">
                        {r.customer_id ? (
                          <button
                            onClick={() => setCustomerLedger({ id: r.customer_id!, name: r.customer_name ?? '—' })}
                            className="text-sm font-medium text-sky-600 hover:underline focus:outline-none">
                            {r.customer_name ?? 'زبون نقدي'}
                          </button>
                        ) : (
                          <span className="text-sm" style={cs.body}>{r.customer_name ?? 'زبون نقدي'}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs" style={cs.sec}>{r.cashier_name ?? '—'}</td>
                      <td className="px-4 py-2.5 text-left font-bold" style={cs.h}>{fmt(r.total_amount)}</td>
                      <td className="px-4 py-2.5 text-left text-emerald-500 font-medium">{fmt(r.paid_amount)}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={r.payment_status} /></td>
                      <td className="px-4 py-2.5 text-xs" style={cs.mute}>{fmtDate(r.created_at)}</td>
                    </tr>
                  ))}
              </ReportTable>
            </>
          )}
        </div>
      )}

      {/* ─── Purchases ─── */}
      {tab === 'purchases' && (
        <div className="space-y-4">
          <DateFilterBar from={from} to={to} onFromChange={setFrom} onToChange={setTo}
            onSearch={loadPurchases} loading={purLoading} />

          {purData && (
            <>
              <SummaryRow cards={[
                { label: 'إجمالي المشتريات', value: fmt(purData.summary.totalAmount), color: '#f59e0b' },
                { label: 'المدفوع للموردين', value: fmt(purData.summary.totalPaid),   color: '#10b981' },
                { label: 'المستحق للموردين', value: fmt(purData.summary.totalDebt),   color: '#ef4444' },
                { label: 'عدد الفواتير',     value: String(purData.summary.count),    color: 'var(--text-heading)' },
              ]} />
              <TableToolbar
                title={`${purData.total} فاتورة`}
                onExport={() => exportExcel(
                  ['رقم الفاتورة', 'المورد', 'الإجمالي', 'المدفوع', 'الحالة', 'التاريخ'],
                  purData.data.map(r => [r.invoice_number, r.supplier_name ?? '—',
                    r.total_amount, r.paid_amount, r.payment_status, fmtDate(r.created_at)]),
                  `purchases_${from}_${to}.xlsx`
                )} />
              <ReportTable cols={['رقم الفاتورة', 'المورد', 'الإجمالي', 'المدفوع', 'الحالة', 'التاريخ']}>
                {purData.data.length === 0
                  ? <EmptyRow cols={6} />
                  : purData.data.map(r => (
                    <tr key={r.id} className="border-t transition-colors"
                      style={{ borderColor: 'var(--border)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-muted)')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}>
                      <td className="px-4 py-2.5 font-mono text-xs text-amber-500">{r.invoice_number}</td>
                      <td className="px-4 py-2.5">
                        {r.supplier_id ? (
                          <button
                            onClick={() => setSupplierLedger({ id: r.supplier_id!, name: r.supplier_name ?? '—' })}
                            className="text-sm font-medium text-amber-600 hover:underline focus:outline-none">
                            {r.supplier_name ?? '—'}
                          </button>
                        ) : (
                          <span className="text-sm" style={cs.body}>{r.supplier_name ?? '—'}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-left font-bold" style={cs.h}>{fmt(r.total_amount)}</td>
                      <td className="px-4 py-2.5 text-left text-emerald-500 font-medium">{fmt(r.paid_amount)}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={r.payment_status} /></td>
                      <td className="px-4 py-2.5 text-xs" style={cs.mute}>{fmtDate(r.created_at)}</td>
                    </tr>
                  ))}
              </ReportTable>
            </>
          )}
        </div>
      )}

      {/* ─── Stock ─── */}
      {tab === 'stock' && (
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap items-end">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={cs.mute} />
              <input value={stockQ} onChange={e => setStockQ(e.target.value)}
                placeholder="بحث بالاسم أو الكود..."
                className={`${inputCls} pr-9 w-64`} style={cs.input} />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer" style={cs.body}>
              <input type="checkbox" checked={showLowStock} onChange={e => setShowLowStock(e.target.checked)}
                className="rounded" />
              منتجات نفاد المخزون فقط
            </label>
            <SearchButton onClick={loadStock} loading={stockLoading} />
          </div>

          {stockData && (
            <>
              <SummaryRow cards={[
                { label: 'عدد الأصناف',       value: String(stockData.summary.totalProducts),   color: 'var(--text-heading)' },
                { label: 'قيمة المخزون',      value: fmtUSD(stockData.summary.totalStockValue), color: '#3b82f6' },
                { label: 'أصناف قاربت النفاد', value: String(stockData.summary.lowStockCount),   color: '#f59e0b' },
              ]} />
              <TableToolbar
                title={`${stockData.data.length} صنف`}
                onExport={() => exportExcel(
                  ['الكود', 'المنتج', 'الفئة', 'الكمية', 'الحد الأدنى', 'التكلفة', 'الجملة', 'التجزئة'],
                  stockData.data.map(r => [r.barcode, r.name, r.category_name ?? '—', r.stock_quantity,
                    r.min_stock_level, r.purchase_price, r.wholesale_price, r.retail_price]),
                  'stock_report.csv'
                )} />
              <ReportTable cols={['الكود', 'المنتج', 'الفئة', 'الكمية', 'الحد الأدنى', 'تكلفة', 'جملة', 'تجزئة']}>
                {stockData.data.length === 0
                  ? <EmptyRow cols={8} />
                  : stockData.data.map(r => {
                    const isLow = parseFloat(r.stock_quantity) <= parseFloat(r.min_stock_level);
                    return (
                      <tr key={r.id} className="border-t transition-colors"
                        style={{ borderColor: 'var(--border)', background: isLow ? 'rgba(245,158,11,0.06)' : '' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-muted)')}
                        onMouseLeave={e => (e.currentTarget.style.background = isLow ? 'rgba(245,158,11,0.06)' : '')}>
                        <td className="px-4 py-2.5 font-mono text-xs" style={cs.mute}>{r.barcode}</td>
                        <td className="px-4 py-2.5 font-medium" style={cs.h}>{r.name}</td>
                        <td className="px-4 py-2.5 text-xs" style={cs.sec}>{r.category_name ?? '—'}</td>
                        <td className={`px-4 py-2.5 text-left font-bold ${isLow ? 'text-amber-500' : ''}`}
                          style={isLow ? {} : cs.h}>{r.stock_quantity}</td>
                        <td className="px-4 py-2.5 text-left" style={cs.sec}>{r.min_stock_level}</td>
                        <td className="px-4 py-2.5 text-left" style={cs.body}>{fmtUSD(r.purchase_price)}</td>
                        <td className="px-4 py-2.5 text-left" style={cs.body}>{fmtUSD(r.wholesale_price)}</td>
                        <td className="px-4 py-2.5 text-left" style={cs.body}>{fmtUSD(r.retail_price)}</td>
                      </tr>
                    );
                  })}
              </ReportTable>
            </>
          )}
        </div>
      )}

      {/* ─── Profit ─── */}
      {tab === 'profit' && (
        <div className="space-y-4">
          <DateFilterBar from={from} to={to} onFromChange={setFrom} onToChange={setTo}
            onSearch={loadProfit} loading={profitLoading} />

          {profitData && (
            <>
              <SummaryRow cards={[
                { label: 'إجمالي الإيرادات', value: fmt(profitData.summary.totalRevenue),  color: '#10b981' },
                { label: 'إجمالي التكلفة',   value: fmt(profitData.summary.totalCost),     color: '#ef4444' },
                { label: 'ربح المبيعات',      value: fmt(profitData.summary.grossProfit),   color: profitData.summary.grossProfit >= 0 ? '#10b981' : '#ef4444' },
                { label: 'إجمالي المصاريف',   value: fmt(profitData.summary.totalExpenses ?? 0), color: '#f59e0b' },
                { label: 'صافي الربح',        value: fmt(profitData.summary.netProfit ?? profitData.summary.grossProfit), color: (profitData.summary.netProfit ?? profitData.summary.grossProfit) >= 0 ? '#10b981' : '#ef4444' },
                { label: 'هامش الربح الصافي', value: `${profitData.summary.margin}%`,       color: '#0ea5e9' },
              ]} />
              <TableToolbar
                title={`${profitData.data.length} منتج`}
                onExport={() => exportExcel(
                  ['المنتج', 'الكود', 'الكمية المباعة', 'الإيرادات', 'التكلفة', 'الربح الإجمالي'],
                  profitData.data.map(r => [r.product_name, r.barcode, r.total_sold,
                    r.total_revenue, r.total_cost, r.gross_profit]),
                  `profit_${from}_${to}.xlsx`
                )} />
              <ReportTable cols={['المنتج', 'الكود', 'الكمية', 'الإيرادات', 'التكلفة', 'الربح']}>
                {profitData.data.length === 0
                  ? <EmptyRow cols={6} />
                  : profitData.data.map(r => {
                    const profit = parseFloat(String(r.gross_profit));
                    return (
                      <tr key={r.id} className="border-t transition-colors"
                        style={{ borderColor: 'var(--border)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-muted)')}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}>
                        <td className="px-4 py-2.5 font-medium" style={cs.h}>{r.product_name}</td>
                        <td className="px-4 py-2.5 font-mono text-xs" style={cs.mute}>{r.barcode}</td>
                        <td className="px-4 py-2.5 text-left" style={cs.body}>{r.total_sold}</td>
                        <td className="px-4 py-2.5 text-left text-emerald-500 font-medium">{fmt(r.total_revenue)}</td>
                        <td className="px-4 py-2.5 text-left text-red-500 font-medium">{fmt(r.total_cost)}</td>
                        <td className={`px-4 py-2.5 text-left font-bold ${profit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {fmt(r.gross_profit)}
                        </td>
                      </tr>
                    );
                  })}
              </ReportTable>
            </>
          )}
        </div>
      )}

      {/* Ledger Modals */}
      {customerLedger && (
        <CustomerLedgerModal
          customerId={customerLedger.id}
          customerName={customerLedger.name}
          onClose={() => setCustomerLedger(null)} />
      )}
      {supplierLedger && (
        <SupplierLedgerModal
          supplierId={supplierLedger.id}
          supplierName={supplierLedger.name}
          onClose={() => setSupplierLedger(null)} />
      )}
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────────── */

function DateFilterBar({ from, to, onFromChange, onToChange, onSearch, loading }: {
  from: string; to: string; onFromChange: (v: string) => void; onToChange: (v: string) => void;
  onSearch: () => void; loading: boolean;
}) {
  const inputStyle = { background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-heading)' };
  const inputCls   = 'rounded-xl px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:ring-sky-500';
  return (
    <div className="flex gap-3 flex-wrap items-end">
      <div>
        <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>من</label>
        <input type="date" value={from} onChange={e => onFromChange(e.target.value)} className={inputCls} style={inputStyle} />
      </div>
      <div>
        <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>إلى</label>
        <input type="date" value={to} onChange={e => onToChange(e.target.value)} className={inputCls} style={inputStyle} />
      </div>
      <SearchButton onClick={onSearch} loading={loading} />
    </div>
  );
}

function SearchButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button onClick={onClick} disabled={loading}
      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition hover:opacity-90"
      style={{ background: '#0ea5e9' }}>
      <Search className="w-4 h-4" />
      {loading ? 'جاري...' : 'عرض'}
    </button>
  );
}

function SummaryRow({ cards }: { cards: Array<{ label: string; value: string; color: string }> }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(c => (
        <div key={c.label} className="rounded-2xl p-4 border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>{c.label}</p>
          <p className="text-xl font-black" style={{ color: c.color }}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}

function TableToolbar({ title, onExport }: { title: string; onExport: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{title}</span>
      <button onClick={onExport}
        className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-xl border transition hover:opacity-80"
        style={{ background: 'var(--bg-muted)', borderColor: 'var(--border)', color: 'var(--text-body)' }}>
        <Download className="w-4 h-4" /> تصدير Excel
      </button>
    </div>
  );
}

function ReportTable({ cols, children }: { cols: string[]; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: 'var(--bg-muted)', borderBottom: '1px solid var(--border)' }}>
            {cols.map(c => (
              <th key={c} className="px-4 py-3 text-right text-xs font-black" style={{ color: 'var(--text-secondary)' }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function EmptyRow({ cols }: { cols: number }) {
  return (
    <tr>
      <td colSpan={cols} className="text-center py-10 text-sm" style={{ color: 'var(--text-muted)' }}>
        لا توجد بيانات
      </td>
    </tr>
  );
}
