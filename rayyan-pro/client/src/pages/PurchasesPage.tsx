import React, { useState } from 'react';
import {
  Plus, Search, Truck, Package, ChevronRight, ChevronLeft,
  X, Check, AlertTriangle, DollarSign, CreditCard, Eye,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchasesApi, type Purchase, type PurchaseItemInput } from '../api/purchases.ts';
import { useAuthStore } from '../store/authStore.ts';
import axios from 'axios';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number | string | null | undefined, dec = 2) =>
  v != null ? parseFloat(String(v)).toLocaleString('ar-SY', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : '—';

const api = axios.create({ baseURL: '/api' });
api.interceptors.request.use((c) => {
  const t = localStorage.getItem('accessToken');
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});

// ─── Product Search ───────────────────────────────────────────────────────────

interface ProductRow {
  id: number; name: string; barcode: string; unit: string;
  purchase_price: string; stock_quantity: string; supplier_name?: string;
}

function ProductSearch({ onSelect }: { onSelect: (p: ProductRow) => void }) {
  const [q, setQ] = useState('');
  const { data, isFetching } = useQuery({
    queryKey: ['products-search', q],
    queryFn: async () => {
      if (q.trim().length < 2) return [];
      const res = await api.get<{ products: ProductRow[] }>('/products', { params: { search: q, limit: 10 } });
      return res.data.products ?? [];
    },
    enabled: q.trim().length >= 2,
  });

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-xl border px-3 py-2.5" style={{ borderColor: '#e2e8f0' }}>
        <Search size={15} className="text-slate-400 flex-shrink-0" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث عن منتج بالاسم أو الباركود..."
          className="flex-1 outline-none text-sm bg-transparent"
          dir="rtl"
        />
        {isFetching && <span className="text-[10px] text-slate-400">...</span>}
      </div>
      {q.trim().length >= 2 && (data?.length ?? 0) > 0 && (
        <div
          className="absolute z-20 w-full mt-1 rounded-xl border shadow-xl overflow-hidden"
          style={{ background: '#fff', borderColor: '#e2e8f0' }}
        >
          {data!.map((p) => (
            <button
              key={p.id}
              onClick={() => { onSelect(p); setQ(''); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 text-right border-b last:border-0"
              style={{ borderColor: '#f1f5f9' }}
            >
              <Package size={14} className="text-slate-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-800 truncate">{p.name}</div>
                <div className="text-[11px] text-slate-400">{p.barcode || 'بدون باركود'} · مخزون: {fmt(p.stock_quantity, 0)} {p.unit}</div>
              </div>
              <div className="text-xs font-bold text-emerald-600 flex-shrink-0">
                {fmt(p.purchase_price)}
              </div>
            </button>
          ))}
        </div>
      )}
      {q.trim().length >= 2 && data?.length === 0 && !isFetching && (
        <div className="absolute z-20 w-full mt-1 rounded-xl border p-4 text-center text-sm text-slate-400" style={{ background: '#fff', borderColor: '#e2e8f0' }}>
          لا نتائج
        </div>
      )}
    </div>
  );
}

// ─── Supplier Select ──────────────────────────────────────────────────────────

interface SupplierRow { id: number; name: string; balance: string; }

function useSuppliers() {
  return useQuery({
    queryKey: ['suppliers-mini'],
    queryFn: async () => {
      const res = await api.get<{ suppliers: SupplierRow[] }>('/suppliers', { params: { limit: 200 } });
      return res.data.suppliers ?? [];
    },
  });
}

// ─── Invoice Row ──────────────────────────────────────────────────────────────

interface InvoiceItem extends PurchaseItemInput { name: string; unit: string; }

// ─── Payment Modal ────────────────────────────────────────────────────────────

function PaymentModal({
  purchase, onClose, onDone,
}: {
  purchase: Purchase;
  onClose: () => void;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  const due = parseFloat(String(purchase.due_amount));

  const mutation = useMutation({
    mutationFn: () => purchasesApi.addPayment(purchase.id, parseFloat(amount)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchases'] }); onDone(); },
    onError: (e: unknown) => {
      if (axios.isAxiosError(e)) setError(e.response?.data?.message ?? 'حدث خطأ');
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-sm rounded-2xl p-6 shadow-2xl" style={{ background: '#fff' }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-black text-slate-800">تسجيل دفعة</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div className="mb-4 p-3 rounded-xl" style={{ background: '#f8fafc' }}>
          <div className="text-xs text-slate-500 mb-1">فاتورة: <span className="font-bold text-slate-700">{purchase.invoice_number}</span></div>
          <div className="text-xs text-slate-500">المتبقي: <span className="font-black text-rose-600">{fmt(due)} $</span></div>
        </div>

        <label className="block text-xs font-bold text-slate-600 mb-1.5">المبلغ المدفوع</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
          style={{ borderColor: '#e2e8f0' }}
          placeholder={`الحد الأقصى ${fmt(due)}`}
          max={due}
          min={0.01}
          step={0.01}
        />

        {error && <div className="mt-2 text-xs text-rose-600">{error}</div>}

        <div className="flex gap-2 mt-5">
          <button
            onClick={() => mutation.mutate()}
            disabled={!amount || parseFloat(amount) <= 0 || mutation.isPending}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity disabled:opacity-50"
            style={{ background: '#059669' }}
          >
            <Check size={15} />
            {mutation.isPending ? 'جارٍ...' : 'تأكيد'}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100">
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Purchase Detail Modal ────────────────────────────────────────────────────

function PurchaseDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const { data } = useQuery({
    queryKey: ['purchase-detail', id],
    queryFn: async () => {
      const res = await purchasesApi.getById(id);
      return res.data.purchase;
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden" style={{ background: '#fff' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#e2e8f0' }}>
          <h3 className="font-black text-slate-800">تفاصيل الفاتورة</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        {!data ? (
          <div className="p-8 text-center text-slate-400 text-sm">جارٍ التحميل...</div>
        ) : (
          <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'رقم الفاتورة', value: data.invoice_number },
                { label: 'المورد',        value: data.supplier_name ?? 'بدون مورد' },
                { label: 'الإجمالي',      value: `${fmt(data.total_amount)} $` },
                { label: 'المدفوع',       value: `${fmt(data.paid_amount)} $` },
                { label: 'المتبقي',       value: `${fmt(data.due_amount)} $` },
                { label: 'تاريخ الفاتورة',value: new Date(data.created_at).toLocaleDateString('ar-SY') },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl p-3" style={{ background: '#f8fafc' }}>
                  <div className="text-[10px] text-slate-400 mb-0.5">{label}</div>
                  <div className="text-sm font-bold text-slate-700">{value}</div>
                </div>
              ))}
            </div>

            <table className="w-full text-sm" dir="rtl">
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['المنتج', 'الكمية', 'سعر الشراء', 'الإجمالي'].map((h) => (
                    <th key={h} className="text-right px-3 py-2 text-xs font-black text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items?.map((item) => (
                  <tr key={item.id} className="border-b" style={{ borderColor: '#f1f5f9' }}>
                    <td className="px-3 py-2 font-bold text-slate-700">{item.product_name}</td>
                    <td className="px-3 py-2 text-slate-600">{fmt(item.quantity, 0)} {item.unit}</td>
                    <td className="px-3 py-2 text-slate-600">{fmt(item.unit_price)}</td>
                    <td className="px-3 py-2 font-bold text-emerald-700">{fmt(item.total_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {data.notes && (
              <div className="rounded-xl p-3 text-sm text-slate-600" style={{ background: '#f8fafc' }}>
                <span className="font-bold text-slate-500 ml-2">ملاحظات:</span>{data.notes}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Create Purchase Modal ────────────────────────────────────────────────────

function CreatePurchaseModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const qc = useQueryClient();
  const { data: suppliers = [] } = useSuppliers();
  const [supplierId, setSupplierId] = useState<number | ''>('');
  const [items, setItems]           = useState<InvoiceItem[]>([]);
  const [paidAmount, setPaidAmount] = useState('0');
  const [notes, setNotes]           = useState('');
  const [error, setError]           = useState('');

  const total = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);

  const addProduct = (p: ProductRow) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product_id === p.id);
      if (existing) {
        return prev.map((i) => i.product_id === p.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, {
        product_id: p.id, name: p.name, unit: p.unit,
        quantity: 1, unit_price: parseFloat(p.purchase_price) || 0,
      }];
    });
  };

  const mutation = useMutation({
    mutationFn: () =>
      purchasesApi.create({
        supplier_id:       supplierId || null,
        items:             items.map(({ product_id, quantity, unit_price }) => ({ product_id, quantity, unit_price })),
        paid_amount:       parseFloat(paidAmount) || 0,
        purchase_currency: 'USD',
        exchange_rate:     1,
        notes:             notes || undefined,
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchases'] }); onDone(); },
    onError: (e: unknown) => {
      if (axios.isAxiosError(e)) setError(e.response?.data?.message ?? 'حدث خطأ');
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ background: '#fff', maxHeight: '92vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: '#e2e8f0' }}>
          <h3 className="font-black text-slate-800">فاتورة شراء جديدة</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Supplier */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">المورد (اختياري)</label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value ? parseInt(e.target.value, 10) : '')}
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
              style={{ borderColor: '#e2e8f0' }}
            >
              <option value="">— بدون مورد —</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Product Search */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">إضافة منتج</label>
            <ProductSearch onSelect={addProduct} />
          </div>

          {/* Items Table */}
          {items.length > 0 && (
            <div className="rounded-xl overflow-hidden border" style={{ borderColor: '#e2e8f0' }}>
              <table className="w-full text-sm" dir="rtl">
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['المنتج', 'الكمية', 'سعر الوحدة', 'الإجمالي', ''].map((h) => (
                      <th key={h} className="text-right px-3 py-2 text-xs font-black text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={item.product_id} className="border-b" style={{ borderColor: '#f1f5f9' }}>
                      <td className="px-3 py-2 font-bold text-slate-700">{item.name}</td>
                      <td className="px-3 py-2 w-24">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => setItems((prev) => prev.map((i, j) => j === idx ? { ...i, quantity: parseFloat(e.target.value) || 0 } : i))}
                          className="w-full rounded-lg border px-2 py-1 text-sm outline-none text-center"
                          style={{ borderColor: '#e2e8f0' }}
                          min={0.001}
                          step={0.001}
                        />
                      </td>
                      <td className="px-3 py-2 w-28">
                        <input
                          type="number"
                          value={item.unit_price}
                          onChange={(e) => setItems((prev) => prev.map((i, j) => j === idx ? { ...i, unit_price: parseFloat(e.target.value) || 0 } : i))}
                          className="w-full rounded-lg border px-2 py-1 text-sm outline-none text-center"
                          style={{ borderColor: '#e2e8f0' }}
                          min={0}
                          step={0.01}
                        />
                      </td>
                      <td className="px-3 py-2 font-bold text-emerald-700">
                        {fmt(item.quantity * item.unit_price)}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => setItems((prev) => prev.filter((_, j) => j !== idx))}
                          className="text-rose-400 hover:text-rose-600"
                        >
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#f0fdf4' }}>
                    <td colSpan={3} className="px-3 py-2.5 font-black text-slate-700 text-sm">الإجمالي</td>
                    <td colSpan={2} className="px-3 py-2.5 font-black text-emerald-700">{fmt(total)} $</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Payment + Notes */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">المبلغ المدفوع الآن</label>
              <input
                type="number"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
                style={{ borderColor: '#e2e8f0' }}
                min={0}
                step={0.01}
              />
              {parseFloat(paidAmount) < total && total > 0 && (
                <div className="mt-1 text-xs text-rose-500 font-bold">
                  متبقي: {fmt(total - (parseFloat(paidAmount) || 0))} $
                </div>
              )}
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
            <span className="text-slate-500">الإجمالي: </span>
            <span className="font-black text-emerald-700">{fmt(total)} $</span>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100">
              إلغاء
            </button>
            <button
              onClick={() => mutation.mutate()}
              disabled={items.length === 0 || mutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
              style={{ background: '#059669' }}
            >
              <Check size={15} />
              {mutation.isPending ? 'جارٍ الحفظ...' : 'حفظ الفاتورة'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PurchasesPage() {
  const user = useAuthStore((s) => s.user);
  const canCreate = user && ['admin', 'manager', 'warehouse'].includes(user.role);
  const canPay    = user && ['admin', 'manager'].includes(user.role);

  const [search, setSearch]           = useState('');
  const [page, setPage]               = useState(1);
  const [showCreate, setShowCreate]   = useState(false);
  const [viewId, setViewId]           = useState<number | null>(null);
  const [payPurchase, setPayPurchase] = useState<Purchase | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['purchases', page],
    queryFn: async () => {
      const res = await purchasesApi.list({ page, limit: 20 });
      return res.data;
    },
  });

  const purchases = data?.purchases ?? [];
  const total     = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-6 min-h-full" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-black text-slate-800">المشتريات</h1>
          <p className="text-sm text-slate-400 mt-0.5">{total} فاتورة شراء</p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white"
            style={{ background: '#059669' }}
          >
            <Plus size={16} />
            فاتورة شراء جديدة
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden border shadow-sm" style={{ background: '#fff', borderColor: '#e2e8f0' }}>
        <table className="w-full text-sm" dir="rtl">
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {['رقم الفاتورة', 'المورد', 'الإجمالي', 'المدفوع', 'المتبقي', 'التاريخ', ''].map((h) => (
                <th key={h} className="text-right px-4 py-3 text-xs font-black text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="text-center py-12 text-slate-400">جارٍ التحميل...</td></tr>
            )}
            {!isLoading && purchases.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-16">
                  <Truck size={32} className="mx-auto text-slate-200 mb-3" />
                  <p className="text-slate-400 text-sm">لا توجد فواتير شراء</p>
                </td>
              </tr>
            )}
            {purchases.map((p) => {
              const due = parseFloat(String(p.due_amount));
              const isPaid = due <= 0;
              return (
                <tr key={p.id} className="border-b hover:bg-slate-50 transition-colors" style={{ borderColor: '#f1f5f9' }}>
                  <td className="px-4 py-3">
                    <span className="font-black text-slate-700 text-xs">{p.invoice_number}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Truck size={13} className="text-slate-400 flex-shrink-0" />
                      <span className="font-bold text-slate-700 truncate max-w-[130px]">{p.supplier_name ?? 'بدون مورد'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-700">{fmt(p.total_amount)} $</td>
                  <td className="px-4 py-3 font-bold text-emerald-600">{fmt(p.paid_amount)} $</td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-block px-2.5 py-1 rounded-full text-xs font-bold"
                      style={{
                        background: isPaid ? '#dcfce7' : '#fee2e2',
                        color:      isPaid ? '#166534' : '#b91c1c',
                      }}
                    >
                      {isPaid ? '✓ مسدد' : `${fmt(due)} $`}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {new Date(p.created_at).toLocaleDateString('ar-SY')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setViewId(p.id)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                        title="عرض التفاصيل"
                      >
                        <Eye size={14} />
                      </button>
                      {canPay && !isPaid && (
                        <button
                          onClick={() => setPayPurchase(p)}
                          className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-500 hover:text-emerald-700"
                          title="تسجيل دفعة"
                        >
                          <CreditCard size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: '#f1f5f9' }}>
            <span className="text-xs text-slate-400">{total} نتيجة — صفحة {page} من {totalPages}</span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 disabled:opacity-30"
              >
                <ChevronRight size={16} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 disabled:opacity-30"
              >
                <ChevronLeft size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreate && (
        <CreatePurchaseModal
          onClose={() => setShowCreate(false)}
          onDone={() => setShowCreate(false)}
        />
      )}
      {viewId !== null && (
        <PurchaseDetail id={viewId} onClose={() => setViewId(null)} />
      )}
      {payPurchase && (
        <PaymentModal
          purchase={payPurchase}
          onClose={() => setPayPurchase(null)}
          onDone={() => setPayPurchase(null)}
        />
      )}
    </div>
  );
}
