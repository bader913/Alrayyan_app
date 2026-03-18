import React, { useEffect, useMemo, useState } from 'react';
import {
  FileText,
  Printer,
  Plus,
  Trash2,
  Receipt,
  Package,
  CalendarDays,
  User,
  Phone,
  Coins,
  Search,
  ClipboardList
} from 'lucide-react';
import {
  CurrencyCode,
  convertFromUSD,
  convertToUSD,
  formatMoney,
  currencySymbols
} from './currency';

type ShopSettings = {
  shop_name?: string;
  shop_address?: string;
  shop_phone?: string;
  shop_mobile?: string;
  shop_tax_number?: string;
  currency?: string;
};

type ProductItem = {
  id: number;
  name: string;
  barcode?: string;
  sale_price?: number;
  retail_price?: number;
  price?: number;
};

type QuoteLine = {
  uid: number;
  product_id: number | '';
  name: string;
  quantity: number;
  price: number;
};

const PrintTemplates: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'blank-invoice' | 'quotation'>('blank-invoice');
  const [settings, setSettings] = useState<ShopSettings>({});
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const [quotationNumber, setQuotationNumber] = useState(`Q-${Date.now()}`);
  const [quotationDate, setQuotationDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('الأسعار قابلة للتعديل حسب الكمية أو تغيرات السوق.');
  const [searchTerm, setSearchTerm] = useState('');
  const [printMode, setPrintMode] = useState<'blank-invoice' | 'quotation' | null>(null);
  const [quotationCurrency, setQuotationCurrency] = useState<CurrencyCode>('USD');
  const [quoteLines, setQuoteLines] = useState<QuoteLine[]>([
    { uid: Date.now(), product_id: '', name: '', quantity: 1, price: 0 }
  ]);

  useEffect(() => {
    fetchSettings();
    fetchProducts();
  }, []);

  useEffect(() => {
    if (!printMode) {
      document.body.removeAttribute('data-print-template');
      return;
    }

    document.body.setAttribute('data-print-template', printMode);

    const handleAfterPrint = () => {
      setPrintMode(null);
      document.body.removeAttribute('data-print-template');
    };

    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
      document.body.removeAttribute('data-print-template');
    };
  }, [printMode]);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      setSettings(data || {});
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoadingProducts(true);
      const res = await fetch('/api/products');
      const data = await res.json();

      const normalized = Array.isArray(data)
        ? data.map((item: any) => ({
            id: Number(item.id),
            name: item.name || '',
            barcode: item.barcode || '',
            sale_price: Number(item.sale_price ?? item.retail_price ?? item.price ?? 0),
            retail_price: Number(item.retail_price ?? item.sale_price ?? item.price ?? 0),
            price: Number(item.price ?? item.sale_price ?? item.retail_price ?? 0)
          }))
        : [];

      setProducts(normalized);
    } catch (error) {
      console.error('Error fetching products:', error);
      setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  const addQuoteLine = () => {
    setQuoteLines((prev) => [
      ...prev,
      {
        uid: Date.now() + Math.floor(Math.random() * 10000),
        product_id: '',
        name: '',
        quantity: 1,
        price: 0
      }
    ]);
  };

  const removeQuoteLine = (uid: number) => {
    setQuoteLines((prev) => prev.filter((line) => line.uid !== uid));
  };

  const updateQuoteLine = (uid: number, field: keyof QuoteLine, value: any) => {
    setQuoteLines((prev) =>
      prev.map((line) => {
        if (line.uid !== uid) return line;
        return { ...line, [field]: value };
      })
    );
  };

  const handleSelectProduct = (uid: number, productId: number) => {
    const selected = products.find((p) => Number(p.id) === Number(productId));
    if (!selected) return;

    const productPrice = Number(selected.sale_price ?? selected.retail_price ?? selected.price ?? 0);

    setQuoteLines((prev) =>
      prev.map((line) =>
        line.uid === uid
          ? {
              ...line,
              product_id: selected.id,
              name: selected.name,
              price: productPrice > 0 ? productPrice : 0
            }
          : line
      )
    );
  };
const handleQuickPickProduct = (productId: number) => {
  const selected = products.find((p) => Number(p.id) === Number(productId));
  if (!selected) return;

  const productPrice = Number(selected.sale_price ?? selected.retail_price ?? selected.price ?? 0);

  const emptyLine = quoteLines.find(
    (line) =>
      !line.name.trim() &&
      !Number(line.price || 0) &&
      Number(line.quantity || 0) === 1 &&
      line.product_id === ''
  );

  if (emptyLine) {
    setQuoteLines((prev) =>
      prev.map((line) =>
        line.uid === emptyLine.uid
          ? {
              ...line,
              product_id: selected.id,
              name: selected.name,
              price: productPrice > 0 ? productPrice : 0
            }
          : line
      )
    );
  } else {
    setQuoteLines((prev) => [
      ...prev,
      {
        uid: Date.now() + Math.floor(Math.random() * 10000),
        product_id: selected.id,
        name: selected.name,
        quantity: 1,
        price: productPrice > 0 ? productPrice : 0
      }
    ]);
  }

  setSearchTerm('');
};
  const filteredProducts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return products.slice(0, 100);

    return products
      .filter((p) => {
        const name = (p.name || '').toLowerCase();
        const barcode = (p.barcode || '').toLowerCase();
        return name.includes(q) || barcode.includes(q);
      })
      .slice(0, 100);
  }, [products, searchTerm]);

  const searchResults = useMemo(() => {
  const q = searchTerm.trim().toLowerCase();
  if (!q) return [];

  return products
    .filter((p) => {
      const name = (p.name || '').toLowerCase();
      const barcode = (p.barcode || '').toLowerCase();
      return name.includes(q) || barcode.includes(q);
    })
    .slice(0, 12);
}, [products, searchTerm]);
  const quotationLinesForPrint = useMemo(() => {
    return quoteLines.filter(
      (line) => line.name.trim() || Number(line.quantity) > 0 || Number(line.price) > 0
    );
  }, [quoteLines]);

  const quotationTotal = useMemo(() => {
    return quotationLinesForPrint.reduce(
      (sum, line) => sum + Number(line.quantity || 0) * Number(line.price || 0),
      0
    );
  }, [quotationLinesForPrint]);

  const blankRows = Array.from({ length: 15 }, (_, index) => index + 1);

  const getQuotationFractionDigits = () => {
    return quotationCurrency === 'SYP' ? 0 : 2;
  };

  const getQuotationPriceDisplayValue = (priceInUSD: number) => {
    const converted = convertFromUSD(Number(priceInUSD || 0), quotationCurrency, settings);
    const fractionDigits = getQuotationFractionDigits();
    return converted.toFixed(fractionDigits);
  };

  const getQuotationLineTotalDisplay = (line: QuoteLine) => {
    return formatMoney(Number(line.quantity || 0) * Number(line.price || 0), quotationCurrency, settings);
  };

  const handlePrint = (mode: 'blank-invoice' | 'quotation') => {
    setPrintMode(mode);

    setTimeout(() => {
      window.print();
    }, 120);
  };

  const activeLineCount = quoteLines.filter(
    (line) => line.name.trim() || Number(line.price || 0) > 0
  ).length;

  const glassCardStyle: React.CSSProperties = {
    background: 'var(--card-bg)',
    borderColor: 'var(--border-color)'
  };

  return (
    <div className="space-y-6" dir="rtl">
     <style>
  {`
    @page {
      size: A4 portrait;
      margin: 0mm;
    }

    .print-blank-sheet,
    .print-quotation-sheet {
      display: none;
    }

    @media print {
      .print-blank-sheet,
      .print-quotation-sheet {
        display: block !important;
      }

      html, body {
        width: 210mm !important;
        min-width: 210mm !important;
        background: #ffffff !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: visible !important;
      }

      body * {
        visibility: hidden !important;
      }

      body[data-print-template="blank-invoice"] .print-blank-sheet,
      body[data-print-template="blank-invoice"] .print-blank-sheet * {
        visibility: visible !important;
      }

      body[data-print-template="quotation"] .print-quotation-sheet,
      body[data-print-template="quotation"] .print-quotation-sheet * {
        visibility: visible !important;
      }

      body[data-print-template="blank-invoice"] .print-blank-sheet,
      body[data-print-template="quotation"] .print-quotation-sheet {
        position: fixed !important;
        inset: 0 !important;
        width: 100% !important;
        min-height: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        z-index: 999999 !important;
        direction: rtl !important;
      }

      body[data-print-template="blank-invoice"] .print-page {
        width: auto !important;
        min-height: auto !important;
        margin: 4cm 3cm !important;
        padding: 0 !important;
        box-sizing: border-box !important;
        background: #ffffff !important;
        color: #000000 !important;
        box-shadow: none !important;
        border: none !important;
        overflow: hidden !important;
        transform: scale(0.90) !important;
        transform-origin: top center !important;
      }

      body[data-print-template="blank-invoice"] .blank-invoice-title {
        font-size: 20px !important;
        line-height: 1.2 !important;
        margin-bottom: 4px !important;
      }

      body[data-print-template="blank-invoice"] .blank-invoice-meta {
        font-size: 10px !important;
        line-height: 1.25 !important;
      }

      body[data-print-template="blank-invoice"] .blank-invoice-label {
        font-size: 16px !important;
        margin-top: 10px !important;
      }

      body[data-print-template="blank-invoice"] .blank-invoice-info {
        font-size: 11px !important;
      }

      body[data-print-template="blank-invoice"] .blank-invoice-info > div {
        padding-top: 8px !important;
        padding-bottom: 8px !important;
      }

      body[data-print-template="blank-invoice"] .blank-invoice-table {
        font-size: 10px !important;
      }

      body[data-print-template="blank-invoice"] .blank-invoice-table th {
        padding: 6px 8px !important;
      }

      body[data-print-template="blank-invoice"] .blank-invoice-table td {
        padding: 4px 8px !important;
        height: 24px !important;
      }

      body[data-print-template="quotation"] .print-page {
        width: 190mm !important;
        min-height: 277mm !important;
        margin: 0 auto !important;
        padding: 0 !important;
        box-sizing: border-box !important;
        background: #ffffff !important;
        color: #000000 !important;
        box-shadow: none !important;
        border: none !important;
        overflow: hidden !important;
      }

      .print-table {
        width: 100% !important;
        border-collapse: collapse !important;
        table-layout: fixed !important;
      }

      .print-table th,
      .print-table td {
        border: 1px solid #d1d5db !important;
      }

      .no-print {
        display: none !important;
      }
    }
  `}
</style>

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
              <FileText size={28} style={{ color: 'var(--theme-primary)' }} />
              الفواتير وعروض الأسعار
            </h2>

            <p className="text-sm font-bold mt-2" style={{ color: 'var(--text-muted)' }}>
              طباعة فاتورة فارغة أو إنشاء عرض سعر أنيق مع الحفاظ الكامل على منطق البيانات والعملات الحالي داخل النظام
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setActiveTab('blank-invoice')}
              className="px-5 py-3 rounded-2xl border font-black flex items-center justify-center gap-2 transition-all"
              style={{
                borderColor:
                  activeTab === 'blank-invoice' ? 'var(--theme-primary)' : 'var(--border-color)',
                color: activeTab === 'blank-invoice' ? '#ffffff' : 'var(--theme-primary)',
                background:
                  activeTab === 'blank-invoice' ? 'var(--theme-primary)' : 'var(--card-bg)'
              }}
            >
              <Receipt size={18} />
              فاتورة فارغة
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('quotation')}
              className="px-5 py-3 rounded-2xl border font-black flex items-center justify-center gap-2 transition-all"
              style={{
                borderColor:
                  activeTab === 'quotation' ? 'var(--theme-primary)' : 'var(--border-color)',
                color: activeTab === 'quotation' ? '#ffffff' : 'var(--theme-primary)',
                background:
                  activeTab === 'quotation' ? 'var(--theme-primary)' : 'var(--card-bg)'
              }}
            >
              <ClipboardList size={18} />
              عرض سعر
            </button>
          </div>
        </div>

        {activeTab === 'blank-invoice' && (
          <>
            <div className="no-print grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 space-y-4">
                <div
                  className="rounded-[2rem] border p-6 lg:p-8"
                  style={{
                    borderColor: 'var(--border-color)',
                    background: 'var(--theme-primary-soft)'
                  }}
                >
                  <div
                    className="text-[10px] font-black uppercase tracking-widest mb-3"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    معاينة الفاتورة الفارغة
                  </div>

                  <div
                    className="rounded-[2rem] border p-6 md:p-8"
                    style={{
                      background: 'var(--card-bg)',
                      borderColor: 'var(--border-color)'
                    }}
                  >
                    <div
                      className="text-center border-b pb-5 mb-5"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      <h1 className="text-3xl font-black mb-2" style={{ color: 'var(--text-color)' }}>
                        {settings?.shop_name || 'اسم المحل'}
                      </h1>

                      {(settings?.shop_address || settings?.shop_phone || settings?.shop_mobile) && (
                        <div className="text-sm font-bold space-y-1" style={{ color: 'var(--text-muted)' }}>
                          {settings?.shop_address && <div>{settings.shop_address}</div>}
                          {(settings?.shop_phone || settings?.shop_mobile) && (
                            <div>
                              {settings?.shop_phone || ''}{' '}
                              {settings?.shop_phone && settings?.shop_mobile ? ' - ' : ''}
                              {settings?.shop_mobile || ''}
                            </div>
                          )}
                        </div>
                      )}

                      {settings?.shop_tax_number && (
                        <div className="text-sm font-bold mt-2" style={{ color: 'var(--text-muted)' }}>
                          الرقم الضريبي: {settings.shop_tax_number}
                        </div>
                      )}

                      <div className="mt-4 text-xl font-black" style={{ color: 'var(--text-color)' }}>
                        فاتورة
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {['اسم العميل', 'التاريخ', 'رقم الفاتورة', 'الهاتف'].map((item) => (
                        <div
                          key={item}
                          className="rounded-2xl border px-4 py-4 text-sm font-black"
                          style={{
                            borderColor: 'var(--border-color)',
                            color: 'var(--text-muted)'
                          }}
                        >
                          {item}: ....................................................
                        </div>
                      ))}
                    </div>

                    <div
                      className="mt-5 rounded-[1.5rem] overflow-hidden border"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      <table className="w-full text-sm">
                        <thead style={{ background: 'var(--theme-primary-soft)' }}>
                          <tr>
                            <th className="p-3 text-center font-black" style={{ color: 'var(--text-color)' }}>
                              #
                            </th>
                            <th className="p-3 text-center font-black" style={{ color: 'var(--text-color)' }}>
                              الصنف
                            </th>
                            <th className="p-3 text-center font-black" style={{ color: 'var(--text-color)' }}>
                              الكمية
                            </th>
                            <th className="p-3 text-center font-black" style={{ color: 'var(--text-color)' }}>
                              السعر
                            </th>
                            <th className="p-3 text-center font-black" style={{ color: 'var(--text-color)' }}>
                              الإجمالي
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {blankRows.map((row) => (
                            <tr key={row} className="border-t" style={{ borderColor: 'var(--border-color)' }}>
                              <td className="p-3 text-center" style={{ color: 'var(--text-muted)' }}>
                                {row}
                              </td>
                              <td className="p-3 h-12"></td>
                              <td className="p-3 text-center"></td>
                              <td className="p-3 text-center"></td>
                              <td className="p-3 text-center"></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                      <div
                        className="rounded-[1.5rem] border px-4 py-4 min-h-[112px] text-sm font-bold"
                        style={{
                          borderColor: 'var(--border-color)',
                          color: 'var(--text-color)'
                        }}
                      >
                        ملاحظات:
                      </div>

                      <div className="space-y-3">
                        {['المجموع', 'الخصم', 'الإجمالي النهائي'].map((item) => (
                          <div
                            key={item}
                            className="rounded-[1.5rem] border px-4 py-4 text-sm font-black flex items-center justify-between"
                            style={{
                              borderColor: 'var(--border-color)',
                              color: 'var(--text-color)'
                            }}
                          >
                            <span>{item}:</span>
                            <span>....................</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div
                      className="grid grid-cols-2 gap-8 mt-10 text-center text-sm font-black"
                      style={{ color: 'var(--text-color)' }}
                    >
                      <div>
                        <div>توقيع المستلم</div>
                        <div
                          className="mt-8 border-t pt-2"
                          style={{ borderColor: 'var(--border-color)' }}
                        >
                          ............................
                        </div>
                      </div>
                      <div>
                        <div>الختم / التوقيع</div>
                        <div
                          className="mt-8 border-t pt-2"
                          style={{ borderColor: 'var(--border-color)' }}
                        >
                          ............................
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div
                  className="app-muted rounded-[2rem] border p-5"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <div
                    className="text-[10px] font-black uppercase tracking-widest mb-3"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    معلومات سريعة
                  </div>

                  <div className="space-y-3 text-sm font-bold">
                    <div className="flex items-center justify-between gap-3">
                      <span style={{ color: 'var(--text-muted)' }}>اسم المحل</span>
                      <span style={{ color: 'var(--theme-primary)' }}>
                        {settings?.shop_name || 'غير محدد'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <span style={{ color: 'var(--text-muted)' }}>نوع النموذج</span>
                      <span style={{ color: 'var(--text-color)' }}>فاتورة فارغة</span>
                    </div>
                  </div>
                </div>

                <div
                  className="app-muted rounded-[2rem] border p-5"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <div
                    className="text-[10px] font-black uppercase tracking-widest mb-3"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    جاهزية الطباعة
                  </div>

                  <div className="space-y-3">
                    <div
                      className="rounded-2xl border px-4 py-3"
                      style={{
                        borderColor: 'var(--border-color)',
                        background: 'var(--theme-primary-soft)'
                      }}
                    >
                      <div className="text-xs font-black" style={{ color: 'var(--text-color)' }}>
                        A4 جاهز للطباعة
                      </div>
                      <div className="text-[11px] font-bold mt-1" style={{ color: 'var(--text-muted)' }}>
                        يتم طباعة النموذج كورقة مستقلة بدون عناصر الواجهة
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handlePrint('blank-invoice')}
                      className="w-full px-6 py-4 rounded-2xl text-white font-black flex items-center justify-center gap-2 transition-all"
                      style={{ background: 'var(--theme-primary)' }}
                    >
                      <Printer size={18} />
                      طباعة الآن
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="print-blank-sheet">
              <div className="print-page">
                <div className="text-center border-b pb-5 mb-5 border-gray-300">
                  <h1 className="blank-invoice-title text-3xl font-black mb-2 text-black">
                    {settings?.shop_name || 'اسم المحل'}
                  </h1>

                  {(settings?.shop_address || settings?.shop_phone || settings?.shop_mobile) && (
                    <div className="blank-invoice-meta text-sm font-bold text-gray-700 space-y-1">
                      {settings?.shop_address && <div>{settings.shop_address}</div>}
                      {(settings?.shop_phone || settings?.shop_mobile) && (
                        <div>
                          {settings?.shop_phone || ''} {settings?.shop_phone && settings?.shop_mobile ? ' - ' : ''}
                          {settings?.shop_mobile || ''}
                        </div>
                      )}
                    </div>
                  )}

                  {settings?.shop_tax_number && (
                    <div className="text-sm font-bold text-gray-700 mt-2">
                      الرقم الضريبي: {settings.shop_tax_number}
                    </div>
                  )}

                  <div className="blank-invoice-label mt-4 text-xl font-black text-black">فاتورة</div>
                </div>

                <div className="blank-invoice-info grid grid-cols-2 gap-4 mb-5 text-sm font-bold text-black">
                  <div className="border rounded-2xl px-4 py-3 border-gray-300">
                    اسم العميل: ....................................................
                  </div>
                  <div className="border rounded-2xl px-4 py-3 border-gray-300">
                    التاريخ: ....../....../........
                  </div>
                  <div className="border rounded-2xl px-4 py-3 border-gray-300">
                    رقم الفاتورة: ................................................
                  </div>
                  <div className="border rounded-2xl px-4 py-3 border-gray-300">
                    الهاتف: .......................................................
                  </div>
                </div>

                <div className="overflow-hidden rounded-[1.5rem] border border-gray-300">
                  <table className="print-table blank-invoice-table text-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="p-3 text-center font-black">#</th>
                        <th className="p-3 text-center font-black">الصنف</th>
                        <th className="p-3 text-center font-black">الكمية</th>
                        <th className="p-3 text-center font-black">السعر</th>
                        <th className="p-3 text-center font-black">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {blankRows.map((row) => (
                        <tr key={row}>
                          <td className="p-3 text-center h-12">{row}</td>
                          <td className="p-3"></td>
                          <td className="p-3 text-center"></td>
                          <td className="p-3 text-center"></td>
                          <td className="p-3 text-center"></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div className="space-y-3">
                    <div className="border rounded-2xl px-4 py-3 min-h-[96px] text-sm font-bold border-gray-300 text-black">
                      ملاحظات:
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="border rounded-2xl px-4 py-3 text-sm font-black flex items-center justify-between border-gray-300 text-black">
                      <span>المجموع:</span>
                      <span>....................</span>
                    </div>
                    <div className="border rounded-2xl px-4 py-3 text-sm font-black flex items-center justify-between border-gray-300 text-black">
                      <span>الخصم:</span>
                      <span>....................</span>
                    </div>
                    <div className="border rounded-2xl px-4 py-3 text-sm font-black flex items-center justify-between border-gray-300 text-black">
                      <span>الإجمالي النهائي:</span>
                      <span>....................</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8 mt-10 text-center text-sm font-black text-black">
                  <div>
                    <div>توقيع المستلم</div>
                    <div className="mt-8 border-t pt-2 border-gray-400">............................</div>
                  </div>
                  <div>
                    <div>الختم / التوقيع</div>
                    <div className="mt-8 border-t pt-2 border-gray-400">............................</div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'quotation' && (
          <>
            <div className="no-print grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 space-y-4">
                <div
                  className="rounded-[2rem] border p-6 lg:p-8"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
                    <div>
                      <div
                        className="text-[10px] font-black uppercase tracking-widest mb-2"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        إضافة أصناف عرض السعر
                      </div>

                      <h3 className="text-xl lg:text-2xl font-black" style={{ color: 'var(--text-color)' }}>
                        تجهيز الأصناف قبل الطباعة
                      </h3>

                      <p className="text-sm font-bold mt-2 leading-7" style={{ color: 'var(--text-muted)' }}>
                        اختر المنتج ثم عدل الاسم أو الكمية أو السعر بحرية قبل الطباعة النهائية
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={addQuoteLine}
                      className="px-5 py-3 rounded-2xl border font-black flex items-center justify-center gap-2 transition-all"
                      style={{
                        borderColor: 'var(--theme-primary)',
                        color: '#ffffff',
                        background: 'var(--theme-primary)'
                      }}
                    >
                      <Plus size={18} />
                      إضافة سطر
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div>
  <div
    className="text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2"
    style={{ color: 'var(--text-muted)' }}
  >
    <Search size={12} />
    بحث سريع عن منتج
  </div>

  <div className="relative">
    <Search
      className="absolute right-4 top-4"
      size={18}
      style={{ color: 'var(--text-muted)' }}
    />

    <input
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      placeholder="ابحث بالاسم أو الباركود"
      className="w-full app-muted border rounded-2xl py-4 pr-12 pl-4 text-sm font-black outline-none"
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
                  <span>
                    {formatMoney(
                      Number(product.sale_price ?? product.retail_price ?? product.price ?? 0),
                      quotationCurrency,
                      settings
                    )}
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div
            className="px-4 py-4 text-sm font-bold"
            style={{ color: 'var(--text-muted)' }}
          >
            لا يوجد منتج مطابق
          </div>
        )}
      </div>
    )}
  </div>
</div>

                    {loadingProducts && (
                      <div
                        className="rounded-2xl border px-5 py-4 text-sm font-black"
                        style={{
                          borderColor: 'var(--border-color)',
                          background: 'var(--theme-primary-soft)',
                          color: 'var(--text-muted)'
                        }}
                      >
                        جاري تحميل المنتجات...
                      </div>
                    )}

                    <div className="space-y-4">
                      {quoteLines.map((line, index) => (
                        <div
                          key={line.uid}
                          className="rounded-[2rem] border p-4 md:p-5 transition-all"
                          style={{
                            borderColor: 'var(--border-color)',
                            background: 'var(--theme-primary-soft)'
                          }}
                        >
                          <div className="flex items-center justify-between gap-3 mb-4">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-11 h-11 rounded-2xl flex items-center justify-center border"
                                style={{
                                  borderColor: 'var(--border-color)',
                                  background: 'var(--card-bg)',
                                  color: 'var(--theme-primary)'
                                }}
                              >
                                <Package size={18} />
                              </div>

                              <div>
                                <div className="font-black" style={{ color: 'var(--text-color)' }}>
                                  الصنف #{index + 1}
                                </div>
                                <div
                                  className="text-[10px] font-black uppercase tracking-widest mt-1"
                                  style={{ color: 'var(--text-muted)' }}
                                >
                                  إجمالي السطر: {getQuotationLineTotalDisplay(line)}
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => removeQuoteLine(line.uid)}
                              disabled={quoteLines.length === 1}
                              className="w-11 h-11 rounded-2xl flex items-center justify-center transition-all disabled:opacity-50"
                              style={{
                                background: 'rgba(239,68,68,0.10)',
                                color: '#dc2626'
                              }}
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                            <div className="xl:col-span-5">
                              <div
                                className="text-[10px] font-black uppercase tracking-widest mb-2"
                                style={{ color: 'var(--text-muted)' }}
                              >
                                المنتج
                              </div>
                              <select
                                value={line.product_id}
                                onChange={(e) => handleSelectProduct(line.uid, Number(e.target.value))}
                                className="w-full border rounded-2xl py-3.5 px-4 text-sm font-black outline-none"
                                style={{
                                  borderColor: 'var(--border-color)',
                                  background: 'var(--card-bg)',
                                  color: 'var(--theme-primary)'
                                }}
                              >
                                <option value="">اختر منتجًا</option>
                                {products.map((product) => (
  <option key={product.id} value={product.id}>
    {product.name} {product.barcode ? `- ${product.barcode}` : ''}
  </option>
))}
                              </select>
                            </div>

                            <div className="xl:col-span-3">
                              <div
                                className="text-[10px] font-black uppercase tracking-widest mb-2"
                                style={{ color: 'var(--text-muted)' }}
                              >
                                اسم مخصص
                              </div>
                              <input
                                value={line.name}
                                onChange={(e) => updateQuoteLine(line.uid, 'name', e.target.value)}
                                placeholder="اسم الصنف"
                                className="w-full border rounded-2xl py-3.5 px-4 text-sm font-black outline-none"
                                style={{
                                  borderColor: 'var(--border-color)',
                                  background: 'var(--card-bg)',
                                  color: 'var(--text-color)'
                                }}
                              />
                            </div>

                            <div className="xl:col-span-2">
                              <div
                                className="text-[10px] font-black uppercase tracking-widest mb-2"
                                style={{ color: 'var(--text-muted)' }}
                              >
                                الكمية
                              </div>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={line.quantity}
                                onChange={(e) =>
                                  updateQuoteLine(line.uid, 'quantity', Number(e.target.value || 0))
                                }
                                className="w-full border rounded-2xl py-3.5 px-3 text-sm font-black outline-none text-center"
                                style={{
                                  borderColor: 'var(--border-color)',
                                  background: 'var(--card-bg)',
                                  color: 'var(--text-color)'
                                }}
                              />
                            </div>

                            <div className="xl:col-span-2">
                              <div
                                className="text-[10px] font-black uppercase tracking-widest mb-2"
                                style={{ color: 'var(--text-muted)' }}
                              >
                                السعر
                              </div>
                              <input
                                type="number"
                                min="0"
                                step={quotationCurrency === 'SYP' ? '1' : '0.01'}
                                value={getQuotationPriceDisplayValue(line.price)}
                                onChange={(e) => {
                                  const enteredValue = Number(e.target.value || 0);
                                  const priceInUSD = convertToUSD(enteredValue, quotationCurrency, settings);
                                  updateQuoteLine(line.uid, 'price', priceInUSD);
                                }}
                                className="w-full border rounded-2xl py-3.5 px-3 text-sm font-black outline-none text-center"
                                style={{
                                  borderColor: 'var(--border-color)',
                                  background: 'var(--card-bg)',
                                  color: 'var(--text-color)'
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div
                  className="rounded-[2rem] border p-6"
                  style={{
                    borderColor: 'var(--border-color)',
                    background: 'var(--theme-primary-soft)'
                  }}
                >
                  <div
                    className="text-[10px] font-black uppercase tracking-widest mb-3"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    ملخص عرض السعر
                  </div>

                  <div className="space-y-3">
                    <div
                      className="text-3xl lg:text-4xl font-black text-center"
                      dir="ltr"
                      style={{ color: 'var(--theme-primary)' }}
                    >
                      {formatMoney(quotationTotal, quotationCurrency, settings)}
                    </div>

                    <div
                      className="text-sm font-bold text-center"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      عدد الأصناف الفعالة: {activeLineCount}
                    </div>

                    <div
                      className="text-xs font-bold text-center"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      العملة المعتمدة: {quotationCurrency} - {currencySymbols[quotationCurrency]}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div
                  className="app-muted rounded-[2rem] border p-5"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <div
                    className="text-[10px] font-black uppercase tracking-widest mb-3"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    بيانات عرض السعر
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div
                        className="text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <Receipt size={12} />
                        رقم العرض
                      </div>
                      <input
                        value={quotationNumber}
                        onChange={(e) => setQuotationNumber(e.target.value)}
                        className="w-full app-muted border rounded-2xl py-3.5 px-4 text-sm font-black outline-none"
                        style={{
                          borderColor: 'var(--border-color)',
                          color: 'var(--text-color)'
                        }}
                      />
                    </div>

                    <div>
                      <div
                        className="text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <CalendarDays size={12} />
                        التاريخ
                      </div>
                      <input
                        type="date"
                        value={quotationDate}
                        onChange={(e) => setQuotationDate(e.target.value)}
                        className="w-full app-muted border rounded-2xl py-3.5 px-4 text-sm font-black outline-none"
                        style={{
                          borderColor: 'var(--border-color)',
                          color: 'var(--text-color)'
                        }}
                      />
                    </div>

                    <div>
                      <div
                        className="text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <Coins size={12} />
                        عملة عرض السعر
                      </div>
                      <select
                        value={quotationCurrency}
                        onChange={(e) => setQuotationCurrency(e.target.value as CurrencyCode)}
                        className="w-full app-muted border rounded-2xl py-3.5 px-4 text-sm font-black outline-none"
                        style={{
                          borderColor: 'var(--border-color)',
                          color: 'var(--theme-primary)'
                        }}
                      >
                        <option value="USD">دولار ($)</option>
                        <option value="SYP">ليرة سورية (ل.س)</option>
                        <option value="TRY">ليرة تركية (TL)</option>
                      </select>
                    </div>

                    <div>
                      <div
                        className="text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <User size={12} />
                        اسم العميل
                      </div>
                      <input
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="اسم العميل"
                        className="w-full app-muted border rounded-2xl py-3.5 px-4 text-sm font-black outline-none"
                        style={{
                          borderColor: 'var(--border-color)',
                          color: 'var(--text-color)'
                        }}
                      />
                    </div>

                    <div>
                      <div
                        className="text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <Phone size={12} />
                        هاتف العميل
                      </div>
                      <input
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="هاتف العميل"
                        className="w-full app-muted border rounded-2xl py-3.5 px-4 text-sm font-black outline-none"
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
                        ملاحظات
                      </div>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={5}
                        className="w-full app-muted border rounded-2xl py-3.5 px-4 text-sm font-black outline-none resize-none leading-7"
                        style={{
                          borderColor: 'var(--border-color)',
                          color: 'var(--text-color)'
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div
                  className="app-muted rounded-[2rem] border p-5"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <div
                    className="text-[10px] font-black uppercase tracking-widest mb-3"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    معلومات سريعة
                  </div>

                  <div className="space-y-3">
                    <div
                      className="rounded-2xl border px-4 py-3 flex items-center justify-between gap-3"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-black" style={{ color: 'var(--text-color)' }}>
                          الأصناف
                        </div>
                        <div className="text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>
                          عدد الأصناف المضافة فعليًا
                        </div>
                      </div>
                      <div
                        className="text-sm font-black text-left"
                        dir="ltr"
                        style={{ color: 'var(--theme-primary)' }}
                      >
                        {activeLineCount}
                      </div>
                    </div>

                    <div
                      className="rounded-2xl border px-4 py-3 flex items-center justify-between gap-3"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-black" style={{ color: 'var(--text-color)' }}>
                          النتائج
                        </div>
                        <div className="text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>
                          منتجات متاحة في البحث
                        </div>
                      </div>
                      <div
                        className="text-sm font-black text-left"
                        dir="ltr"
                        style={{ color: 'var(--theme-primary)' }}
                      >
                        {searchTerm.trim() ? searchResults.length : products.length}
                      </div>
                    </div>

                    <div
                      className="rounded-2xl border px-4 py-3 flex items-center justify-between gap-3"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-black" style={{ color: 'var(--text-color)' }}>
                          الإجمالي
                        </div>
                        <div className="text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>
                          مجموع عرض السعر
                        </div>
                      </div>
                      <div
                        className="text-sm font-black text-left"
                        dir="ltr"
                        style={{ color: 'var(--theme-primary)' }}
                      >
                        {formatMoney(quotationTotal, quotationCurrency, settings)}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handlePrint('quotation')}
                    className="w-full mt-4 px-6 py-4 rounded-2xl text-white font-black flex items-center justify-center gap-2 transition-all"
                    style={{ background: 'var(--theme-primary)' }}
                  >
                    <Printer size={18} />
                    طباعة عرض السعر
                  </button>
                </div>
              </div>
            </div>

            <div className="print-quotation-sheet">
              <div className="print-page">
                <div className="flex items-start justify-between border-b pb-5 mb-5 border-gray-300">
                  <div>
                    <h1 className="text-3xl font-black mb-2 text-black">
                      {settings?.shop_name || 'اسم المحل'}
                    </h1>

                    <div className="text-sm font-bold text-gray-700 space-y-1">
                      {settings?.shop_address && <div>{settings.shop_address}</div>}
                      {(settings?.shop_phone || settings?.shop_mobile) && (
                        <div>
                          {settings?.shop_phone || ''} {settings?.shop_phone && settings?.shop_mobile ? ' - ' : ''}
                          {settings?.shop_mobile || ''}
                        </div>
                      )}
                      {settings?.shop_tax_number && <div>الرقم الضريبي: {settings.shop_tax_number}</div>}
                    </div>
                  </div>

                  <div className="text-left">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-white font-black bg-black">
                      <Receipt size={16} />
                      عرض سعر
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-5 text-sm font-bold text-black">
                  <div className="border rounded-2xl px-4 py-3 border-gray-300">
                    رقم العرض: {quotationNumber || '-'}
                  </div>
                  <div className="border rounded-2xl px-4 py-3 border-gray-300">
                    التاريخ: {quotationDate || '-'}
                  </div>
                  <div className="border rounded-2xl px-4 py-3 border-gray-300">
                    اسم العميل: {customerName || '-'}
                  </div>
                  <div className="border rounded-2xl px-4 py-3 border-gray-300">
                    هاتف العميل: {customerPhone || '-'}
                  </div>
                  <div className="border rounded-2xl px-4 py-3 border-gray-300 col-span-2">
                    العملة المعتمدة: {quotationCurrency} - {currencySymbols[quotationCurrency]}
                  </div>
                </div>

                <div className="overflow-hidden rounded-[1.5rem] border border-gray-300">
                  <table className="print-table text-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="p-3 text-center font-black" style={{ width: '8%' }}>
                          #
                        </th>
                        <th className="p-3 text-center font-black" style={{ width: '44%' }}>
                          الصنف
                        </th>
                        <th className="p-3 text-center font-black" style={{ width: '16%' }}>
                          الكمية
                        </th>
                        <th className="p-3 text-center font-black" style={{ width: '16%' }}>
                          السعر
                        </th>
                        <th className="p-3 text-center font-black" style={{ width: '16%' }}>
                          الإجمالي
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {quotationLinesForPrint.length > 0 ? (
                        quotationLinesForPrint.map((line, index) => (
                          <tr key={line.uid}>
                            <td className="p-3 text-center">{index + 1}</td>
                            <td className="p-3 break-words">{line.name || '-'}</td>
                            <td className="p-3 text-center">{Number(line.quantity || 0)}</td>
                            <td className="p-3 text-center">
                              {formatMoney(Number(line.price || 0), quotationCurrency, settings)}
                            </td>
                            <td className="p-3 text-center">
                              {formatMoney(
                                Number(line.quantity || 0) * Number(line.price || 0),
                                quotationCurrency,
                                settings
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="p-4 text-center font-bold text-gray-600">
                            لا توجد أصناف مضافة
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end mt-5">
                  <div className="w-full max-w-sm space-y-3">
                    <div className="border rounded-2xl px-4 py-3 text-sm font-black flex items-center justify-between border-gray-300 text-black">
                      <span>الإجمالي النهائي</span>
                      <span>{formatMoney(quotationTotal, quotationCurrency, settings)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 border rounded-2xl p-4 text-sm font-bold min-h-[90px] border-gray-300 text-black">
                  <div className="font-black mb-2">ملاحظات:</div>
                  <div>{notes || '-'}</div>
                </div>

                <div className="grid grid-cols-2 gap-8 mt-10 text-center text-sm font-black text-black">
                  <div>
                    <div>توقيع العميل</div>
                    <div className="mt-8 border-t pt-2 border-gray-400">............................</div>
                  </div>
                  <div>
                    <div>الختم / التوقيع</div>
                    <div className="mt-8 border-t pt-2 border-gray-400">............................</div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PrintTemplates;