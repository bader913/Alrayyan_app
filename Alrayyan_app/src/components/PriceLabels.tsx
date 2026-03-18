import React, { useEffect, useMemo, useState } from 'react';
import { Tag, Printer, RefreshCw } from 'lucide-react';

interface Product {
  id: number;
  name: string;
  barcode?: string;
  sale_price?: number;
  stock_quantity?: number;
  unit?: string;
  category_name?: string;
}

const PriceLabels: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('');
const [searchTerm, setSearchTerm] = useState('');
const [labelCount, setLabelCount] = useState('1');
const searchResults = useMemo(() => {
  const q = searchTerm.trim().toLowerCase();
  if (!q) return [];

  return products
    .filter((product) => {
      const name = (product.name || '').toLowerCase();
      const barcode = (product.barcode || '').toLowerCase();
      return name.includes(q) || barcode.includes(q);
    })
    .slice(0, 12);
}, [products, searchTerm]);
  const [showBarcode, setShowBarcode] = useState(true);
  const [showCategory, setShowCategory] = useState(false);
  const [labelSize, setLabelSize] = useState<'small' | 'medium' | 'large'>('medium');

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

  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === selectedProductId) || null;
  }, [products, selectedProductId]);

  const safeLabelCount = Math.max(1, Number(labelCount) || 1);

  const handleQuickPickProduct = (productId: number) => {
  setSelectedProductId(productId);
  setSearchTerm('');
};

  const formatLabelPrice = (value: number | undefined) => {
    if (value == null || Number.isNaN(Number(value))) return '$0.0';
    return `$${Number(value).toFixed(1)}`;
  };
const labelSizeConfig = useMemo(() => {
  if (labelSize === 'small') {
    return {
      widthCm: 4,
      heightCm: 2.5,
      gridColCm: 4,
      previewMaxWidthClass: 'max-w-[260px]',
      previewMinHeightClass: 'min-h-[170px]',
      nameClass: 'text-sm',
      priceClass: 'text-xl',
      categoryClass: 'text-[10px]',
      barcodeClass: 'text-[10px]'
    };
  }

  if (labelSize === 'large') {
    return {
      widthCm: 7,
      heightCm: 5,
      gridColCm: 7,
      previewMaxWidthClass: 'max-w-[420px]',
      previewMinHeightClass: 'min-h-[300px]',
      nameClass: 'text-2xl',
      priceClass: 'text-4xl',
      categoryClass: 'text-sm',
      barcodeClass: 'text-sm'
    };
  }

  return {
    widthCm: 6,
    heightCm: 4,
    gridColCm: 6,
    previewMaxWidthClass: 'max-w-sm',
    previewMinHeightClass: 'min-h-[240px]',
    nameClass: 'text-xl',
    priceClass: 'text-3xl',
    categoryClass: 'text-xs',
    barcodeClass: 'text-xs'
  };
}, [labelSize]);
  const handlePrint = () => {
    if (!selectedProduct) {
      alert('اختر صنفًا أولًا');
      return;
    }

    const labelsHtml = Array.from({ length: safeLabelCount })
      .map(() => {
        return `
          <div class="price-label">
            <div class="top-row">
              ${showCategory && selectedProduct.category_name ? `<div class="category">${selectedProduct.category_name}</div>` : '<div class="category-empty"></div>'}
            </div>

            <div class="product-name">${selectedProduct.name || ''}</div>

            <div class="price-box">${formatLabelPrice(selectedProduct.sale_price)}</div>

            ${
              showBarcode && selectedProduct.barcode
                ? `
                  <div class="barcode-row">
                    <div class="barcode-text">${selectedProduct.barcode}</div>
                  </div>
                `
                : '<div class="barcode-placeholder"></div>'
            }
          </div>
        `;
      })
      .join('');

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return;

    printWindow.document.write(`
      <html dir="rtl">
        <head>
          <title>طباعة بطاقات الأسعار</title>
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
  grid-template-columns: repeat(auto-fill, ${labelSizeConfig.gridColCm}cm);
  gap: 0.2cm;
  justify-content: start;
  padding: 0.2cm;
}

.price-label {
  width: ${labelSizeConfig.widthCm}cm;
  height: ${labelSizeConfig.heightCm}cm;
              border: 1px solid #999;
              border-radius: 0.25cm;
              padding: 0.18cm;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              text-align: center;
              overflow: hidden;
              page-break-inside: avoid;
              break-inside: avoid;
              background: #fff;
            }

            .top-row {
              min-height: 0.45cm;
              display: flex;
              justify-content: center;
              align-items: center;
            }

            .category {
  font-size: ${labelSize === 'small' ? '8px' : labelSize === 'large' ? '12px' : '10px'};
  font-weight: 700;
  color: #444;
}

            .category-empty {
              height: 12px;
            }

            .product-name {
  font-size: ${labelSize === 'small' ? '11px' : labelSize === 'large' ? '20px' : '16px'};
  font-weight: 800;
  line-height: 1.15;
  min-height: ${labelSize === 'small' ? '0.7cm' : labelSize === 'large' ? '1.5cm' : '1.2cm'};
  max-height: ${labelSize === 'small' ? '0.8cm' : labelSize === 'large' ? '1.6cm' : '1.25cm'};
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 0 0.08cm;
}

          .price-box {
  font-size: 24px;
  font-weight: 900;
  line-height: 1;
  padding: 0.15cm 0.1cm;
  border-radius: 0.18cm;
  border: 1px dashed #999;
  direction: ltr;
}

            .barcode-row {
              min-height: 0.55cm;
              display: flex;
              align-items: center;
              justify-content: center;
            }

           .barcode-text {
  font-size: ${labelSize === 'small' ? '9px' : labelSize === 'large' ? '12px' : '11px'};
  font-weight: 700;
  direction: ltr;
  letter-spacing: 0.5px;
}

            .barcode-placeholder {
              min-height: 0.55cm;
            }

            @page {
              margin: 0.2cm;
            }

            @media print {
              body {
                padding: 0;
              }

              .labels-grid {
                gap: 0.15cm;
                padding: 0.15cm;
              }
            }
          </style>
        </head>
        <body>
          <div class="labels-grid">
            ${labelsHtml}
          </div>

          <script>
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
  const handlePrintPriceList = () => {
  const printableProducts = products
    .filter((product) => product.name && product.sale_price != null)
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));

  if (!printableProducts.length) {
    alert('لا توجد أصناف متاحة لطباعة قائمة الأسعار');
    return;
  }

  const rowsHtml = printableProducts
    .map((product, index) => {
      return `
        <tr>
          <td>${index + 1}</td>
          <td>${product.name || ''}</td>
          <td>${formatLabelPrice(product.sale_price)}</td>
          <td>${product.category_name || '-'}</td>
        </tr>
      `;
    })
    .join('');

  const printWindow = window.open('', '_blank', 'width=1000,height=750');
  if (!printWindow) return;

  printWindow.document.write(`
    <html dir="rtl">
      <head>
        <title>طباعة قائمة الأسعار</title>
        <style>
          * {
            box-sizing: border-box;
            font-family: Arial, sans-serif;
          }

          body {
            margin: 0;
            padding: 24px;
            background: #ffffff;
            color: #000000;
          }

          .page-title {
            text-align: center;
            font-size: 24px;
            font-weight: 900;
            margin-bottom: 8px;
          }

          .page-subtitle {
            text-align: center;
            font-size: 13px;
            font-weight: 700;
            color: #555;
            margin-bottom: 20px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }

          th,
          td {
            border: 1px solid #999;
            padding: 10px 8px;
            text-align: center;
            font-size: 13px;
            word-wrap: break-word;
          }

          th {
            background: #f3f4f6;
            font-size: 14px;
            font-weight: 900;
          }

          td:nth-child(2) {
            text-align: right;
            font-weight: 700;
          }

          td:nth-child(3) {
            direction: ltr;
            font-weight: 900;
          }

          .footer-note {
            margin-top: 16px;
            text-align: center;
            font-size: 12px;
            color: #666;
            font-weight: 700;
          }

          @page {
            size: A4 portrait;
            margin: 12mm;
          }

          @media print {
            body {
              padding: 0;
            }

            tr {
              page-break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        <div class="page-title">قائمة الأسعار</div>
        <div class="page-subtitle">اسم الصنف - السعر - التصنيف</div>

        <table>
          <thead>
            <tr>
              <th style="width: 8%;">#</th>
              <th style="width: 52%;">اسم الصنف</th>
              <th style="width: 18%;">السعر</th>
              <th style="width: 22%;">التصنيف</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="footer-note">
          عدد الأصناف: ${printableProducts.length}
        </div>

        <script>
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
              <Tag size={28} style={{ color: 'var(--theme-primary)' }} />
              طباعة بطاقات الأسعار
            </h2>
            <p className="text-sm font-bold mt-2" style={{ color: 'var(--text-muted)' }}>
              اختر الصنف ثم اطبع بطاقة سعر واضحة وجاهزة للرفوف
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
    بحث واختيار الصنف
  </div>

  <div className="relative">
    <input
      type="text"
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      placeholder="اكتب اسم الصنف أو جزءًا من الباركود"
      className="w-full app-muted border rounded-2xl py-4 px-4 text-sm font-black outline-none transition-all"
      style={{
        borderColor: 'var(--border-color)',
        color: 'var(--text-color)'
      }}
    />

    {searchTerm.trim() && (
      <div
        className="absolute top-full right-0 left-0 mt-2 rounded-[1.5rem] border shadow-xl overflow-hidden z-30"
        style={{
          borderColor: 'var(--border-color)',
          background: 'var(--card-bg)'
        }}
      >
        {searchResults.length > 0 ? (
          <div className="max-h-80 overflow-y-auto">
            {searchResults.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => handleQuickPickProduct(product.id)}
                className="w-full px-4 py-3 text-right border-b transition-all"
                style={{
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-color)',
                  background: 'transparent'
                }}
              >
                <div className="font-black text-sm">{product.name}</div>
                <div
                  className="text-[11px] font-bold mt-1 flex items-center justify-between gap-3"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <span dir="ltr">{product.barcode || '-'}</span>
                  <span>{formatLabelPrice(product.sale_price)}</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div
            className="px-4 py-4 text-sm font-bold"
            style={{ color: 'var(--text-muted)' }}
          >
            لا يوجد صنف مطابق
          </div>
        )}
      </div>
    )}
  </div>

  <div className="mt-3">
    <select
      value={selectedProductId}
      onChange={(e) => {
  setSelectedProductId(e.target.value ? Number(e.target.value) : '');
  setSearchTerm('');
}}
      className="w-full app-muted border rounded-2xl py-4 px-4 text-sm font-black outline-none transition-all"
      style={{
        borderColor: 'var(--border-color)',
        color: 'var(--theme-primary)'
      }}
    >
      <option value="">اختر صنفًا من القائمة الكاملة</option>
      {products.map((product) => (
        <option key={product.id} value={product.id}>
          {product.name} {product.barcode ? `- ${product.barcode}` : ''}
        </option>
      ))}
    </select>
  </div>
</div>

            <div>
              <div
                className="text-[10px] font-black uppercase tracking-widest mb-2"
                style={{ color: 'var(--text-muted)' }}
              >
                عدد البطاقات
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
            <div>
  <div
    className="text-[10px] font-black uppercase tracking-widest mb-2"
    style={{ color: 'var(--text-muted)' }}
  >
    مقاس البطاقة
  </div>

  <select
    value={labelSize}
    onChange={(e) => setLabelSize(e.target.value as 'small' | 'medium' | 'large')}
    className="w-full app-muted border rounded-2xl py-4 px-4 text-sm font-black outline-none transition-all"
    style={{
      borderColor: 'var(--border-color)',
      color: 'var(--theme-primary)'
    }}
  >
    <option value="small">صغير — 4 × 2.5 سم</option>
    <option value="medium">متوسط — 6 × 4 سم</option>
    <option value="large">كبير — 7 × 5 سم</option>
  </select>
</div>

            <label
              className="flex items-center justify-between gap-3 app-muted border rounded-2xl py-4 px-4 cursor-pointer"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <span className="font-black text-sm" style={{ color: 'var(--text-color)' }}>
                إظهار الباركود الرقمي
              </span>
              <input
                type="checkbox"
                checked={showBarcode}
                onChange={(e) => setShowBarcode(e.target.checked)}
                className="w-5 h-5"
              />
            </label>

            <label
              className="flex items-center justify-between gap-3 app-muted border rounded-2xl py-4 px-4 cursor-pointer"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <span className="font-black text-sm" style={{ color: 'var(--text-color)' }}>
                إظهار التصنيف
              </span>
              <input
                type="checkbox"
                checked={showCategory}
                onChange={(e) => setShowCategory(e.target.checked)}
                className="w-5 h-5"
              />
            </label>

         <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
  <button
    type="button"
    onClick={handlePrint}
    disabled={!selectedProduct}
    className="w-full px-6 py-4 rounded-2xl text-white font-black transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
    style={{ background: 'var(--theme-primary)' }}
  >
    <Printer size={20} />
    طباعة بطاقة السعر
  </button>

  <button
    type="button"
    onClick={handlePrintPriceList}
    disabled={isLoading || products.length === 0}
    className="w-full px-6 py-4 rounded-2xl border font-black transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
    style={{
      borderColor: 'var(--border-color)',
      background: 'var(--card-bg)',
      color: 'var(--theme-primary)'
    }}
  >
    <Printer size={20} />
   طباعة التسعيرة الكاملة للمخزون
  </button>
</div>
          </div>

          <div
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
              <div
                className="h-full min-h-[220px] flex items-center justify-center font-black"
                style={{ color: 'var(--text-muted)' }}
              >
                جاري تحميل الأصناف...
              </div>
            ) : !selectedProduct ? (
              <div
                className="h-full min-h-[220px] flex items-center justify-center text-center font-black"
                style={{ color: 'var(--text-muted)' }}
              >
                اختر صنفًا لعرض بطاقة السعر
              </div>
            ) : (
           <div
  className={`${labelSizeConfig.previewMaxWidthClass} mx-auto bg-white text-black rounded-3xl border border-gray-300 p-5 text-center shadow-sm ${labelSizeConfig.previewMinHeightClass} flex flex-col justify-between`}
>
                <div className={`min-h-[20px] ${labelSizeConfig.categoryClass} font-bold text-gray-600`}>
                  {showCategory ? selectedProduct.category_name || '' : ''}
                </div>

               <div className={`${labelSizeConfig.nameClass} font-black leading-tight px-2`}>
                  {selectedProduct.name}
                </div>

               <div
  className={`border border-dashed border-gray-400 rounded-2xl py-4 px-3 ${labelSizeConfig.priceClass} font-black`}
  dir="ltr"
>
                  {formatLabelPrice(selectedProduct.sale_price)}
                </div>

                <div className={`${labelSizeConfig.barcodeClass} font-bold text-gray-700 min-h-[20px]`} dir="ltr">
                  {showBarcode ? selectedProduct.barcode || '' : ''}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PriceLabels;