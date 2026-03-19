import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FileText, Plus, X, Printer, Search, RefreshCw,
  Building2, User, Trash2, Save,
} from 'lucide-react';
import { apiClient } from '../api/client.ts';
import { settingsApi } from '../api/settings.ts';

interface Product {
  id:             number;
  name:           string;
  retail_price:   string;
  wholesale_price:string;
  barcode:        string | null;
  unit:           string | null;
}

interface LineItem {
  id:          number;
  name:        string;
  qty:         number;
  unit_price:  number;
  discount:    number;
}

type DocType = 'invoice' | 'quote';

const CURRENCIES = [
  { code: 'USD', symbol: '$' },
  { code: 'SYP', symbol: 'ل.س' },
  { code: 'TRY', symbol: 'TL' },
  { code: 'SAR', symbol: 'ر.س' },
  { code: 'AED', symbol: 'د.إ' },
];

function genInvoiceNo(type: DocType) {
  const prefix = type === 'invoice' ? 'INV' : 'QUO';
  const d = new Date();
  return `${prefix}-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${Math.floor(Math.random()*9000)+1000}`;
}

export default function InvoicesPage() {
  const [docType,      setDocType]      = useState<DocType>('invoice');
  const [invoiceNo,    setInvoiceNo]    = useState(() => genInvoiceNo('invoice'));
  const [invoiceDate,  setInvoiceDate]  = useState(new Date().toISOString().split('T')[0]);
  const [dueDate,      setDueDate]      = useState('');
  const [currency,     setCurrency]     = useState('USD');
  const [customerName, setCustomerName] = useState('');
  const [customerInfo, setCustomerInfo] = useState('');
  const [notes,        setNotes]        = useState('');
  const [items,        setItems]        = useState<LineItem[]>([]);
  const [search,       setSearch]       = useState('');
  const [debouncedQ,   setDebouncedQ]   = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setInvoiceNo(genInvoiceNo(docType));
  }, [docType]);

  const { data: productData } = useQuery({
    queryKey: ['products-invoice', debouncedQ],
    queryFn:  () => apiClient.get('/products', { params: { q: debouncedQ, limit: 20 } })
      .then((r) => r.data as { products: Product[] }),
    enabled: debouncedQ.length > 0,
  });

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn:  () => settingsApi.getAll().then((r) => r.data.settings),
    staleTime: 0,
  });

  const shopName    = settings?.shop_name    ?? 'اسم المحل';
  const shopPhone   = settings?.shop_phone   ?? '';
  const shopAddress = settings?.shop_address ?? '';

  const addProduct = (p: Product) => {
    setItems((prev) => {
      const existing = prev.find((x) => x.id === p.id);
      if (existing) return prev.map((x) => x.id === p.id ? { ...x, qty: x.qty + 1 } : x);
      return [...prev, { id: p.id, name: p.name, qty: 1, unit_price: parseFloat(p.retail_price) || 0, discount: 0 }];
    });
    setSearch(''); setDebouncedQ('');
  };

  const updateItem = (id: number, field: keyof LineItem, val: number) =>
    setItems((prev) => prev.map((x) => x.id === id ? { ...x, [field]: val } : x));

  const removeItem = (id: number) => setItems((prev) => prev.filter((x) => x.id !== id));

  const sym    = CURRENCIES.find((c) => c.code === currency)?.symbol ?? '$';
  const subtotal = items.reduce((s, i) => s + i.qty * i.unit_price, 0);
  const discountTotal = items.reduce((s, i) => s + i.discount, 0);
  const total  = Math.max(0, subtotal - discountTotal);

  const fmt = (n: number) =>
    `${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${sym}`;

  const handlePrint = () => {
    const rows = items.map((item, i) => `
      <tr>
        <td>${i + 1}</td>
        <td style="font-weight:700;text-align:right">${item.name}</td>
        <td style="text-align:center">${item.qty.toLocaleString()}</td>
        <td style="text-align:center">${item.unit_price.toFixed(2)} ${sym}</td>
        ${item.discount > 0 ? `<td style="text-align:center;color:#ef4444">${item.discount.toFixed(2)} ${sym}</td>` : `<td style="text-align:center">—</td>`}
        <td style="text-align:center;font-weight:900;color:#059669">${((item.qty * item.unit_price) - item.discount).toFixed(2)} ${sym}</td>
      </tr>
    `).join('');

    const isInvoice = docType === 'invoice';
    const title     = isInvoice ? 'فاتورة بيع' : 'عرض سعر';
    const color     = isInvoice ? '#059669' : '#7c3aed';

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>${title}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; color: #1e293b; font-size: 13px; }
        .page { max-width: 800px; margin: 0 auto; padding: 32px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
        .logo-section { display: flex; flex-direction: column; gap: 4px; }
        .shop-name { font-size: 22px; font-weight: 900; color: ${color}; }
        .shop-info { font-size: 11px; color: #64748b; }
        .doc-section { text-align: left; }
        .doc-title { font-size: 20px; font-weight: 900; color: ${color}; margin-bottom: 8px; }
        .doc-meta { font-size: 11px; color: #64748b; line-height: 1.8; }
        .divider { height: 2px; background: ${color}; margin-bottom: 24px; border-radius: 2px; }
        .bill-to { background: #f8fafc; border-right: 3px solid ${color}; padding: 12px 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0; }
        .bill-to-label { font-size: 10px; font-weight: 700; color: #64748b; margin-bottom: 4px; text-transform: uppercase; }
        .bill-to-name { font-size: 15px; font-weight: 900; }
        .bill-to-info { font-size: 11px; color: #64748b; margin-top: 2px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        th { background: ${color}; color: white; padding: 10px 12px; font-size: 11px; text-align: center; }
        th:nth-child(2) { text-align: right; }
        td { padding: 9px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px; text-align: center; }
        .totals { display: flex; justify-content: flex-start; flex-direction: column; align-items: flex-end; gap: 6px; }
        .totals-row { display: flex; gap: 40px; justify-content: flex-start; }
        .totals-label { font-size: 12px; color: #64748b; min-width: 100px; text-align: right; }
        .totals-value { font-size: 12px; font-weight: 700; min-width: 120px; text-align: left; }
        .total-final { font-size: 16px; font-weight: 900; color: ${color}; }
        .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; }
        .footer-note { font-size: 11px; color: #94a3b8; }
        .notes-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 24px; font-size: 11px; color: #475569; }
        .valid-badge { background: ${color}20; color: ${color}; padding: 4px 10px; border-radius: 20px; font-size: 10px; font-weight: 700; display: inline-block; margin-top: 4px; }
        @media print { @page { margin: 1cm; } body { font-size: 12px; } .page { padding: 0; } }
      </style></head>
      <body><div class="page">
        <div class="header">
          <div class="logo-section">
            <div class="shop-name">${shopName}</div>
            ${shopPhone   ? `<div class="shop-info">📞 ${shopPhone}</div>` : ''}
            ${shopAddress ? `<div class="shop-info">📍 ${shopAddress}</div>` : ''}
          </div>
          <div class="doc-section">
            <div class="doc-title">${title}</div>
            <div class="doc-meta">
              رقم: <strong>${invoiceNo}</strong><br/>
              التاريخ: ${invoiceDate}<br/>
              ${dueDate ? `تاريخ الانتهاء: ${dueDate}<br/>` : ''}
              العملة: ${currency}
              ${!isInvoice ? `<br/><span class="valid-badge">عرض سعر — غير ملزم</span>` : ''}
            </div>
          </div>
        </div>

        <div class="divider"></div>

        ${(customerName || customerInfo) ? `
        <div class="bill-to">
          <div class="bill-to-label">${isInvoice ? 'فاتورة إلى' : 'مقدم إلى'}</div>
          ${customerName ? `<div class="bill-to-name">${customerName}</div>` : ''}
          ${customerInfo ? `<div class="bill-to-info">${customerInfo.replace(/\n/g,'<br/>')}</div>` : ''}
        </div>` : ''}

        <table>
          <thead><tr>
            <th style="width:40px">#</th>
            <th style="text-align:right">الصنف</th>
            <th>الكمية</th>
            <th>سعر الوحدة</th>
            <th>الخصم</th>
            <th>الإجمالي</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>

        <div class="totals">
          <div class="totals-row">
            <span class="totals-label">المجموع الفرعي:</span>
            <span class="totals-value">${fmt(subtotal)}</span>
          </div>
          ${discountTotal > 0 ? `
          <div class="totals-row">
            <span class="totals-label" style="color:#ef4444">إجمالي الخصم:</span>
            <span class="totals-value" style="color:#ef4444">- ${fmt(discountTotal)}</span>
          </div>` : ''}
          <div class="totals-row" style="margin-top:8px; padding-top:8px; border-top:2px solid #e2e8f0">
            <span class="totals-label total-final">الإجمالي الكلي:</span>
            <span class="totals-value total-final">${fmt(total)}</span>
          </div>
        </div>

        ${notes ? `<div class="notes-box"><strong>ملاحظات:</strong> ${notes}</div>` : ''}

        <div class="footer">
          <div class="footer-note">${isInvoice ? 'شكراً لتعاملكم معنا' : 'هذا العرض صالح لمدة 7 أيام من تاريخه'}</div>
          <div class="footer-note">تم الإصدار بواسطة ${shopName}</div>
        </div>
      </div>
      <script>window.onload=()=>{ window.print(); window.close(); }<\/script>
      </body></html>`);
    win.document.close();
  };

  const products = productData?.products ?? [];

  return (
    <div className="p-6" dir="rtl">
      <div className="mb-6">
        <h1 className="text-2xl font-black mb-1" style={{ color: 'var(--text-heading)' }}>
          الفواتير وعروض الأسعار
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          أصدر فواتير احترافية وعروض أسعار باسم محلك
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left panel: settings + product search */}
        <div className="flex flex-col gap-4">
          {/* Doc type */}
          <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="text-xs font-black mb-3" style={{ color: 'var(--text-muted)' }}>نوع المستند</div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {(['invoice', 'quote'] as DocType[]).map((t) => (
                <button key={t} onClick={() => setDocType(t)}
                  className="py-2.5 rounded-xl text-sm font-black transition-colors flex items-center justify-center gap-2"
                  style={docType === t
                    ? { background: t === 'invoice' ? '#059669' : '#7c3aed', color: '#fff' }
                    : { background: 'var(--bg-muted)', color: 'var(--text-secondary)' }}>
                  {t === 'invoice' ? <><FileText size={15}/> فاتورة</> : <><Save size={15}/> عرض سعر</>}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2.5">
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>رقم المستند</label>
                <input type="text" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border text-sm font-mono focus:outline-none"
                  style={{ background: 'var(--bg-muted)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>التاريخ</label>
                  <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none"
                    style={{ background: 'var(--bg-muted)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>تاريخ الانتهاء</label>
                  <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none"
                    style={{ background: 'var(--bg-muted)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>العملة</label>
                <select value={currency} onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border text-sm font-bold focus:outline-none"
                  style={{ background: 'var(--bg-muted)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                  {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Customer */}
          <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2 mb-3">
              <User size={14} style={{ color: 'var(--text-muted)' }} />
              <div className="text-xs font-black" style={{ color: 'var(--text-muted)' }}>بيانات العميل</div>
            </div>
            <div className="flex flex-col gap-2">
              <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)}
                placeholder="اسم العميل أو الشركة"
                className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none"
                style={{ background: 'var(--bg-muted)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              <textarea rows={2} value={customerInfo} onChange={(e) => setCustomerInfo(e.target.value)}
                placeholder="هاتف / عنوان / معلومات إضافية"
                className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none resize-none"
                style={{ background: 'var(--bg-muted)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
            </div>
          </div>

          {/* Product search */}
          <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="text-xs font-black mb-3" style={{ color: 'var(--text-muted)' }}>إضافة صنف</div>
            <div className="relative mb-2">
              <Search size={14} className="absolute top-1/2 -translate-y-1/2 right-3" style={{ color: 'var(--text-muted)' }} />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث عن صنف..."
                className="w-full pr-8 pl-3 py-2 rounded-xl border text-sm focus:outline-none"
                style={{ background: 'var(--bg-muted)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
            </div>
            {products.length > 0 && (
              <div className="max-h-48 overflow-y-auto flex flex-col gap-1">
                {products.map((p) => (
                  <button key={p.id} onClick={() => addProduct(p)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-right w-full transition-colors text-sm"
                    style={{ background: 'var(--bg-muted)', color: 'var(--text-primary)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-card)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-muted)'; }}>
                    <Plus size={13} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                    <span className="flex-1 truncate font-bold">{p.name}</span>
                    <span className="text-xs font-black" style={{ color: 'var(--primary)' }}>
                      ${parseFloat(p.retail_price).toFixed(2)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Document preview / items */}
        <div className="xl:col-span-2 flex flex-col gap-4">
          {/* Items table */}
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <div className="grid grid-cols-12 gap-2 px-4 py-2.5 text-xs font-black border-b"
              style={{ background: 'var(--bg-muted)', color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
              <div className="col-span-4">الصنف</div>
              <div className="col-span-1 text-center">كمية</div>
              <div className="col-span-3 text-center">سعر الوحدة</div>
              <div className="col-span-2 text-center">خصم</div>
              <div className="col-span-1 text-center">المجموع</div>
              <div className="col-span-1" />
            </div>

            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3"
                style={{ background: 'var(--bg-card)', color: 'var(--text-muted)' }}>
                <FileText size={40} />
                <span className="text-sm">أضف أصناف من القائمة اليسرى</span>
              </div>
            ) : (
              <div style={{ background: 'var(--bg-card)' }}>
                {items.map((item, i) => {
                  const lineTotal = item.qty * item.unit_price - item.discount;
                  return (
                    <div key={item.id}
                      className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center border-b"
                      style={{ borderColor: 'var(--border)', background: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-muted)' }}>
                      <div className="col-span-4 text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                        {item.name}
                      </div>
                      <div className="col-span-1">
                        <input type="number" min="0.001" step="1" value={item.qty}
                          onChange={(e) => updateItem(item.id, 'qty', parseFloat(e.target.value) || 1)}
                          className="w-full text-center px-1 py-1 rounded-lg border text-xs font-bold focus:outline-none"
                          style={{ background: 'var(--bg-muted)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                      </div>
                      <div className="col-span-3">
                        <input type="number" min="0" step="0.01" value={item.unit_price}
                          onChange={(e) => updateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                          className="w-full text-center px-1 py-1 rounded-lg border text-xs font-bold focus:outline-none"
                          style={{ background: 'var(--bg-muted)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                      </div>
                      <div className="col-span-2">
                        <input type="number" min="0" step="0.01" value={item.discount || 0}
                          onChange={(e) => updateItem(item.id, 'discount', parseFloat(e.target.value) || 0)}
                          className="w-full text-center px-1 py-1 rounded-lg border text-xs font-bold focus:outline-none"
                          style={{ background: 'var(--bg-muted)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                      </div>
                      <div className="col-span-1 text-center text-xs font-black" style={{ color: '#059669' }}>
                        {lineTotal.toFixed(2)}
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <button onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600">
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Totals + Notes */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div className="text-xs font-black mb-2" style={{ color: 'var(--text-muted)' }}>ملاحظات</div>
              <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="أي ملاحظات على المستند..."
                className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none resize-none"
                style={{ background: 'var(--bg-muted)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
            </div>
            <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div className="flex flex-col gap-2">
                {[
                  { label: 'المجموع الفرعي', value: fmt(subtotal), color: 'var(--text-primary)' },
                  ...(discountTotal > 0 ? [{ label: 'إجمالي الخصم', value: `- ${fmt(discountTotal)}`, color: '#ef4444' }] : []),
                  { label: 'الإجمالي الكلي', value: fmt(total), color: docType === 'invoice' ? '#059669' : '#7c3aed' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>{label}</span>
                    <span className="text-sm font-black tabular-nums" style={{ color }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Print */}
          <button onClick={handlePrint} disabled={!items.length}
            className="w-full py-4 rounded-xl text-white font-black text-base disabled:opacity-40 flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
            style={{ background: docType === 'invoice' ? '#059669' : '#7c3aed' }}>
            <Printer size={18} />
            {docType === 'invoice' ? 'طباعة الفاتورة' : 'طباعة عرض السعر'}
          </button>
        </div>
      </div>
    </div>
  );
}
