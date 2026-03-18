import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Wallet,
  TrendingDown,
  Calendar,
  FileText,
  DollarSign,
  Trash2,
  AlertCircle,
  Search,
  Eye,
  Printer,
  X,
  Pencil,
  User as UserIcon,
  BarChart3,
  Coins
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Expense, User } from '../types';
import { appConfirm } from '../utils/appConfirm';
import { appAlert } from '../utils/appAlert';

interface ExpensesProps {
  user: User | null;
}

type CurrencyCode = 'SYP' | 'USD' | 'TRY' | 'SAR' | 'AED';

interface ExpenseDetails extends Expense {
  user_name?: string;
  notes?: string;
}

const Expenses: React.FC<ExpensesProps> = ({ user }) => {
  const [expenses, setExpenses] = useState<ExpenseDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [settings, setSettings] = useState<any>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showExpensesReportPreview, setShowExpensesReportPreview] = useState(false);

  const [selectedExpense, setSelectedExpense] = useState<ExpenseDetails | null>(null);
  const [editingExpense, setEditingExpense] = useState<ExpenseDetails | null>(null);

  const [formData, setFormData] = useState({
    description: '',
    amount: 0, // stored internally in USD
    amountInput: '',
    category: 'عام'
  });

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
    fetchSettings();
    fetchExpenses();
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

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/expenses');
      const data = await res.json();
      setExpenses(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching expenses:', error);
      setExpenses([]);
    } finally {
      setLoading(false);
    }
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

  const getUsdToSyp = () => parseFloat(settings?.usd_to_syp || '11000');
  const getUsdToTry = () => parseFloat(settings?.usd_to_try || '44');
  const getUsdToSar = () => parseFloat(settings?.usd_to_sar || '3.75');
  const getUsdToAed = () => parseFloat(settings?.usd_to_aed || '3.67');

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

  const formatPrintDate = (date: string) => {
    const d = new Date(date);
    const datePart = d.toLocaleDateString('ar-SA', { timeZone: 'Asia/Damascus' });
    const timePart = d.toLocaleTimeString('ar-SA', {
      timeZone: 'Asia/Damascus',
      hour: '2-digit',
      minute: '2-digit'
    });
    return `${datePart} ${timePart}`;
  };

  const filteredExpenses = useMemo(() => {
    const searchLower = searchQuery.toLowerCase().trim();

    if (!searchLower) return expenses;

    return expenses.filter((exp: any) => {
      return (
        String(exp.id || '').includes(searchLower) ||
        String(exp.description || '').toLowerCase().includes(searchLower) ||
        String(exp.category || '').toLowerCase().includes(searchLower) ||
        String(exp.user_name || '').toLowerCase().includes(searchLower)
      );
    });
  }, [expenses, searchQuery]);

  const totalExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0);

  const currentMonthExpenses = expenses.reduce((sum, exp) => {
    const d = new Date(exp.created_at);
    const now = new Date();
    if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
      return sum + Number(exp.amount || 0);
    }
    return sum;
  }, 0);

  const categoriesCount = new Set(expenses.map((exp) => exp.category || 'عام')).size;

  const latestExpenseDate =
    expenses.length > 0
      ? expenses
          .slice()
          .sort(
            (a, b) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )[0]?.created_at
      : null;

  const resetForm = () => {
    setFormData({
      description: '',
      amount: 0,
      amountInput: '',
      category: 'عام'
    });
    setEditingExpense(null);
  };

  const openCreateForm = () => {
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (expense: ExpenseDetails) => {
    setEditingExpense(expense);
    setFormData({
      description: expense.description || '',
      category: expense.category || 'عام',
      amount: Number(expense.amount || 0),
      amountInput: formatMoneyRaw(Number(expense.amount || 0), getCurrencyCode())
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.description.trim()) {
      appAlert('يرجى إدخال وصف المصروف');
      return;
    }

    if (Number(formData.amount || 0) <= 0) {
      appAlert('يرجى إدخال مبلغ صحيح');
      return;
    }

    setFormLoading(true);

    try {
      const endpoint = editingExpense ? `/api/expenses/${editingExpense.id}` : '/api/expenses';
      const method = editingExpense ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: formData.description.trim(),
          category: formData.category,
          amount: Number(formData.amount || 0), // store in USD internally
          user_id: user?.id
        })
      });

      if (!res.ok) {
        const result = await res.json().catch(() => null);
        appAlert(result?.message || (editingExpense ? 'تعذر تعديل المصروف' : 'تعذر حفظ المصروف'));
        return;
      }

      setShowForm(false);
      resetForm();
      await fetchExpenses();
    } catch (error) {
      console.error('Error saving expense:', error);
      appAlert(editingExpense ? 'حدث خطأ أثناء تعديل المصروف' : 'حدث خطأ أثناء حفظ المصروف');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = await Promise.resolve(appConfirm('هل أنت متأكد من حذف هذا المصروف؟'));
    if (!confirmed) return;

    setActionLoadingId(id);

    try {
      const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });

      if (res.ok) {
        if (selectedExpense?.id === id) {
          setShowExpenseModal(false);
          setSelectedExpense(null);
        }
        await fetchExpenses();
      } else {
        const result = await res.json().catch(() => null);
        appAlert(result?.message || 'تعذر حذف المصروف');
      }
    } catch (error) {
      console.error('Error deleting expense:', error);
      appAlert('حدث خطأ أثناء حذف المصروف');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleViewExpense = (expense: ExpenseDetails) => {
    setSelectedExpense(expense);
    setShowExpenseModal(true);
  };

  const buildExpensePrintHtml = (expense: ExpenseDetails) => {
    const escapeHtml = (value: any) =>
      String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    return `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
        <head>
          <meta charset="utf-8" />
          <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
          <title>إيصال مصروف #${escapeHtml(expense.id)}</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 2mm;
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
              width: 80mm;
              min-width: 80mm;
              max-width: 80mm;
            }

            body {
              font-size: 11px;
              line-height: 1.55;
              padding: 0;
            }

            .receipt {
              width: 76mm;
              margin: 0 auto;
              padding: 4px 0;
            }

            .title {
              text-align: center;
              font-size: 16px;
              font-weight: bold;
              margin-bottom: 3px;
            }

            .muted {
              color: #666;
            }

            .small {
              font-size: 9px;
            }

            .base {
              font-size: 11px;
            }

            .lg {
              font-size: 14px;
            }

            .bold {
              font-weight: bold;
            }

            .sep {
              border-top: 1px dashed #999;
              margin: 8px 0;
            }

            .row {
              display: flex;
              justify-content: space-between;
              gap: 8px;
              margin: 4px 0;
            }

            .box {
              border: 1px solid #ddd;
              border-radius: 8px;
              padding: 8px;
              margin-top: 6px;
            }

            .footer {
              margin-top: 12px;
              text-align: center;
              font-size: 10px;
            }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="title">${escapeHtml(settings?.shop_name || 'سوبر ماركت الخير')}</div>
            <div class="base muted" style="text-align:center;">${escapeHtml(settings?.shop_address || 'دمشق، الميدان')}</div>
            ${settings?.shop_phone ? `<div class="small muted" style="text-align:center;">${escapeHtml(settings.shop_phone)}</div>` : ''}
            ${settings?.shop_tax_number ? `<div class="small muted" style="text-align:center;">الرقم الضريبي: ${escapeHtml(settings.shop_tax_number)}</div>` : ''}

            <div class="sep"></div>

            <div class="row base">
              <span>إيصال مصروف</span>
              <span>#${escapeHtml(expense.id)}</span>
            </div>

            <div class="row base">
              <span>التاريخ:</span>
              <span>${escapeHtml(formatPrintDate(expense.created_at))}</span>
            </div>

            <div class="row base">
              <span>المستخدم:</span>
              <span>${escapeHtml(expense.user_name || user?.name || '-')}</span>
            </div>

            <div class="row base">
              <span>التصنيف:</span>
              <span>${escapeHtml(expense.category || 'عام')}</span>
            </div>

            <div class="sep"></div>

            <div class="box">
              <div class="small muted">الوصف</div>
              <div class="base bold" style="margin-top:6px;">${escapeHtml(expense.description || '-')}</div>
            </div>

            <div class="box">
              <div class="row lg bold">
                <span>المبلغ:</span>
                <span>${escapeHtml(formatMoney(Number(expense.amount || 0)))}</span>
              </div>
              ${
                showUsd
                  ? `
                    <div class="row small muted">
                      <span>USD:</span>
                      <span>${escapeHtml(formatMoney(Number(expense.amount || 0), 'USD'))}</span>
                    </div>
                  `
                  : ''
              }
            </div>

            <div class="footer">
              <div class="small muted">${escapeHtml(settings?.receipt_footer || 'تم إنشاء هذا الإيصال من النظام')}</div>
            </div>
          </div>
        </body>
      </html>
    `;
  };

  const printExpense = (expense: ExpenseDetails) => {
    const printContent = buildExpensePrintHtml(expense);
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

  const buildExpensesReportHtml = () => {
    const reportRows = expenses
      .map((exp) => {
        return `
          <tr>
            <td>#${exp.id}</td>
            <td>${formatPrintDate(exp.created_at)}</td>
            <td>${exp.description || '-'}</td>
            <td>${exp.category || 'عام'}</td>
            <td>${exp.user_name || '-'}</td>
            <td>${formatMoney(Number(exp.amount || 0))}</td>
          </tr>
        `;
      })
      .join('');

    return `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8" />
          <title>تقرير المصروفات</title>
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
              <h1>تقرير المصروفات</h1>
              <p>تقرير شامل عن جميع المصروفات الحالية</p>
              <div class="shop-meta">
                <div>${settings?.shop_name || 'سوبر ماركت الخير'}</div>
                <div>${settings?.shop_address || 'دمشق، الميدان'}</div>
                ${settings?.shop_phone ? `<div>${settings.shop_phone}</div>` : ''}
                ${settings?.shop_tax_number ? `<div>الرقم الضريبي: ${settings.shop_tax_number}</div>` : ''}
              </div>
            </div>

            <div class="stats">
              <div class="card">
                <h3>عدد المصروفات</h3>
                <div>${expenses.length}</div>
              </div>
              <div class="card">
                <h3>إجمالي المصروفات</h3>
                <div>${formatMoney(totalExpenses)}</div>
              </div>
              <div class="card">
                <h3>مصروفات هذا الشهر</h3>
                <div>${formatMoney(currentMonthExpenses)}</div>
              </div>
              <div class="card">
                <h3>عدد التصنيفات</h3>
                <div>${categoriesCount}</div>
              </div>
            </div>

            <div class="section">
              <div class="section-title">تفاصيل المصروفات</div>
              <table>
                <thead>
                  <tr>
                    <th>رقم السجل</th>
                    <th>التاريخ والوقت</th>
                    <th>الوصف</th>
                    <th>التصنيف</th>
                    <th>المستخدم</th>
                    <th>المبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    reportRows ||
                    `
                      <tr>
                        <td colspan="6" style="text-align:center;color:#64748b;">
                          لا توجد بيانات
                        </td>
                      </tr>
                    `
                  }
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

  const handlePrintExpensesReport = () => {
    const printContent = buildExpensesReportHtml();

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.left = '-9999px';
    iframe.style.top = '0';
    iframe.setAttribute('aria-hidden', 'true');

    iframe.onload = () => {
      setTimeout(() => {
        const iframeWindow = iframe.contentWindow;
        if (iframeWindow) {
          iframeWindow.focus();
          iframeWindow.print();

          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 1000);
        }
      }, 300);
    };

    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (iframeDoc) {
      iframeDoc.open();
      iframeDoc.write(printContent);
      iframeDoc.close();
    } else {
      document.body.removeChild(iframe);
      appAlert('تعذر فتح نافذة الطباعة');
    }
  };

  return (
    <>
      <div className="space-y-8" dir="rtl">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="app-card p-8 rounded-[2.5rem] border shadow-sm flex items-center justify-between"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <div>
              <h3 className="text-[10px] font-black app-text-muted uppercase tracking-[0.2em] mb-2">
                إجمالي المصروفات
              </h3>
              <div className="text-3xl font-black text-rose-600 tracking-tight mb-1">
                {formatMoney(totalExpenses)}
              </div>
              {showUsd && (
                <div
                  className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border"
                  style={{
                    background: 'rgba(244,63,94,0.08)',
                    color: '#f43f5e',
                    borderColor: 'rgba(244,63,94,0.16)'
                  }}
                >
                  {formatMoney(totalExpenses, 'USD')}
                </div>
              )}
            </div>

            <div
              className="w-16 h-16 rounded-[1.5rem] flex items-center justify-center shadow-lg border"
              style={{
                background: 'rgba(244,63,94,0.08)',
                color: '#e11d48',
                borderColor: 'rgba(244,63,94,0.16)'
              }}
            >
              <TrendingDown size={28} strokeWidth={2.5} />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="app-card p-8 rounded-[2.5rem] border shadow-sm flex items-center justify-between"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <div>
              <h3 className="text-[10px] font-black app-text-muted uppercase tracking-[0.2em] mb-2">
                مصروفات هذا الشهر
              </h3>
              <div className="text-3xl font-black app-text tracking-tight">
                {formatMoney(currentMonthExpenses)}
              </div>
            </div>

            <div
              className="w-16 h-16 rounded-[1.5rem] flex items-center justify-center shadow-lg border"
              style={{
                background: 'var(--theme-primary-soft)',
                color: 'var(--theme-primary)',
                borderColor: 'var(--theme-primary-soft-2)'
              }}
            >
              <Calendar size={28} strokeWidth={2.5} />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="app-card p-8 rounded-[2.5rem] border shadow-sm flex items-center justify-between"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <div>
              <h3 className="text-[10px] font-black app-text-muted uppercase tracking-[0.2em] mb-2">
                عدد التصنيفات
              </h3>
              <div className="text-3xl font-black app-text tracking-tight">{categoriesCount}</div>
            </div>

            <div
              className="w-16 h-16 rounded-[1.5rem] flex items-center justify-center shadow-lg border"
              style={{
                background: 'rgba(59,130,246,0.08)',
                color: '#3b82f6',
                borderColor: 'rgba(59,130,246,0.16)'
              }}
            >
              <BarChart3 size={28} strokeWidth={2.5} />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl shadow-slate-900/20 text-white relative overflow-hidden"
          >
            <div
              className="absolute top-0 right-0 w-56 h-56 rounded-full blur-3xl -mr-24 -mt-24"
              style={{ background: 'rgba(255,255,255,0.06)' }}
            />

            <div className="relative z-10">
              <h3
                className="text-[10px] font-black uppercase tracking-[0.2em] mb-2"
                style={{ color: 'var(--theme-primary)' }}
              >
                إدارة المصروفات
              </h3>

              <p className="text-sm font-bold text-slate-400 mb-5 leading-relaxed">
                أضف، عدّل، اعرض، واطبع المصروفات بنفس أسلوب صفحة الفواتير
              </p>

              <button
                onClick={openCreateForm}
                className="text-white font-black py-4 px-7 rounded-[1.5rem] shadow-lg transition-all active:scale-95 flex items-center gap-3"
                style={{ background: 'var(--theme-primary)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--theme-primary-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--theme-primary)';
                }}
              >
                <Plus size={20} strokeWidth={3} />
                تسجيل مصروف
              </button>
            </div>

            <div className="w-16 h-16 bg-white/5 rounded-[1.5rem] flex items-center justify-center border border-white/10 absolute left-8 bottom-8">
              <Wallet size={28} strokeWidth={2.5} style={{ color: 'var(--theme-primary)' }} />
            </div>
          </motion.div>
        </div>

        <div className="flex flex-col gap-6 no-print">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="relative flex-1 max-w-xl group">
              <Search
                className="absolute right-5 top-1/2 -translate-y-1/2 app-text-muted transition-colors"
                size={22}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث برقم السجل، الوصف، التصنيف، أو المستخدم..."
                className="w-full app-muted border rounded-[2rem] py-4 pr-14 pl-6 outline-none transition-all font-bold app-text shadow-sm"
                style={{ borderColor: 'var(--border-color)' }}
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowExpensesReportPreview(true)}
                disabled={loading || expenses.length === 0}
                className="text-white font-black px-6 py-4 rounded-[1.5rem] flex items-center gap-3 shadow-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'var(--theme-primary)' }}
              >
                <FileText size={18} strokeWidth={2.5} />
                عرض تقرير المصروفات
              </button>

              <div
                className="app-card p-2 rounded-2xl border shadow-sm flex items-center gap-2"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    background: 'rgba(244,63,94,0.08)',
                    color: '#e11d48'
                  }}
                >
                  <TrendingDown size={20} strokeWidth={2.5} />
                </div>
                <div className="pr-2 pl-4">
                  <div className="text-[10px] font-black app-text-muted uppercase tracking-widest">
                    إجمالي السجلات
                  </div>
                  <div className="text-base font-black app-text leading-none">{expenses.length}</div>
                </div>
              </div>
            </div>
          </div>

          {latestExpenseDate && (
            <div className="flex items-center gap-2 px-4 py-3 app-card rounded-2xl border shadow-sm w-fit">
              <AlertCircle size={14} className="text-amber-500" />
              <span className="text-[10px] font-black app-text-muted uppercase tracking-widest">
                آخر مصروف مسجل: {formatPrintDate(latestExpenseDate)}
              </span>
            </div>
          )}
        </div>

        <div
          className="app-card rounded-[2.5rem] border shadow-sm overflow-hidden"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr
                  className="app-muted text-[10px] font-black uppercase tracking-[0.2em] border-b"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <th className="px-8 py-6 app-text-muted">رقم السجل</th>
                  <th className="px-8 py-6 app-text-muted">الوصف</th>
                  <th className="px-8 py-6 app-text-muted">التصنيف</th>
                  <th className="px-8 py-6 app-text-muted">التاريخ والوقت</th>
                  <th className="px-8 py-6 app-text-muted">المبلغ</th>
                  <th className="px-8 py-6 app-text-muted">المستخدم</th>
                  <th className="px-8 py-6 text-center app-text-muted">الإجراءات</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-8 py-20 text-center">
                      <div className="flex flex-col items-center gap-4 app-text-muted opacity-70">
                        <div
                          className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin"
                          style={{
                            borderColor: 'var(--theme-primary)',
                            borderTopColor: 'transparent'
                          }}
                        />
                        <p className="text-base font-black uppercase tracking-widest">
                          جاري تحميل المصروفات...
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-8 py-20 text-center">
                      <div className="flex flex-col items-center gap-4 app-text-muted opacity-60">
                        <TrendingDown size={64} strokeWidth={1} />
                        <p className="text-base font-black uppercase tracking-widest">
                          لا توجد مصروفات مطابقة للبحث
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map((exp) => (
                    <tr
                      key={exp.id}
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
                            <TrendingDown size={22} strokeWidth={2.5} />
                          </div>
                          <div className="font-black app-text tracking-tight">#{exp.id}</div>
                        </div>
                      </td>

                      <td className="px-8 py-6">
                        <div className="flex flex-col">
                          <span className="text-base font-black app-text">{exp.description}</span>
                        </div>
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
                          {exp.category || 'عام'}
                        </span>
                      </td>

                      <td className="px-8 py-6">
                        <div className="flex flex-col">
                          <span className="text-base font-black app-text">
                            {new Date(exp.created_at).toLocaleDateString('ar-SA')}
                          </span>
                          <span className="text-[10px] font-bold app-text-muted uppercase tracking-widest">
                            {new Date(exp.created_at).toLocaleTimeString('ar-SA', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </td>

                      <td className="px-8 py-6">
                        <div className="flex flex-col">
                          <span className="text-base font-black text-rose-600 tracking-tight">
                            {formatMoney(Number(exp.amount || 0))}
                          </span>
                          {showUsd && (
                            <span className="text-[10px] font-bold app-text-muted uppercase tracking-widest">
                              {formatMoney(Number(exp.amount || 0), 'USD')}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 app-muted rounded-lg flex items-center justify-center"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            <UserIcon size={12} />
                          </div>
                          <span className="text-xs font-bold app-text-muted">
                            {exp.user_name || '-'}
                          </span>
                        </div>
                      </td>

                      <td className="px-8 py-6">
                        <div className="flex items-center justify-center gap-3">
                          <button
                            onClick={() => handleViewExpense(exp)}
                            className="w-10 h-10 flex items-center justify-center rounded-xl transition-all shadow-sm border"
                            style={{
                              color: '#3b82f6',
                              borderColor: 'transparent',
                              background: 'transparent'
                            }}
                            title="عرض المصروف"
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
                            onClick={() => openEditForm(exp)}
                            className="w-10 h-10 flex items-center justify-center rounded-xl transition-all shadow-sm border"
                            style={{
                              color: '#f59e0b',
                              borderColor: 'transparent',
                              background: 'transparent'
                            }}
                            title="تعديل المصروف"
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'rgba(245,158,11,0.08)';
                              e.currentTarget.style.borderColor = 'rgba(245,158,11,0.15)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent';
                              e.currentTarget.style.borderColor = 'transparent';
                            }}
                          >
                            <Pencil size={18} strokeWidth={2.5} />
                          </button>

                          <button
                            onClick={() => printExpense(exp)}
                            className="w-10 h-10 flex items-center justify-center rounded-xl transition-all shadow-sm border"
                            style={{
                              color: 'var(--theme-primary)',
                              borderColor: 'transparent',
                              background: 'transparent'
                            }}
                            title="طباعة الإيصال"
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

                          <button
                            onClick={() => handleDelete(exp.id)}
                            disabled={actionLoadingId === exp.id}
                            className="w-10 h-10 flex items-center justify-center rounded-xl transition-all shadow-sm border disabled:opacity-50"
                            style={{
                              color: '#e11d48',
                              borderColor: 'transparent',
                              background: 'transparent'
                            }}
                            title="حذف المصروف"
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'rgba(225,29,72,0.08)';
                              e.currentTarget.style.borderColor = 'rgba(225,29,72,0.15)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent';
                              e.currentTarget.style.borderColor = 'transparent';
                            }}
                          >
                            <Trash2 size={18} strokeWidth={2.5} />
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
                عرض {filteredExpenses.length} من {expenses.length} مصروفات
              </span>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {showExpenseModal && selectedExpense && (
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
                        background: 'rgba(244,63,94,0.08)',
                        color: '#e11d48'
                      }}
                    >
                      <TrendingDown size={20} strokeWidth={2.5} />
                    </div>
                    <div>
                      <h3 className="font-black app-text leading-none">تفاصيل المصروف</h3>
                      <span className="text-[10px] font-black app-text-muted uppercase tracking-widest">
                        #{selectedExpense.id}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowExpenseModal(false)}
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
                      <div className="text-right">رقم السجل:</div>
                      <div className="text-left app-text">#{selectedExpense.id}</div>

                      <div className="text-right">التاريخ:</div>
                      <div className="text-left app-text">
                        {new Date(selectedExpense.created_at).toLocaleDateString('ar-SA')}
                      </div>

                      <div className="text-right">الوقت:</div>
                      <div className="text-left app-text">
                        {new Date(selectedExpense.created_at).toLocaleTimeString('ar-SA')}
                      </div>

                      <div className="text-right">المستخدم:</div>
                      <div className="text-left app-text">{selectedExpense.user_name || '-'}</div>

                      <div className="text-right">التصنيف:</div>
                      <div className="text-left">
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-black border"
                          style={{
                            background: 'var(--theme-primary-soft)',
                            color: 'var(--theme-primary)',
                            borderColor: 'var(--theme-primary-soft-2)'
                          }}
                        >
                          {selectedExpense.category || 'عام'}
                        </span>
                      </div>
                    </div>

                    <div
                      className="border-t border-dashed my-6"
                      style={{ borderColor: 'var(--border-color)' }}
                    />
                  </div>

                  <div className="space-y-5">
                    <div
                      className="p-5 rounded-[1.5rem] border"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      <div className="text-[10px] font-black app-text-muted uppercase tracking-widest mb-2">
                        وصف المصروف
                      </div>
                      <div className="text-base font-black app-text leading-relaxed">
                        {selectedExpense.description || '-'}
                      </div>
                    </div>

                    <div
                      className="p-5 rounded-[1.5rem] border"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      <div className="flex justify-between text-base font-bold app-text-muted">
                        <span>المبلغ:</span>
                        <div className="text-left">
                          <div className="text-rose-600 font-black">
                            {formatMoney(Number(selectedExpense.amount || 0))}
                          </div>
                          {showUsd && (
                            <div className="text-[10px] font-bold app-text-muted uppercase tracking-widest">
                              {formatMoney(Number(selectedExpense.amount || 0), 'USD')}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-center mt-6">
                    <p className="text-[10px] font-black app-text-muted uppercase tracking-[0.2em] leading-relaxed">
                      {settings?.receipt_footer || 'تم إنشاء هذا الإيصال من النظام'}
                    </p>
                  </div>
                </div>

                <div
                  className="p-6 app-muted flex gap-4 border-t"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <button
                    onClick={() => printExpense(selectedExpense)}
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
                    onClick={() => {
                      setShowExpenseModal(false);
                      openEditForm(selectedExpense);
                    }}
                    className="flex-1 font-black py-4 rounded-[1.5rem] flex items-center justify-center gap-3 transition-all shadow-lg active:scale-95"
                    style={{
                      background: 'rgba(245,158,11,0.08)',
                      color: '#f59e0b',
                      border: '1px solid rgba(245,158,11,0.2)'
                    }}
                  >
                    <Pencil size={18} strokeWidth={2.5} />
                    تعديل
                  </button>

                  <button
                    onClick={() => setShowExpenseModal(false)}
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

        <AnimatePresence>
          {showForm && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[110] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="app-card w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <div
                  className="p-8 border-b flex items-center justify-between app-muted"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm"
                      style={{
                        background: editingExpense
                          ? 'rgba(245,158,11,0.08)'
                          : 'rgba(244,63,94,0.08)',
                        color: editingExpense ? '#f59e0b' : '#e11d48'
                      }}
                    >
                      {editingExpense ? (
                        <Pencil size={24} strokeWidth={2.5} />
                      ) : (
                        <TrendingDown size={24} strokeWidth={2.5} />
                      )}
                    </div>
                    <h2 className="text-xl font-black app-text tracking-tight">
                      {editingExpense ? 'تعديل المصروف' : 'تسجيل مصروف جديد'}
                    </h2>
                  </div>

                  <button
                    onClick={() => {
                      setShowForm(false);
                      resetForm();
                    }}
                    className="w-10 h-10 flex items-center justify-center app-text-muted rounded-full transition-all"
                  >
                    <Plus className="rotate-45" size={24} strokeWidth={2.5} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="p-10 space-y-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black app-text-muted uppercase tracking-widest mr-2">
                      وصف المصروف
                    </label>
                    <div className="relative group">
                      <FileText
                        className="absolute right-5 top-1/2 -translate-y-1/2 app-text-muted transition-colors"
                        size={22}
                      />
                      <input
                        type="text"
                        required
                        value={formData.description}
                        onChange={(e) =>
                          setFormData({ ...formData, description: e.target.value })
                        }
                        className="w-full app-muted border rounded-[1.5rem] py-5 pr-14 pl-6 outline-none transition-all font-bold app-text"
                        style={{ borderColor: 'var(--border-color)' }}
                        placeholder="مثلاً: كهرباء، إيجار، صيانة، نقل..."
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black app-text-muted uppercase tracking-widest mr-2">
                        المبلغ
                      </label>

                      <div className="text-[10px] font-bold app-text-muted mr-2">
                        سيتم حفظ المصروف داخليًا بالدولار حسب العملة المختارة.
                        {getCurrencyCode() !== 'USD' && formData.amount > 0 && (
                          <span className="block mt-1">
                            بالدولار التقريبي: {formatMoney(formData.amount, 'USD')}
                          </span>
                        )}
                      </div>

                      <div className="relative group">
                        <Coins
                          className="absolute right-5 top-1/2 -translate-y-1/2 app-text-muted transition-colors"
                          size={22}
                        />
                        <input
                          type="text"
                          inputMode="decimal"
                          lang="en"
                          dir="ltr"
                          required
                          value={formData.amountInput}
                          onChange={(e) => {
                            const normalized = normalizeDigits(e.target.value);
                            setFormData({
                              ...formData,
                              amountInput: normalized,
                              amount: convertToUSD(Number(normalized || 0), )
                            });
                          }}
                          className="w-full app-muted border rounded-[1.5rem] py-5 pr-14 pl-16 outline-none transition-all font-black app-text"
                          style={{ borderColor: 'var(--border-color)' }}
                        />
                        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-[10px] font-black app-text-muted uppercase tracking-widest">
                         
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black app-text-muted uppercase tracking-widest mr-2">
                        التصنيف
                      </label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full app-muted border rounded-[1.5rem] py-5 px-6 outline-none transition-all font-bold app-text appearance-none cursor-pointer"
                        style={{ borderColor: 'var(--border-color)' }}
                      >
                        <option value="عام">عام</option>
                        <option value="فواتير">فواتير</option>
                        <option value="إيجار">إيجار</option>
                        <option value="رواتب">رواتب</option>
                        <option value="صيانة">صيانة</option>
                        <option value="نقل">نقل</option>
                        <option value="مشتريات خدمية">مشتريات خدمية</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-6 flex gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowForm(false);
                        resetForm();
                      }}
                      className="flex-1 py-5 app-muted app-text font-black rounded-[1.5rem] transition-all active:scale-95 border"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      إلغاء
                    </button>

                    <button
                      type="submit"
                      disabled={formLoading}
                      className="flex-1 py-5 text-white font-black rounded-[1.5rem] shadow-xl transition-all active:scale-95 disabled:opacity-50"
                      style={{ background: editingExpense ? '#f59e0b' : '#e11d48' }}
                    >
                      {formLoading
                        ? 'جاري الحفظ...'
                        : editingExpense
                        ? 'حفظ التعديل'
                        : 'حفظ المصروف'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showExpensesReportPreview && (
          <div className="fixed inset-0 z-[130] bg-black/60 flex items-center justify-center p-4">
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
                    معاينة تقرير المصروفات
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    تقرير شامل بجميع المصروفات الحالية
                  </p>
                </div>

                <button
                  onClick={() => setShowExpensesReportPreview(false)}
                  className="w-11 h-11 rounded-xl border flex items-center justify-center text-slate-600 hover:bg-slate-50 transition"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-auto bg-slate-100 p-6">
                <div className="max-w-6xl mx-auto bg-white shadow-xl rounded-2xl p-8">
                  <div className="text-center mb-8">
                    <h1 className="text-3xl font-black text-slate-800 mb-2">تقرير المصروفات</h1>
                    <p className="text-sm text-slate-500">تقرير شامل عن جميع المصروفات الحالية</p>
                    <p className="text-base font-black text-slate-700 mt-3">
                      {settings?.shop_name || 'سوبر ماركت الخير'}
                    </p>
                    <p className="text-sm text-slate-500 mt-1">
                      {settings?.shop_address || 'دمشق، الميدان'}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <div className="border rounded-2xl p-5 text-center">
                      <h3 className="text-xs font-black text-slate-500 mb-2">عدد المصروفات</h3>
                      <div className="text-3xl font-black text-slate-800">{expenses.length}</div>
                    </div>

                    <div className="border rounded-2xl p-5 text-center">
                      <h3 className="text-xs font-black text-slate-500 mb-2">إجمالي المصروفات</h3>
                      <div className="text-3xl font-black text-rose-600">
                        {formatMoney(totalExpenses)}
                      </div>
                    </div>

                    <div className="border rounded-2xl p-5 text-center">
                      <h3 className="text-xs font-black text-slate-500 mb-2">مصروفات هذا الشهر</h3>
                      <div className="text-3xl font-black text-slate-800">
                        {formatMoney(currentMonthExpenses)}
                      </div>
                    </div>

                    <div className="border rounded-2xl p-5 text-center">
                      <h3 className="text-xs font-black text-slate-500 mb-2">عدد التصنيفات</h3>
                      <div className="text-3xl font-black text-slate-800">{categoriesCount}</div>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-2xl border">
                    <table className="w-full text-right border-collapse">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-4 text-xs font-black text-slate-500">رقم السجل</th>
                          <th className="px-4 py-4 text-xs font-black text-slate-500">التاريخ والوقت</th>
                          <th className="px-4 py-4 text-xs font-black text-slate-500">الوصف</th>
                          <th className="px-4 py-4 text-xs font-black text-slate-500">التصنيف</th>
                          <th className="px-4 py-4 text-xs font-black text-slate-500">المستخدم</th>
                          <th className="px-4 py-4 text-xs font-black text-slate-500">المبلغ</th>
                        </tr>
                      </thead>

                      <tbody>
                        {expenses.length > 0 ? (
                          expenses.map((expense: ExpenseDetails) => (
                            <tr key={expense.id} className="border-t">
                              <td className="px-4 py-4 font-bold text-slate-700">#{expense.id}</td>
                              <td className="px-4 py-4 text-slate-700">
                                {formatPrintDate(expense.created_at)}
                              </td>
                              <td className="px-4 py-4 text-slate-700 font-bold">
                                {expense.description || '-'}
                              </td>
                              <td className="px-4 py-4 text-slate-700">
                                {expense.category || 'عام'}
                              </td>
                              <td className="px-4 py-4 text-slate-700">
                                {expense.user_name || '-'}
                              </td>
                              <td className="px-4 py-4 font-black text-rose-600">
                                {formatMoney(Number(expense.amount || 0))}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td
                              colSpan={6}
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
                <div className="text-sm text-slate-500">
                  راجع التقرير ثم اضغط طباعة إذا كانت البيانات صحيحة
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowExpensesReportPreview(false)}
                    className="px-5 py-3 rounded-xl border font-bold text-slate-700 hover:bg-slate-50 transition"
                  >
                    إغلاق
                  </button>

                  <button
                    onClick={handlePrintExpensesReport}
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

export default Expenses;