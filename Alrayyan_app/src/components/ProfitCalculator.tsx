import React, { useEffect, useMemo, useState } from 'react';
import { Calculator, RefreshCw } from 'lucide-react';

interface Product {
  id: number;
  name: string;
  barcode?: string;
  purchase_price?: number;
  sale_price?: number;
  stock_quantity?: number;
  unit?: string;
  category_name?: string;
}

const ProfitCalculator: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('');
  const [purchasePriceInput, setPurchasePriceInput] = useState('');
  const [salePriceInput, setSalePriceInput] = useState('');
  const [quantityInput, setQuantityInput] = useState('1');

  useEffect(() => {
    void fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setIsLoadingProducts(true);
      const res = await fetch('/api/products');
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching products:', error);
      setProducts([]);
    } finally {
      setIsLoadingProducts(false);
    }
  };

  const normalizeDigits = (value: string) => {
    return value
      .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      .replace(/,/g, '.')
      .replace(/[^\d.]/g, '')
      .replace(/(\..*)\./g, '$1');
  };

  const parseValue = (value: string) => {
    const normalized = normalizeDigits(value.trim());
    const num = Number(normalized);
    return Number.isFinite(num) ? num : 0;
  };

  const selectedProduct = useMemo(() => {
    return products.find((product) => product.id === selectedProductId) || null;
  }, [products, selectedProductId]);

  const purchasePrice = useMemo(() => parseValue(purchasePriceInput), [purchasePriceInput]);
  const salePrice = useMemo(() => parseValue(salePriceInput), [salePriceInput]);
  const quantity = useMemo(() => Math.max(0, parseValue(quantityInput)), [quantityInput]);

  const profitPerUnit = useMemo(() => salePrice - purchasePrice, [salePrice, purchasePrice]);
  const totalCost = useMemo(() => purchasePrice * quantity, [purchasePrice, quantity]);
  const totalSales = useMemo(() => salePrice * quantity, [salePrice, quantity]);
  const totalProfit = useMemo(() => profitPerUnit * quantity, [profitPerUnit, quantity]);

  const profitMargin = useMemo(() => {
    if (salePrice <= 0) return 0;
    return (profitPerUnit / salePrice) * 100;
  }, [profitPerUnit, salePrice]);

  const markupRate = useMemo(() => {
    if (purchasePrice <= 0) return 0;
    return (profitPerUnit / purchasePrice) * 100;
  }, [profitPerUnit, purchasePrice]);

  const formatNumber = (value: number, decimals = 2) => {
    if (!Number.isFinite(value)) return '0.00';
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals
    });
  };

  const handleSelectProduct = (value: string) => {
    const productId = value ? Number(value) : '';
    setSelectedProductId(productId);

    const product = products.find((item) => item.id === productId);
    if (!product) {
      setPurchasePriceInput('');
      setSalePriceInput('');
      return;
    }

    setPurchasePriceInput(
      product.purchase_price != null ? String(product.purchase_price) : ''
    );
    setSalePriceInput(
      product.sale_price != null ? String(product.sale_price) : ''
    );
  };

  const resetAll = () => {
    setSelectedProductId('');
    setPurchasePriceInput('');
    setSalePriceInput('');
    setQuantityInput('1');
  };

  const resultTone =
    profitPerUnit > 0
      ? { text: 'ربح', color: '#16a34a', bg: 'rgba(22, 163, 74, 0.10)' }
      : profitPerUnit < 0
      ? { text: 'خسارة', color: '#dc2626', bg: 'rgba(220, 38, 38, 0.10)' }
      : { text: 'تعادل', color: 'var(--theme-primary)', bg: 'var(--theme-primary-soft)' };

  return (
    <div className="space-y-6">
      <div
        className="app-card rounded-[2rem] border p-6 lg:p-8"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h2
              className="text-2xl lg:text-3xl font-black flex items-center gap-3"
              style={{ color: 'var(--text-color)' }}
            >
              <Calculator size={28} style={{ color: 'var(--theme-primary)' }} />
              حاسبة الربح
            </h2>

            <p className="text-sm font-bold mt-2" style={{ color: 'var(--text-muted)' }}>
              اختر صنفًا من المخزون لمعرفة الربح المتوقع حسب سعر الشراء وسعر البيع والكمية
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => void fetchProducts()}
              className="px-5 py-3 rounded-2xl border font-black flex items-center justify-center gap-2 transition-all"
              style={{
                borderColor: 'var(--border-color)',
                color: 'var(--theme-primary)',
                background: 'var(--card-bg)'
              }}
            >
              <RefreshCw size={18} />
              تحديث الأصناف
            </button>

            <button
              type="button"
              onClick={resetAll}
              className="px-5 py-3 rounded-2xl border font-black flex items-center justify-center gap-2 transition-all"
              style={{
                borderColor: 'var(--border-color)',
                color: 'var(--theme-primary)',
                background: 'var(--card-bg)'
              }}
            >
              <RefreshCw size={18} />
              إعادة ضبط
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <div
                className="text-[10px] font-black uppercase tracking-widest mb-2"
                style={{ color: 'var(--text-muted)' }}
              >
                اختر الصنف من المخزون
              </div>

              <select
                value={selectedProductId}
                onChange={(e) => handleSelectProduct(e.target.value)}
                className="w-full app-muted border rounded-2xl py-4 px-4 text-sm font-black outline-none transition-all"
                style={{
                  borderColor: 'var(--border-color)',
                  color: 'var(--theme-primary)'
                }}
                disabled={isLoadingProducts}
              >
                <option value="">
                  {isLoadingProducts ? 'جاري تحميل الأصناف...' : 'اختر صنفًا'}
                </option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                    {product.barcode ? ` - ${product.barcode}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {selectedProduct && (
              <div
                className="rounded-[2rem] border p-5"
                style={{
                  borderColor: 'var(--border-color)',
                  background: 'var(--theme-primary-soft)'
                }}
              >
                <div
                  className="text-[10px] font-black uppercase tracking-widest mb-3"
                  style={{ color: 'var(--text-muted)' }}
                >
                  بيانات الصنف
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm font-bold">
                  <div className="flex items-center justify-between gap-3">
                    <span style={{ color: 'var(--text-muted)' }}>الاسم</span>
                    <span style={{ color: 'var(--text-color)' }}>{selectedProduct.name}</span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span style={{ color: 'var(--text-muted)' }}>التصنيف</span>
                    <span style={{ color: 'var(--text-color)' }}>
                      {selectedProduct.category_name || '-'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span style={{ color: 'var(--text-muted)' }}>المتوفر</span>
                    <span style={{ color: 'var(--text-color)' }}>
                      {selectedProduct.stock_quantity ?? 0} {selectedProduct.unit || ''}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span style={{ color: 'var(--text-muted)' }}>الباركود</span>
                    <span style={{ color: 'var(--text-color)' }}>
                      {selectedProduct.barcode || '-'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div>
              <div
                className="text-[10px] font-black uppercase tracking-widest mb-2"
                style={{ color: 'var(--text-muted)' }}
              >
                سعر الشراء
              </div>

              <input
                type="text"
                inputMode="decimal"
                lang="en"
                dir="ltr"
                value={purchasePriceInput}
                onChange={(e) => setPurchasePriceInput(normalizeDigits(e.target.value))}
                placeholder="0.00"
                className="w-full app-muted border rounded-2xl py-4 px-4 text-lg font-black outline-none transition-all text-center"
                style={{
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-color)'
                }}
              />
            </div>

            <div>
              <div
                className="text-[10px] font-black uppercase tracking-widest mb-2"
                style={{ color: 'var(--text-muted)' }}
              >
                سعر البيع
              </div>

              <input
                type="text"
                inputMode="decimal"
                lang="en"
                dir="ltr"
                value={salePriceInput}
                onChange={(e) => setSalePriceInput(normalizeDigits(e.target.value))}
                placeholder="0.00"
                className="w-full app-muted border rounded-2xl py-4 px-4 text-lg font-black outline-none transition-all text-center"
                style={{
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-color)'
                }}
              />
            </div>

            <div>
              <div
                className="text-[10px] font-black uppercase tracking-widest mb-2"
                style={{ color: 'var(--text-muted)' }}
              >
                الكمية المباعة المتوقعة
              </div>

              <input
                type="text"
                inputMode="decimal"
                lang="en"
                dir="ltr"
                value={quantityInput}
                onChange={(e) => setQuantityInput(normalizeDigits(e.target.value))}
                placeholder="1"
                className="w-full app-muted border rounded-2xl py-4 px-4 text-lg font-black outline-none transition-all text-center"
                style={{
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-color)'
                }}
              />
            </div>

            <div
              className="rounded-[2rem] border p-5"
              style={{
                borderColor: 'var(--border-color)',
                background: resultTone.bg
              }}
            >
              <div className="flex items-center justify-between gap-3 mb-3">
                <span className="text-sm font-black" style={{ color: 'var(--text-muted)' }}>
                  حالة العملية
                </span>
                <span
                  className="px-4 py-2 rounded-2xl text-sm font-black"
                  style={{
                    color: resultTone.color,
                    background: 'rgba(255,255,255,0.65)'
                  }}
                >
                  {resultTone.text}
                </span>
              </div>

              <div className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>
                اختر صنفًا أو عدّل الأسعار يدويًا ثم أدخل الكمية لمعرفة الربح المتوقع.
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div
              className="app-muted rounded-[2rem] border p-5"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <div
                className="text-[10px] font-black uppercase tracking-widest mb-4"
                style={{ color: 'var(--text-muted)' }}
              >
                النتائج الأساسية
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div
                  className="rounded-2xl border p-4"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <div className="text-xs font-black mb-2" style={{ color: 'var(--text-muted)' }}>
                    ربح القطعة
                  </div>
                  <div
                    className="text-2xl font-black"
                    dir="ltr"
                    style={{ color: resultTone.color }}
                  >
                    {formatNumber(profitPerUnit)}
                  </div>
                </div>

                <div
                  className="rounded-2xl border p-4"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <div className="text-xs font-black mb-2" style={{ color: 'var(--text-muted)' }}>
                    الربح الإجمالي
                  </div>
                  <div
                    className="text-2xl font-black"
                    dir="ltr"
                    style={{ color: resultTone.color }}
                  >
                    {formatNumber(totalProfit)}
                  </div>
                </div>

                <div
                  className="rounded-2xl border p-4"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <div className="text-xs font-black mb-2" style={{ color: 'var(--text-muted)' }}>
                    تكلفة الكمية
                  </div>
                  <div className="text-2xl font-black" dir="ltr" style={{ color: 'var(--text-color)' }}>
                    {formatNumber(totalCost)}
                  </div>
                </div>

                <div
                  className="rounded-2xl border p-4"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <div className="text-xs font-black mb-2" style={{ color: 'var(--text-muted)' }}>
                    قيمة البيع
                  </div>
                  <div className="text-2xl font-black" dir="ltr" style={{ color: 'var(--text-color)' }}>
                    {formatNumber(totalSales)}
                  </div>
                </div>
              </div>
            </div>

            <div
              className="app-muted rounded-[2rem] border p-5"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <div
                className="text-[10px] font-black uppercase tracking-widest mb-4"
                style={{ color: 'var(--text-muted)' }}
              >
                نسب الربح
              </div>

              <div className="space-y-3">
                <div
                  className="rounded-2xl border px-4 py-4 flex items-center justify-between gap-3"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <div>
                    <div className="text-sm font-black" style={{ color: 'var(--text-color)' }}>
                      هامش الربح
                    </div>
                    <div className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
                      الربح نسبةً إلى سعر البيع
                    </div>
                  </div>

                  <div
                    className="text-xl font-black"
                    dir="ltr"
                    style={{ color: resultTone.color }}
                  >
                    {formatNumber(profitMargin, 2)}%
                  </div>
                </div>

                <div
                  className="rounded-2xl border px-4 py-4 flex items-center justify-between gap-3"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <div>
                    <div className="text-sm font-black" style={{ color: 'var(--text-color)' }}>
                      نسبة الزيادة
                    </div>
                    <div className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
                      الربح نسبةً إلى سعر الشراء
                    </div>
                  </div>

                  <div
                    className="text-xl font-black"
                    dir="ltr"
                    style={{ color: resultTone.color }}
                  >
                    {formatNumber(markupRate, 2)}%
                  </div>
                </div>
              </div>
            </div>

            <div
              className="rounded-[2rem] border p-5"
              style={{
                borderColor: 'var(--border-color)',
                background: 'var(--theme-primary-soft)'
              }}
            >
              <div
                className="text-[10px] font-black uppercase tracking-widest mb-3"
                style={{ color: 'var(--text-muted)' }}
              >
                ملخص سريع
              </div>

              <div className="text-sm font-bold leading-7" style={{ color: 'var(--text-color)' }}>
                {selectedProduct ? (
                  <>
                    عند بيع <span style={{ color: 'var(--theme-primary)' }}>{selectedProduct.name}</span> بكمية{' '}
                    <span style={{ color: 'var(--theme-primary)' }}>{formatNumber(quantity, 2)}</span>،
                    وبسعر بيع <span style={{ color: 'var(--theme-primary)' }}>{formatNumber(salePrice)}</span>،
                    وسعر شراء <span style={{ color: 'var(--theme-primary)' }}>{formatNumber(purchasePrice)}</span>،
                    يكون صافي الربح المتوقع:
                    <span style={{ color: resultTone.color }}> {formatNumber(totalProfit)} </span>
                  </>
                ) : (
                  <>
                    اختر صنفًا من المخزون ثم أدخل الكمية لتحصل على الربح المتوقع مباشرة.
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfitCalculator;