import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Barcode, Printer, Search, RefreshCw } from 'lucide-react';
import { appError } from '../utils/appAlert';

interface Product {
  id: number;
  name: string;
  barcode?: string;
  sale_price?: number;
  stock_quantity?: number;
  unit?: string;
}

const BarcodeGenerator: React.FC = () => {
      const formatLabelPrice = (value: number | undefined) => {
    if (value == null || Number.isNaN(Number(value))) return '';
    return `${Number(value).toFixed(1)} $`;
  };
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('');
  const [customBarcode, setCustomBarcode] = useState('');
  const [labelCount, setLabelCount] = useState('1');
  const printAreaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/products');
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching products:', error);
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return products;

    return products.filter((product) => {
      const name = product.name?.toLowerCase() || '';
      const barcode = String(product.barcode || '').toLowerCase();
      return name.includes(q) || barcode.includes(q);
    });
  }, [products, searchQuery]);

  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === selectedProductId) || null;
  }, [products, selectedProductId]);

  const finalBarcode = (customBarcode.trim() || selectedProduct?.barcode || '').trim();
  const safeLabelCount = Math.max(1, Number(labelCount) || 1);

  const handlePrint = () => {
    if (!selectedProduct) {
      appError('اختر صنفًا أولًا');
      return;
    }

    if (!finalBarcode) {
      appError('لا يوجد باركود للطباعة، أدخل باركود يدويًا أولًا');
      return;
    }

    const labelsHtml = Array.from({ length: safeLabelCount })
      .map(() => {
        return `
          <div class="barcode-label">
            <div class="shop-name">الريان</div>
            <div class="product-name">${selectedProduct.name || ''}</div>
            <svg class="barcode-svg" jsbarcode-value="${finalBarcode}"></svg>
            <div class="barcode-text">${finalBarcode}</div>
            <div class="price-row">
              ${
  selectedProduct.sale_price != null
    ? `<span>السعر: ${formatLabelPrice(selectedProduct.sale_price)}</span>`
    : ''
}
            </div>
          </div>
        `;
      })
      .join('');

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return;

    printWindow.document.write(`
      <html dir="rtl">
        <head>
          <title>طباعة باركود</title>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
          <style>
  * {
    box-sizing: border-box;
    font-family: Arial, sans-serif;
  }

  body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    color: #000000;
  }

  .labels-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, 4cm);
    gap: 0.15cm;
    justify-content: start;
    padding: 0.15cm;
  }

  .barcode-label {
    width: 4cm;
    height: 2.5cm;
    border: 1px solid #999;
    border-radius: 0.18cm;
    padding: 0.08cm 0.1cm;
    text-align: center;
    break-inside: avoid;
    page-break-inside: avoid;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .shop-name {
    font-size: 8px;
    font-weight: 700;
    line-height: 1.1;
    margin: 0;
  }

  .product-name {
    font-size: 9px;
    font-weight: 700;
    line-height: 1.1;
    min-height: 0.5cm;
    max-height: 0.55cm;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0.04cm 0;
  }

  .barcode-svg {
    width: 100%;
    height: 0.95cm;
    margin: 0 auto;
    display: block;
  }

  .barcode-text {
    margin-top: 0.03cm;
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.3px;
    direction: ltr;
    line-height: 1;
  }

  .price-row {
    margin-top: 0.03cm;
    font-size: 8px;
    font-weight: 700;
    line-height: 1;
    min-height: 0.25cm;
  }

  @page {
    margin: 0.2cm;
  }

  @media print {
    body {
      padding: 0;
    }

    .labels-grid {
      gap: 0.1cm;
      padding: 0.1cm;
    }
  }
</style>
        </head>
        <body>
          <div class="labels-grid">
            ${labelsHtml}
          </div>

          <script>
            document.querySelectorAll('.barcode-svg').forEach((svg) => {
              const value = svg.getAttribute('jsbarcode-value') || '';
              if (!value) return;

              try {
                JsBarcode(svg, value, {
  format: 'CODE128',
  displayValue: false,
  margin: 0,
  width: 1.2,
  height: 34
});
              } catch (e) {
                console.error('Barcode render error:', e);
              }
            });

            window.onload = () => {
              setTimeout(() => {
                window.print();
              }, 250);
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

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
              <Barcode size={28} style={{ color: 'var(--theme-primary)' }} />
              أداة توليد الباركود
            </h2>
            <p className="text-sm font-bold mt-2" style={{ color: 'var(--text-muted)' }}>
              اختر الصنف ثم اطبع باركود جاهز للمنتجات التي لا تحمل ملصقًا مناسبًا
            </p>
          </div>

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
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <div
                className="text-[10px] font-black uppercase tracking-widest mb-2"
                style={{ color: 'var(--text-muted)' }}
              >
                بحث عن صنف
              </div>

              <div className="relative">
                <Search
                  size={18}
                  className="absolute right-4 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-muted)' }}
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder=" اكتب اسم المنتج او جزء من اسمه لتسهيل الفلترة من اختيار الملف  "
                  className="w-full app-muted border rounded-2xl py-4 pr-12 pl-4 text-sm font-black outline-none transition-all"
                  style={{
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-color)'
                  }}
                />
              </div>
            </div>

            <div>
              <div
                className="text-[10px] font-black uppercase tracking-widest mb-2"
                style={{ color: 'var(--text-muted)' }}
              >
                اختر الصنف
              </div>

              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value ? Number(e.target.value) : '')}
                className="w-full app-muted border rounded-2xl py-4 px-4 text-sm font-black outline-none transition-all"
                style={{
                  borderColor: 'var(--border-color)',
                  color: 'var(--theme-primary)'
                }}
              >
                <option value="">اختر صنفًا</option>
                {filteredProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} {product.barcode ? `(${product.barcode})` : '(بدون باركود)'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div
                className="text-[10px] font-black uppercase tracking-widest mb-2"
                style={{ color: 'var(--text-muted)' }}
              >
                باركود يدوي اختياري
              </div>

              <input
                type="text"
                inputMode="numeric"
                value={customBarcode}
                onChange={(e) => setCustomBarcode(e.target.value)}
                placeholder="إذا كان الصنف بلا باركود، أدخل باركود يدويًا هنا"
                className="w-full app-muted border rounded-2xl py-4 px-4 text-sm font-black outline-none transition-all"
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
                عدد الملصقات
              </div>

              <input
                type="number"
                min="1"
                value={labelCount}
                onChange={(e) => setLabelCount(e.target.value)}
                className="w-full app-muted border rounded-2xl py-4 px-4 text-sm font-black outline-none transition-all"
                style={{
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-color)'
                }}
              />
            </div>

            <button
              type="button"
              onClick={handlePrint}
              disabled={!selectedProduct || !finalBarcode}
              className="w-full px-6 py-4 rounded-2xl text-white font-black transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              style={{ background: 'var(--theme-primary)' }}
            >
              <Printer size={20} />
              طباعة الباركود
            </button>
          </div>

          <div
            ref={printAreaRef}
            className="app-muted rounded-[2rem] border p-6 min-h-[320px]"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <div
              className="text-[10px] font-black uppercase tracking-widest mb-4"
              style={{ color: 'var(--text-muted)' }}
            >
              معاينة سريعة
            </div>

            {isLoading ? (
              <div className="h-full min-h-[220px] flex items-center justify-center font-black" style={{ color: 'var(--text-muted)' }}>
                جاري تحميل الأصناف...
              </div>
            ) : !selectedProduct ? (
              <div className="h-full min-h-[220px] flex items-center justify-center text-center font-black" style={{ color: 'var(--text-muted)' }}>
                اختر صنفًا لعرض معاينة الباركود
              </div>
            ) : (
              <div className="max-w-xs mx-auto bg-white text-black rounded-3xl border border-gray-300 p-5 text-center shadow-sm">
                <div className="text-xs font-bold mb-2">الريان</div>
                <div className="text-sm font-bold mb-3">{selectedProduct.name}</div>

                <div className="border-2 border-dashed border-gray-300 rounded-2xl px-4 py-6">
                  <div className="text-xs font-bold mb-2">BARCODE</div>
                  <div className="text-base font-black tracking-wider" dir="ltr">
                    {finalBarcode || '--------'}
                  </div>
                </div>

                <div className="mt-3 text-xs font-bold">
                  {selectedProduct.sale_price != null ? `السعر: ${formatLabelPrice(selectedProduct.sale_price)}` : 'بدون سعر'}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BarcodeGenerator;