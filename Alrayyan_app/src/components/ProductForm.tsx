import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Save,
  Barcode,
  Package,
  Tag,
  DollarSign,
  Layers,
  Calendar,
  Truck,
  FileText,
  AlertTriangle
} from 'lucide-react';
import { motion } from 'motion/react';
import { Product, Category, Supplier } from '../types';

interface ProductFormProps {
  product: Product | null;
  categories: Category[];
  onClose: () => void;
  onSave: () => void | Promise<void>;
}

const ProductForm: React.FC<ProductFormProps> = ({ product, categories, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<Product>>({
    barcode: '',
    name: '',
    category_id: 0,
    unit: 'قطعة',
    purchase_price: 0,
    sale_price: 0,
    stock_quantity: 0,
    min_stock_level: 5,
    expiry_date: '',
    supplier_id: undefined,
    notes: '',
    image_url: ''
  });

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState<any>(null);
  const isMountedRef = useRef(true);

  const [purchasePriceInput, setPurchasePriceInput] = useState('');
  const [salePriceInput, setSalePriceInput] = useState('');
  const [stockQuantityInput, setStockQuantityInput] = useState('');
  const [minStockLevelInput, setMinStockLevelInput] = useState('');

  const normalizeDigits = (value: string) => {
  let normalized = value
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
    .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
    .replace(/٫/g, '.')
    .replace(/,/g, '.')
    .replace(/[^\d.]/g, '');

  // السماح فقط بأول نقطة عشرية
  const firstDotIndex = normalized.indexOf('.');
  if (firstDotIndex !== -1) {
    normalized =
      normalized.slice(0, firstDotIndex + 1) +
      normalized.slice(firstDotIndex + 1).replace(/\./g, '');
  }


  // لو المستخدم بدأ بـ . نخليها 0.
  if (normalized.startsWith('.')) {
    normalized = `0${normalized}`;
  }

  return normalized;
};
  const parseDecimalInput = (value: string) => {
  if (!value || value === '.' || value === '0.') return 0;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([fetchSettings(), fetchSuppliers()]);
    };

    if (product) {
      setFormData({
        ...product,
        image_url: product.image_url || '',
        notes: product.notes || '',
        expiry_date: product.expiry_date || ''
      });

      setPurchasePriceInput(
        product.purchase_price !== undefined && product.purchase_price !== null
          ? String(product.purchase_price)
          : ''
      );
      setSalePriceInput(
        product.sale_price !== undefined && product.sale_price !== null
          ? String(product.sale_price)
          : ''
      );
      setStockQuantityInput(
        product.stock_quantity !== undefined && product.stock_quantity !== null
          ? String(product.stock_quantity)
          : ''
      );
      setMinStockLevelInput(
        product.min_stock_level !== undefined && product.min_stock_level !== null
          ? String(product.min_stock_level)
          : ''
      );
    } else {
      setFormData({
        barcode: '',
        name: '',
        category_id: 0,
        unit: 'قطعة',
        purchase_price: 0,
        sale_price: 0,
        stock_quantity: 0,
        min_stock_level: 5,
        expiry_date: '',
        supplier_id: undefined,
        notes: '',
        image_url: ''
      });

      setPurchasePriceInput('');
      setSalePriceInput('');
      setStockQuantityInput('');
      setMinStockLevelInput('');
    }

    loadData();
  }, [product]);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) {
        throw new Error('فشل تحميل الإعدادات');
      }

      const data = await res.json();

      if (!isMountedRef.current) return;

      setSettings(data);

      if (!product) {
        const defaultMin = Number(data.low_stock_threshold) || 5;
        setFormData(prev => ({
          ...prev,
          min_stock_level: defaultMin
        }));
        setMinStockLevelInput(String(defaultMin));
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await fetch('/api/suppliers');
      if (!res.ok) {
        throw new Error('فشل تحميل الموردين');
      }

      const data = await res.json();

      if (!isMountedRef.current) return;
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      if (!isMountedRef.current) return;
      setSuppliers([]);
    }
  };

  const formatImageUrl = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('http') || url.startsWith('data:')) return url;
    return `/api/local-image?path=${encodeURIComponent(url)}`;
  };

  const defaultCategories = [
    'مواد غذائية',
    'منظفات',
    'مشروبات',
    'أدوية ومستحضرات صحية',
    'خضروات وفواكه',
    'ألبان وأجبان',
    'دخان '
  ];

  const categoryOptions =
    categories && categories.length > 0
      ? categories
      : defaultCategories.map((name, index) => ({
          id: index + 1,
          name
        }));

  const hardRefreshApp = () => {
    try {
      const user = localStorage.getItem('user');
      const token = localStorage.getItem('token');

      localStorage.clear();
      sessionStorage.clear();

      if (user) localStorage.setItem('user', user);
      if (token) localStorage.setItem('token', token);
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      window.location.reload();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (loading) return;

    setLoading(true);
    setError('');

    const url = product ? `/api/products/${product.id}` : '/api/products';
    const method = product ? 'PUT' : 'POST';

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, 10000);

    const payload = {
      ...formData,
      purchase_price: Number(purchasePriceInput || 0),
      sale_price: Number(salePriceInput || 0),
      stock_quantity: Number(stockQuantityInput || 0),
      min_stock_level: Number(minStockLevelInput || 0)
    };

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      let result: any = null;

      try {
        result = await res.json();
      } catch {
        result = null;
      }

      if (!res.ok || !result?.success) {
        setError(result?.message || 'فشل حفظ المنتج');
        return;
      }

      try {
        await Promise.resolve(onSave());
      } catch (saveError) {
        console.error('onSave error:', saveError);
      }

      onClose();

      setTimeout(() => {
        hardRefreshApp();
      }, 150);
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setError('انتهت مهلة الحفظ. تم إيقاف الطلب حتى لا تبقى الشاشة معلقة');
      } else {
        console.error(err);
        setError('حدث خطأ أثناء الاتصال بالخادم');
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const usdToSyp = Number(settings?.usd_to_syp || 0);
const purchasePriceUsd = Number(purchasePriceInput || 0);
const salePriceUsd = Number(salePriceInput || 0);

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-4 font-sans" dir="rtl">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/20"
      >
        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-sm">
              <Package size={24} strokeWidth={2.5} />
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              {product ? 'تعديل المنتج' : 'إضافة منتج جديد'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-12 h-12 flex items-center justify-center text-slate-400 hover:bg-slate-200 rounded-full transition-all disabled:opacity-50"
          >
            <X size={28} strokeWidth={2.5} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-10 grid grid-cols-1 md:grid-cols-2 gap-10">
          {error && (
            <div className="col-span-full bg-rose-50 text-rose-600 p-6 rounded-[1.5rem] text-sm font-black border border-rose-100 flex items-center gap-3">
              <AlertTriangle size={20} strokeWidth={3} />
              {error}
            </div>
          )}

          <div className="space-y-8">
            <div className="flex items-center gap-3 text-emerald-600 font-black text-[10px] uppercase tracking-[0.2em] mb-2">
              <Tag size={18} strokeWidth={2.5} />
              <span>المعلومات الأساسية</span>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">الباركود</label>
              <div className="relative group">
                <Barcode className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={22} />
                <input
                  type="text"
                  
                  lang="en"
                  dir="ltr"
                  value={formData.barcode || ''}
                  onChange={(e) => setFormData({ ...formData, barcode: normalizeDigits(e.target.value) })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] py-5 pr-14 pl-6 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-bold text-slate-700"
                  placeholder="امسح أو أدخل الباركود"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">اسم المنتج</label>
              <div className="relative group">
                <Package className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={22} />
                <input
                  type="text"
                  required
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] py-5 pr-14 pl-6 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-bold text-slate-700"
                  placeholder="أدخل اسم المنتج"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">رابط صورة المنتج</label>
              <div className="flex gap-4">
                <div className="relative group flex-1">
                  <FileText className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={22} />
                  <input
                    type="text"
                    value={formData.image_url || ''}
                    onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] py-5 pr-14 pl-6 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-bold text-slate-700"
                    placeholder="أدخل رابط صورة المنتج"
                  />
                </div>
                {formData.image_url && (
                  <div className="w-16 h-16 rounded-2xl border border-slate-200 overflow-hidden bg-slate-50 flex-shrink-0 shadow-sm">
                    <img
                      src={formatImageUrl(formData.image_url)}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = 'https://via.placeholder.com/150?text=Error';
                      }}
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">التصنيف</label>
                <div className="relative group">
                  <Layers className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors pointer-events-none" size={20} />
                  <select
                    required
                    value={formData.category_id || ''}
                    onChange={(e) => setFormData({ ...formData, category_id: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] py-5 pr-14 pl-6 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-bold text-slate-700 appearance-none cursor-pointer"
                  >
                    <option value="">اختر التصنيف</option>
                    {categoryOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">الوحدة</label>
                <div className="relative group">
                  <Tag className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors pointer-events-none" size={20} />
                  <select
                    required
                    value={formData.unit || 'قطعة'}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] py-5 pr-14 pl-6 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-bold text-slate-700 appearance-none cursor-pointer"
                  >
                    <option value="قطعة">قطعة</option>
                    <option value="كرتونة">كرتونة</option>
                    <option value="كيلو">كيلو</option>
                    <option value="لتر">لتر</option>
                    <option value="علبة">علبة</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="flex items-center gap-3 text-emerald-600 font-black text-[10px] uppercase tracking-[0.2em] mb-2">
              <DollarSign size={18} strokeWidth={2.5} />
              <span> التسعير بالدولار</span>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">سعر الشراء</label>
                <div className="relative group">
                <input
  type="text"
  inputMode="decimal"
  lang="en"
  dir="ltr"
  required
  value={purchasePriceInput}
  onChange={(e) => {
    const value = normalizeDigits(e.target.value);
    setPurchasePriceInput(value);
    setFormData((prev) => ({
      ...prev,
      purchase_price: parseDecimalInput(value)
    }));
  }}
  placeholder="0.00"
  className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] py-5 px-6 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-black text-slate-700 text-lg tracking-tight text-center"
/>
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-black tracking-widest">
</div>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2 text-emerald-600">سعر البيع</label>
                <div className="relative group">
               <input
  type="text"
  inputMode="decimal"
  lang="en"
  dir="ltr"
  required
  value={salePriceInput}
  onChange={(e) => {
    const value = normalizeDigits(e.target.value);
    setSalePriceInput(value);
    setFormData((prev) => ({
      ...prev,
      sale_price: parseDecimalInput(value)
    }));
  }}
  placeholder="0.00"
  className="w-full bg-emerald-50/50 border border-emerald-100 rounded-[1.5rem] py-5 px-6 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-black text-emerald-700 text-lg tracking-tight text-center"
/>
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 text-[10px] text-emerald-400 font-black tracking-widest">
 
</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">الكمية الحالية</label>
                <input
                  type="text"
                  inputMode="decimal"
                  lang="en"
                  dir="ltr"
                  required
                  value={stockQuantityInput}
                  onChange={(e) => {
                    const value = normalizeDigits(e.target.value);
                    setStockQuantityInput(value);
                    setFormData({ ...formData, stock_quantity: Number(value || 0) });
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] py-5 px-6 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-black text-slate-700 text-center"
                />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">الحد الأدنى للتنبيه</label>
                <input
                  type="text"
                  inputMode="decimal"
                  lang="en"
                  dir="ltr"
                  required
                  value={minStockLevelInput}
                  onChange={(e) => {
                    const value = normalizeDigits(e.target.value);
                    setMinStockLevelInput(value);
                    setFormData({ ...formData, min_stock_level: Number(value || 0) });
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] py-5 px-6 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-black text-slate-700 text-center"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">تاريخ الصلاحية</label>
              <div className="relative group">
                <Calendar className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={22} />
                <input
                  type="date"
                  value={formData.expiry_date || ''}
                  onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] py-5 pr-14 pl-6 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-bold text-slate-700"
                />
              </div>
            </div>
          </div>

          <div className="col-span-full space-y-8 pt-8 border-t border-slate-50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">المورد</label>
                <div className="relative group">
                  <Truck className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors pointer-events-none" size={22} />
                  <select
                    value={formData.supplier_id ?? ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        supplier_id: e.target.value ? Number(e.target.value) : undefined
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] py-5 pr-14 pl-6 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-bold text-slate-700 appearance-none cursor-pointer"
                  >
                    <option value="">اختر المورد</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">ملاحظات</label>
                <div className="relative group">
                  <FileText className="absolute right-5 top-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={22} />
                  <textarea
                    value={formData.notes || ''}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] py-5 pr-14 pl-6 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-bold text-slate-700 h-20 resize-none"
                    placeholder="أدخل أي ملاحظات إضافية"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="col-span-full pt-10 flex justify-end gap-6">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-10 py-5 bg-slate-100 text-slate-600 font-black rounded-[1.5rem] hover:bg-slate-200 transition-all active:scale-95 disabled:opacity-50"
            >
              إلغاء
            </button>

            <button
              type="submit"
              disabled={loading}
              className="px-16 py-5 bg-emerald-600 text-white font-black rounded-[1.5rem] shadow-2xl shadow-emerald-500/30 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-3"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save size={22} strokeWidth={2.5} />
              )}
              {loading ? 'جاري الحفظ...' : 'حفظ المنتج'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default ProductForm;