import React, { useState, useCallback } from 'react';
import {
  Plus, Search, Edit2, Power, Scale, Tag, Package,
  Layers, ChevronRight, ChevronLeft, AlertTriangle,
  X, Check, SlidersHorizontal, ArrowUpDown, Warehouse,
} from 'lucide-react';
import {
  useProducts, useCreateProduct, useUpdateProduct,
  useToggleProductActive, useAdjustStock,
  useCategories, useCreateCategory, useDeleteCategory,
  useSuppliers, useCreateSupplier,
  type Product, type CreateProductData, type Category, type Supplier,
} from '../api/products.ts';
import { useAuthStore } from '../store/authStore.ts';

// ─── Constants ───────────────────────────────────────────────────────────────

const UNITS = ['قطعة', 'كغ', 'غ', 'لتر', 'مل', 'علبة', 'كرتون', 'حزمة', 'متر', 'دزينة'];

const fmtPrice = (v: string | null | undefined) =>
  v ? parseFloat(v).toLocaleString('ar-SY', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '—';

const fmtQty = (v: string | null | undefined, unit?: string) =>
  v ? `${parseFloat(v).toLocaleString('ar-SY', { maximumFractionDigits: 3 })} ${unit ?? ''}`.trim() : '0';

// ─── Stock Badge ─────────────────────────────────────────────────────────────

function StockBadge({ qty, min, unit }: { qty: string; min: string; unit: string }) {
  const q = parseFloat(qty);
  const m = parseFloat(min);
  const isOut = q <= 0;
  const isLow = !isOut && q <= m;

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
      style={{
        background: isOut ? '#fee2e2' : isLow ? '#fef3c7' : '#dcfce7',
        color:      isOut ? '#b91c1c' : isLow ? '#92400e' : '#166534',
      }}
    >
      {isOut && <AlertTriangle size={11} />}
      {fmtQty(qty, unit)}
    </span>
  );
}

// ─── Product Form ─────────────────────────────────────────────────────────────

interface ProductFormState {
  barcode: string;
  name: string;
  category_id: string;
  unit: string;
  is_weighted: boolean;
  purchase_price: string;
  retail_price: string;
  wholesale_price: string;
  wholesale_min_qty: string;
  initial_stock: string;
  min_stock_level: string;
  expiry_date: string;
  supplier_id: string;
  notes: string;
}

const EMPTY_FORM: ProductFormState = {
  barcode: '', name: '', category_id: '', unit: 'قطعة', is_weighted: false,
  purchase_price: '', retail_price: '', wholesale_price: '', wholesale_min_qty: '1',
  initial_stock: '0', min_stock_level: '5', expiry_date: '', supplier_id: '', notes: '',
};

function toFormState(p: Product): ProductFormState {
  return {
    barcode:          p.barcode ?? '',
    name:             p.name,
    category_id:      p.category_id ?? '',
    unit:             p.unit,
    is_weighted:      p.is_weighted,
    purchase_price:   p.purchase_price,
    retail_price:     p.retail_price,
    wholesale_price:  p.wholesale_price ?? '',
    wholesale_min_qty:p.wholesale_min_qty,
    initial_stock:    '0',
    min_stock_level:  p.min_stock_level,
    expiry_date:      p.expiry_date ? p.expiry_date.split('T')[0] : '',
    supplier_id:      p.supplier_id ?? '',
    notes:            p.notes ?? '',
  };
}

interface ProductModalProps {
  editProduct: Product | null;
  categories: Category[];
  suppliers: Supplier[];
  onClose: () => void;
  onSubmit: (data: CreateProductData) => void;
  loading: boolean;
  error: string;
}

function ProductModal({ editProduct, categories, suppliers, onClose, onSubmit, loading, error }: ProductModalProps) {
  const [form, setForm] = useState<ProductFormState>(
    editProduct ? toFormState(editProduct) : EMPTY_FORM
  );

  const set = (field: keyof ProductFormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const toggle = (field: keyof ProductFormState) => () =>
    setForm((f) => ({ ...f, [field]: !f[field] }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parseNum = (s: string, fallback = 0) => {
      const n = parseFloat(s.replace(/,/g, ''));
      return isNaN(n) ? fallback : n;
    };
    onSubmit({
      barcode:          form.barcode.trim() || null,
      name:             form.name.trim(),
      category_id:      form.category_id ? parseInt(form.category_id, 10) : null,
      unit:             form.unit,
      is_weighted:      form.is_weighted,
      purchase_price:   parseNum(form.purchase_price),
      retail_price:     parseNum(form.retail_price),
      wholesale_price:  form.wholesale_price ? parseNum(form.wholesale_price) : null,
      wholesale_min_qty:parseNum(form.wholesale_min_qty, 1),
      initial_stock:    parseNum(form.initial_stock),
      min_stock_level:  parseNum(form.min_stock_level, 5),
      expiry_date:      form.expiry_date || null,
      supplier_id:      form.supplier_id ? parseInt(form.supplier_id, 10) : null,
      notes:            form.notes.trim() || null,
    });
  };

  const labelCls = 'block text-xs font-bold text-slate-600 mb-1';
  const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#f0fdf4' }}>
              <Package size={16} style={{ color: '#059669' }} />
            </div>
            <h2 className="font-black text-slate-800 text-base">
              {editProduct ? 'تعديل المنتج' : 'إضافة منتج جديد'}
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl text-sm font-semibold text-red-700" style={{ background: '#fee2e2' }}>
              <AlertTriangle size={15} />
              {error}
            </div>
          )}

          {/* === المعلومات الأساسية === */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Tag size={14} style={{ color: '#059669' }} />
              <span className="text-xs font-black text-slate-500 uppercase tracking-wider">المعلومات الأساسية</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={labelCls}>اسم المنتج *</label>
                <input required value={form.name} onChange={set('name')} className={inputCls} placeholder="أدخل اسم المنتج" />
              </div>
              <div>
                <label className={labelCls}>الباركود</label>
                <input value={form.barcode} onChange={set('barcode')} className={inputCls} placeholder="اختياري" dir="ltr" />
              </div>
              <div>
                <label className={labelCls}>الفئة</label>
                <select value={form.category_id} onChange={set('category_id')} className={inputCls}>
                  <option value="">— بلا فئة —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>وحدة القياس</label>
                <select value={form.unit} onChange={set('unit')} className={inputCls}>
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className="flex items-center">
                <label className="flex items-center gap-2.5 cursor-pointer select-none" style={{ marginTop: '20px' }}>
                  <div
                    onClick={toggle('is_weighted')}
                    className="w-11 h-6 rounded-full relative transition-colors cursor-pointer flex-shrink-0"
                    style={{ background: form.is_weighted ? '#059669' : '#e2e8f0' }}
                  >
                    <div
                      className="absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all"
                      style={{ right: form.is_weighted ? '24px' : '4px' }}
                    />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <Scale size={12} />
                      منتج موزون
                    </div>
                    <div className="text-[10px] text-slate-400">الكمية بالكيلو/الغرام</div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* === الأسعار === */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ArrowUpDown size={14} style={{ color: '#059669' }} />
              <span className="text-xs font-black text-slate-500 uppercase tracking-wider">الأسعار</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>سعر الشراء *</label>
                <input required type="number" min="0" step="0.01" value={form.purchase_price} onChange={set('purchase_price')}
                  className={inputCls} placeholder="0.00" dir="ltr" />
              </div>
              <div>
                <label className={labelCls}>سعر البيع (مفرق) *</label>
                <input required type="number" min="0" step="0.01" value={form.retail_price} onChange={set('retail_price')}
                  className={inputCls} placeholder="0.00" dir="ltr" />
              </div>
              <div>
                <label className={labelCls}>سعر البيع (جملة)</label>
                <input type="number" min="0" step="0.01" value={form.wholesale_price} onChange={set('wholesale_price')}
                  className={inputCls} placeholder="اختياري" dir="ltr" />
              </div>
              {form.wholesale_price && (
                <div>
                  <label className={labelCls}>الحد الأدنى للجملة (كمية)</label>
                  <input type="number" min="0" step="0.01" value={form.wholesale_min_qty} onChange={set('wholesale_min_qty')}
                    className={inputCls} placeholder="1" dir="ltr" />
                </div>
              )}
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* === المخزون والمورد === */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Warehouse size={14} style={{ color: '#059669' }} />
              <span className="text-xs font-black text-slate-500 uppercase tracking-wider">المخزون والمورد</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {!editProduct && (
                <div>
                  <label className={labelCls}>الكمية الافتتاحية</label>
                  <input type="number" min="0" step="0.001" value={form.initial_stock} onChange={set('initial_stock')}
                    className={inputCls} placeholder="0" dir="ltr" />
                </div>
              )}
              <div>
                <label className={labelCls}>حد التنبيه (أقل كمية)</label>
                <input type="number" min="0" step="0.001" value={form.min_stock_level} onChange={set('min_stock_level')}
                  className={inputCls} placeholder="5" dir="ltr" />
              </div>
              <div>
                <label className={labelCls}>تاريخ الانتهاء</label>
                <input type="date" value={form.expiry_date} onChange={set('expiry_date')} className={inputCls} dir="ltr" />
              </div>
              <div className={editProduct ? 'col-span-2' : ''}>
                <label className={labelCls}>المورد</label>
                <select value={form.supplier_id} onChange={set('supplier_id')} className={inputCls}>
                  <option value="">— بلا مورد —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-3">
              <label className={labelCls}>ملاحظات</label>
              <textarea value={form.notes} onChange={set('notes')} rows={2}
                className={inputCls + ' resize-none'} placeholder="ملاحظات إضافية (اختياري)" />
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
          <button type="button" onClick={onClose}
            className="px-5 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors">
            إلغاء
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              const f = document.querySelector('form');
              f?.requestSubmit();
            }}
            disabled={loading}
            className="px-6 py-2 rounded-xl text-sm font-black text-white transition-all disabled:opacity-50"
            style={{ background: '#059669' }}
          >
            {loading ? 'جاري الحفظ...' : editProduct ? 'حفظ التعديلات' : 'إضافة المنتج'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Stock Adjust Modal ───────────────────────────────────────────────────────

function StockModal({ product, onClose, onSubmit, loading }: {
  product: Product;
  onClose: () => void;
  onSubmit: (qty: number, note: string) => void;
  loading: boolean;
}) {
  const [qty, setQty] = useState(product.stock_quantity);
  const [note, setNote] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" dir="rtl">
        <h3 className="font-black text-slate-800 mb-1">تعديل المخزون</h3>
        <p className="text-xs text-slate-400 mb-4">{product.name}</p>

        <div className="mb-3">
          <label className="block text-xs font-bold text-slate-600 mb-1">الكمية الجديدة</label>
          <input
            type="number" min="0" step="0.001"
            value={qty} onChange={(e) => setQty(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-emerald-400"
            dir="ltr"
          />
          <p className="text-[10px] text-slate-400 mt-1">
            الكمية الحالية: {fmtQty(product.stock_quantity, product.unit)}
          </p>
        </div>
        <div className="mb-5">
          <label className="block text-xs font-bold text-slate-600 mb-1">سبب التعديل</label>
          <input
            value={note} onChange={(e) => setNote(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-emerald-400"
            placeholder="جرد، تصحيح، ..."
          />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2 rounded-xl text-sm font-bold text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors">
            إلغاء
          </button>
          <button
            onClick={() => onSubmit(parseFloat(qty) || 0, note)}
            disabled={loading}
            className="flex-1 py-2 rounded-xl text-sm font-black text-white disabled:opacity-50 transition-all"
            style={{ background: '#059669' }}
          >
            {loading ? 'جاري...' : 'حفظ'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Categories Panel ─────────────────────────────────────────────────────────

function CategoriesPanel({ categories, onClose }: { categories: Category[]; onClose: () => void }) {
  const [newName, setNewName] = useState('');
  const createCat = useCreateCategory();
  const deleteCat = useDeleteCategory();
  const [err, setErr] = useState('');

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setErr('');
    try {
      await createCat.mutateAsync({ name: newName.trim() });
      setNewName('');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErr(msg ?? 'حدث خطأ');
    }
  };

  const handleDelete = async (id: string, count: number) => {
    if (count > 0) { setErr('لا يمكن حذف فئة تحتوي منتجات'); return; }
    setErr('');
    try { await deleteCat.mutateAsync(id); } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErr(msg ?? 'حدث خطأ');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" dir="rtl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-black text-slate-800 flex items-center gap-2">
            <Layers size={16} style={{ color: '#059669' }} /> الفئات
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        {err && <p className="text-xs text-red-600 mb-3 font-semibold">{err}</p>}

        <div className="flex gap-2 mb-4">
          <input
            value={newName} onChange={(e) => setNewName(e.target.value)}
            className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-400"
            placeholder="اسم الفئة الجديدة"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <button onClick={handleAdd} disabled={createCat.isPending}
            className="px-3 py-2 rounded-xl text-white text-sm font-bold disabled:opacity-50"
            style={{ background: '#059669' }}>
            <Plus size={16} />
          </button>
        </div>

        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {categories.length === 0 && <p className="text-xs text-slate-400 text-center py-4">لا توجد فئات بعد</p>}
          {categories.map((c) => (
            <div key={c.id} className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-50 group">
              <div>
                <span className="text-sm font-semibold text-slate-700">{c.name}</span>
                <span className="text-[10px] text-slate-400 mr-2">({c.products_count} منتج)</span>
              </div>
              <button
                onClick={() => handleDelete(c.id, c.products_count)}
                className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                title="حذف الفئة"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProductsPage() {
  const user = useAuthStore((s) => s.user);
  const canEdit = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'warehouse';
  const canToggleActive = user?.role === 'admin' || user?.role === 'manager';

  // ─── Filters ───────────────────────────────────────────────────────────────
  const [search, setSearch]       = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [activeTab, setActiveTab] = useState<'true' | 'false' | 'all'>('true');
  const [lowStock, setLowStock]   = useState(false);
  const [page, setPage]           = useState(1);

  const resetPage = useCallback(() => setPage(1), []);

  // ─── Queries ───────────────────────────────────────────────────────────────
  const { data, isLoading } = useProducts({
    q:           search || undefined,
    category_id: categoryId || undefined,
    is_active:   activeTab,
    low_stock:   lowStock || undefined,
    page,
    limit: 20,
  });
  const { data: categories = [] } = useCategories();
  const { data: suppliers  = [] } = useSuppliers();

  // ─── Mutations ─────────────────────────────────────────────────────────────
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const toggleActive  = useToggleProductActive();
  const adjustStock   = useAdjustStock();

  // ─── Modals ────────────────────────────────────────────────────────────────
  const [showProductModal, setShowProductModal] = useState(false);
  const [editProduct, setEditProduct]           = useState<Product | null>(null);
  const [stockProduct, setStockProduct]         = useState<Product | null>(null);
  const [showCategories, setShowCategories]     = useState(false);
  const [modalError, setModalError]             = useState('');

  const openCreate = () => { setEditProduct(null); setModalError(''); setShowProductModal(true); };
  const openEdit   = (p: Product) => { setEditProduct(p); setModalError(''); setShowProductModal(true); };
  const closeModal = () => { setShowProductModal(false); setEditProduct(null); setModalError(''); };

  const handleProductSubmit = async (data: CreateProductData) => {
    setModalError('');
    try {
      if (editProduct) {
        const { initial_stock: _, ...rest } = data;
        await updateProduct.mutateAsync({ id: editProduct.id, ...rest });
      } else {
        await createProduct.mutateAsync(data);
      }
      closeModal();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setModalError(msg ?? 'حدث خطأ، يرجى المحاولة مرة أخرى');
    }
  };

  const handleAdjustStock = async (qty: number, note: string) => {
    if (!stockProduct) return;
    await adjustStock.mutateAsync({ id: stockProduct.id, new_quantity: qty, note });
    setStockProduct(null);
  };

  const products   = data?.products    ?? [];
  const pagination = data?.pagination;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-black text-slate-800">إدارة المنتجات</h1>
          <p className="text-xs text-slate-400 mt-0.5 font-medium">
            {pagination ? `${pagination.total.toLocaleString('ar-SY')} منتج إجمالاً` : '...'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCategories(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Layers size={14} />
            الفئات
          </button>
          {canEdit && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black text-white transition-all hover:opacity-90"
              style={{ background: '#059669' }}
            >
              <Plus size={15} />
              منتج جديد
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-4 flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute top-2.5 right-3 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPage(); }}
            placeholder="بحث بالاسم أو الباركود..."
            className="w-full border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100"
          />
        </div>

        {/* Category */}
        <select
          value={categoryId}
          onChange={(e) => { setCategoryId(e.target.value); resetPage(); }}
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-emerald-400"
        >
          <option value="">جميع الفئات</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* Active Tabs */}
        <div className="flex bg-slate-100 rounded-xl p-0.5 gap-0.5">
          {(['true', 'all', 'false'] as const).map((v) => (
            <button
              key={v}
              onClick={() => { setActiveTab(v); resetPage(); }}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={
                activeTab === v
                  ? { background: '#fff', color: '#059669', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
                  : { color: '#64748b' }
              }
            >
              {v === 'true' ? 'نشط' : v === 'false' ? 'أرشيف' : 'الكل'}
            </button>
          ))}
        </div>

        {/* Low Stock Toggle */}
        <button
          onClick={() => { setLowStock((v) => !v); resetPage(); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all"
          style={
            lowStock
              ? { background: '#fef3c7', borderColor: '#fbbf24', color: '#92400e' }
              : { borderColor: '#e2e8f0', color: '#64748b' }
          }
        >
          <AlertTriangle size={13} />
          مخزون منخفض
        </button>

        {/* Filters indicator */}
        {(search || categoryId || lowStock) && (
          <button
            onClick={() => { setSearch(''); setCategoryId(''); setLowStock(false); resetPage(); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-50 border border-rose-100 transition-colors"
          >
            <X size={12} />
            إلغاء الفلاتر
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-slate-400 text-sm font-medium">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              جاري التحميل...
            </div>
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            <Package size={32} className="mb-2 opacity-30" />
            <p className="text-sm font-semibold">لا توجد منتجات</p>
            {canEdit && activeTab === 'true' && !search && !categoryId && (
              <button
                onClick={openCreate}
                className="mt-3 text-xs font-bold text-emerald-600 hover:text-emerald-700"
              >
                + أضف أول منتج
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100" style={{ background: '#f8fafc' }}>
                  {['الباركود', 'المنتج', 'الفئة', 'الوحدة', 'سعر المفرق', 'سعر الجملة', 'المخزون', 'الحالة', ''].map((h) => (
                    <th key={h} className="text-right px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-4 py-3 text-xs font-mono text-slate-400 whitespace-nowrap">
                      {p.barcode ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {p.is_weighted && (
                          <span title="منتج موزون">
                            <Scale size={13} style={{ color: '#0369a1' }} className="flex-shrink-0" />
                          </span>
                        )}
                        <span className="text-sm font-bold text-slate-700 leading-tight">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {p.category_name ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold"
                          style={{ background: '#f0fdf4', color: '#166534' }}>
                          {p.category_name}
                        </span>
                      ) : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 font-medium">{p.unit}</td>
                    <td className="px-4 py-3 text-sm font-black text-slate-700 whitespace-nowrap">
                      {fmtPrice(p.retail_price)} ل.س
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {p.wholesale_price ? (
                        <div>
                          <span className="text-sm font-bold text-blue-700">{fmtPrice(p.wholesale_price)} ل.س</span>
                          <span className="text-[10px] text-slate-400 block">
                            من {fmtQty(p.wholesale_min_qty, p.unit)}
                          </span>
                        </div>
                      ) : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <StockBadge qty={p.stock_quantity} min={p.min_stock_level} unit={p.unit} />
                        {canEdit && (
                          <button
                            onClick={() => setStockProduct(p)}
                            className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-emerald-600 transition-all p-0.5 rounded"
                            title="تعديل المخزون"
                          >
                            <SlidersHorizontal size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
                        style={{
                          background: p.is_active ? '#f0fdf4' : '#f1f5f9',
                          color:      p.is_active ? '#166534' : '#94a3b8',
                        }}
                      >
                        {p.is_active ? <><Check size={10} />نشط</> : 'أرشيف'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {canEdit && (
                          <button
                            onClick={() => openEdit(p)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                            title="تعديل"
                          >
                            <Edit2 size={13} />
                          </button>
                        )}
                        {canToggleActive && (
                          <button
                            onClick={() => toggleActive.mutate(p.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                            title={p.is_active ? 'أرشفة' : 'تفعيل'}
                          >
                            <Power size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-slate-400 font-medium">
            صفحة {pagination.page} من {pagination.pages}
            {' '}({pagination.total} منتج)
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pagination.page <= 1}
              className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={15} />
            </button>
            {Array.from({ length: Math.min(pagination.pages, 5) }, (_, i) => {
              const p = pagination.pages <= 5
                ? i + 1
                : page <= 3 ? i + 1
                : page >= pagination.pages - 2 ? pagination.pages - 4 + i
                : page - 2 + i;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className="w-8 h-8 rounded-lg text-xs font-bold transition-all"
                  style={
                    p === page
                      ? { background: '#059669', color: '#fff' }
                      : { border: '1px solid #e2e8f0', color: '#475569' }
                  }
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
              disabled={pagination.page >= pagination.pages}
              className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {showProductModal && (
        <ProductModal
          editProduct={editProduct}
          categories={categories}
          suppliers={suppliers}
          onClose={closeModal}
          onSubmit={handleProductSubmit}
          loading={createProduct.isPending || updateProduct.isPending}
          error={modalError}
        />
      )}
      {stockProduct && (
        <StockModal
          product={stockProduct}
          onClose={() => setStockProduct(null)}
          onSubmit={handleAdjustStock}
          loading={adjustStock.isPending}
        />
      )}
      {showCategories && (
        <CategoriesPanel
          categories={categories}
          onClose={() => setShowCategories(false)}
        />
      )}
    </div>
  );
}
