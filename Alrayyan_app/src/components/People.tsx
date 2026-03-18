import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  User,
  Phone,
  MapPin,
  Wallet,
  Edit2,
  Trash2,
  UserCircle,
  Truck,
  Eye,
  Printer,
  Download,
  X,
  FileText,
  HandCoins,
  ArrowDownCircle,
  ArrowUpCircle,
  Hash
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { Supplier, Customer, AccountTransaction } from '../types';
import {formatAppDateTime} from '../utils/formatDateTime'
interface PeopleProps {
  type: 'suppliers' | 'customers';
}

interface StatementTotals {
  total_purchases?: number;
  total_sales?: number;
  total_paid: number;
  total_remaining: number;
  current_balance: number;
  sales_count?: number;
  purchase_count?: number;
  payments_count?: number;
}

interface SupplierStatementResponse {
  success: boolean;
  supplier: Supplier;
  transactions: AccountTransaction[];
  totals: StatementTotals;
}

interface CustomerStatementResponse {
  success: boolean;
  customer: Customer;
  transactions: AccountTransaction[];
  totals: StatementTotals;
}

type PersonItem = Supplier | Customer;
type CurrencyCode = 'USD' | 'TRY' | 'SAR' | 'AED' | 'SYP';

const People: React.FC<PeopleProps> = ({ type }) => {
  const isSuppliers = type === 'suppliers';

  const [settings, setSettings] = useState<any>(null);
  const [data, setData] = useState<PersonItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<PersonItem | null>(null);
  const [formData, setFormData] = useState({ name: '', phone: '', address: '' });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingDeleteItem, setPendingDeleteItem] = useState<PersonItem | null>(null);

  const [showStatementModal, setShowStatementModal] = useState(false);
  const [statementLoading, setStatementLoading] = useState(false);
  const [statementData, setStatementData] = useState<SupplierStatementResponse | CustomerStatementResponse | null>(null);

  const [showSettleModal, setShowSettleModal] = useState(false);
  const [pendingSettleItem, setPendingSettleItem] = useState<PersonItem | null>(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleCurrency, setSettleCurrency] = useState<CurrencyCode>('USD');
  const [settleNote, setSettleNote] = useState('');
  const [settleLoading, setSettleLoading] = useState(false);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      setSettings(data);
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  useEffect(() => {
    fetchData();
    fetchSettings();
  }, [type]);

  const showTempMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  const normalizeDigits = (value: string) => {
    return value
      .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
      .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
      .replace(/٫/g, '.')
      .replace(/,/g, '.')
      .replace(/[^\d.]/g, '')
      .replace(/(\..*)\./g, '$1');
  };

  const getCurrencyCode = (): CurrencyCode => {
    const currency = settings?.currency;

    if (currency === 'USD' || currency === 'TRY' || currency === 'SAR' || currency === 'AED' || currency === 'SYP') {
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
    return Number(amount || 0) * Number(rate || 1);
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

  const showUsd = settings?.show_usd === 'true';

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/${type}`);
      const result = await res.json();
      setData(Array.isArray(result) ? result : []);
    } catch (error) {
      console.error('Error fetching people data:', error);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const url = editingItem ? `/api/${type}/${editingItem.id}` : `/api/${type}`;
    const method = editingItem ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const result = await res.json().catch(() => null);

      if (res.ok) {
        setShowForm(false);
        setEditingItem(null);
        setFormData({ name: '', phone: '', address: '' });
        await fetchData();
        showTempMessage(editingItem ? 'تم تحديث البيانات بنجاح' : 'تمت الإضافة بنجاح');
      } else {
        showTempMessage(result?.message || 'فشل حفظ البيانات');
      }
    } catch (error) {
      console.error('Error saving person:', error);
      showTempMessage('حدث خطأ أثناء حفظ البيانات');
    }
  };

  const handleEdit = (item: PersonItem) => {
    setEditingItem(item);
    setFormData({ name: item.name, phone: item.phone, address: item.address });
    setShowForm(true);
  };

  const openDeleteConfirm = (item: PersonItem) => {
    setPendingDeleteItem(item);
    setShowDeleteConfirm(true);
  };

  const closeDeleteConfirm = () => {
    if (actionLoading) return;
    setShowDeleteConfirm(false);
    setPendingDeleteItem(null);
  };

  const handleDelete = async (item?: PersonItem) => {
    const target = item || pendingDeleteItem;
    if (!target) return;

    if (item) {
      openDeleteConfirm(item);
      return;
    }

    setActionLoading(target.id);

    try {
      const res = await fetch(`/api/${type}/${target.id}`, {
        method: 'DELETE'
      });

      const result = await res.json().catch(() => null);

      if (res.ok && result?.success) {
        closeDeleteConfirm();
        await fetchData();
        showTempMessage(`تم حذف ${isSuppliers ? 'المورد' : 'العميل'} بنجاح`);
      } else {
        showTempMessage(result?.message || 'تعذر الحذف');
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      showTempMessage('حدث خطأ أثناء الحذف');
    } finally {
      setActionLoading(null);
    }
  };

  const handleViewStatement = async (item: PersonItem) => {
    setStatementLoading(true);
    setShowStatementModal(true);
    setStatementData(null);

    try {
      const res = await fetch(`/api/${type}/${item.id}/statement`);
      const contentType = res.headers.get('content-type') || '';

      if (!contentType.includes('application/json')) {
        const text = await res.text();
        console.error('Non-JSON response:', text);
        showTempMessage('السيرفر لم يرجع JSON صحيح');
        setShowStatementModal(false);
        return;
      }

      const result = await res.json();

      if (res.ok && result?.success) {
        setStatementData(result);
      } else {
        showTempMessage(result?.message || 'تعذر تحميل كشف الحساب');
        setShowStatementModal(false);
      }
    } catch (error) {
      console.error('Error fetching statement:', error);
      showTempMessage('حدث خطأ أثناء تحميل كشف الحساب');
      setShowStatementModal(false);
    } finally {
      setStatementLoading(false);
    }
  };

  const exportPeopleExcel = () => {
    const rows = filteredData.map((item, index) => ({
      '#': index + 1,
      'الاسم': item.name,
      'الهاتف': item.phone,
      'العنوان': item.address,
      'الرصيد (العملة الافتراضية)': formatMoney(Number(item.balance || 0)),
      'الرصيد (USD)': formatMoney(Number(item.balance || 0), 'USD')
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, isSuppliers ? 'Suppliers' : 'Customers');

    XLSX.writeFile(
      workbook,
      `${isSuppliers ? 'suppliers' : 'customers'}_${new Date().toISOString().split('T')[0]}.xlsx`
    );
  };

  const printPeople = () => {
    const printWindow = window.open('', '', 'width=1000,height=800');
    if (!printWindow) return;

    const rows = filteredData
      .map(
        (item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${item.name}</td>
        <td>${item.phone}</td>
        <td>${item.address}</td>
        <td>${formatMoney(Number(item.balance || 0))}</td>
        <td>${formatMoney(Number(item.balance || 0), 'USD')}</td>
      </tr>
    `
      )
      .join('');

    printWindow.document.write(`
      <html dir="rtl">
        <head>
          <title>${isSuppliers ? 'طباعة الموردين' : 'طباعة العملاء'}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 30px; color: #222; }
            h1 { text-align: center; margin-bottom: 10px; }
            p { text-align: center; color: #666; margin-bottom: 30px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: right; }
            th { background: #f5f5f5; }
          </style>
        </head>
        <body>
          <h1>${isSuppliers ? 'قائمة الموردين' : 'قائمة العملاء'}</h1>
          <p>تاريخ الطباعة: ${formatAppDateTime()}</p>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>الاسم</th>
                <th>الهاتف</th>
                <th>العنوان</th>
                <th>الرصيد</th>
                <th>الرصيد بالدولار</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
          <script>
            window.onload = () => { window.print(); };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  const getStatementPerson = () => {
    if (!statementData) return null;

    return isSuppliers
      ? (statementData as SupplierStatementResponse).supplier
      : (statementData as CustomerStatementResponse).customer;
  };

  const getStatementTransactions = (): AccountTransaction[] => {
    if (!statementData) return [];
    return statementData.transactions || [];
  };

  const exportStatementToExcel = () => {
    if (!statementData) return;

    const person = getStatementPerson();
    if (!person) return;

    const rows = getStatementTransactions().map((row, index) => ({
      '#': index + 1,
      'النوع':
        row.transaction_type === 'sale'
          ? 'مبيع'
          : row.transaction_type === 'purchase'
          ? 'شراء'
          : row.transaction_type === 'payment'
          ? 'تسديد'
          : 'تعديل',
      'المرجع': getTransactionReferenceLabel(row),
      'التاريخ': formatAppDateTime(row.created_at),
      'عليه': row.debit_amount > 0 ? formatMoney(Number(row.debit_amount || 0)) : '',
      'له': row.credit_amount > 0 ? formatMoney(Number(row.credit_amount || 0)) : '',
      'الرصيد بعد الحركة': formatMoney(Number(row.balance_after || 0)),
      'المبلغ الأصلي':
        row.amount_original != null
          ? `${Number(row.amount_original).toLocaleString('en-US', {
              minimumFractionDigits: row.currency_code === 'SYP' ? 0 : 2,
              maximumFractionDigits: row.currency_code === 'SYP' ? 0 : 2
            })} ${getCurrencySymbol((row.currency_code as CurrencyCode) || 'USD')}`
          : '',
      'الملاحظة': row.note || '',
      'المستخدم': row.user_name || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Statement');
    XLSX.writeFile(
      workbook,
      `${isSuppliers ? 'supplier' : 'customer'}_statement_${person.name}_${new Date()
        .toISOString()
        .split('T')[0]}.xlsx`
    );
  };

  const printStatement = () => {
    if (!statementData) return;

    const person = getStatementPerson();
    if (!person) return;

    const totals = statementData.totals;

    const rows = getStatementTransactions()
      .map(
        (row) => `
          <tr>
            <td>${
              row.transaction_type === 'sale'
                ? 'مبيع'
                : row.transaction_type === 'purchase'
                ? 'شراء'
                : row.transaction_type === 'payment'
                ? 'تسديد'
                : 'تعديل'
            }</td>
            <td>${getTransactionReferenceLabel(row)}</td>
            <td>${formatAppDateTime(row.created_at)}</td>
            <td>${row.debit_amount > 0 ? formatMoney(Number(row.debit_amount || 0)) : '-'}</td>
            <td>${row.credit_amount > 0 ? formatMoney(Number(row.credit_amount || 0)) : '-'}</td>
            <td>${formatMoney(Number(row.balance_after || 0))}</td>
            <td>${
              row.amount_original != null
                ? `${Number(row.amount_original).toLocaleString('en-US', {
                    minimumFractionDigits: row.currency_code === 'SYP' ? 0 : 2,
                    maximumFractionDigits: row.currency_code === 'SYP' ? 0 : 2
                  })} ${getCurrencySymbol((row.currency_code as CurrencyCode) || 'USD')}`
                : '-'
            }</td>
            <td>${row.note || '-'}</td>
            <td>${row.user_name || '-'}</td>
          </tr>
        `
      )
      .join('');

    const printWindow = window.open('', '', 'width=1200,height=850');
    if (!printWindow) return;

    printWindow.document.write(`
      <html dir="rtl">
        <head>
          <title>كشف الحساب</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 30px; color: #222; }
            h1 { text-align: center; margin-bottom: 8px; }
            .meta { text-align: center; color: #666; margin-bottom: 25px; }
            .card-wrap { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 25px; }
            .card { border: 1px solid #ddd; border-radius: 12px; padding: 14px; }
            .label { color: #777; font-size: 12px; margin-bottom: 6px; }
            .value { font-size: 18px; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: right; }
            th { background: #f5f5f5; }
          </style>
        </head>
        <body>
          <h1>كشف حساب ${isSuppliers ? 'المورد' : 'العميل'}</h1>
          <div class="meta">
            ${person.name} - ${person.phone} - ${person.address}<br />
            تاريخ الطباعة: ${formatAppDateTime()}
          </div>

          <div class="card-wrap">
            <div class="card">
              <div class="label">${isSuppliers ? 'إجمالي المشتريات' : 'إجمالي المبيعات'}</div>
              <div class="value">${formatMoney(
                Number(isSuppliers ? totals.total_purchases || 0 : totals.total_sales || 0)
              )}</div>
            </div>
            <div class="card">
              <div class="label">عدد الفواتير</div>
              <div class="value">${Number(
                isSuppliers ? totals.purchase_count || 0 : totals.sales_count || 0
              ).toLocaleString('en-US')}</div>
            </div>
            <div class="card">
              <div class="label">إجمالي التسديدات</div>
              <div class="value">${formatMoney(Number(totals.total_paid || 0))}</div>
            </div>
            <div class="card">
              <div class="label">عدد مرات التسديد</div>
              <div class="value">${Number(totals.payments_count || 0).toLocaleString('en-US')}</div>
            </div>
            <div class="card">
              <div class="label">الرصيد الحالي</div>
              <div class="value">${formatMoney(Number(totals.current_balance || 0))}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>النوع</th>
                <th>المرجع</th>
                <th>التاريخ</th>
                <th>عليه</th>
                <th>له</th>
                <th>الرصيد بعد الحركة</th>
                <th>المبلغ الأصلي</th>
                <th>ملاحظة</th>
                <th>المستخدم</th>
              </tr>
            </thead>
            <tbody>
              ${rows || `<tr><td colspan="9">لا توجد حركات</td></tr>`}
            </tbody>
          </table>

          <script>
            window.onload = () => { window.print(); };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  const openSettleModal = (item: PersonItem) => {
    setPendingSettleItem(item);
    setSettleAmount('');
    setSettleCurrency(getCurrencyCode());
    setSettleNote('');
    setShowSettleModal(true);
  };

  const closeSettleModal = () => {
    if (settleLoading) return;
    setShowSettleModal(false);
    setPendingSettleItem(null);
    setSettleAmount('');
    setSettleCurrency(getCurrencyCode());
    setSettleNote('');
  };

  const handleSettleDebt = async () => {
    if (!pendingSettleItem) return;

    const amount = parseFloat(settleAmount);

    if (!amount || amount <= 0) {
      showTempMessage('أدخل مبلغًا صحيحًا');
      return;
    }

    const amountInUSD = convertToUSD(amount, settleCurrency);
    const currentBalance = Number(pendingSettleItem.balance || 0);

    

    setSettleLoading(true);
    setActionLoading(pendingSettleItem.id);

    try {
      const res = await fetch(`/api/${type}/${pendingSettleItem.id}/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountInUSD,
          amount_original: amount,
          currency_code: settleCurrency,
          exchange_rate: getRateFromUSD(settleCurrency),
          note: settleNote || `تسديد ${isSuppliers ? 'مورد' : 'عميل'} من شاشة الأشخاص`
        })
      });

      const result = await res.json().catch(() => null);

      if (res.ok) {
        closeSettleModal();
        await fetchData();
        showTempMessage(`تم تسديد ${amount.toLocaleString('en-US')} ${getCurrencySymbol(settleCurrency)} بنجاح`);
      } else {
        showTempMessage(result?.message || 'تعذر تنفيذ عملية التسديد');
      }
    } catch (error) {
      console.error('Error settling debt:', error);
      showTempMessage('حدث خطأ أثناء تنفيذ التسديد');
    } finally {
      setSettleLoading(false);
      setActionLoading(null);
    }
  };
const getBalanceTitle = (balance: number) => {
  const value = Number(balance || 0);

  if (isSuppliers) {
    if (value > 0) return 'له عليك';
    if (value < 0) return 'عليه لك';
    return 'الرصيد الحالي';
  }

  if (value > 0) return 'عليه';
  if (value < 0) return 'له';
  return 'الرصيد الحالي';
};

const getBalanceCardStyle = (balance: number) => {
  const value = Number(balance || 0);

  if (isSuppliers) {
    if (value > 0) {
      return {
        background: 'rgba(244,63,94,0.08)',
        color: '#e11d48',
        borderColor: 'rgba(244,63,94,0.16)',
        iconBackground: 'rgba(244,63,94,0.14)'
      };
    }

    if (value < 0) {
      return {
        background: 'rgba(16,185,129,0.10)',
        color: '#059669',
        borderColor: 'rgba(16,185,129,0.20)',
        iconBackground: 'rgba(16,185,129,0.18)'
      };
    }
  } else {
    if (value > 0) {
      return {
        background: 'rgba(244,63,94,0.08)',
        color: '#e11d48',
        borderColor: 'rgba(244,63,94,0.16)',
        iconBackground: 'rgba(244,63,94,0.14)'
      };
    }

    if (value < 0) {
      return {
        background: 'rgba(16,185,129,0.10)',
        color: '#059669',
        borderColor: 'rgba(16,185,129,0.20)',
        iconBackground: 'rgba(16,185,129,0.18)'
      };
    }
  }

  return {
    background: 'var(--theme-primary-soft)',
    color: 'var(--theme-primary)',
    borderColor: 'var(--theme-primary-soft-2)',
    iconBackground: 'var(--theme-primary-soft-2)'
  };
};

const getSettlePreviewBeneficiaryLabel = () => {
  return isSuppliers ? 'المورد' : 'العميل';
};

  const filteredData = data.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) || item.phone.includes(searchQuery)
  );

  const getTransactionTypeLabel = (typeValue: AccountTransaction['transaction_type']) => {
    switch (typeValue) {
      case 'sale':
        return 'مبيع';
      case 'purchase':
        return 'شراء';
      case 'payment':
        return 'تسديد';
      case 'adjustment':
      default:
        return 'تعديل';
    }
  };
const getTransactionReferenceLabel = (row: AccountTransaction) => {
  const referenceId = row.reference_id ? `#${row.reference_id}` : '';

  if (row.transaction_type === 'sale') {
    return referenceId ? `فاتورة مبيعات رقم ${referenceId}` : 'فاتورة مبيعات';
  }

  if (row.transaction_type === 'purchase') {
    return referenceId ? `فاتورة شراء رقم ${referenceId}` : 'فاتورة شراء';
  }

  if (row.transaction_type === 'payment') {
    return referenceId ? `سند تسديد رقم ${referenceId}` : 'تسديد يدوي';
  }

  if (row.transaction_type === 'adjustment') {
    return referenceId ? `تعديل رقم ${referenceId}` : 'تعديل يدوي';
  }

  return referenceId || '-';
};
  return (
    <div className="space-y-10" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="relative flex-1 max-w-xl group">
          <Search
            className="absolute right-5 top-1/2 -translate-y-1/2 app-text-muted transition-colors"
            size={22}
            style={{ color: 'var(--text-muted)' }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`ابحث عن ${isSuppliers ? 'مورد' : 'عميل'}...`}
            className="w-full app-card border rounded-[2rem] py-4 pr-14 pl-6 outline-none transition-all font-bold app-text shadow-sm"
            style={{ borderColor: 'var(--border-color)' }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={exportPeopleExcel}
            className="app-card border app-text font-black py-4 px-6 rounded-[1.5rem] shadow-sm flex items-center gap-3 transition-all active:scale-95"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <Download size={18} strokeWidth={2.5} />
            تصدير Excel
          </button>

          <button
            onClick={printPeople}
            className="app-card border app-text font-black py-4 px-6 rounded-[1.5rem] shadow-sm flex items-center gap-3 transition-all active:scale-95"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <Printer size={18} strokeWidth={2.5} />
            طباعة {isSuppliers ? 'الموردين' : 'العملاء'}
          </button>

          <button
            onClick={() => {
              setEditingItem(null);
              setFormData({ name: '', phone: '', address: '' });
              setShowForm(true);
            }}
            className="text-white font-black py-4 px-10 rounded-[1.5rem] shadow-xl flex items-center gap-3 transition-all active:scale-95 group"
            style={{ background: 'var(--theme-primary)' }}
          >
            <Plus size={20} strokeWidth={3} className="group-hover:rotate-90 transition-transform duration-300" />
            إضافة {isSuppliers ? 'مورد' : 'عميل'} جديد
          </button>
        </div>
      </div>

      {message && (
        <div
          className="px-5 py-4 rounded-2xl font-black text-sm border"
          style={{
            background: 'var(--theme-primary-soft)',
            borderColor: 'var(--theme-primary-soft-2)',
            color: 'var(--theme-primary)'
          }}
        >
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {loading ? (
          <div className="col-span-full py-32 text-center">
            <div className="flex flex-col items-center gap-4 app-text-muted">
              <div
                className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: 'var(--theme-primary)', borderTopColor: 'transparent' }}
              />
              <p className="text-sm font-black uppercase tracking-widest">جاري التحميل...</p>
            </div>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="col-span-full py-32 text-center">
            <div className="flex flex-col items-center gap-4 app-text-muted opacity-60">
              {isSuppliers ? <Truck size={80} strokeWidth={1} /> : <UserCircle size={80} strokeWidth={1} />}
              <p className="text-sm font-black uppercase tracking-widest">لا توجد بيانات لعرضها</p>
            </div>
          </div>
        ) : (
          filteredData.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="app-card p-8 rounded-[2.5rem] border shadow-sm hover:shadow-2xl transition-all duration-500 group relative overflow-hidden"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <div
                className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-16 -mt-16 transition-all duration-700"
                style={{ background: isSuppliers ? 'rgba(59,130,246,0.08)' : 'var(--theme-primary-soft)' }}
              />

              <div className="relative z-10">
                <div className="flex items-start justify-between mb-8">
                  <div className="flex items-center gap-5">
                    <div
                      className="w-16 h-16 rounded-[1.5rem] flex items-center justify-center shadow-lg transition-all duration-500 group-hover:scale-110"
                      style={
                        isSuppliers
                          ? { background: 'rgba(59,130,246,0.10)', color: '#2563eb' }
                          : { background: 'var(--theme-primary-soft)', color: 'var(--theme-primary)' }
                      }
                    >
                      {isSuppliers ? <Truck size={32} strokeWidth={2.5} /> : <UserCircle size={32} strokeWidth={2.5} />}
                    </div>
                    <div>
                      <h3 className="font-black app-text text-xl tracking-tight mb-1">{item.name}</h3>
                      <div className="flex items-center gap-2 app-text-muted">
                        <Phone size={14} strokeWidth={2.5} />
                        <span className="text-xs font-bold tracking-wider">{item.phone}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-4 group-hover:translate-x-0">
                    <button
                      onClick={() => handleViewStatement(item)}
                      className="w-10 h-10 flex items-center justify-center rounded-xl transition-all border shadow-sm"
                      style={{
                        color: 'var(--theme-primary)',
                        background: 'transparent',
                        borderColor: 'transparent'
                      }}
                      title="كشف الحساب"
                    >
                      <Eye size={16} strokeWidth={2.5} />
                    </button>

                    <button
                      onClick={() => openSettleModal(item)}
                      disabled={actionLoading === item.id}
                      className="w-10 h-10 flex items-center justify-center text-emerald-600 rounded-xl transition-all border shadow-sm disabled:opacity-50"
                      style={{ borderColor: 'transparent' }}
                      title="وفي الدين"
                    >
                      <HandCoins size={16} strokeWidth={2.5} />
                    </button>

                    <button
                      onClick={() => handleEdit(item)}
                      className="w-10 h-10 flex items-center justify-center text-blue-500 rounded-xl transition-all border shadow-sm"
                      style={{ borderColor: 'transparent' }}
                      title="تعديل"
                    >
                      <Edit2 size={16} strokeWidth={2.5} />
                    </button>

                    <button
                      onClick={() => handleDelete(item)}
                      disabled={actionLoading === item.id}
                      className="w-10 h-10 flex items-center justify-center text-rose-500 rounded-xl transition-all border shadow-sm disabled:opacity-50"
                      style={{ borderColor: 'transparent' }}
                      title="حذف"
                    >
                      <Trash2 size={16} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>

                <div className="space-y-6">
                  <div
                    className="flex items-center gap-4 text-sm font-bold p-4 rounded-2xl border"
                    style={{
                      color: 'var(--text-muted)',
                      background: 'var(--muted-bg)',
                      borderColor: 'var(--border-color)'
                    }}
                  >
                    <MapPin size={18} strokeWidth={2.5} />
                    <span className="truncate">{item.address}</span>
                  </div>

                  <div
                    className="p-6 rounded-[1.5rem] flex items-center justify-between border transition-all duration-500"
                   style={{
  background: getBalanceCardStyle(Number(item.balance || 0)).background,
  color: getBalanceCardStyle(Number(item.balance || 0)).color,
  borderColor: getBalanceCardStyle(Number(item.balance || 0)).borderColor
}}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{
  background: getBalanceCardStyle(Number(item.balance || 0)).iconBackground
}}
                      >
                        <Wallet size={20} strokeWidth={2.5} />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest">
  {getBalanceTitle(Number(item.balance || 0))}
</span>
                    </div>

                    <div className="text-left">
                      <div className="text-xl font-black tracking-tight">
                        {formatMoney(Number(item.balance || 0))}
                      </div>
                      {showUsd && (
                        <div className="text-[10px] font-black uppercase tracking-widest opacity-60">
                          {formatMoney(Number(item.balance || 0), 'USD')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8">
                  <button
                    onClick={() => handleViewStatement(item)}
                    className="w-full py-4 text-[15px] font-black rounded-2xl transition-all border"
                    style={{
                      color: 'white',
                      background: 'var(--theme-primary)',
                      borderColor: 'transparent'
                    }}
                  >
                    عرض كشف الحساب
                  </button>

                  <button
                    onClick={() => openSettleModal(item)}
                    disabled={actionLoading === item.id}
                    className="w-full py-4 text-[15px] font-black rounded-2xl transition-all border disabled:opacity-50"
                    style={{
                      color: 'var(--theme-primary)',
                      background: 'var(--theme-primary-soft)',
                      borderColor: 'var(--theme-primary-soft-2)'
                    }}
                  >
                    وفي الدين
                  </button>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="app-card w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <div
                className="p-8 border-b flex items-center justify-between"
                style={{ borderColor: 'var(--border-color)', background: 'var(--muted-bg)' }}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm"
                    style={
                      isSuppliers
                        ? { background: 'rgba(59,130,246,0.10)', color: '#2563eb' }
                        : { background: 'var(--theme-primary-soft)', color: 'var(--theme-primary)' }
                    }
                  >
                    {isSuppliers ? <Truck size={24} strokeWidth={2.5} /> : <UserCircle size={24} strokeWidth={2.5} />}
                  </div>
                  <h2 className="text-xl font-black app-text tracking-tight">
                    {editingItem ? 'تعديل' : 'إضافة'} {isSuppliers ? 'مورد' : 'عميل'}
                  </h2>
                </div>

                <button
                  onClick={() => setShowForm(false)}
                  className="w-10 h-10 flex items-center justify-center rounded-full transition-all app-text-muted"
                  style={{ background: 'transparent' }}
                >
                  <Plus className="rotate-45" size={24} strokeWidth={2.5} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-10 space-y-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black app-text-muted uppercase tracking-widest mr-2">
                    الاسم الكامل
                  </label>
                  <div className="relative group">
                    <User className="absolute right-5 top-1/2 -translate-y-1/2 app-text-muted transition-colors" size={22} />
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full app-muted border rounded-[1.5rem] py-5 pr-14 pl-6 outline-none transition-all font-bold app-text"
                      style={{ borderColor: 'var(--border-color)' }}
                      placeholder="أدخل الاسم"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black app-text-muted uppercase tracking-widest mr-2">
                    رقم الهاتف
                  </label>
                  <div className="relative group">
                    <Phone className="absolute right-5 top-1/2 -translate-y-1/2 app-text-muted transition-colors" size={22} />
                    <input
                      type="text"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full app-muted border rounded-[1.5rem] py-5 pr-14 pl-6 outline-none transition-all font-bold app-text text-left"
                      style={{ borderColor: 'var(--border-color)' }}
                      placeholder="05xxxxxxxx"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black app-text-muted uppercase tracking-widest mr-2">
                    العنوان
                  </label>
                  <div className="relative group">
                    <MapPin className="absolute right-5 top-1/2 -translate-y-1/2 app-text-muted transition-colors" size={22} />
                    <input
                      type="text"
                      required
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full app-muted border rounded-[1.5rem] py-5 pr-14 pl-6 outline-none transition-all font-bold app-text"
                      style={{ borderColor: 'var(--border-color)' }}
                      placeholder="أدخل العنوان بالتفصيل"
                    />
                  </div>
                </div>

                <div className="pt-6 flex gap-4">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="flex-1 py-5 app-muted app-text font-black rounded-[1.5rem] transition-all active:scale-95 border"
                    style={{ borderColor: 'var(--border-color)' }}
                  >
                    إلغاء
                  </button>

                  <button
                    type="submit"
                    className="flex-1 py-5 text-white font-black rounded-[1.5rem] shadow-xl transition-all active:scale-95"
                    style={{ background: 'var(--theme-primary)' }}
                  >
                    {editingItem ? 'تحديث البيانات' : 'حفظ البيانات'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showStatementModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              className="app-card w-full max-w-6xl rounded-[2.5rem] shadow-2xl overflow-hidden border"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <div
                className="p-6 border-b flex items-center justify-between"
                style={{ borderColor: 'var(--border-color)', background: 'var(--muted-bg)' }}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ background: 'var(--theme-primary-soft)', color: 'var(--theme-primary)' }}
                  >
                    <FileText size={22} strokeWidth={2.5} />
                  </div>

                  <div>
                    <h3 className="font-black app-text">
                      كشف حساب {isSuppliers ? 'المورد' : 'العميل'}
                    </h3>
                    <div className="text-[10px] font-black app-text-muted uppercase tracking-widest">
                      {statementData ? getStatementPerson()?.name : 'جاري التحميل...'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {statementData && (
                    <>
                      <button
                        onClick={exportStatementToExcel}
                        className="text-white font-black py-3 px-5 rounded-2xl flex items-center gap-2"
                        style={{ background: '#16a34a' }}
                      >
                        <Download size={18} strokeWidth={2.5} />
                        Excel
                      </button>

                      <button
                        onClick={printStatement}
                        className="text-white font-black py-3 px-5 rounded-2xl flex items-center gap-2"
                        style={{ background: 'var(--theme-primary)' }}
                      >
                        <Printer size={18} strokeWidth={2.5} />
                        طباعة
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => setShowStatementModal(false)}
                    className="w-10 h-10 flex items-center justify-center app-text-muted rounded-full transition-all"
                  >
                    <X size={20} strokeWidth={2.5} />
                  </button>
                </div>
              </div>

              <div className="p-8 max-h-[80vh] overflow-y-auto custom-scrollbar">
                {statementLoading || !statementData ? (
                  <div className="py-24 text-center app-text-muted font-black">
                    جاري تحميل كشف الحساب...
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
                      <div className="app-muted border rounded-2xl p-5" style={{ borderColor: 'var(--border-color)' }}>
                        <div className="text-[10px] font-black app-text-muted uppercase tracking-widest mb-2">
                          {isSuppliers ? 'إجمالي المشتريات' : 'إجمالي المبيعات'}
                        </div>
                        <div className="text-xl font-black app-text">
                          {formatMoney(
                            Number(
                              isSuppliers
                                ? statementData.totals.total_purchases || 0
                                : statementData.totals.total_sales || 0
                            )
                          )}
                        </div>
                      </div>

                      <div className="app-muted border rounded-2xl p-5" style={{ borderColor: 'var(--border-color)' }}>
                        <div className="text-[10px] font-black app-text-muted uppercase tracking-widest mb-2">
                          عدد الفواتير
                        </div>
                        <div className="text-xl font-black app-text">
                          {Number(
                            isSuppliers
                              ? statementData.totals.purchase_count || 0
                              : statementData.totals.sales_count || 0
                          ).toLocaleString('en-US')}
                        </div>
                      </div>

                      <div className="app-muted border rounded-2xl p-5" style={{ borderColor: 'var(--border-color)' }}>
                        <div className="text-[10px] font-black app-text-muted uppercase tracking-widest mb-2">
                          إجمالي التسديدات
                        </div>
                        <div className="text-xl font-black" style={{ color: 'var(--theme-primary)' }}>
                          {formatMoney(Number(statementData.totals.total_paid || 0))}
                        </div>
                      </div>

                      <div className="app-muted border rounded-2xl p-5" style={{ borderColor: 'var(--border-color)' }}>
                        <div className="text-[10px] font-black app-text-muted uppercase tracking-widest mb-2">
                          مرات التسديد
                        </div>
                        <div className="text-xl font-black app-text">
                          {Number(statementData.totals.payments_count || 0).toLocaleString('en-US')}
                        </div>
                      </div>

                      <div className="app-muted border rounded-2xl p-5" style={{ borderColor: 'var(--border-color)' }}>
                        <div className="text-[10px] font-black app-text-muted uppercase tracking-widest mb-2">
                          الرصيد الحالي
                        </div>
                        <div className="text-xl font-black app-text">
                          {formatMoney(Number(statementData.totals.current_balance || 0))}
                        </div>
                      </div>
                    </div>

                    <div className="app-card rounded-[2rem] border overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
                      <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-right border-collapse">
                          <thead>
                            <tr
                              className="text-[10px] font-black uppercase tracking-[0.2em] border-b"
                              style={{
                                background: 'var(--muted-bg)',
                                color: 'var(--text-muted)',
                                borderColor: 'var(--border-color)'
                              }}
                            >
                              <th className="px-6 py-5">النوع</th>
                              <th className="px-6 py-5">المرجع</th>
                              <th className="px-6 py-5">التاريخ</th>
                              <th className="px-6 py-5">عليه</th>
                              <th className="px-6 py-5">له</th>
                              <th className="px-6 py-5">الرصيد بعد الحركة</th>
                              <th className="px-6 py-5">الأصل</th>
                              <th className="px-6 py-5">ملاحظة</th>
                              <th className="px-6 py-5">المستخدم</th>
                            </tr>
                          </thead>

                          <tbody>
                            {getStatementTransactions().length === 0 ? (
                              <tr>
                                <td colSpan={9} className="px-6 py-8 text-center font-black app-text-muted">
                                  لا توجد حركات على هذا الحساب
                                </td>
                              </tr>
                            ) : (
                              getStatementTransactions().map((row) => (
                                <tr key={row.id} style={{ borderTop: `1px solid var(--border-color)` }}>
                                  <td className="px-6 py-5 font-black app-text">
                                    <div className="flex items-center gap-2">
                                      {row.debit_amount > 0 ? (
                                        <ArrowUpCircle size={16} className="text-rose-500" />
                                      ) : (
                                        <ArrowDownCircle size={16} style={{ color: 'var(--theme-primary)' }} />
                                      )}
                                      {getTransactionTypeLabel(row.transaction_type)}
                                    </div>
                                  </td>

                                 <td className="px-6 py-5 text-sm font-bold app-text-muted">
  <div className="flex items-center gap-2">
    <Hash size={14} />
    <span>{getTransactionReferenceLabel(row)}</span>
  </div>
</td>

                                  <td className="px-6 py-5 text-sm font-bold app-text-muted">
                                   {formatAppDateTime(row.created_at)}
                                  </td>

                                  <td className="px-6 py-5 font-black text-rose-600">
                                    {row.debit_amount > 0 ? formatMoney(Number(row.debit_amount || 0)) : '-'}
                                  </td>

                                  <td className="px-6 py-5 font-black" style={{ color: 'var(--theme-primary)' }}>
                                    {row.credit_amount > 0 ? formatMoney(Number(row.credit_amount || 0)) : '-'}
                                  </td>

                                  <td className="px-6 py-5 font-black app-text">
                                    {formatMoney(Number(row.balance_after || 0))}
                                  </td>

                                  <td className="px-6 py-5 text-sm font-bold app-text-muted">
                                    {row.amount_original != null
                                      ? `${Number(row.amount_original).toLocaleString('en-US', {
                                          minimumFractionDigits: row.currency_code === 'SYP' ? 0 : 2,
                                          maximumFractionDigits: row.currency_code === 'SYP' ? 0 : 2
                                        })} ${getCurrencySymbol((row.currency_code as CurrencyCode) || 'USD')}`
                                      : '-'}
                                  </td>

                                  <td className="px-6 py-5 text-sm font-bold app-text-muted">
                                    {row.note || '-'}
                                  </td>

                                  <td className="px-6 py-5 text-sm font-bold app-text-muted">
                                    {row.user_name || '-'}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {showDeleteConfirm && pendingDeleteItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={closeDeleteConfirm} />

          <div className="relative w-full max-w-md rounded-[2rem] bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-black text-slate-900">تأكيد الحذف</h3>
              <button
                type="button"
                onClick={closeDeleteConfirm}
                className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-5">
              <p className="text-sm font-bold text-slate-600 leading-7">
                هل أنت متأكد من حذف {isSuppliers ? 'المورد' : 'العميل'} "{pendingDeleteItem.name}"؟
              </p>

              <div className="flex gap-4 pt-2">
                <button
                  type="button"
                  onClick={closeDeleteConfirm}
                  disabled={!!actionLoading}
                  className="flex-1 py-4 bg-slate-100 text-slate-700 font-black rounded-[1rem] disabled:opacity-50"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete()}
                  disabled={!!actionLoading}
                  className="flex-1 py-4 bg-rose-600 text-white font-black rounded-[1rem] disabled:opacity-50"
                >
                  {actionLoading ? 'جارٍ الحذف...' : 'تأكيد الحذف'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showSettleModal && pendingSettleItem && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={closeSettleModal}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              className="relative w-full max-w-md app-card rounded-[2rem] shadow-2xl border overflow-hidden"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <div
                className="p-6 border-b flex items-center justify-between"
                style={{ borderColor: 'var(--border-color)', background: 'var(--muted-bg)' }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ background: 'var(--theme-primary-soft)', color: 'var(--theme-primary)' }}
                  >
                    <HandCoins size={22} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black app-text">وفي الدين</h3>
                    <p className="text-xs font-bold app-text-muted">{pendingSettleItem.name}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={closeSettleModal}
                  className="w-10 h-10 flex items-center justify-center rounded-full app-text-muted"
                >
                  <X size={20} strokeWidth={2.5} />
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div
                  className="rounded-2xl border p-4"
                  style={{
                    borderColor: 'var(--border-color)',
                    background: 'var(--muted-bg)'
                  }}
                >
                  <div className="text-[10px] font-black uppercase tracking-widest app-text-muted mb-2">
                    الرصيد الحالي
                  </div>
                  <div className="text-xl font-black app-text">
                    {formatMoney(Number(pendingSettleItem.balance || 0))}
                  </div>
                  {showUsd && (
                    <div className="text-xs font-bold app-text-muted mt-1">
                      {formatMoney(Number(pendingSettleItem.balance || 0), 'USD')}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black app-text-muted">المبلغ</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    lang="en"
                    dir="ltr"
                    value={settleAmount}
                    onChange={(e) => setSettleAmount(normalizeDigits(e.target.value))}
                    placeholder="أدخل مبلغ التسديد"
                    className="w-full app-muted border rounded-[1.2rem] py-4 px-4 outline-none font-bold app-text"
                    style={{ borderColor: 'var(--border-color)' }}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black app-text-muted">العملة</label>
                  <select
                    value={settleCurrency}
                    onChange={(e) => setSettleCurrency(e.target.value as CurrencyCode)}
                    className="w-full app-muted border rounded-[1.2rem] py-4 px-4 outline-none font-bold app-text"
                    style={{ borderColor: 'var(--border-color)' }}
                  >
                    <option value="USD">دولار ($)</option>
                    <option value="SYP">ليرة سورية (ل.س)</option>
                    <option value="TRY">تركي (TL)</option>
                    <option value="SAR">ريال سعودي (ر.س)</option>
                    <option value="AED">درهم إماراتي (د.إ)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black app-text-muted">ملاحظة</label>
                  <textarea
                    value={settleNote}
                    onChange={(e) => setSettleNote(e.target.value)}
                    placeholder="مثال: دفعة أولى، دفعة ثانية..."
                    className="w-full app-muted border rounded-[1.2rem] py-4 px-4 outline-none font-bold app-text min-h-[90px] resize-none"
                    style={{ borderColor: 'var(--border-color)' }}
                  />
                </div>

               {!!settleAmount && parseFloat(settleAmount) > 0 && (
  <div
    className="rounded-2xl border p-4 text-sm"
    style={{
      borderColor: 'var(--theme-primary-soft-2)',
      background: 'var(--theme-primary-soft)',
      color: 'var(--theme-primary)'
    }}
  >
    {(() => {
      const enteredAmountInUSD = convertToUSD(parseFloat(settleAmount || '0'), settleCurrency);
      const currentBalance = Number(pendingSettleItem.balance || 0);
      const nextBalance = currentBalance - enteredAmountInUSD;

      return (
        <>
          <div>
            سيتم تسجيل تسديد بقيمة:
            <span className="font-black mx-1">
              {formatMoney(enteredAmountInUSD)}
            </span>
          </div>

          <div className="mt-2">
            الرصيد بعد الحركة:
            <span className="font-black mx-1">
              {formatMoney(nextBalance)}
            </span>
          </div>

          {nextBalance < 0 && (
  <div className="mt-2 font-black">
    سيكون هناك رصيد لصالح {getSettlePreviewBeneficiaryLabel()} بقيمة:
    <span className="mx-1">{formatMoney(Math.abs(nextBalance))}</span>
  </div>
)}
        </>
      );
    })()}
  </div>
)}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeSettleModal}
                    disabled={settleLoading}
                    className="flex-1 py-4 rounded-[1rem] font-black border app-text disabled:opacity-50"
                    style={{ borderColor: 'var(--border-color)' }}
                  >
                    إلغاء
                  </button>

                  <button
                    type="button"
                    onClick={handleSettleDebt}
                    disabled={settleLoading}
                    className="flex-1 py-4 rounded-[1rem] font-black text-white disabled:opacity-50"
                    style={{ background: 'var(--theme-primary)' }}
                  >
                    {settleLoading ? 'جارٍ الحفظ...' : 'تأكيد التسديد'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default People;