import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Calendar,
  Download,
  TrendingUp,
  Package,
  FileText,
  Printer,
  X
} from 'lucide-react';
import { motion } from 'motion/react';
import * as XLSX from 'xlsx';
import { appAlert } from '../utils/appAlert';

type SalesDay = {
  date: string;
  count: number;
  total: number;
};

const Reports: React.FC = () => {


  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const [salesReport, setSalesReport] = useState<SalesDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
    const [settings, setSettings] = useState<any>(null);

   useEffect(() => {
    fetchReport();
  }, [dateRange]);

  useEffect(() => {
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
  const fetchReport = async () => {
    try {
      setLoading(true);

      const res = await fetch(
        `/api/reports/sales?start=${encodeURIComponent(dateRange.start)}&end=${encodeURIComponent(dateRange.end)}`
      );

      if (!res.ok) {
        throw new Error('فشل في تحميل التقرير');
      }

      const data = await res.json();

      if (Array.isArray(data)) {
        setSalesReport(data);
      } else {
        setSalesReport([]);
      }
    } catch (error) {
      console.error(error);
      setSalesReport([]);
    } finally {
      setLoading(false);
    }
  };

  const totalSales = salesReport.reduce((sum, day) => sum + Number(day.total || 0), 0);
  const totalOrders = salesReport.reduce((sum, day) => sum + Number(day.count || 0), 0);
  const estimatedProfit = totalSales * 0.11;
  const avgInvoice = totalSales / (totalOrders || 1);
  const maxTotal = Math.max(...salesReport.map((d) => Number(d.total || 0)), 1);
  
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

const getCurrencySymbol = (currencyCode?: CurrencyCode) => {
  switch (currencyCode || getCurrencyCode()) {
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
  const handleExportExcel = () => {
    try {
      if (!salesReport.length) {
        appAlert('لا توجد بيانات لتصديرها ضمن الفترة المحددة');
        return;
      }

      setExporting(true);

     const detailsData = salesReport.map((day, index) => ({
  '#': index + 1,
  'التاريخ': day.date,
  'عدد العمليات': day.count,
  [`الإجمالي (${getCurrencySymbol()})`]: formatMoneyRaw(Number(day.total || 0)),
  ...(showUsd
    ? { 'الإجمالي ($)': formatMoneyRaw(Number(day.total || 0), 'USD') }
    : {})
}));

      const summaryData = [
  { 'البند': 'من تاريخ', 'القيمة': dateRange.start },
  { 'البند': 'إلى تاريخ', 'القيمة': dateRange.end },
  { 'البند': `إجمالي المبيعات (${getCurrencySymbol()})`, 'القيمة': formatMoneyRaw(totalSales) },
  ...(showUsd
    ? [{ 'البند': 'إجمالي المبيعات ($)', 'القيمة': formatMoneyRaw(totalSales, 'USD') }]
    : []),
  { 'البند': 'عدد الفواتير', 'القيمة': totalOrders },
  { 'البند': `متوسط الفاتورة (${getCurrencySymbol()})`, 'القيمة': formatMoneyRaw(avgInvoice) },
  { 'البند': `صافي الأرباح التقديري (${getCurrencySymbol()})`, 'القيمة': formatMoneyRaw(estimatedProfit) },
  ...(showUsd
    ? [{ 'البند': 'صافي الأرباح التقديري ($)', 'القيمة': formatMoneyRaw(estimatedProfit, 'USD') }]
    : []),
  { 'البند': 'هامش الربح المعتمد', 'القيمة': '11%' }
];

      const workbook = XLSX.utils.book_new();

      const summarySheet = XLSX.utils.json_to_sheet(summaryData);
      const detailsSheet = XLSX.utils.json_to_sheet(detailsData);

      summarySheet['!cols'] = [
        { wch: 28 },
        { wch: 22 }
      ];

      detailsSheet['!cols'] = [
        { wch: 8 },
        { wch: 16 },
        { wch: 18 },
        { wch: 20 },
        { wch: 16 }
      ];

      XLSX.utils.book_append_sheet(workbook, summarySheet, 'الملخص');
      XLSX.utils.book_append_sheet(workbook, detailsSheet, 'المبيعات اليومية');

      const fileName = `sales-report-${dateRange.start}-to-${dateRange.end}.xlsx`;
      XLSX.writeFile(workbook, fileName);
    } catch (error) {
      console.error(error);
      appAlert('حدث خطأ أثناء تصدير ملف Excel');
    } finally {
      setExporting(false);
    }
  };

  const buildPrintHtml = () => {
    return `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8" />
          <title>تقرير المبيعات</title>
          <style>
            * {
              box-sizing: border-box;
            }

            body {
              font-family: Arial, sans-serif;
              padding: 30px;
              color: #1e293b;
              direction: rtl;
              background: #ffffff;
              margin: 0;
            }

            .wrapper {
              max-width: 1000px;
              margin: 0 auto;
            }

            .header {
              text-align: center;
              margin-bottom: 30px;
            }

            .header h1 {
              font-size: 28px;
              margin: 0 0 8px;
              font-weight: 700;
            }

            .header p {
              color: #64748b;
              font-size: 14px;
              margin: 0;
            }

            .stats {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 16px;
              margin-bottom: 30px;
            }

            .card {
              padding: 16px;
              border: 1px solid #dbe2ea;
              border-radius: 12px;
              text-align: center;
              background: #fff;
            }

            .card h3 {
              font-size: 12px;
              color: #64748b;
              margin: 0 0 8px;
              font-weight: 700;
            }

            .card div {
              font-size: 18px;
              font-weight: 700;
            }

            table {
              border-collapse: collapse;
              width: 100%;
              margin-top: 20px;
            }

            th {
              background: #f8fafc;
              text-align: right;
              padding: 12px;
              font-size: 12px;
              color: #475569;
              border: 1px solid #dbe2ea;
            }

            td {
              padding: 12px;
              border: 1px solid #e2e8f0;
              font-size: 14px;
            }

            .total {
              color: #059669;
              font-weight: 700;
            }

            @page {
              size: A4;
              margin: 14mm;
            }

            @media print {
              body {
                padding: 0;
              }

              .stats {
                break-inside: avoid;
              }

              tr {
                break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          <div class="wrapper">
            <div class="header">
              <h1>تقرير مبيعات الفترة</h1>
              <p>من ${dateRange.start} إلى ${dateRange.end}</p>
            </div>

            <div class="stats">
              <div class="card">
                <h3>إجمالي المبيعات</h3>
                <div>${formatMoney(totalSales)}</div>
              </div>
              <div class="card">
                <h3>عدد الفواتير</h3>
                <div>${totalOrders} فاتورة</div>
              </div>
              <div class="card">
                <h3>صافي الأرباح (تقديري)</h3>
                <div>${formatMoney(estimatedProfit)}</div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>عدد العمليات</th>
                  <th>الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                ${salesReport
                  .map(
                    (day) => `
                      <tr>
                        <td>${day.date}</td>
                        <td>${day.count} عملية</td>
                        <td class="total">${formatMoney(Number(day.total || 0))}</td>
                      </tr>
                    `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </body>
      </html>
    `;
  };

  const handleOpenPreview = () => {
    if (!salesReport.length) {
      appAlert('لا توجد بيانات للعرض');
      return;
    }

    setShowPrintPreview(true);
  };

  const handlePrintFromPreview = () => {
    const printContent = buildPrintHtml();

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.left = '-9999px';
    iframe.style.top = '0';
    iframe.setAttribute('aria-hidden', 'true');

    document.body.appendChild(iframe);

    const iframeWindow = iframe.contentWindow;
    const iframeDoc = iframeWindow?.document;

    if (!iframeWindow || !iframeDoc) {
      document.body.removeChild(iframe);
      appAlert('تعذر فتح نافذة الطباعة');
      return;
    }

    iframeDoc.open();
    iframeDoc.write(printContent);
    iframeDoc.close();

    const runPrint = () => {
      iframeWindow.focus();
      iframeWindow.print();

      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1000);
    };

    if (iframe.contentDocument?.readyState === 'complete') {
      setTimeout(runPrint, 300);
    } else {
      iframe.onload = () => {
        setTimeout(runPrint, 300);
      };
    }
  };

  return (
    <>
      <div className="space-y-10" dir="rtl">
        <div
          className="app-card p-8 rounded-[2.5rem] border shadow-sm flex flex-col md:flex-row items-center justify-between gap-8"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="flex flex-col sm:flex-row items-center gap-6 flex-1 w-full">
            <div className="flex-1 w-full space-y-3">
              <label className="text-[10px] font-black app-text-muted uppercase tracking-widest mr-2">
                من تاريخ
              </label>
              <div className="relative group">
                <Calendar
                  className="absolute right-5 top-1/2 -translate-y-1/2 app-text-muted transition-colors"
                  size={22}
                />
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className="w-full app-muted border rounded-[1.5rem] py-4 pr-14 pl-6 outline-none transition-all font-bold app-text"
                  style={{ borderColor: 'var(--border-color)' }}
                />
              </div>
            </div>

            <div className="flex-1 w-full space-y-3">
              <label className="text-[10px] font-black app-text-muted uppercase tracking-widest mr-2">
                إلى تاريخ
              </label>
              <div className="relative group">
                <Calendar
                  className="absolute right-5 top-1/2 -translate-y-1/2 app-text-muted transition-colors"
                  size={22}
                />
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  className="w-full app-muted border rounded-[1.5rem] py-4 pr-14 pl-6 outline-none transition-all font-bold app-text"
                  style={{ borderColor: 'var(--border-color)' }}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-4 w-full md:w-auto pt-6 md:pt-0">
            <button
              onClick={handleExportExcel}
              disabled={loading || exporting || salesReport.length === 0}
              className="flex-1 md:flex-none app-card border app-text font-black py-4 px-8 rounded-[1.5rem] flex items-center justify-center gap-3 transition-all active:scale-95 group disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <Download
                size={20}
                strokeWidth={2.5}
                className="group-hover:scale-110 transition-transform"
              />
              {exporting ? 'جاري التصدير...' : 'تصدير Excel'}
            </button>

            <button
              onClick={handleOpenPreview}
              disabled={loading || salesReport.length === 0}
              className="flex-1 md:flex-none text-white font-black py-4 px-10 rounded-[1.5rem] shadow-xl flex items-center justify-center gap-3 transition-all active:scale-95 group disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'var(--theme-primary)' }}
            >
              <Printer size={20} strokeWidth={2.5} className="group-hover:scale-110 transition-transform" />
              عرض التقرير
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="app-card p-10 rounded-[2.5rem] border shadow-sm hover:shadow-2xl transition-all duration-500 group relative overflow-hidden"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <div
              className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-16 -mt-16 opacity-60 group-hover:opacity-100 transition-opacity"
              style={{ background: 'var(--theme-primary-soft)' }}
            />
            <div className="relative z-10">
              <div
                className="w-16 h-16 rounded-[1.5rem] flex items-center justify-center mb-8 shadow-lg group-hover:scale-110 transition-transform duration-500"
                style={{ background: 'var(--theme-primary-soft)', color: 'var(--theme-primary)' }}
              >
                <TrendingUp size={32} strokeWidth={2.5} />
              </div>
              <h3 className="text-[10px] font-black app-text-muted uppercase tracking-[0.2em] mb-2">
                إجمالي المبيعات
              </h3>
             <div className="text-4xl font-black app-text tracking-tighter mb-1">
  {formatMoney(totalSales)}
</div>
{showUsd && (
  <div className="text-xs font-black app-text-muted tracking-widest uppercase">
    {formatMoney(totalSales, 'USD')}
  </div>
)}
              <div
                className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border"
                style={{
                  background: 'var(--theme-primary-soft)',
                  color: 'var(--theme-primary)',
                  borderColor: 'var(--theme-primary-soft-2)'
                }}
              >
                خلال الفترة المحددة
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="app-card p-10 rounded-[2.5rem] border shadow-sm hover:shadow-2xl transition-all duration-500 group relative overflow-hidden"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl -mr-16 -mt-16 opacity-60 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-[1.5rem] flex items-center justify-center mb-8 shadow-lg shadow-blue-500/10 group-hover:scale-110 transition-transform duration-500">
                <FileText size={32} strokeWidth={2.5} />
              </div>
              <h3 className="text-[10px] font-black app-text-muted uppercase tracking-[0.2em] mb-2">
                عدد الفواتير
              </h3>
              <div className="text-4xl font-black app-text tracking-tighter mb-1">
                {totalOrders} <span className="text-base">فاتورة</span>
              </div>
              <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-blue-100">
               متوسط {formatMoney(avgInvoice)} للفاتورة
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="app-card p-10 rounded-[2.5rem] border shadow-sm hover:shadow-2xl transition-all duration-500 group relative overflow-hidden"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-full blur-3xl -mr-16 -mt-16 opacity-60 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10">
              <div className="w-16 h-16 bg-orange-50 text-orange-600 rounded-[1.5rem] flex items-center justify-center mb-8 shadow-lg shadow-orange-500/10 group-hover:scale-110 transition-transform duration-500">
                <Package size={32} strokeWidth={2.5} />
              </div>
              <h3 className="text-[10px] font-black app-text-muted uppercase tracking-[0.2em] mb-2">
                صافي الأرباح (تقديري)
              </h3>
             <div className="text-4xl font-black app-text tracking-tighter mb-1">
  {formatMoney(estimatedProfit)}
</div>
{showUsd && (
  <div className="text-xs font-black app-text-muted tracking-widest uppercase">
    {formatMoney(estimatedProfit, 'USD')}
  </div>
)}
              <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-orange-50 text-orange-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-orange-100">
                بناءً على هامش ربح 11%
              </div>
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div
            className="app-card p-10 rounded-[2.5rem] border shadow-sm overflow-hidden relative group"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <div
              className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"
              style={{ background: 'var(--theme-primary-soft)' }}
            />
            <h3 className="text-xl font-black app-text mb-12 flex items-center gap-4 relative z-10">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'var(--theme-primary-soft)', color: 'var(--theme-primary)' }}
              >
                <BarChart3 size={20} strokeWidth={2.5} />
              </div>
              رسم بياني للمبيعات اليومية
            </h3>

            <div className="h-80 flex items-end justify-between gap-2 pt-10 relative z-10">
              {loading ? (
                <div className="w-full h-full flex flex-col items-center justify-center app-text-muted gap-4">
                  <BarChart3 size={64} strokeWidth={1} />
                  <p className="text-[10px] font-black uppercase tracking-widest">جاري التحميل...</p>
                </div>
              ) : salesReport.length === 0 ? (
                <div className="w-full h-full flex flex-col items-center justify-center app-text-muted gap-4">
                  <BarChart3 size={64} strokeWidth={1} />
                  <p className="text-[10px] font-black uppercase tracking-widest">لا توجد بيانات</p>
                </div>
              ) : (
                salesReport.map((day, i) => (
                  <div
                    key={i}
                    className="flex-1 flex flex-col items-center justify-end gap-3 group/bar relative h-full"
                  >
                    <div
                      className="w-full transition-all duration-500 rounded-t-2xl relative shadow-sm"
                      style={{
                        height: `${Math.max((day.total / maxTotal) * 100, 4)}%`,
                        background: 'var(--theme-primary-soft-2)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--theme-primary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--theme-primary-soft-2)';
                      }}
                    >
                      <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-black px-4 py-2 rounded-xl opacity-0 group-hover/bar:opacity-100 transition-all duration-300 whitespace-nowrap z-20 shadow-xl pointer-events-none">
                        {formatMoney(Number(day.total || 0))}
                      </div>
                    </div>
                    <span className="text-[8px] font-black app-text-muted -rotate-45 mt-4 whitespace-nowrap uppercase tracking-tighter">
                      {day.date.split('-').slice(1).join('/')}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div
            className="app-card rounded-[2.5rem] border shadow-sm overflow-hidden flex flex-col"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <div className="p-8 border-b app-muted" style={{ borderColor: 'var(--border-color)' }}>
              <h3 className="text-xl font-black app-text tracking-tight">تفاصيل المبيعات اليومية</h3>
            </div>

            <div className="overflow-y-auto max-h-[500px] custom-scrollbar">
              <table className="w-full text-right border-collapse">
                <thead
                  className="sticky top-0 text-[10px] uppercase tracking-[0.2em] font-black border-b z-10"
                  style={{
                    background: 'color-mix(in srgb, var(--card-bg) 88%, transparent)',
                    color: 'var(--text-muted)',
                    borderColor: 'var(--border-color)',
                    backdropFilter: 'blur(10px)'
                  }}
                >
                  <tr>
                    <th className="px-8 py-6">التاريخ</th>
                    <th className="px-8 py-6">عدد العمليات</th>
                    <th className="px-8 py-6">الإجمالي</th>
                  </tr>
                </thead>

                <tbody>
                  {salesReport.map((day, i) => (
                    <tr key={i} style={{ borderTop: `1px solid var(--border-color)` }}>
                      <td className="px-8 py-6 text-sm font-black app-text">{day.date}</td>
                      <td className="px-8 py-6">
                        <span
                          className="px-4 py-1.5 app-muted app-text-muted text-[10px] font-black rounded-xl uppercase tracking-widest border"
                          style={{ borderColor: 'var(--border-color)' }}
                        >
                          {day.count} عملية
                        </span>
                      </td>
                      <td className="px-8 py-6">
                       <div
  className="text-base font-black tracking-tight"
  style={{ color: 'var(--theme-primary)' }}
>
  {formatMoney(Number(day.total || 0))}
</div>
{showUsd && (
  <div className="text-[10px] font-black app-text-muted tracking-widest uppercase">
    {formatMoney(Number(day.total || 0), 'USD')}
  </div>
)}
                      </td>
                    </tr>
                  ))}

                  {!loading && salesReport.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-8 py-20 text-center">
                        <div className="flex flex-col items-center gap-4 app-text-muted opacity-70">
                          <BarChart3 size={64} strokeWidth={1} />
                          <p className="text-[10px] font-black uppercase tracking-widest">
                            لا توجد بيانات ضمن الفترة المحددة
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {showPrintPreview && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-6xl h-[90vh] bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b" dir="rtl">
              <div>
                <h2 className="text-xl font-black text-slate-800">معاينة التقرير قبل الطباعة</h2>
                <p className="text-sm text-slate-500 mt-1">
                  من {dateRange.start} إلى {dateRange.end}
                </p>
              </div>

              <button
                onClick={() => setShowPrintPreview(false)}
                className="w-11 h-11 rounded-xl border flex items-center justify-center text-slate-600 hover:bg-slate-50 transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-auto bg-slate-100 p-6">
              <div className="max-w-4xl mx-auto bg-white shadow-xl rounded-2xl p-8" dir="rtl">
                <div className="text-center mb-8">
                  <h1 className="text-3xl font-black text-slate-800 mb-2">تقرير مبيعات الفترة</h1>
                  <p className="text-sm text-slate-500">
                    من {dateRange.start} إلى {dateRange.end}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                  <div className="border rounded-2xl p-5 text-center">
                    <h3 className="text-xs font-black text-slate-500 mb-2">إجمالي المبيعات</h3>
                    <div className="text-2xl font-black text-emerald-600">
  {formatMoney(totalSales)}
</div>
                  </div>

                  <div className="border rounded-2xl p-5 text-center">
                    <h3 className="text-xs font-black text-slate-500 mb-2">عدد الفواتير</h3>
                    <div className="text-2xl font-black text-slate-800">
                      {totalOrders} فاتورة
                    </div>
                  </div>

                  <div className="border rounded-2xl p-5 text-center">
                    <h3 className="text-xs font-black text-slate-500 mb-2">صافي الأرباح (تقديري)</h3>
                    <div className="text-2xl font-black text-orange-600">
                      {formatMoney(estimatedProfit)}
                    </div>
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border">
                  <table className="w-full text-right border-collapse">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-5 py-4 text-xs font-black text-slate-500">التاريخ</th>
                        <th className="px-5 py-4 text-xs font-black text-slate-500">عدد العمليات</th>
                        <th className="px-5 py-4 text-xs font-black text-slate-500">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesReport.map((day, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-5 py-4 font-bold text-slate-700">{day.date}</td>
                          <td className="px-5 py-4 text-slate-700">{day.count} عملية</td>
                          <td className="px-5 py-4 font-black text-emerald-600">
                            {formatMoney(Number(day.total || 0))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="border-t px-6 py-4 flex items-center justify-between gap-3 bg-white" dir="rtl">
              <div className="text-sm text-slate-500">
                راجع التقرير ثم اضغط طباعة إذا كان كل شيء صحيحًا
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowPrintPreview(false)}
                  className="px-5 py-3 rounded-xl border font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  إغلاق
                </button>

                <button
                  onClick={handlePrintFromPreview}
                  className="px-5 py-3 rounded-xl text-white font-bold flex items-center gap-2 transition"
                  style={{ background: 'var(--theme-primary)' }}
                >
                  <Printer size={18} />
                  طباعة
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Reports;