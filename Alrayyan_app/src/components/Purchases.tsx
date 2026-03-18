import React, { useState, useEffect } from 'react';
import {
  Search,
  Truck,
  Package,
  Trash2,
  Save,
  ShoppingCart,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Product, Supplier, User } from '../types';

interface PurchaseItem {
  product_id: number;
  name: string;
  quantity: number;
  quantityInput: string;
  unit_price: number; // مخزن داخليًا بالدولار
  unitPriceInput: string;
  total_price: number; // مخزن داخليًا بالدولار
}
interface TopPurchasedProduct extends Product {
  purchase_count: number;
  purchased_qty: number;
}

interface PurchasesProps {
  user: User | null;
}

const Purchases: React.FC<PurchasesProps> = ({ user }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<PurchaseItem[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<number | null>(null);
  const [paidAmountInput, setPaidAmountInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [settings, setSettings] = useState<any>(null);
  const [topPurchasedProducts, setTopPurchasedProducts] = useState<TopPurchasedProduct[]>([]);
  const [latestPurchaseInfo, setLatestPurchaseInfo] = useState<{
  id: number | null;
  total_amount: number;
  supplier_name: string;
}>({
  id: null,
  total_amount: 0,
  supplier_name: ''
});
  type CurrencyCode = 'SYP' | 'USD' | 'TRY' | 'SAR' | 'AED';
  const normalizeDigits = (value: string) => {
  return value
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
    .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
    .replace(/٫/g, '.')
    .replace(/,/g, '.')
    .replace(/[^\d.]/g, '')
    .replace(/(\..*)\./g, '$1');
};

     useEffect(() => {
    fetchData();
    fetchSettings();
  }, []);
  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      setSettings(data);
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };
const fetchData = async () => {
  try {
    const [prodRes, supRes, latestPurchaseRes] = await Promise.all([
      fetch('/api/products'),
      fetch('/api/suppliers'),
      fetch('/api/purchases/latest')
    ]);

    const prodData = await prodRes.json();
    const supData = await supRes.json();
    const latestPurchaseData = await latestPurchaseRes.json();

    setProducts(Array.isArray(prodData) ? prodData : []);
    setSuppliers(Array.isArray(supData) ? supData : []);
    setLatestPurchaseInfo({
  id: typeof latestPurchaseData?.id === 'number' ? latestPurchaseData.id : null,
  total_amount: Number(latestPurchaseData?.total_amount || 0),
  supplier_name: String(latestPurchaseData?.supplier_name || '')
});
  } catch (error) {
    console.error('Error fetching purchase data:', error);
    setProducts([]);
    setSuppliers([]);
    setLatestPurchaseInfo({
  id: null,
  total_amount: 0,
  supplier_name: ''
});
  }

  try {
    const topRes = await fetch('/api/purchases/top-products');
    const topData = await topRes.json();
    setTopPurchasedProducts(Array.isArray(topData) ? topData : []);
  } catch (error) {
    console.error('Error fetching top purchased products:', error);
    setTopPurchasedProducts([]);
  }
};

  const addToCart = (product: Product) => {
  setCart(prev => {
    const existing = prev.find(item => item.product_id === product.id);

    if (existing) {
      return prev.map(item =>
        item.product_id === product.id
          ? {
              ...item,
              quantity: item.quantity + 1,
              quantityInput: String(item.quantity + 1),
              total_price: (item.quantity + 1) * item.unit_price
            }
          : item
      );
    }

    return [
      ...prev,
      {
        product_id: product.id,
        name: product.name,
        quantity: 1,
        quantityInput: '1',
        unit_price: Number(product.purchase_price || 0),
        unitPriceInput: formatMoneyRaw(Number(product.purchase_price || 0)),
        total_price: Number(product.purchase_price || 0)
      }
    ];
  });

  setSearchQuery('');
};

 const updateItem = (
  id: number,
  field: 'quantity' | 'unit_price',
  rawValue: string
) => {
  const normalized = normalizeDigits(rawValue);

  setCart(prev =>
    prev.map(item => {
      if (item.product_id !== id) return item;

      const updated = { ...item };

      if (field === 'quantity') {
        updated.quantityInput = normalized;

        const qty = Number(normalized || 0);
        updated.quantity = Number.isFinite(qty) ? qty : 0;
      }

      if (field === 'unit_price') {
        updated.unitPriceInput = normalized;

        const enteredAmount = Number(normalized || 0);
        updated.unit_price = Number.isFinite(enteredAmount)
          ? convertToUSD(enteredAmount, getCurrencyCode())
          : 0;
      }

      updated.total_price = updated.quantity * updated.unit_price;
      return updated;
    })
  );
};
    const getCurrencyCode = (): CurrencyCode => {
  const currency = settings?.currency;

  if (
    currency === 'USD' ||
    currency === 'TRY' ||
    currency === 'SAR' ||
    currency === 'AED' ||
    currency === 'SYP'
  ) {
    return currency;
  }

  if (currency === '$') return 'USD';
  if (currency === 'ل.س') return 'SYP';

  return 'USD';
};

const getUsdToSyp = () => {
  return parseFloat(settings?.usd_to_syp || '11000');
};

const getUsdToTry = () => {
  return parseFloat(settings?.usd_to_try || '44');
};

const getUsdToSar = () => {
  return parseFloat(settings?.usd_to_sar || '3.75');
};

const getUsdToAed = () => {
  return parseFloat(settings?.usd_to_aed || '3.67');
};

const getRateFromUSD = (currencyCode: CurrencyCode) => {
  switch (currencyCode) {
    case 'USD':
      return 1;
    case 'SYP':
      return getUsdToSyp();
    case 'TRY':
      return getUsdToTry();
    case 'SAR':
      return getUsdToSar();
    case 'AED':
      return getUsdToAed();
    default:
      return 1;
  }
};

const getCurrencySymbol = (currencyCode?: CurrencyCode) => {
  const code = currencyCode || getCurrencyCode();

  switch (code) {
    case 'USD':
      return '$';
    case 'TRY':
      return 'TL';
    case 'SAR':
      return 'ر.س';
    case 'AED':
      return 'د.إ';
    case 'SYP':
    default:
      return 'ل.س';
  }
};

const convertFromUSD = (amount: number, targetCurrency?: CurrencyCode) => {
  const currencyCode = targetCurrency || getCurrencyCode();
  const rate = getRateFromUSD(currencyCode);
  return Number(amount || 0) * rate;
};

const convertToUSD = (amount: number, sourceCurrency?: CurrencyCode) => {
  const currencyCode = sourceCurrency || getCurrencyCode();
  const rate = getRateFromUSD(currencyCode);
  if (!rate) return Number(amount || 0);
  return Number(amount || 0) / rate;
};

const formatMoney = (amount: number, currencyCode?: CurrencyCode) => {
  const code = currencyCode || getCurrencyCode();
  const converted = convertFromUSD(Number(amount || 0), code);
  const fractionDigits = code === 'SYP' ? 0 : 2;

  return `${converted.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  })} ${getCurrencySymbol(code)}`;
};

const formatMoneyRaw = (amount: number, currencyCode?: CurrencyCode) => {
  const code = currencyCode || getCurrencyCode();
  const converted = convertFromUSD(Number(amount || 0), code);
  const fractionDigits = code === 'SYP' ? 0 : 2;

  return converted.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  });
};
  const showUsd = settings?.show_usd === 'true';

  const removeItem = (id: number) => {
    setCart(prev => prev.filter(item => item.product_id !== id));
  };

  const total = cart.reduce((sum, item) => sum + item.total_price, 0);
const paidAmountInUSD = convertToUSD(Number(paidAmountInput || 0), getCurrencyCode());
const remainingAmount = Math.max(0, total - paidAmountInUSD);

  const handleSave = async () => {
    if (cart.length === 0 || !selectedSupplier) return;
    setLoading(true);

const purchaseData = {
  supplier_id: selectedSupplier,
  total_amount: total,
  paid_amount: paidAmountInUSD,
  user_id: user?.id,
  items: cart.map(item => ({
    product_id: item.product_id,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total_price: item.total_price
  }))
};

    try {
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(purchaseData)
      });
      const result = await res.json();
      if (result.success) {
  setMessage('تم تسجيل فاتورة الشراء وتحديث المخزون بنجاح');
  setCart([]);
  setPaidAmountInput('');
  fetchData();
}else {
        setMessage(result.message || 'فشل حفظ الفاتورة');
      }
    } catch (err) {
      setMessage('حدث خطأ أثناء الاتصال بالخادم');
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const filteredProducts = searchQuery
    ? products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.barcode.includes(searchQuery))
    : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8" dir="rtl">
      <div className="lg:col-span-2 space-y-8">
        {/* Search & Selection */}
        <div
          className="app-card p-8 rounded-[2.5rem] border shadow-sm relative z-50"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="relative group">
            <Search
              className="absolute right-5 top-1/2 -translate-y-1/2 app-text-muted transition-colors"
              size={22}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث عن منتج لإضافته لفاتورة الشراء..."
              className="w-full app-muted border rounded-[2rem] py-5 pr-14 pl-6 outline-none transition-all font-bold app-text"
              style={{ borderColor: 'var(--border-color)' }}
            />
          </div>

          <AnimatePresence>
            {searchQuery && filteredProducts.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute left-8 right-8 mt-4 max-h-[400px] overflow-y-auto app-card border rounded-[2rem] shadow-2xl z-[60] custom-scrollbar"
                style={{ borderColor: 'var(--border-color)' }}
              >
                {filteredProducts.map(p => (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="w-full flex items-center justify-between p-6 border-b last:border-none transition-all group"
                    style={{ borderColor: 'var(--border-color)' }}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className="w-12 h-12 app-muted rounded-2xl flex items-center justify-center transition-all border shadow-sm"
                        style={{ color: 'var(--text-muted)', borderColor: 'transparent' }}
                      >
                        <Package size={24} strokeWidth={2.5} />
                      </div>
                      <div className="text-right">
                        <div className="font-black app-text transition-colors">{p.name}</div>
                        <div className="text-[10px] font-black app-text-muted uppercase tracking-widest">
                          المخزون: {p.stock_quantity} {p.unit}
                        </div>
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-black app-text">
  {formatMoney(Number(p.purchase_price || 0))}
</div>
{showUsd && (
  <div className="text-[10px] font-bold app-text-muted uppercase tracking-widest">
    {formatMoney(Number(p.purchase_price || 0), 'USD')}
  </div>
)}
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          <div
  className="app-card p-8 rounded-[2.5rem] border shadow-sm"
  style={{ borderColor: 'var(--border-color)' }}
>
  <div className="flex items-center justify-between mb-6">
    <h3 className="font-black app-text tracking-tight flex items-center gap-3">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ background: 'var(--theme-primary-soft)', color: 'var(--theme-primary)' }}
      >
        <Package size={20} strokeWidth={2.5} />
      </div>
      الأكثر شراءً
    </h3>

    <div
      className="px-4 py-2 app-card rounded-full border shadow-sm"
      style={{ borderColor: 'var(--border-color)' }}
    >
      <span className="text-[10px] font-black app-text-muted uppercase tracking-widest">
        {topPurchasedProducts.length} منتجات
      </span>
    </div>
  </div>

  {topPurchasedProducts.length > 0 ? (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {topPurchasedProducts.map((product) => (
        <button
          key={product.id}
          onClick={() => addToCart(product)}
          className="w-full text-right p-5 rounded-[1.75rem] border app-muted transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="font-black app-text text-sm leading-6 truncate">
                {product.name}
              </div>

              <div className="mt-2 text-[10px] font-black app-text-muted uppercase tracking-widest">
                المخزون: {product.stock_quantity} {product.unit}
              </div>

              <div className="mt-2 text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--theme-primary)' }}>
                تكرر {product.purchase_count} مرة
              </div>
            </div>

            <div className="text-left shrink-0">
              <div className="text-sm font-black app-text">
                {formatMoney(Number(product.purchase_price || 0))}
              </div>

              {showUsd && (
                <div className="text-[10px] font-bold app-text-muted uppercase tracking-widest">
                  {formatMoney(Number(product.purchase_price || 0), 'USD')}
                </div>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  ) : (
    <div className="py-10 text-center app-text-muted">
      <p className="text-xs font-black uppercase tracking-[0.2em]">
        لا توجد بيانات مشتريات سابقة لعرض المنتجات الأكثر شراءً
      </p>
    </div>
  )}
</div>
        </div>

        {/* Purchase Items List */}
        <div
          className="app-card rounded-[2.5rem] border shadow-sm overflow-hidden min-h-[500px] flex flex-col"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div
            className="px-10 py-8 border-b flex items-center justify-between app-muted"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <h3 className="font-black app-text tracking-tight flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'var(--theme-primary-soft)', color: 'var(--theme-primary)' }}
              >
                <ShoppingCart size={20} strokeWidth={2.5} />
              </div>
              أصناف فاتورة الشراء - التسعير حسب اعدادات البرنامج 
            </h3>
            <div
              className="px-4 py-2 app-card rounded-full border shadow-sm"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <span className="text-[10px] font-black app-text-muted uppercase tracking-widest">
                {cart.length} أصناف مختارة
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-8 space-y-4 custom-scrollbar">
            {cart.map(item => (
              <motion.div
                layout
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                key={item.product_id}
                className="flex flex-wrap items-center gap-6 p-6 app-muted rounded-[2rem] border transition-all duration-300"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <div className="flex-1 min-w-[200px]">
                  <div className="text-[10px] font-black app-text-muted uppercase tracking-widest mb-1">المنتج</div>
                  <div className="font-black app-text text-lg">{item.name}</div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black app-text-muted uppercase tracking-widest mr-2">الكمية</label>
                   <input
  type="text"
  inputMode="decimal"
  lang="en"
  dir="ltr"
  value={item.quantityInput}
  onChange={(e) => updateItem(item.product_id, 'quantity', e.target.value)}
                      className="w-24 app-card border rounded-2xl py-3 text-center font-black app-text outline-none transition-all"
                      style={{ borderColor: 'var(--border-color)' }}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black app-text-muted uppercase tracking-widest mr-2"> السعر   </label>
                    <input
  type="text"
  inputMode="decimal"
  lang="en"
  dir="ltr"
  value={item.unitPriceInput}
  onChange={(e) => updateItem(item.product_id, 'unit_price', e.target.value)}
  className="w-32 app-card border rounded-2xl py-3 text-center font-black app-text outline-none transition-all"
  style={{ borderColor: 'var(--border-color)' }}
/>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black app-text-muted uppercase tracking-widest mr-2 text-center block">الإجمالي</label>
                    <div className="w-32 text-center">
                     <div className="font-black text-lg" style={{ color: 'var(--theme-primary)' }}>
  {formatMoney(item.total_price)}
</div>
{showUsd && (
  <div className="text-[10px] font-bold app-text-muted uppercase tracking-widest">
    {formatMoney(item.total_price, 'USD')}
  </div>
)}
                    </div>
                  </div>
                  <button
                    onClick={() => removeItem(item.product_id)}
                    className="w-12 h-12 flex items-center justify-center text-rose-400 rounded-2xl transition-all shadow-sm border border-transparent mt-6"
                  >
                    <Trash2 size={20} strokeWidth={2.5} />
                  </button>
                </div>
              </motion.div>
            ))}

            {cart.length === 0 && (
  <div className="h-full flex flex-col items-center justify-center app-text-muted gap-6 opacity-60 py-32">
    <Truck size={80} strokeWidth={1} />
    <p className="text-sm font-black uppercase tracking-[0.12em] text-center leading-8">
      {latestPurchaseInfo.id
  ? `لم يتم إضافة أي أصناف للفاتورة - آخر فاتورة شراء رقم ${latestPurchaseInfo.id} من المورد ${latestPurchaseInfo.supplier_name || 'غير محدد'} بقيمة ${formatMoney(latestPurchaseInfo.total_amount)}`
  : 'لم يتم إضافة أي أصناف للفاتورة بعد'}
    </p>
  </div>
)}
          </div>
        </div>
      </div>

      {/* Sidebar Actions */}
      <div className="space-y-8">
        <div
          className="app-card p-8 rounded-[2.5rem] border shadow-sm space-y-8"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="space-y-4">
            <label className="text-[10px] font-black app-text-muted uppercase tracking-widest mr-2">المورد</label>
            <div className="relative group">
              <Truck
                className="absolute right-5 top-1/2 -translate-y-1/2 app-text-muted transition-colors"
                size={22}
              />
              <select
                value={selectedSupplier || ''}
                onChange={(e) => setSelectedSupplier(Number(e.target.value) || null)}
                className="w-full app-muted border rounded-[1.5rem] py-5 pr-14 pl-6 outline-none font-bold app-text appearance-none cursor-pointer transition-all"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <option value="">اختر المورد</option>
                {Array.isArray(suppliers) && suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-8 border-t space-y-6" style={{ borderColor: 'var(--border-color)' }}>
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black app-text-muted uppercase tracking-widest">إجمالي الفاتورة</span>
              <div className="text-left">
               <div className="text-2xl font-black app-text tracking-tight">
  {formatMoney(total)}
</div>
{showUsd && (
  <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--theme-primary)' }}>
    {formatMoney(total, 'USD')}
  </div>
)}
              </div>
            </div>

          <div className="space-y-3">
  <div className="flex items-center justify-between gap-3">
    <label className="text-[10px] font-black app-text-muted uppercase tracking-widest mr-2">
      المبلغ المدفوع للمورد
    </label>

    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setPaidAmountInput('')}
        disabled={!paidAmountInput}
        className="px-4 py-2 rounded-xl border font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-50"
        style={{
          borderColor: 'var(--border-color)',
          background: 'transparent',
          color: 'var(--text-muted)'
        }}
      >
        تصفير
      </button>

      <button
        type="button"
        onClick={() => setPaidAmountInput(formatMoneyRaw(total))}
        disabled={total <= 0}
        className="px-4 py-2 rounded-xl border font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-50"
        style={{
          borderColor: 'var(--theme-primary-soft-2)',
          background: 'var(--theme-primary-soft)',
          color: 'var(--theme-primary)'
        }}
      >
        دفع كامل
      </button>
    </div>
  </div>

  <div className="relative group">
    <input
      type="text"
      inputMode="decimal"
      lang="en"
      dir="ltr"
      value={paidAmountInput}
      onChange={(e) => setPaidAmountInput(normalizeDigits(e.target.value))}
      className="w-full rounded-[1.5rem] py-5 text-center font-black text-xl outline-none transition-all border"
      style={{
        background: 'var(--theme-primary-soft)',
        borderColor: 'var(--theme-primary-soft-2)',
        color: 'var(--theme-primary)'
      }}
    />
    <div
      className="absolute left-6 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase tracking-widest"
      style={{ color: 'var(--theme-primary)' }}
    >
      {getCurrencySymbol()}
    </div>
  </div>
</div>

            <div
              className="flex justify-between items-center p-6 rounded-[1.5rem] border"
              style={{
                background: 'rgba(244,63,94,0.08)',
                borderColor: 'rgba(244,63,94,0.16)'
              }}
            >
              <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">المتبقي (دين)</span>
              <div className="text-left">
                <div className="text-lg font-black text-rose-600">
  {formatMoney(remainingAmount)}
</div>
{showUsd && (
  <div className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">
    {formatMoney(remainingAmount, 'USD')}
  </div>
)}
              </div>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={cart.length === 0 || !selectedSupplier || loading}
            className="w-full text-white font-black py-6 rounded-[2rem] shadow-xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-4 group"
            style={{ background: 'var(--theme-primary)' }}
            onMouseEnter={(e) => {
              if (!(cart.length === 0 || !selectedSupplier || loading)) {
                e.currentTarget.style.background = 'var(--theme-primary-hover)';
              }
            }}
            onMouseLeave={(e) => {
              if (!(cart.length === 0 || !selectedSupplier || loading)) {
                e.currentTarget.style.background = 'var(--theme-primary)';
              }
            }}
          >
            <Save size={24} strokeWidth={2.5} className="group-hover:scale-110 transition-transform" />
            {loading ? 'جاري الحفظ...' : 'حفظ فاتورة الشراء'}
          </button>

          <AnimatePresence>
            {message && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="p-5 rounded-[1.5rem] text-center text-xs font-black uppercase tracking-widest flex items-center justify-center gap-3 border"
                style={{
                  background: 'var(--theme-primary-soft)',
                  color: 'var(--theme-primary)',
                  borderColor: 'var(--theme-primary-soft-2)'
                }}
              >
                <AlertCircle size={18} strokeWidth={2.5} />
                {message}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white space-y-4 relative overflow-hidden group">
          <div
            className="absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl -mr-16 -mt-16 transition-all duration-700"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          />

          <h4 className="font-black flex items-center gap-3 relative z-10" style={{ color: 'var(--theme-primary)' }}>
            <AlertCircle size={20} strokeWidth={2.5} />
            تنبيه هام
          </h4>
          <p className="text-[11px] font-bold text-slate-400 leading-relaxed relative z-10">
            عند حفظ فاتورة الشراء، سيتم زيادة الكميات في المخزون تلقائياً، وسيتم تحديث سعر الشراء للمنتجات بناءً على الأسعار المدخلة في هذه الفاتورة.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Purchases;