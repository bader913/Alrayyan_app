import React, { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { customersApi, type Customer, type CustomerTransaction } from '../api/customers.ts';
import { settingsApi } from '../api/settings.ts';
import { useCurrency } from '../hooks/useCurrency.ts';
import { useDebounce } from '../hooks/useDebounce.ts';
import { Users, Plus, Search, Eye, CreditCard, X, ChevronLeft, ChevronRight, Edit2, Filter, Info } from 'lucide-react';

const CURRENCIES = [
  { code: 'USD', label: 'دولار أمريكي',   symbol: '$',    rateKey: '' },
  { code: 'SYP', label: 'ليرة سورية',     symbol: 'ل.س',  rateKey: 'usd_to_syp' },
  { code: 'TRY', label: 'ليرة تركية',     symbol: 'TL',    rateKey: 'usd_to_try' },
  { code: 'SAR', label: 'ريال سعودي',     symbol: 'ر.س',  rateKey: 'usd_to_sar' },
];

function getRateFromSettings(settings: Record<string, string> | undefined, currCode: string): number {
  if (currCode === 'USD' || !settings) return 1;
  const key = CURRENCIES.find(c => c.code === currCode)?.rateKey ?? '';
  return parseFloat(settings[key] ?? '1') || 1;
}

const fmtDate = (d: string) => new Date(d).toLocaleDateString('ar-EG-u-nu-latn', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

const TX_LABELS: Record<string, string> = { sale: 'بيع', payment: 'دفعة', return: 'مرتجع', adjustment: 'تعديل' };
const TX_COLOR: Record<string, string>  = { sale: 'text-red-400', payment: 'text-green-400', return: 'text-blue-400', adjustment: 'text-yellow-400' };
const TYPE_LABELS: Record<string, string> = { retail: 'تجزئة', wholesale: 'جملة' };

export default function CustomersPage() {
  const { fmt } = useCurrency();
  const { data: settingsData } = useQuery({
    queryKey: ['settings'],
    queryFn:  () => settingsApi.getAll().then(r => r.data.settings),
    staleTime: 30_000,
  });
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch]       = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading]     = useState(true);

  const [showForm, setShowForm]     = useState(false);
  const [editTarget, setEditTarget] = useState<Customer | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', address: '', customer_type: 'retail', credit_limit: '0', notes: '' });
  const [formErr, setFormErr] = useState('');
  const [saving, setSaving]   = useState(false);

  const [accountModal, setAccountModal] = useState<{ customer: Customer; transactions: CustomerTransaction[]; total: number; page: number } | null>(null);
  const [acctLoading, setAcctLoading]   = useState(false);

  const [payModal, setPayModal]   = useState<Customer | null>(null);
  const [payForm, setPayForm]     = useState({ amount: '', currency_code: 'USD', exchange_rate: '1', note: '' });
  const [payErr, setPayErr]       = useState('');
  const [payLoading, setPayLoading] = useState(false);

  const debouncedSearch = useDebounce(search, 300);

  const loadCustomers = useCallback(async (q = search, type = typeFilter) => {
    setLoading(true);
    try {
      const res = await customersApi.list({ q: q || undefined, type: type || undefined, limit: 50 });
      setCustomers(res.data.customers);
    } catch { /* ignore */ }
    setLoading(false);
  }, [search, typeFilter]);

  useEffect(() => { loadCustomers('', ''); }, []);

  useEffect(() => {
    loadCustomers(debouncedSearch, typeFilter);
  }, [debouncedSearch, typeFilter]);

  const openAccount = async (c: Customer, page = 1) => {
    setAcctLoading(true);
    setAccountModal({ customer: c, transactions: [], total: 0, page });
    try {
      const res = await customersApi.getAccount(c.id, page);
      setAccountModal({ customer: res.data.customer, transactions: res.data.transactions, total: res.data.total, page: res.data.page });
    } catch { /* ignore */ }
    setAcctLoading(false);
  };

  const openForm = (c?: Customer) => {
    setEditTarget(c ?? null);
    setForm({
      name: c?.name ?? '', phone: c?.phone ?? '', address: c?.address ?? '',
      customer_type: c?.customer_type ?? 'retail',
      credit_limit: c?.credit_limit ? String(parseFloat(c.credit_limit)) : '0',
      notes: c?.notes ?? '',
    });
    setFormErr('');
    setShowForm(true);
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormErr('');
    try {
      const payload = {
        name: form.name, phone: form.phone || undefined, address: form.address || undefined,
        customer_type: form.customer_type, credit_limit: parseFloat(form.credit_limit) || 0,
        notes: form.notes || undefined,
      };
      if (editTarget) await customersApi.update(editTarget.id, payload);
      else await customersApi.create(payload);
      setShowForm(false);
      loadCustomers(search, typeFilter);
    } catch (err: unknown) {
      setFormErr((err as { message?: string }).message ?? 'حدث خطأ');
    }
    setSaving(false);
  };

  const openPay = (c: Customer) => {
    setPayModal(c);
    const rate = getRateFromSettings(settingsData, 'USD');
    setPayForm({ amount: '', currency_code: 'USD', exchange_rate: String(rate), note: '' });
    setPayErr('');
  };

  const handlePayCurrencyChange = (code: string) => {
    const rate = getRateFromSettings(settingsData, code);
    setPayForm(p => ({ ...p, currency_code: code, exchange_rate: String(rate) }));
  };

  const submitPay = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(payForm.amount);
    if (!amt || amt <= 0) { setPayErr('أدخل مبلغاً صحيحاً'); return; }
    setPayLoading(true);
    setPayErr('');
    try {
      await customersApi.addPayment(payModal!.id, {
        amount: amt,
        currency_code: payForm.currency_code,
        exchange_rate: parseFloat(payForm.exchange_rate) || 1,
        note: payForm.note || undefined,
      });
      setPayModal(null);
      loadCustomers(search, typeFilter);
      if (accountModal && accountModal.customer.id === payModal!.id) {
        openAccount({ ...payModal! }, accountModal.page);
      }
    } catch (err: unknown) {
      setPayErr((err as { message?: string }).message ?? 'حدث خطأ');
    }
    setPayLoading(false);
  };

  const totalDebt = customers.reduce((s, c) => s + parseFloat(c.balance), 0);

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="w-7 h-7 text-purple-400" />
          <h1 className="text-2xl font-bold text-white">العملاء</h1>
        </div>
        <button onClick={() => openForm()}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold px-4 py-2 rounded-lg transition">
          <Plus className="w-4 h-4" /> عميل جديد
        </button>
      </div>

      {/* Summary Card */}
      {totalDebt > 0 && (
        <div className="rounded-xl p-4" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)' }}>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>إجمالي الديون المستحقة من العملاء</p>
          <p className="text-2xl font-bold mt-1" style={{ color: '#ef4444' }}>{fmt(totalDebt)}</p>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو الهاتف..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pr-10 pl-4 py-2 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-purple-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select value={typeFilter}
            onChange={e => { setTypeFilter(e.target.value); loadCustomers(search, e.target.value); }}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500">
            <option value="">الكل</option>
            <option value="retail">تجزئة</option>
            <option value="wholesale">جملة</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-700/60 text-slate-300 text-right">
              <th className="px-4 py-3">العميل</th>
              <th className="px-4 py-3">الهاتف</th>
              <th className="px-4 py-3">النوع</th>
              <th className="px-4 py-3 text-left">حد الائتمان</th>
              <th className="px-4 py-3 text-left">الرصيد المستحق</th>
              <th className="px-4 py-3 text-center">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-12 text-slate-500">جاري التحميل...</td></tr>
            ) : customers.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-slate-500">لا يوجد عملاء</td></tr>
            ) : customers.map(c => (
              <tr key={c.id} className="border-t border-slate-700 hover:bg-slate-750 transition">
                <td className="px-4 py-3">
                  <button onClick={() => openAccount(c)} className="font-medium text-blue-600 hover:text-blue-500 hover:underline transition text-right">
                    {c.name}
                  </button>
                </td>
                <td className="px-4 py-3 text-slate-300">{c.phone ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.customer_type === 'wholesale' ? 'bg-blue-900/40 text-blue-400' : 'bg-slate-700 text-slate-300'}`}>
                    {TYPE_LABELS[c.customer_type]}
                  </span>
                </td>
                <td className="px-4 py-3 text-left text-slate-300">{fmt(c.credit_limit)}</td>
                <td className="px-4 py-3 text-left">
                  {(() => {
                    const b = parseFloat(String(c.balance)) || 0;
                    return b > 0
                      ? <span className="text-red-400 font-semibold">{fmt(b)}<span className="text-xs text-red-500 mr-1">(دين)</span></span>
                      : b < 0
                        ? <span className="text-green-400 font-semibold">{fmt(Math.abs(b))}<span className="text-xs text-green-600 mr-1">(بذمتنا)</span></span>
                        : <span className="text-slate-500">—</span>;
                  })()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-2">
                    <button onClick={() => openAccount(c)} title="سجل الحساب"
                      className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded transition">
                      <Eye className="w-4 h-4" />
                    </button>
                    {(parseFloat(String(c.balance)) || 0) !== 0 && (
                      <button onClick={() => openPay(c)} title="تسجيل دفعة"
                        className="p-1.5 text-slate-400 hover:text-green-400 hover:bg-slate-700 rounded transition">
                        <CreditCard className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => openForm(c)} title="تعديل"
                      className="p-1.5 text-slate-400 hover:text-purple-400 hover:bg-slate-700 rounded transition">
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Account Modal */}
      {accountModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-700">
              <div>
                <h2 className="text-lg font-bold text-white">حساب: {accountModal.customer.name}</h2>
                <div className="flex gap-4 mt-0.5 text-sm">
                  <span className="text-slate-400">الرصيد: {(() => {
                    const b = parseFloat(String(accountModal.customer.balance)) || 0;
                    return b > 0
                      ? <span className="text-red-400 font-bold">{fmt(b)} (دين)</span>
                      : b < 0
                        ? <span className="text-green-400 font-bold">{fmt(Math.abs(b))} (بذمتنا)</span>
                        : <span className="text-slate-400 font-bold">لا يوجد رصيد</span>;
                  })()}</span>
                  <span className="text-slate-400">حد الائتمان:
                    <span className="text-slate-300"> {fmt(accountModal.customer.credit_limit)}</span>
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {(parseFloat(String(accountModal.customer.balance)) || 0) !== 0 && (
                  <button onClick={() => { setAccountModal(null); openPay(accountModal.customer); }}
                    className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm px-3 py-1.5 rounded-lg transition">
                    <CreditCard className="w-4 h-4" /> دفعة
                  </button>
                )}
                <button onClick={() => setAccountModal(null)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {acctLoading ? (
                <p className="text-center text-slate-500 py-10">جاري التحميل...</p>
              ) : accountModal.transactions.length === 0 ? (
                <p className="text-center text-slate-500 py-10">لا توجد حركات لهذا العميل</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-400 text-right border-b border-slate-700">
                      <th className="pb-2">التاريخ</th>
                      <th className="pb-2">النوع</th>
                      <th className="pb-2 text-left">مدين</th>
                      <th className="pb-2 text-left">دائن</th>
                      <th className="pb-2 text-left">الرصيد</th>
                      <th className="pb-2">ملاحظة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accountModal.transactions.map(tx => (
                      <tr key={tx.id} className="border-t border-slate-800">
                        <td className="py-2 text-slate-400 text-xs">{fmtDate(tx.created_at)}</td>
                        <td className={`py-2 font-medium ${TX_COLOR[tx.transaction_type] ?? 'text-slate-300'}`}>
                          {TX_LABELS[tx.transaction_type] ?? tx.transaction_type}
                        </td>
                        <td className="py-2 text-left text-red-300">{parseFloat(tx.debit_amount) > 0 ? fmt(tx.debit_amount) : '—'}</td>
                        <td className="py-2 text-left text-green-300">{parseFloat(tx.credit_amount) > 0 ? fmt(tx.credit_amount) : '—'}</td>
                        <td className="py-2 text-left text-white font-medium">{fmt(tx.balance_after)}</td>
                        <td className="py-2 text-slate-400 text-xs max-w-xs truncate">{tx.note ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {accountModal.total > 30 && (
              <div className="flex items-center justify-between p-4 border-t border-slate-700">
                <span className="text-sm text-slate-400">
                  صفحة {accountModal.page} من {Math.ceil(accountModal.total / 30)}
                </span>
                <div className="flex gap-2">
                  <button disabled={accountModal.page <= 1}
                    onClick={() => openAccount(accountModal.customer, accountModal.page - 1)}
                    className="p-1.5 rounded bg-slate-700 disabled:opacity-40 hover:bg-slate-600 transition">
                    <ChevronRight className="w-4 h-4 text-white" />
                  </button>
                  <button disabled={accountModal.page >= Math.ceil(accountModal.total / 30)}
                    onClick={() => openAccount(accountModal.customer, accountModal.page + 1)}
                    className="p-1.5 rounded bg-slate-700 disabled:opacity-40 hover:bg-slate-600 transition">
                    <ChevronLeft className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {payModal && (() => {
        const currBalance  = parseFloat(String(payModal.balance)) || 0;
        const payAmt       = parseFloat(payForm.amount) || 0;
        const rate         = parseFloat(payForm.exchange_rate) || 1;
        const amtUSD       = payForm.currency_code === 'USD' ? payAmt : (rate > 0 ? payAmt / rate : 0);
        const newBalance   = currBalance - amtUSD;
        const currSym      = CURRENCIES.find(c => c.code === payForm.currency_code)?.symbol ?? payForm.currency_code;
        const isOverpaid   = newBalance < 0;
        return (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" dir="rtl">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md">
              <div className="flex items-center justify-between p-5 border-b border-slate-700">
                <h2 className="text-lg font-bold text-white">تسجيل دفعة — {payModal.name}</h2>
                <button onClick={() => setPayModal(null)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={submitPay} className="p-5 space-y-4">

                {/* Current balance */}
                <div
                  className="rounded-lg p-3 text-sm flex justify-between items-center"
                  style={currBalance > 0
                    ? { background: 'rgba(239,68,68,0.07)',    border: '1px solid rgba(239,68,68,0.18)' }
                    : currBalance < 0
                    ? { background: 'rgba(16,185,129,0.07)',  border: '1px solid rgba(16,185,129,0.18)' }
                    : { background: 'var(--bg-muted)',         border: '1px solid var(--border)' }}
                >
                  <span style={{ color: 'var(--text-secondary)' }}>الرصيد الحالي</span>
                  <span className="font-bold text-base" style={{ color: currBalance > 0 ? '#ef4444' : currBalance < 0 ? '#10b981' : 'var(--text-muted)' }}>
                    {currBalance > 0 ? `${fmt(currBalance)} (عليه دين)` : currBalance < 0 ? `${fmt(Math.abs(currBalance))} (بذمتنا)` : 'لا يوجد رصيد'}
                  </span>
                </div>

                {/* Amount + Currency */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-sm text-slate-400 mb-1">المبلغ المدفوع *</label>
                    <div className="relative">
                      <input type="number" step="0.01" min="0.01" required value={payForm.amount}
                        onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-green-500 pr-16"
                        placeholder="0.00" />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">{currSym}</span>
                    </div>
                    {/* USD equivalent preview */}
                    {payAmt > 0 && payForm.currency_code !== 'USD' && (
                      <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                        <Info size={11} />
                        يعادل: <span className="font-bold">{amtUSD.toFixed(4)} $</span>
                        {rate > 1 && <span className="text-slate-500">(1 $ = {rate} {currSym})</span>}
                      </p>
                    )}
                  </div>

                  {/* Currency selector */}
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">العملة</label>
                    <select value={payForm.currency_code}
                      onChange={e => handlePayCurrencyChange(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500">
                      {CURRENCIES.map(c => (
                        <option key={c.code} value={c.code}>{c.code} — {c.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Exchange rate (hidden for USD) */}
                  {payForm.currency_code !== 'USD' && (
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">سعر الصرف (1 $ = ؟ {currSym})</label>
                      <input type="number" step="0.01" min="0.01" value={payForm.exchange_rate}
                        onChange={e => setPayForm(p => ({ ...p, exchange_rate: e.target.value }))}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500" />
                    </div>
                  )}

                  <div className={payForm.currency_code !== 'USD' ? 'col-span-2' : 'col-span-2'}>
                    <label className="block text-sm text-slate-400 mb-1">ملاحظة</label>
                    <input value={payForm.note}
                      onChange={e => setPayForm(p => ({ ...p, note: e.target.value }))}
                      placeholder="اختياري"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500" />
                  </div>
                </div>

                {/* New balance preview */}
                {payAmt > 0 && (
                  <div className={`rounded-lg p-3 text-sm border ${isOverpaid ? 'bg-blue-950/40 border-blue-700/40' : 'bg-slate-800 border-slate-700'}`}>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">الرصيد بعد الدفع</span>
                      <span className={`font-bold ${isOverpaid ? 'text-blue-400' : newBalance > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                        {isOverpaid
                          ? `${fmt(Math.abs(newBalance))} (بذمتنا)`
                          : newBalance > 0
                            ? fmt(newBalance)
                            : 'صفر — مسدّد بالكامل ✓'}
                      </span>
                    </div>
                    {isOverpaid && (
                      <p className="text-blue-300 text-xs mt-1 flex items-center gap-1">
                        <Info size={11} />
                        الدفع يزيد عن الدين — سيُسجَّل الباقي رصيداً بذمتنا للعميل
                      </p>
                    )}
                  </div>
                )}

                {payErr && <p className="text-red-400 text-sm">{payErr}</p>}

                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setPayModal(null)}
                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-lg transition text-sm">
                    إلغاء
                  </button>
                  <button type="submit" disabled={payLoading}
                    className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-2.5 rounded-lg transition text-sm font-semibold">
                    {payLoading ? 'جاري التسجيل...' : 'تسجيل الدفعة'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-slate-700">
              <h2 className="text-lg font-bold text-white">{editTarget ? 'تعديل عميل' : 'عميل جديد'}</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={submitForm} className="p-5 space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">الاسم *</label>
                <input required value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">الهاتف</label>
                <input value={form.phone}
                  onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">نوع العميل</label>
                  <select value={form.customer_type}
                    onChange={e => setForm(p => ({ ...p, customer_type: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500">
                    <option value="retail">تجزئة</option>
                    <option value="wholesale">جملة</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">حد الائتمان $</label>
                  <input type="number" min="0" step="0.01" value={form.credit_limit}
                    onChange={e => setForm(p => ({ ...p, credit_limit: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">العنوان</label>
                <input value={form.address}
                  onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">ملاحظات</label>
                <textarea rows={2} value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500 resize-none" />
              </div>

              {formErr && <p className="text-red-400 text-sm">{formErr}</p>}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg transition text-sm">
                  إلغاء
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white py-2 rounded-lg transition text-sm font-semibold">
                  {saving ? 'جاري الحفظ...' : editTarget ? 'حفظ التعديلات' : 'إضافة عميل'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
