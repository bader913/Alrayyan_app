import React, { useState } from 'react';
import {
  Plus, Search, RotateCcw, Package, ChevronRight, ChevronLeft,
  X, Check, AlertTriangle, Eye,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { returnsApi, type SaleReturn, type SaleForReturn } from '../api/returns.ts';
import { useAuthStore } from '../store/authStore.ts';
import { useCurrency } from '../hooks/useCurrency.ts';
import axios from 'axios';

const fmtQty = (v: number | string | null | undefined, dec = 0) =>
  v != null ? parseFloat(String(v)).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : '—';

const RETURN_METHOD_LABELS: Record<string, string> = {
  cash_refund:   'رد نقدي',
  debt_discount: 'خصم من الدين',
  stock_only:    'استرداد مخزون فقط',
};

const RETURN_METHOD_COLORS: Record<string, { bg: string; color: string }> = {
  cash_refund:   { bg: '#dcfce7', color: '#166534' },
  debt_discount: { bg: '#dbeafe', color: '#1e40af' },
  stock_only:    { bg: '#f3f4f6', color: '#4b5563' },
};

// ─── Return Detail Modal ──────────────────────────────────────────────────────

function ReturnDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const { fmt } = useCurrency();
  const { data } = useQuery({
    queryKey: ['return-detail', id],
    queryFn: async () => {
      const res = await returnsApi.getById(id);
      return res.data.return;
    },
  });

  const colors = data ? RETURN_METHOD_COLORS[data.return_method] : { bg: '#f3f4f6', color: '#4b5563' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden" style={{ background: '#fff' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#e2e8f0' }}>
          <h3 className="font-black text-slate-800">تفاصيل المرتجع</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        {!data ? (
          <div className="p-8 text-center text-slate-400 text-sm">جارٍ التحميل...</div>
        ) : (
          <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'رقم المرتجع',   value: data.return_number },
                { label: 'فاتورة البيع',  value: data.sale_invoice },
                { label: 'العميل',         value: data.customer_name ?? 'بدون عميل' },
                { label: 'الإجمالي',       value: fmt(data.total_amount) },
                { label: 'السبب',          value: data.reason ?? '—' },
                { label: 'التاريخ',        value: new Date(data.created_at).toLocaleDateString('en-GB') },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl p-3" style={{ background: '#f8fafc' }}>
                  <div className="text-[10px] text-slate-400 mb-0.5">{label}</div>
                  <div className="text-sm font-bold text-slate-700">{value}</div>
                </div>
              ))}
            </div>
            <div className="rounded-xl p-3 flex items-center gap-2" style={{ background: colors.bg }}>
              <span className="text-xs font-bold" style={{ color: colors.color }}>
                طريقة الإرجاع: {RETURN_METHOD_LABELS[data.return_method]}
              </span>
            </div>
            <table className="w-full text-sm" dir="rtl">
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['المنتج', 'الكمية', 'سعر الوحدة', 'الإجمالي'].map((h) => (
                    <th key={h} className="text-right px-3 py-2 text-xs font-black text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items?.map((item) => (
                  <tr key={item.id} className="border-b" style={{ borderColor: '#f1f5f9' }}>
                    <td className="px-3 py-2 font-bold text-slate-700">{item.product_name}</td>
                    <td className="px-3 py-2 text-slate-600">{fmtQty(item.quantity, 0)} {item.unit}</td>
                    <td className="px-3 py-2 text-slate-600">{fmt(item.unit_price)}</td>
                    <td className="px-3 py-2 font-bold text-rose-700">{fmt(item.total_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Create Return Modal ──────────────────────────────────────────────────────

interface ReturnItemRow {
  sale_item_id:  number;
  product_id:    number;
  product_name:  string;
  unit:          string;
  max_qty:       number;
  unit_price:    number;
  quantity:      number;
  selected:      boolean;
}

function CreateReturnModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { fmt } = useCurrency();
  const qc = useQueryClient();
  const [saleIdInput, setSaleIdInput] = useState('');
  const [sale, setSale]               = useState<SaleForReturn | null>(null);
  const [loadError, setLoadError]     = useState('');
  const [returnItems, setReturnItems] = useState<ReturnItemRow[]>([]);
  const [returnMethod, setReturnMethod] = useState<'cash_refund' | 'debt_discount' | 'stock_only'>('cash_refund');
  const [reason, setReason]           = useState('');
  const [notes, setNotes]             = useState('');
  const [error, setError]             = useState('');

  const loadSale = async () => {
    const id = parseInt(saleIdInput, 10);
    if (!id) return;
    setLoadError('');
    try {
      const res = await returnsApi.getSaleForReturn(id);
      const s = res.data.sale;
      setSale(s);
      setReturnItems(
        s.items.map((item) => ({
          sale_item_id: item.id,
          product_id:   item.product_id,
          product_name: item.product_name,
          unit:         item.unit,
          max_qty:      parseFloat(String(item.quantity)),
          unit_price:   parseFloat(String(item.unit_price)),
          quantity:     parseFloat(String(item.quantity)),
          selected:     false,
        }))
      );
    } catch (e: unknown) {
      if (axios.isAxiosError(e)) setLoadError(e.response?.data?.message ?? 'الفاتورة غير موجودة');
    }
  };

  const selectedItems = returnItems.filter((i) => i.selected);
  const total = selectedItems.reduce((s, i) => s + i.quantity * i.unit_price, 0);

  const mutation = useMutation({
    mutationFn: () =>
      returnsApi.create({
        sale_id:       sale!.id,
        items:         selectedItems.map(({ sale_item_id, product_id, quantity, unit_price }) => ({
          sale_item_id, product_id, quantity, unit_price,
        })),
        return_method: returnMethod,
        reason:        reason || undefined,
        notes:         notes  || undefined,
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['returns'] }); onDone(); },
    onError: (e: unknown) => {
      if (axios.isAxiosError(e)) setError(e.response?.data?.message ?? 'حدث خطأ');
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ background: '#fff', maxHeight: '92vh' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: '#e2e8f0' }}>
          <h3 className="font-black text-slate-800">مرتجع جديد</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Sale Search */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">رقم فاتورة البيع</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={saleIdInput}
                onChange={(e) => setSaleIdInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadSale()}
                className="flex-1 rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
                style={{ borderColor: '#e2e8f0' }}
                placeholder="أدخل رقم الفاتورة (ID)..."
              />
              <button
                onClick={loadSale}
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-white flex items-center gap-2"
                style={{ background: '#059669' }}
              >
                <Search size={14} />
                بحث
              </button>
            </div>
            {loadError && <div className="mt-1.5 text-xs text-rose-600">{loadError}</div>}
          </div>

          {/* Sale Info */}
          {sale && (
            <>
              <div className="rounded-xl p-4 border" style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
                <div className="flex items-center gap-4 text-sm">
                  <div><span className="text-slate-500">فاتورة: </span><span className="font-black text-slate-700">{sale.invoice_number}</span></div>
                  <div><span className="text-slate-500">العميل: </span><span className="font-bold">{sale.customer_name ?? 'بدون'}</span></div>
                  <div><span className="text-slate-500">الإجمالي: </span><span className="font-black text-emerald-700">{fmt(sale.total_amount)}</span></div>
                </div>
              </div>

              {/* Items */}
              <div className="rounded-xl overflow-hidden border" style={{ borderColor: '#e2e8f0' }}>
                <table className="w-full text-sm" dir="rtl">
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th className="px-3 py-2 text-right text-xs font-black text-slate-500 w-10">✓</th>
                      {['المنتج', 'الكمية الأصلية', 'كمية الإرجاع', 'سعر الوحدة', 'الإجمالي'].map((h) => (
                        <th key={h} className="text-right px-3 py-2 text-xs font-black text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {returnItems.map((item, idx) => (
                      <tr key={item.sale_item_id} className="border-b" style={{ borderColor: '#f1f5f9' }}>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={item.selected}
                            onChange={(e) => setReturnItems((prev) =>
                              prev.map((i, j) => j === idx ? { ...i, selected: e.target.checked } : i)
                            )}
                            className="w-4 h-4 rounded"
                          />
                        </td>
                        <td className="px-3 py-2 font-bold text-slate-700">{item.product_name}</td>
                        <td className="px-3 py-2 text-slate-500">{fmtQty(item.max_qty)} {item.unit}</td>
                        <td className="px-3 py-2 w-24">
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => setReturnItems((prev) =>
                              prev.map((i, j) => j === idx ? {
                                ...i,
                                quantity: Math.min(parseFloat(e.target.value) || 0, i.max_qty),
                                selected: true,
                              } : i)
                            )}
                            className="w-full rounded-lg border px-2 py-1 text-sm outline-none text-center"
                            style={{ borderColor: '#e2e8f0' }}
                            min={0.001}
                            max={item.max_qty}
                            step={0.001}
                            disabled={!item.selected}
                          />
                        </td>
                        <td className="px-3 py-2 text-slate-600">{fmt(item.unit_price)}</td>
                        <td className="px-3 py-2 font-bold text-rose-700">
                          {item.selected ? fmt(item.quantity * item.unit_price) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {selectedItems.length > 0 && (
                    <tfoot>
                      <tr style={{ background: '#fef2f2' }}>
                        <td colSpan={5} className="px-3 py-2.5 font-black text-slate-700 text-sm">إجمالي المرتجع</td>
                        <td className="px-3 py-2.5 font-black text-rose-700">{fmt(total)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Return Method */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">طريقة الإرجاع</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['cash_refund', 'debt_discount', 'stock_only'] as const).map((m) => {
                    const c = RETURN_METHOD_COLORS[m];
                    const active = returnMethod === m;
                    return (
                      <button
                        key={m}
                        onClick={() => setReturnMethod(m)}
                        className="py-2.5 rounded-xl text-sm font-bold transition-all border-2"
                        style={{
                          background: active ? c.bg : '#fff',
                          color: active ? c.color : '#64748b',
                          borderColor: active ? c.color : '#e2e8f0',
                        }}
                      >
                        {RETURN_METHOD_LABELS[m]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Reason + Notes */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">سبب الإرجاع</label>
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
                    style={{ borderColor: '#e2e8f0' }}
                    placeholder="مثال: منتج تالف"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">ملاحظات</label>
                  <input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
                    style={{ borderColor: '#e2e8f0' }}
                    placeholder="اختياري"
                  />
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-xl p-3 text-sm text-rose-700" style={{ background: '#fef2f2' }}>
              <AlertTriangle size={14} />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t flex-shrink-0" style={{ borderColor: '#e2e8f0', background: '#f8fafc' }}>
          <div className="text-sm">
            {selectedItems.length > 0 && (
              <>
                <span className="text-slate-500">إجمالي المرتجع: </span>
                <span className="font-black text-rose-700">{fmt(total)}</span>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100">
              إلغاء
            </button>
            <button
              onClick={() => mutation.mutate()}
              disabled={!sale || selectedItems.length === 0 || mutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
              style={{ background: '#dc2626' }}
            >
              <Check size={15} />
              {mutation.isPending ? 'جارٍ الحفظ...' : 'تأكيد المرتجع'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ReturnsPage() {
  const { fmt } = useCurrency();
  const [page, setPage]             = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [viewId, setViewId]         = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['returns', page],
    queryFn: async () => {
      const res = await returnsApi.list({ page, limit: 20 });
      return res.data;
    },
  });

  const returns    = data?.returns ?? [];
  const total      = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-6 min-h-full" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-black text-slate-800">المرتجعات</h1>
          <p className="text-sm text-slate-400 mt-0.5">{total} مرتجع</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white"
          style={{ background: '#dc2626' }}
        >
          <Plus size={16} />
          مرتجع جديد
        </button>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden border shadow-sm" style={{ background: '#fff', borderColor: '#e2e8f0' }}>
        <table className="w-full text-sm" dir="rtl">
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {['رقم المرتجع', 'فاتورة البيع', 'العميل', 'الإجمالي', 'طريقة الإرجاع', 'التاريخ', ''].map((h) => (
                <th key={h} className="text-right px-4 py-3 text-xs font-black text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="text-center py-12 text-slate-400">جارٍ التحميل...</td></tr>
            )}
            {!isLoading && returns.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-16">
                  <RotateCcw size={32} className="mx-auto text-slate-200 mb-3" />
                  <p className="text-slate-400 text-sm">لا توجد مرتجعات</p>
                </td>
              </tr>
            )}
            {returns.map((r) => {
              const colors = RETURN_METHOD_COLORS[r.return_method];
              return (
                <tr key={r.id} className="border-b hover:bg-slate-50 transition-colors" style={{ borderColor: '#f1f5f9' }}>
                  <td className="px-4 py-3">
                    <span className="font-black text-slate-700 text-xs">{r.return_number}</span>
                  </td>
                  <td className="px-4 py-3 text-xs font-bold text-slate-500">{r.sale_invoice}</td>
                  <td className="px-4 py-3 text-slate-700 font-bold truncate max-w-[120px]">
                    {r.customer_name ?? '—'}
                  </td>
                  <td className="px-4 py-3 font-bold text-rose-700">{fmt(r.total_amount)}</td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-block px-2.5 py-1 rounded-full text-xs font-bold"
                      style={{ background: colors.bg, color: colors.color }}
                    >
                      {RETURN_METHOD_LABELS[r.return_method]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {new Date(r.created_at).toLocaleDateString('en-GB')}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setViewId(r.id)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                      title="عرض التفاصيل"
                    >
                      <Eye size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: '#f1f5f9' }}>
            <span className="text-xs text-slate-400">{total} نتيجة — صفحة {page} من {totalPages}</span>
            <div className="flex gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 disabled:opacity-30">
                <ChevronRight size={16} />
              </button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 disabled:opacity-30">
                <ChevronLeft size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateReturnModal onClose={() => setShowCreate(false)} onDone={() => setShowCreate(false)} />
      )}
      {viewId !== null && (
        <ReturnDetail id={viewId} onClose={() => setViewId(null)} />
      )}
    </div>
  );
}
