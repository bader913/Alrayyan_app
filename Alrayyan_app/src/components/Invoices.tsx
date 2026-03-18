import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Search,
  Eye,
  Printer,
  X,
  User,
  Truck,
  ShoppingBag,
  ShoppingCart,
  FileText,
  BarChart3
} from 'lucide-react';
import Barcode from 'react-barcode';
import { motion, AnimatePresence } from 'motion/react';
import { Sale } from '../types';
import { appAlert } from '../utils/appAlert';
import { formatAppDateTime, formatAppDate, formatAppTime } from '../utils/formatDateTime';interface PurchaseInvoice {
  id: number;
  supplier_id?: number;
  supplier_name?: string;
  supplier_phone?: string;
  supplier_address?: string;
  total_amount: number;
  paid_amount: number;
  user_id?: number;
  user_name?: string;
  created_at: string;
  items?: Array<{
    id: number;
    purchase_id: number;
    product_id: number;
    quantity: number;
    unit_price: number;
    total_price: number;
    product_name?: string;
    product_barcode?: string;
    product_unit?: string;
  }>;
}

type InvoiceTab = 'sales' | 'purchases';

const Invoices: React.FC = () => {
  const [activeTab, setActiveTab] = useState<InvoiceTab>('sales');
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<PurchaseInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [settings, setSettings] = useState<any>(null);

  

  const [showInvoicesReportPreview, setShowInvoicesReportPreview] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
  setSearchQuery('');
  fetchInvoices();
}, [activeTab]);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      setSettings(data);
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      if (activeTab === 'sales') {
        const res = await fetch('/api/sales');
        const data = await res.json();
        setSales(Array.isArray(data) ? data : []);
      } else {
        const res = await fetch('/api/purchases');
        const data = await res.json();
        setPurchases(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching invoices:', error);
      if (activeTab === 'sales') setSales([]);
      else setPurchases([]);
    } finally {
      setLoading(false);
    }
  };

  const handleViewInvoice = async (id: number) => {
    try {
      const endpoint = activeTab === 'sales' ? `/api/sales/${id}` : `/api/purchases/${id}`;
      const res = await fetch(endpoint);
      const data = await res.json();
      setSelectedInvoice(data);
      setShowInvoiceModal(true);
    } catch (error) {
      console.error('Error fetching invoice details:', error);
    }
  };

  const handlePrintInvoice = async (id: number) => {
  try {
    const endpoint = activeTab === 'sales' ? `/api/sales/${id}` : `/api/purchases/${id}`;
    const res = await fetch(endpoint);

    if (!res.ok) {
      const text = await res.text();
      console.error('Invoice print request failed:', res.status, text);
      appAlert('تعذر جلب بيانات الفاتورة للطباعة');
      return;
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      console.error('Expected JSON but got:', text);
      appAlert('السيرفر أعاد استجابة غير صالحة للطباعة');
      return;
    }

    const data = await res.json();
    printInvoice(data, activeTab);
  } catch (error) {
    console.error('Error fetching invoice details for printing:', error);
    appAlert('حدث خطأ أثناء جلب بيانات الفاتورة للطباعة');
  }
};

  const getPaymentMethodText = (method: string) => {
    switch (method) {
      case 'cash':
        return 'نقدي';
      case 'card':
        return 'شام كاش';
      case 'credit':
        return 'آجل';
      default:
        return method;
    }
  };

  type CurrencyCode = 'SYP' | 'USD' | 'TRY' | 'SAR' | 'AED';

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

const getCurrencySymbol = (currencyCode?: CurrencyCode): string => {
  const code = currencyCode || getCurrencyCode();

  const symbols: Record<CurrencyCode, string> = {
    SYP: 'ل.س',
    USD: '$',
    TRY: 'TL',
    SAR: 'ر.س',
    AED: 'د.إ'
  };

  return symbols[code];
};

const convertFromUSD = (amount: number, targetCurrency?: CurrencyCode) => {
  const currencyCode = targetCurrency || getCurrencyCode();
  const rate = getRateFromUSD(currencyCode);
  return Number(amount || 0) * rate;
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

  const formatPrintDate = (date: string | number | Date) => formatAppDateTime(date);
const buildInvoicePrintHtml = (invoiceData: any, type: InvoiceTab) => {
  const items = invoiceData.items || invoiceData.sale_items || invoiceData.purchase_items || [];

  const invoiceNumber = invoiceData.id || invoiceData.saleId || invoiceData.sale_id || '';

  const invoiceDate = invoiceData.created_at || new Date();

  const customerOrSupplierName =
    type === 'sales'
      ? invoiceData.customer_name || invoiceData.customer?.name || 'عميل نقدي'
      : invoiceData.supplier_name || invoiceData.supplier?.name || '-';

  const paymentMethodValue = invoiceData.payment_method || invoiceData.paymentMethod || 'cash';

  const paymentMethodLabel =
    paymentMethodValue === 'cash'
      ? 'نقدي'
      : paymentMethodValue === 'card'
      ? 'شام كاش'
      : paymentMethodValue === 'credit'
      ? 'آجل'
      : paymentMethodValue;

  const totalAmount = Number(invoiceData.total_amount ?? invoiceData.total ?? 0);
  const discountAmount = type === 'sales' ? Number(invoiceData.discount ?? 0) : 0;
  const grandTotalAmount = type === 'sales' ? totalAmount - discountAmount : totalAmount;
  const paidAmountValue = Number(invoiceData.paid_amount ?? invoiceData.paidAmount ?? 0);

  const remainingValue = Math.max(grandTotalAmount - paidAmountValue, 0);
  const changeValue = Math.max(paidAmountValue - grandTotalAmount, 0);

  const escapeHtml = (value: any) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const itemsHtml = items
    .map((item: any) => {
      const itemName = escapeHtml(item.product_name || item.name || item.product?.name || 'صنف');
      const qty = Number(item.quantity || 0);
      const unitPrice = Number(item.unit_price ?? item.sale_price ?? 0);
      const lineTotal = Number(item.total_price ?? unitPrice * qty);

      return `
        <div class="row item-row">
          <span class="col-name">${itemName}</span>
          <span class="col-qty">${qty.toLocaleString('en-US')}</span>
          <span class="col-price">${escapeHtml(formatMoneyRaw(unitPrice))}</span>
          <span class="col-total">${escapeHtml(formatMoneyRaw(lineTotal))}</span>
        </div>
      `;
    })
    .join('');

  return `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
      <head>
        <meta charset="utf-8" />
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
        <title>${type === 'sales' ? 'فاتورة بيع' : 'فاتورة شراء'} #${escapeHtml(invoiceNumber)}</title>

        <style>
          @page {
            size: 55mm auto;
            margin: 1mm;
          }

          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }

          html, body {
            background: #fff;
            color: #000;
            font-family: Tahoma, Arial, "Segoe UI", sans-serif;
            width: 55mm;
            min-width: 55mm;
            max-width: 55mm;
          }

          body {
            padding: 0;
            font-size: 10px;
            line-height: 1.35;
          }

          .receipt {
            width: 54mm;
            max-width: 54mm;
            margin-left: auto;
            margin-right: auto;
            padding: 1px 0;
          }

          .row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 2mm;
          }

          .header-row,
          .item-row {
            display: grid;
            grid-template-columns: 42% 13% 20% 25%;
            align-items: center;
            gap: 0.5mm;
            margin: 0;
            padding: 1px 0;
            border-bottom: 1px solid #eee;
          }

          .header-row {
            font-weight: bold;
            border-bottom: 1px solid #999;
          }

          .col-name {
            text-align: left;
            word-break: break-word;
            padding-right: 0.5mm;
          }

          .col-qty {
            text-align: center;
          }

          .col-price {
            text-align: right;
            direction: ltr;
            unicode-bidi: embed;
          }

          .col-total {
            text-align: right;
            font-weight: bold;
            direction: ltr;
            unicode-bidi: embed;
            white-space: nowrap;
          }

          .sep {
            border-top: 1px dashed #999;
            margin: 4px 0;
          }

          .title {
            font-size: 15px;
            font-weight: bold;
            margin-bottom: 2.5px;
            text-align: center;
          }

          .text-center { text-align: center; }
          .muted { color: #666; }
          .small { font-size: 8px; }
          .base { font-size: 10px; }
          .lg { font-size: 12px; }
          .bold { font-weight: bold; }

          .totals .row {
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 2mm;
            margin: 2px 0;
          }

          .meta-row {
            margin-top: 4px;
          }

          .footer {
            margin-top: 6px;
            text-align: center;
            font-size: 9px;
          }

          .invoice-no {
            font-size: 11px;
            font-weight: bold;
            margin-bottom: 2px;
          }

          @media print {
            html, body {
              width: 55mm;
              min-width: 55mm;
              max-width: 55mm;
            }

            .receipt {
              width: 54mm;
              max-width: 54mm;
              margin-left: auto;
              margin-right: auto;
            }
          }
        </style>
      </head>

      <body>
        <div class="receipt">
          <div class="text-center">
            <div class="title">${escapeHtml(settings?.shop_name || 'سوبر ماركت الخير')}</div>
            <div class="base muted">${escapeHtml(settings?.shop_address || 'دمشق، الميدان')}</div>
            ${
              settings?.shop_phone
                ? `<div class="small muted">${escapeHtml(settings.shop_phone)}</div>`
                : ''
            }
            ${
              settings?.shop_tax_number
                ? `<div class="small muted">الرقم الضريبي: ${escapeHtml(settings.shop_tax_number)}</div>`
                : ''
            }
          </div>

          <div class="sep"></div>

          <div class="row base">
            <span>رقم الفاتورة: #${escapeHtml(invoiceNumber)}</span>
            <span>${escapeHtml(formatPrintDate(invoiceDate))}</span>
          </div>

          <div class="row base meta-row">
            <span>${type === 'sales' ? 'الكاشير' : 'المستخدم'}: ${escapeHtml(invoiceData.user_name || '-')}</span>
            ${
              type === 'sales'
                ? `<span>طريقة الدفع: ${escapeHtml(paymentMethodLabel)}</span>`
                : `<span></span>`
            }
          </div>

          <div class="row base meta-row">
            <span>${type === 'sales' ? 'العميل' : 'المورد'}: ${escapeHtml(customerOrSupplierName)}</span>
          </div>

          <div class="sep"></div>

          <div class="items">
            <div class="row header-row small">
              <span class="col-name">الصنف</span>
              <span class="col-qty">الكمية</span>
              <span class="col-price">السعر</span>
              <span class="col-total">الإجمالي</span>
            </div>

            ${itemsHtml}
          </div>

          <div class="sep"></div>

          <div class="totals">
            <div class="row base">
              <span>المجموع الفرعي:</span>
              <span>${escapeHtml(formatMoney(totalAmount))}</span>
            </div>

            ${
              type === 'sales' && discountAmount > 0
                ? `
                  <div class="row base" style="margin-top: 4px;">
                    <span>الخصم:</span>
                    <span>- ${escapeHtml(formatMoney(discountAmount))}</span>
                  </div>
                `
                : ''
            }

            <div class="row lg bold" style="margin-top: 6px;">
              <span>الإجمالي:</span>
              <span>${escapeHtml(formatMoney(grandTotalAmount))}</span>
            </div>

            ${
              paymentMethodValue !== 'credit'
                ? `
                  <div class="row base" style="margin-top: 4px;">
                    <span>المدفوع:</span>
                    <span>${escapeHtml(formatMoney(paidAmountValue))}</span>
                  </div>
                  <div class="row base" style="margin-top: 4px;">
                    <span>${remainingValue > 0 ? 'المتبقي:' : 'الباقي:'}</span>
                    <span>${escapeHtml(formatMoney(remainingValue > 0 ? remainingValue : changeValue))}</span>
                  </div>
                `
                : `
                  <div class="row base" style="margin-top: 4px;">
                    <span>المدفوع:</span>
                    <span>${escapeHtml(formatMoney(paidAmountValue))}</span>
                  </div>
                  <div class="row base" style="margin-top: 4px;">
                    <span>المتبقي:</span>
                    <span>${escapeHtml(formatMoney(remainingValue))}</span>
                  </div>
                `
            }

            ${
              showUsd
                ? `
                  <div class="row small muted" style="margin-top: 5px;">
                    <span>USD</span>
                    <span>${escapeHtml(formatMoney(grandTotalAmount, 'USD'))}</span>
                  </div>
                `
                : ''
            }
          </div>

          <div class="footer">
            <div class="invoice-no">#${escapeHtml(invoiceNumber)}</div>
            <div class="small muted">
              ${escapeHtml(settings?.receipt_footer || 'شكراً لزيارتكم، نرجو زيارتنا مرة أخرى!')}
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
};
const printInvoice = (invoiceData: any, type: InvoiceTab) => {
  const printContent = buildInvoicePrintHtml(invoiceData, type);

  const printWindow = window.open('', '_blank', 'width=900,height=700');

  if (!printWindow) {
    appAlert('تعذر فتح نافذة الطباعة');
    return;
  }

  printWindow.document.open();
  printWindow.document.write(printContent);
  printWindow.document.close();

  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();

      printWindow.onafterprint = () => {
        printWindow.close();
      };
    }, 300);
  };
};

 const filteredSales = sales.filter((sale) => {
  const searchLower = searchQuery.toLowerCase().trim();

  const paymentMethodLabel =
    sale.payment_method === 'cash'
      ? 'نقدي'
      : sale.payment_method === 'card'
      ? 'شام كاش'
      : sale.payment_method === 'credit'
      ? 'آجل'
      : '';

  return (
    sale.id.toString().includes(searchLower) ||
    (sale.customer_name && sale.customer_name.toLowerCase().includes(searchLower)) ||
    (sale.user_name && sale.user_name.toLowerCase().includes(searchLower)) ||
    paymentMethodLabel.toLowerCase().includes(searchLower) ||
    (sale.payment_method && sale.payment_method.toLowerCase().includes(searchLower))
  );
});

  const filteredPurchases = purchases.filter((purchase) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      purchase.id.toString().includes(searchLower) ||
      (purchase.supplier_name && purchase.supplier_name.toLowerCase().includes(searchLower)) ||
      (purchase.user_name && purchase.user_name.toLowerCase().includes(searchLower))
    );
  });

  const currentInvoices = activeTab === 'sales' ? filteredSales : filteredPurchases;
  const totalInvoicesCount = activeTab === 'sales' ? sales.length : purchases.length;
  const salesTabActive = activeTab === 'sales';

  

  const invoicesSource = activeTab === 'sales' ? sales : purchases;

  const reportTotalAmount = invoicesSource.reduce((sum: number, invoice: any) => {
    return sum + Number(invoice.total_amount || 0);
  }, 0);

  const reportTotalDiscount = activeTab === 'sales'
    ? sales.reduce((sum: number, invoice: any) => sum + Number(invoice.discount || 0), 0)
    : 0;

  const reportFinalTotal = activeTab === 'sales'
    ? reportTotalAmount - reportTotalDiscount
    : reportTotalAmount;

  const reportPaidTotal = invoicesSource.reduce((sum: number, invoice: any) => {
    return sum + Number(invoice.paid_amount || 0);
  }, 0);

  const reportRemainingTotal = reportFinalTotal - reportPaidTotal;

  const reportCashCount =
    activeTab === 'sales'
      ? sales.filter((invoice: any) => invoice.payment_method === 'cash').length
      : 0;

  const reportCardCount =
    activeTab === 'sales'
      ? sales.filter((invoice: any) => invoice.payment_method === 'card').length
      : 0;

  const reportCreditCount =
    activeTab === 'sales'
      ? sales.filter((invoice: any) => invoice.payment_method === 'credit').length
      : 0;

  const buildInvoicesReportHtml = () => {
        const money = (amount: number, currencyCode?: CurrencyCode) => {
      return formatMoney(Number(amount || 0), currencyCode);
    };
    const reportRows = invoicesSource
    
      .map((invoice: any) => {
        const finalTotal =
          activeTab === 'sales'
            ? Number(invoice.total_amount) - Number(invoice.discount || 0)
            : Number(invoice.total_amount);

        const remaining = finalTotal - Number(invoice.paid_amount || 0);

        return `
          <tr>
            <td>#${invoice.id}</td>
            <td>${formatPrintDate(invoice.created_at)}</td>
            <td>${
              activeTab === 'sales'
                ? invoice.customer_name || 'عميل نقدي'
                : invoice.supplier_name || '-'
            }</td>
            <td>${money(Number(invoice.total_amount))}</td>
            ${
              activeTab === 'sales'
                ? `<td>${money(Number(invoice.discount || 0))}</td>`
                : ''
            }
            ${
              activeTab === 'sales'
                ? `<td>${getPaymentMethodText(invoice.payment_method)}</td>`
                : ''
            }
            <td>${money(finalTotal)}</td>
            <td>${money(Number(invoice.paid_amount || 0))}</td>
            <td>${money(remaining)}</td>
            <td>${invoice.user_name || '-'}</td>
          </tr>
        `;
      })
      .join('');

    return `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8" />
          <title>${activeTab === 'sales' ? 'تقرير فواتير المبيعات' : 'تقرير فواتير الشراء'}</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 24px;
              font-family: Arial, sans-serif;
              background: #fff;
              color: #0f172a;
              direction: rtl;
            }
            .page {
              max-width: 1100px;
              margin: 0 auto;
            }
            .header {
              text-align: center;
              margin-bottom: 24px;
            }
            .header h1 {
              margin: 0 0 8px;
              font-size: 28px;
              font-weight: 800;
            }
            .header p {
              margin: 0;
              color: #64748b;
              font-size: 14px;
            }
            .shop-meta {
              margin-top: 10px;
              color: #475569;
              font-size: 13px;
              line-height: 1.8;
            }
            .stats {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 16px;
              margin: 28px 0;
            }
            .card {
              border: 1px solid #e2e8f0;
              border-radius: 16px;
              padding: 18px;
              text-align: center;
            }
            .card h3 {
              margin: 0 0 8px;
              font-size: 12px;
              color: #64748b;
              font-weight: 800;
            }
            .card div {
              font-size: 18px;
              font-weight: 800;
            }
            .section {
              border: 1px solid #e2e8f0;
              border-radius: 16px;
              padding: 18px;
              margin-bottom: 18px;
            }
            .section-title {
              font-size: 16px;
              font-weight: 800;
              margin-bottom: 14px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
            }
            th {
              background: #f8fafc;
              color: #475569;
              font-size: 12px;
              font-weight: 800;
              padding: 12px;
              border: 1px solid #e2e8f0;
              text-align: right;
            }
            td {
              padding: 12px;
              border: 1px solid #e2e8f0;
              font-size: 13px;
              text-align: right;
            }
            .footer-note {
              margin-top: 24px;
              text-align: center;
              color: #64748b;
              font-size: 12px;
              font-weight: 700;
            }
            @page {
              size: A4 landscape;
              margin: 12mm;
            }
            @media print {
              body { padding: 0; }
              .stats, .section, table, tr {
                break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="header">
              <h1>${activeTab === 'sales' ? 'تقرير فواتير المبيعات' : 'تقرير فواتير الشراء'}</h1>
              <p>تقرير شامل عن جميع الفواتير الحالية</p>
              <div class="shop-meta">
                <div>${settings?.shop_name || 'سوبر ماركت الخير'}</div>
                <div>${settings?.shop_address || 'دمشق، الميدان'}</div>
                ${settings?.shop_phone ? `<div>${settings.shop_phone}</div>` : ''}
                ${settings?.shop_tax_number ? `<div>الرقم الضريبي: ${settings.shop_tax_number}</div>` : ''}
              </div>
            </div>

            <div class="stats">
              <div class="card">
                <h3>عدد الفواتير</h3>
                <div>${totalInvoicesCount}</div>
              </div>
              <div class="card">
                <h3>إجمالي القيمة</h3>
                <div>${money(reportTotalAmount)}</div>
              </div>
              <div class="card">
                <h3>المدفوع</h3>
                <div>${money(reportPaidTotal)}</div>
              </div>
              <div class="card">
                <h3>المتبقي</h3>
                <div>${money(reportRemainingTotal)}</div>
              </div>
            </div>

            ${
              activeTab === 'sales'
                ? `
                  <div class="stats" style="grid-template-columns: repeat(4, 1fr);">
                    <div class="card">
                      <h3>إجمالي الخصومات</h3>
                      <div>${money(reportTotalDiscount)}</div>
                    </div>
                    <div class="card">
                      <h3>فواتير نقدي</h3>
                      <div>${reportCashCount}</div>
                    </div>
                    <div class="card">
                      <h3>فواتير شام كاش</h3>
                      <div>${reportCardCount}</div>
                    </div>
                    <div class="card">
                      <h3>فواتير آجل</h3>
                      <div>${reportCreditCount}</div>
                    </div>
                  </div>
                `
                : ''
            }

            <div class="section">
              <div class="section-title">تفاصيل الفواتير</div>
              <table>
                <thead>
                  <tr>
                    <th>رقم الفاتورة</th>
                    <th>التاريخ والوقت</th>
                    <th>${activeTab === 'sales' ? 'العميل' : 'المورد'}</th>
                    <th>الإجمالي</th>
                    ${activeTab === 'sales' ? '<th>الخصم</th>' : ''}
                    ${activeTab === 'sales' ? '<th>طريقة الدفع</th>' : ''}
                    <th>الصافي</th>
                    <th>المدفوع</th>
                    <th>المتبقي</th>
                    <th>${activeTab === 'sales' ? 'الكاشير' : 'المستخدم'}</th>
                  </tr>
                </thead>
                <tbody>
                  ${reportRows || `
                    <tr>
                      <td colspan="${activeTab === 'sales' ? 10 : 8}" style="text-align:center;color:#64748b;">
                        لا توجد بيانات
                      </td>
                    </tr>
                  `}
                </tbody>
              </table>
            </div>

            <div class="footer-note">
              تم إنشاء هذا التقرير من النظام
            </div>
          </div>
        </body>
      </html>
    `;
  };

const handlePrintInvoicesReport = () => {
  const printContent = buildInvoicesReportHtml();

  // إنشاء iframe مخفي
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.left = '-9999px';
  iframe.style.top = '0';
  iframe.setAttribute('aria-hidden', 'true');

  // تعيين معالج onload قبل إلحاق الـ iframe
  iframe.onload = () => {
    // تأخير بسيط لضمان اكتمال كل شيء
    setTimeout(() => {
      const iframeWindow = iframe.contentWindow;
      if (iframeWindow) {
        iframeWindow.focus();
        iframeWindow.print();

        // إزالة الـ iframe بعد الطباعة (مع تأخير كافٍ)
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 1000);
      }
    }, 300);
  };

  // إلحاق الـ iframe بالـ DOM
  document.body.appendChild(iframe);

  // كتابة المحتوى إلى الـ iframe
  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (iframeDoc) {
    iframeDoc.open();
    iframeDoc.write(printContent);
    iframeDoc.close();
  } else {
    // في حالة فشل الوصول إلى المستند
    document.body.removeChild(iframe);
    appAlert('تعذر فتح نافذة الطباعة');
  }
};
  return (
    <>
      <div dir="rtl">
        <div className="space-y-8 no-print">
          <div className="flex flex-col gap-6 no-print">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setActiveTab('sales')}
                  className="px-6 py-4 rounded-[1.5rem] font-black flex items-center gap-3 transition-all shadow-sm border"
                  style={{
                    background: salesTabActive ? 'var(--theme-primary)' : 'var(--card-bg, transparent)',
                    color: salesTabActive ? '#fff' : 'var(--text-color)',
                    borderColor: salesTabActive ? 'var(--theme-primary)' : 'var(--border-color)',
                    boxShadow: salesTabActive ? '0 18px 40px rgba(0,0,0,0.12)' : 'none'
                  }}
                >
                  <ShoppingCart size={18} strokeWidth={2.5} />
                  فواتير المبيعات
                </button>

                <button
                  onClick={() => setActiveTab('purchases')}
                  className="px-6 py-4 rounded-[1.5rem] font-black flex items-center gap-3 transition-all shadow-sm border"
                  style={{
                    background: !salesTabActive ? 'var(--theme-primary)' : 'var(--card-bg, transparent)',
                    color: !salesTabActive ? '#fff' : 'var(--text-color)',
                    borderColor: !salesTabActive ? 'var(--theme-primary)' : 'var(--border-color)',
                    boxShadow: !salesTabActive ? '0 18px 40px rgba(0,0,0,0.12)' : 'none'
                  }}
                >
                  <ShoppingBag size={18} strokeWidth={2.5} />
                  فواتير الشراء
                </button>
              </div>

              <button
                onClick={() => setShowInvoicesReportPreview(true)}
                disabled={loading || totalInvoicesCount === 0}
                className="text-white font-black px-6 py-4 rounded-[1.5rem] flex items-center gap-3 shadow-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'var(--theme-primary)' }}
              >
                <FileText size={18} strokeWidth={2.5} />
                عرض تقرير الفواتير
              </button>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4 flex-1">
                <div className="relative flex-1 max-w-xl group">
                  <Search
                    className="absolute right-5 top-1/2 -translate-y-1/2 app-text-muted transition-colors"
                    size={22}
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={
                      activeTab === 'sales'
                        ? 'ابحث برقم الفاتورة، العميل، , الكاشير او طريقة الدفع '
                        : 'ابحث برقم الفاتورة، المورد، أو المستخدم...'
                    }
                    className="w-full app-muted border rounded-[2rem] py-4 pr-14 pl-6 outline-none transition-all font-bold app-text shadow-sm"
                    style={{ borderColor: 'var(--border-color)' }}
                  />
                 
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div
                  className="app-card p-2 rounded-2xl border shadow-sm flex items-center gap-2"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{
                      background: 'var(--theme-primary-soft)',
                      color: 'var(--theme-primary)'
                    }}
                  >
                    <Receipt size={20} strokeWidth={2.5} />
                  </div>
                  <div className="pr-2 pl-4">
                    <div className="text-[10px] font-black app-text-muted uppercase tracking-widest">
                      إجمالي الفواتير
                    </div>
                    <div className="text-base font-black app-text leading-none">{totalInvoicesCount}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            className="app-card rounded-[2.5rem] border shadow-sm overflow-hidden no-print"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr
                    className="app-muted text-[10px] font-black uppercase tracking-[0.2em] border-b"
                    style={{ borderColor: 'var(--border-color)' }}
                  >
                    <th className="px-8 py-6 app-text-muted">رقم الفاتورة</th>
                    <th className="px-8 py-6 app-text-muted">التاريخ والوقت</th>
                    <th className="px-8 py-6 app-text-muted">{activeTab === 'sales' ? 'العميل' : 'المورد'}</th>
                    <th className="px-8 py-6 app-text-muted">الإجمالي</th>
                    {activeTab === 'sales' && <th className="px-8 py-6 app-text-muted">الخصم</th>}
                    {activeTab === 'sales' && <th className="px-8 py-6 app-text-muted">طريقة الدفع</th>}
                    <th className="px-8 py-6 app-text-muted">{activeTab === 'sales' ? 'الكاشير' : 'المستخدم'}</th>
                    <th className="px-8 py-6 text-center app-text-muted">الإجراءات</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={activeTab === 'sales' ? 8 : 6} className="px-8 py-20 text-center">
                        <div className="flex flex-col items-center gap-4 app-text-muted opacity-70">
                          <div
                            className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin"
                            style={{
                              borderColor: 'var(--theme-primary)',
                              borderTopColor: 'transparent'
                            }}
                          />
                          <p className="text-base font-black uppercase tracking-widest">جاري تحميل الفواتير...</p>
                        </div>
                      </td>
                    </tr>
                  ) : currentInvoices.length === 0 ? (
                    <tr>
                     <td colSpan={activeTab === 'sales' ? 8 : 6} className="px-8 py-20 text-center">
                        <div className="flex flex-col items-center gap-4 app-text-muted opacity-60">
                          <Receipt size={64} strokeWidth={1} />
                          <p className="text-base font-black uppercase tracking-widest">لا توجد فواتير مطابقة للبحث</p>
                        </div>
                      </td>
                    </tr>
                  ) : activeTab === 'sales' ? (
                    filteredSales.map((sale) => (
                      <tr
                        key={sale.id}
                        className="transition-all duration-300 group"
                        style={{ borderBottom: '1px solid var(--border-color)' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--theme-primary-soft)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div
                              className="w-12 h-12 app-card rounded-2xl flex items-center justify-center border shadow-sm transition-all"
                              style={{
                                borderColor: 'var(--border-color)',
                                color: 'var(--text-muted)'
                              }}
                            >
                              <Receipt size={22} strokeWidth={2.5} />
                            </div>
                            <div className="font-black app-text tracking-tight">#{sale.id}</div>
                          </div>
                        </td>

                        <td className="px-8 py-6">
                          <div className="flex flex-col">
  <span className="text-base font-black app-text">
    {formatAppDate(sale.created_at)}
  </span>
  <span className="text-[10px] font-bold app-text-muted uppercase tracking-widest">
    {formatAppTime(sale.created_at)}
  </span>
</div>
                        </td>

                        <td className="px-8 py-6">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-8 h-8 app-muted rounded-full flex items-center justify-center"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              <User size={14} />
                            </div>
                            <span className="text-base font-black app-text">
                              {sale.customer_name || 'عميل نقدي'}
                            </span>
                          </div>
                        </td>

                        <td className="px-8 py-6">
                          <div className="flex flex-col">
                            <span
                              className="text-base font-black tracking-tight"
                              style={{ color: 'var(--theme-primary)' }}
                            >
                              {formatMoney(Number(sale.total_amount))}
                            </span>
                            <span className="text-[10px] font-bold app-text-muted uppercase tracking-widest">
                              {showUsd ? formatMoney(Number(sale.total_amount), 'USD') : ''}
                            </span>
                          </div>
                        </td>

                        <td className="px-8 py-6">
                          {sale.discount > 0 ? (
                            <div className="flex flex-col">
                              <span className="text-base font-black text-rose-500">
                                -{formatMoney(Number(sale.discount))}
                              </span>
                              <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">
                                {showUsd ? formatMoney(Number(sale.discount), 'USD') : ''}
                              </span>
                            </div>
                          ) : (
                            <span className="app-text-muted opacity-60">—</span>
                          )}
                        </td>

                        <td className="px-8 py-6">
                          <span
                            className="inline-flex items-center px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border"
                            style={{
                              background: 'var(--theme-primary-soft)',
                              color: 'var(--theme-primary)',
                              borderColor: 'var(--theme-primary-soft-2)'
                            }}
                          >
                            {getPaymentMethodText(sale.payment_method)}
                          </span>
                        </td>

                        <td className="px-8 py-6">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-6 h-6 app-muted rounded-lg flex items-center justify-center"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              <User size={12} />
                            </div>
                            <span className="text-xs font-bold app-text-muted">
                              {sale.user_name || '-'}
                            </span>
                          </div>
                        </td>

                        <td className="px-8 py-6">
                          <div className="flex items-center justify-center gap-3">
                            <button
                              onClick={() => handleViewInvoice(sale.id)}
                              className="w-10 h-10 flex items-center justify-center rounded-xl transition-all shadow-sm border"
                              style={{
                                color: '#3b82f6',
                                borderColor: 'transparent',
                                background: 'transparent'
                              }}
                              title="عرض الفاتورة"
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(59,130,246,0.08)';
                                e.currentTarget.style.borderColor = 'rgba(59,130,246,0.15)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.borderColor = 'transparent';
                              }}
                            >
                              <Eye size={18} strokeWidth={2.5} />
                            </button>

                            <button
                              onClick={() => handlePrintInvoice(sale.id)}
                              className="w-10 h-10 flex items-center justify-center rounded-xl transition-all shadow-sm border"
                              style={{
                                color: 'var(--theme-primary)',
                                borderColor: 'transparent',
                                background: 'transparent'
                              }}
                              title="طباعة الفاتورة"
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'var(--theme-primary-soft)';
                                e.currentTarget.style.borderColor = 'var(--theme-primary-soft-2)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.borderColor = 'transparent';
                              }}
                            >
                              <Printer size={18} strokeWidth={2.5} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    filteredPurchases.map((purchase) => (
                      <tr
                        key={purchase.id}
                        className="transition-all duration-300 group"
                        style={{ borderBottom: '1px solid var(--border-color)' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--theme-primary-soft)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div
                              className="w-12 h-12 app-card rounded-2xl flex items-center justify-center border shadow-sm transition-all"
                              style={{
                                borderColor: 'var(--border-color)',
                                color: 'var(--text-muted)'
                              }}
                            >
                              <Receipt size={22} strokeWidth={2.5} />
                            </div>
                            <div className="font-black app-text tracking-tight">#{purchase.id}</div>
                          </div>
                        </td>

                        <td className="px-8 py-6">
                          <div className="flex flex-col">
  <span className="text-base font-black app-text">
    {formatAppDate(purchase.created_at)}
  </span>
  <span className="text-[10px] font-bold app-text-muted uppercase tracking-widest">
    {formatAppTime(purchase.created_at)}
  </span>
</div>
                        </td>

                        <td className="px-8 py-6">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-8 h-8 app-muted rounded-full flex items-center justify-center"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              <Truck size={14} />
                            </div>
                            <span className="text-base font-black app-text">
                              {purchase.supplier_name || '-'}
                            </span>
                          </div>
                        </td>

                        <td className="px-8 py-6">
                          <div className="flex flex-col">
                            <span
                              className="text-base font-black tracking-tight"
                              style={{ color: 'var(--theme-primary)' }}
                            >
                              {formatMoney(Number(purchase.total_amount))}
                            </span>
                            <span className="text-[10px] font-bold app-text-muted uppercase tracking-widest">
                              {showUsd ? formatMoney(Number(purchase.total_amount), 'USD') : ''}
                            </span>
                          </div>
                        </td>

                        <td className="px-8 py-6">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-6 h-6 app-muted rounded-lg flex items-center justify-center"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              <User size={12} />
                            </div>
                            <span className="text-xs font-bold app-text-muted">
                              {purchase.user_name || '-'}
                            </span>
                          </div>
                        </td>

                        <td className="px-8 py-6">
                          <div className="flex items-center justify-center gap-3">
                            <button
                              onClick={() => handleViewInvoice(purchase.id)}
                              className="w-10 h-10 flex items-center justify-center rounded-xl transition-all shadow-sm border"
                              style={{
                                color: '#3b82f6',
                                borderColor: 'transparent',
                                background: 'transparent'
                              }}
                              title="عرض الفاتورة"
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(59,130,246,0.08)';
                                e.currentTarget.style.borderColor = 'rgba(59,130,246,0.15)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.borderColor = 'transparent';
                              }}
                            >
                              <Eye size={18} strokeWidth={2.5} />
                            </button>

                            <button
                              onClick={() => handlePrintInvoice(purchase.id)}
                              className="w-10 h-10 flex items-center justify-center rounded-xl transition-all shadow-sm border"
                              style={{
                                color: 'var(--theme-primary)',
                                borderColor: 'transparent',
                                background: 'transparent'
                              }}
                              title="طباعة الفاتورة"
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'var(--theme-primary-soft)';
                                e.currentTarget.style.borderColor = 'var(--theme-primary-soft-2)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.borderColor = 'transparent';
                              }}
                            >
                              <Printer size={18} strokeWidth={2.5} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div
              className="px-8 py-6 border-t flex items-center justify-between app-muted"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: 'var(--theme-primary)' }}
                />
                <span className="text-[10px] font-black app-text-muted uppercase tracking-widest">
                  عرض {currentInvoices.length} من {totalInvoicesCount} فواتير
                </span>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {showInvoiceModal && selectedInvoice && (
              <div
                className="fixed inset-0 z-[100] flex items-center justify-center p-4 no-print"
                style={{
                  background: 'rgba(15,23,42,0.55)',
                  backdropFilter: 'blur(10px)'
                }}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  className="app-card w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <div
                    className="p-6 border-b flex justify-between items-center app-muted"
                    style={{ borderColor: 'var(--border-color)' }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{
                          background: 'var(--theme-primary-soft)',
                          color: 'var(--theme-primary)'
                        }}
                      >
                        <Receipt size={20} strokeWidth={2.5} />
                      </div>
                      <div>
                        <h3 className="font-black app-text leading-none">
                          {activeTab === 'sales' ? 'تفاصيل فاتورة البيع' : 'تفاصيل فاتورة الشراء'}
                        </h3>
                        <span className="text-[10px] font-black app-text-muted uppercase tracking-widest">
                          #{selectedInvoice.id}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => setShowInvoiceModal(false)}
                      className="w-10 h-10 flex items-center justify-center rounded-full transition-all"
                      style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--theme-primary-soft)';
                        e.currentTarget.style.color = 'var(--theme-primary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'var(--text-muted)';
                      }}
                    >
                      <X size={20} strokeWidth={2.5} />
                    </button>
                  </div>

                  <div className="p-8 app-card app-text font-mono text-base max-h-[60vh] overflow-y-auto custom-scrollbar">
                    <div className="text-center mb-8 space-y-2">
                      <h2 className="text-3xl font-black app-text mb-1">
                        {settings?.shop_name || 'سوبر ماركت الخير'}
                      </h2>

                      <p className="text-[10px] font-bold app-text-muted uppercase tracking-widest">
                        {settings?.shop_address || 'دمشق، الميدان'}
                      </p>

                      {settings?.shop_tax_number && (
                        <p className="text-[10px] font-bold app-text-muted uppercase tracking-widest">
                          الرقم الضريبي: {settings.shop_tax_number}
                        </p>
                      )}

                      <div
                        className="border-t border-dashed my-6"
                        style={{ borderColor: 'var(--border-color)' }}
                      />

                      <div className="grid grid-cols-2 gap-y-2 text-[10px] font-bold app-text-muted uppercase tracking-widest text-right">
                        <div className="text-right">رقم الفاتورة:</div>
                        <div className="text-left app-text">#{selectedInvoice.id}</div>

                        <div className="text-right">التاريخ:</div>
                        <div className="text-left app-text">
  {formatAppDate(selectedInvoice.created_at)}
</div>

                        <div className="text-right">الوقت:</div>
                        <div className="text-left app-text">
  {formatAppTime(selectedInvoice.created_at)}
</div>

                        <div className="text-right">{activeTab === 'sales' ? 'الكاشير:' : 'المستخدم:'}</div>
                        <div className="text-left app-text">{selectedInvoice.user_name || '-'}</div>

                        <div className="text-right">{activeTab === 'sales' ? 'العميل:' : 'المورد:'}</div>
                        <div className="text-left app-text">
                          {activeTab === 'sales'
                            ? (selectedInvoice.customer_name || 'عميل نقدي')
                            : (selectedInvoice.supplier_name || '-')}
                        </div>

                        {activeTab === 'sales' && (
                          <>
                            <div className="text-right">طريقة الدفع:</div>
                            <div className="text-left">
                              <span
                                className="px-2 py-0.5 rounded text-[10px] font-black border"
                                style={{
                                  background: 'var(--theme-primary-soft)',
                                  color: 'var(--theme-primary)',
                                  borderColor: 'var(--theme-primary-soft-2)'
                                }}
                              >
                                {getPaymentMethodText(selectedInvoice.payment_method)}
                              </span>
                            </div>
                          </>
                        )}
                      </div>

                      <div
                        className="border-t border-dashed my-6"
                        style={{ borderColor: 'var(--border-color)' }}
                      />
                    </div>

                    <div className="space-y-4 mb-8">
                      <div
                        className="flex justify-between text-[10px] font-black app-text-muted uppercase tracking-widest border-b pb-3"
                        style={{ borderColor: 'var(--border-color)' }}
                      >
                        <span className="w-24">الصنف</span>
                        <span className="w-10 text-center">الكمية</span>
                        <span className="w-16 text-center">السعر</span>
                        <span className="w-20 text-left">الإجمالي</span>
                      </div>

                      {selectedInvoice.items &&
                        selectedInvoice.items.map((item: any, i: number) => (
                          <div
                            key={i}
                            className="flex justify-between text-[11px] py-1 border-b last:border-none"
                            style={{ borderColor: 'var(--border-color)' }}
                          >
                            <span className="w-24 truncate font-bold app-text">
                              {item.product_name || 'منتج غير معروف'}
                            </span>

                            <span className="w-10 text-center font-black app-text">{item.quantity}</span>

                            <span className="w-16 text-center">
                              <div className="font-black app-text">{formatMoney(Number(item.unit_price))}</div>
{showUsd && (
  <div className="text-[8px] font-bold app-text-muted">
    {formatMoney(Number(item.unit_price), 'USD')}
  </div>
)}
                            </span>

                            <span className="w-20 text-left">
                              <div
                                className="font-black"
                                style={{ color: 'var(--theme-primary)' }}
                              >
                                {formatMoney(Number(item.total_price))}
                              </div>
                              <div className="text-[8px] font-bold app-text-muted">
                                {showUsd && formatMoney(Number(item.total_price), 'USD')}
                              </div>
                            </span>
                          </div>
                        ))}
                    </div>

                    <div
                      className="border-t border-dashed pt-6 space-y-3"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      <div className="flex justify-between text-base font-bold app-text-muted">
                        <span>المجموع الفرعي:</span>
                        <div className="text-left">
                          <div className="app-text">{formatMoney(Number(selectedInvoice.total_amount))}</div>
{showUsd && (
  <div className="text-[10px] font-bold app-text-muted uppercase tracking-widest">
    {formatMoney(Number(selectedInvoice.total_amount), 'USD')}
  </div>
)}
                        </div>
                      </div>

                      {activeTab === 'sales' && Number(selectedInvoice.discount || 0) > 0 && (
                        <div className="flex justify-between text-base font-bold text-rose-500">
                          <span>الخصم:</span>
                          <span>-{formatMoney(Number(selectedInvoice.discount))}</span>
                        </div>
                      )}

                      <div
                        className="flex justify-between text-xl font-black mt-4 border-t pt-4"
                        style={{ borderColor: 'var(--border-color)' }}
                      >
                        <span className="app-text">الإجمالي:</span>
                        <div className="text-left">
                          <div style={{ color: 'var(--theme-primary)' }}>
  {formatMoney(
    activeTab === 'sales'
      ? Number(selectedInvoice.total_amount) - Number(selectedInvoice.discount || 0)
      : Number(selectedInvoice.total_amount)
  )}
</div>
                          <div
                            className="text-xs font-black uppercase tracking-widest"
                            style={{ color: 'var(--theme-primary)' }}
                          >
                           {showUsd &&
  formatMoney(
    activeTab === 'sales'
      ? Number(selectedInvoice.total_amount) - Number(selectedInvoice.discount || 0)
      : Number(selectedInvoice.total_amount),
    'USD'
  )}
                          </div>
                        </div>
                      </div>

                      <div
  className="p-4 rounded-2xl mt-6 space-y-2 border"
  style={{
    background: 'var(--theme-primary-soft)',
    borderColor: 'var(--theme-primary-soft-2)'
  }}
>
  <div className="flex justify-between text-lx font-bold app-text-muted">
    <span>المدفوع:</span>
    <div className="text-left">
      <div className="app-text">{formatMoney(Number(selectedInvoice.paid_amount || 0))}</div>
      {showUsd && (
        <div className="text-[10px] app-text-muted">
          {formatMoney(Number(selectedInvoice.paid_amount || 0), 'USD')}
        </div>
      )}
    </div>
  </div>

  <div className="flex justify-between text-xs font-bold app-text-muted">
    <span>المتبقي:</span>
    <div className="text-left">
      <div className={activeTab === 'sales' ? 'text-emerald-600' : 'text-rose-600'}>
        {formatMoney(
          activeTab === 'sales'
            ? (Number(selectedInvoice.total_amount) - Number(selectedInvoice.discount || 0)) -
                Number(selectedInvoice.paid_amount || 0)
            : Number(selectedInvoice.total_amount) - Number(selectedInvoice.paid_amount || 0)
        )}
      </div>

      <div className="text-[10px] app-text-muted">
        {showUsd &&
          formatMoney(
            activeTab === 'sales'
              ? (Number(selectedInvoice.total_amount) - Number(selectedInvoice.discount || 0)) -
                  Number(selectedInvoice.paid_amount || 0)
              : Number(selectedInvoice.total_amount) - Number(selectedInvoice.paid_amount || 0),
            'USD'
          )}
      </div>
    </div>
  </div>
</div>
</div>
                    {activeTab === 'sales' && (
                      <div className="text-center mt-10 space-y-4">
                        <div className="flex justify-center opacity-80 grayscale hover:grayscale-0 transition-all">
                          <Barcode
                            value={selectedInvoice.id.toString()}
                            width={1.2}
                            height={50}
                            fontSize={12}
                            background="transparent"
                          />
                        </div>
                      </div>
                    )}

                    <div className="text-center mt-6">
                      <p className="text-[10px] font-black app-text-muted uppercase tracking-[0.2em] leading-relaxed">
                        {settings?.receipt_footer || 'شكراً لزيارتكم، نرجو زيارتنا مرة أخرى!'}
                      </p>
                    </div>
                  </div>

                  <div
                    className="p-6 app-muted flex gap-4 border-t"
                    style={{ borderColor: 'var(--border-color)' }}
                  >
                    <button
                      onClick={() => printInvoice(selectedInvoice, activeTab)}
                      className="flex-1 text-white font-black py-4 rounded-[1.5rem] flex items-center justify-center gap-3 transition-all shadow-lg active:scale-95"
                      style={{ background: 'var(--theme-primary)' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--theme-primary-hover)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--theme-primary)';
                      }}
                    >
                      <Printer size={20} strokeWidth={2.5} />
                      طباعة
                    </button>

                    <button
                      onClick={() => setShowInvoiceModal(false)}
                      className="flex-1 app-card border app-text font-black py-4 rounded-[1.5rem] transition-all active:scale-95"
                      style={{ borderColor: 'var(--border-color)' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--theme-primary-soft)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '';
                      }}
                    >
                      إغلاق
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
          
       
      </div>

      <AnimatePresence>
        {showInvoicesReportPreview && (
          <div
            className="fixed inset-0 z-[130] bg-black/60 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 20 }}
              className="w-full max-w-7xl h-[92vh] bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col"
              dir="rtl"
            >
              <div className="flex items-center justify-between px-6 py-5 border-b">
                <div>
                  <h2 className="text-xl font-black text-slate-800">
                    {activeTab === 'sales' ? 'معاينة تقرير فواتير المبيعات' : 'معاينة تقرير فواتير الشراء'}
                  </h2>
                  <p className="text-xl text-slate-500 mt-1">
                    تقرير شامل بجميع الفواتير الحالية
                  </p>
                </div>

                <button
                  onClick={() => setShowInvoicesReportPreview(false)}
                  className="w-11 h-11 rounded-xl border flex items-center justify-center text-slate-600 hover:bg-slate-50 transition"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-auto bg-slate-100 p-6">
                <div className="max-w-6xl mx-auto bg-white shadow-xl rounded-2xl p-8">
                  <div className="text-center mb-8">
                    <h1 className="text-3xl font-black text-slate-800 mb-2">
                      {activeTab === 'sales' ? 'تقرير فواتير المبيعات' : 'تقرير فواتير الشراء'}
                    </h1>
                    <p className="text-xl text-slate-500">تقرير شامل عن جميع الفواتير الحالية</p>
                    <p className="text-base font-black text-slate-700 mt-3">
                      {settings?.shop_name || 'سوبر ماركت الخير'}
                    </p>
                    <p className="text-xl text-slate-500 mt-1">
                      {settings?.shop_address || 'دمشق، الميدان'}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <div className="border rounded-2xl p-5 text-center">
                      <h3 className="text-xs font-black text-slate-500 mb-2">عدد الفواتير</h3>
                      <div className="text-3xl font-black text-slate-800">{totalInvoicesCount}</div>
                    </div>

                    <div className="border rounded-2xl p-5 text-center">
                      <h3 className="text-3xl font-black text-slate-500 mb-2">إجمالي القيمة</h3>
                      <div className="text-3xl font-black text-emerald-600">
                        {formatMoney(reportTotalAmount)}
                      </div>
                    </div>

                    <div className="border rounded-2xl p-5 text-center">
                      <h3 className="text-xs font-black text-slate-500 mb-2">المدفوع</h3>
                      <div className="text-3xl font-black text-slate-800">
                        {formatMoney(reportPaidTotal)}
                      </div>
                    </div>

                    <div className="border rounded-2xl p-5 text-center">
                      <h3 className="text-xl font-black text-slate-500 mb-2">المتبقي</h3>
                      <div className="text-3xl font-black text-rose-600">
                        {formatMoney(reportRemainingTotal)}
                      </div>
                    </div>
                  </div>

                  {activeTab === 'sales' && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                      <div className="border rounded-2xl p-5 text-center">
                        <h3 className="text-xs font-black text-slate-500 mb-2">إجمالي الخصومات</h3>
                        <div className="text-3xl font-black text-rose-600">
                          {formatMoney(reportTotalDiscount)}
                        </div>
                      </div>

                      <div className="border rounded-2xl p-5 text-center">
                        <h3 className="text-xs font-black text-slate-500 mb-2">فواتير نقدي</h3>
                        <div className="text-3xl font-black text-slate-800">{reportCashCount}</div>
                      </div>

                      <div className="border rounded-2xl p-5 text-center">
                        <h3 className="text-xs font-black text-slate-500 mb-2">فواتير شام كاش</h3>
                        <div className="text-3xl font-black text-slate-800">{reportCardCount}</div>
                      </div>

                      <div className="border rounded-2xl p-5 text-center">
                        <h3 className="text-xs font-black text-slate-500 mb-2">فواتير آجل</h3>
                        <div className="text-3xl font-black text-slate-800">{reportCreditCount}</div>
                      </div>
                    </div>
                  )}

                  <div className="overflow-hidden rounded-2xl border">
                    <table className="w-full text-right border-collapse">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-4 text-xs font-black text-slate-500">رقم الفاتورة</th>
                          <th className="px-4 py-4 text-xs font-black text-slate-500">التاريخ والوقت</th>
                          <th className="px-4 py-4 text-xs font-black text-slate-500">
                            {activeTab === 'sales' ? 'العميل' : 'المورد'}
                          </th>
                          <th className="px-4 py-4 text-xs font-black text-slate-500">الإجمالي</th>
                          {activeTab === 'sales' && (
                            <th className="px-4 py-4 text-xs font-black text-slate-500">الخصم</th>
                          )}
                          {activeTab === 'sales' && (
                            <th className="px-4 py-4 text-xs font-black text-slate-500">طريقة الدفع</th>
                          )}
                          <th className="px-4 py-4 text-xs font-black text-slate-500">الصافي</th>
                          <th className="px-4 py-4 text-xs font-black text-slate-500">المدفوع</th>
                          <th className="px-4 py-4 text-xs font-black text-slate-500">المتبقي</th>
                          <th className="px-4 py-4 text-xs font-black text-slate-500">
                            {activeTab === 'sales' ? 'الكاشير' : 'المستخدم'}
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {invoicesSource.length > 0 ? (
                          invoicesSource.map((invoice: any, i: number) => {
                            const finalTotal =
                              activeTab === 'sales'
                                ? Number(invoice.total_amount) - Number(invoice.discount || 0)
                                : Number(invoice.total_amount);

                            const remaining = finalTotal - Number(invoice.paid_amount || 0);

                            return (
                              <tr key={i} className="border-t">
                                <td className="px-4 py-4 font-bold text-slate-700">#{invoice.id}</td>
                                <td className="px-4 py-4 text-slate-700">{formatPrintDate(invoice.created_at)}</td>
                                <td className="px-4 py-4 text-slate-700 font-bold">
                                  {activeTab === 'sales'
                                    ? invoice.customer_name || 'عميل نقدي'
                                    : invoice.supplier_name || '-'}
                                </td>
                                <td className="px-4 py-4 text-slate-700">
                                  {formatMoney(Number(invoice.total_amount))}
                                </td>
                                {activeTab === 'sales' && (
                                  <td className="px-4 py-4 text-rose-600 font-bold">
                                    {formatMoney(Number(invoice.discount || 0))}
                                  </td>
                                )}
                                {activeTab === 'sales' && (
                                  <td className="px-4 py-4 text-slate-700">
                                    {getPaymentMethodText(invoice.payment_method)}
                                  </td>
                                )}
                                <td className="px-4 py-4 font-black text-emerald-600">
                                  {formatMoney(finalTotal)}
                                </td>
                                <td className="px-4 py-4 text-slate-700">
                                 {formatMoney(Number(invoice.paid_amount || 0))}
                                </td>
                                <td className="px-4 py-4 font-bold text-rose-600">
                                  {formatMoney(remaining)}
                                </td>
                                <td className="px-4 py-4 text-slate-700">{invoice.user_name || '-'}</td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td
                              colSpan={activeTab === 'sales' ? 10 : 8}
                              className="px-4 py-10 text-center text-slate-400 font-bold"
                            >
                              لا توجد بيانات
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="border-t px-6 py-4 flex items-center justify-between gap-3 bg-white" dir="rtl">
                <div className="text-base text-slate-500">
                  راجع التقرير ثم اضغط طباعة إذا كانت البيانات صحيحة
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowInvoicesReportPreview(false)}
                    className="px-5 py-3 rounded-xl border font-bold text-slate-700 hover:bg-slate-50 transition"
                  >
                    إغلاق
                  </button>

                  <button
                    onClick={handlePrintInvoicesReport}
                    className="px-5 py-3 rounded-xl text-white font-bold flex items-center gap-2 transition"
                    style={{ background: 'var(--theme-primary)' }}
                  >
                    <Printer size={18} />
                    طباعة التقرير
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Invoices;
