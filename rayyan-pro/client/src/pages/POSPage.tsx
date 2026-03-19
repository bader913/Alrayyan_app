import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, X, Plus, Minus, ShoppingCart, User,
  Printer, Check, AlertCircle, Scale, DollarSign, Clock,
  RefreshCw, Bookmark, BookOpen, Trash2,
} from 'lucide-react';
import { usePosStore } from '../store/posStore.ts';
import { useQuery } from '@tanstack/react-query';
import {
  useTerminals, useCurrentShift, useOpenShift, useCloseShift,
  useCreateSale, useCustomerSearch, useCreateCustomer,
  calcCartItem, reCalcItem, resolveProductPrice,
  type CartItem, type Customer, type Shift, type ShiftSummary, type Sale,
} from '../api/pos.ts';
import { useProducts } from '../api/products.ts';
import { printInvoice } from '../utils/print.ts';
import { useCurrency } from '../hooks/useCurrency.ts';
import { settingsApi } from '../api/settings.ts';

// ─── Parked Invoices ──────────────────────────────────────────────────────────
const PARKED_KEY = 'rayyan_parked_invoices';

interface ParkedInvoice {
  id:           string;
  created_at:   string;
  customer:     Customer | null;
  cart:         CartItem[];
  saleType:     'retail' | 'wholesale';
  saleDiscount: number;
  notes:        string;
}

function loadParked(): ParkedInvoice[] {
  try { return JSON.parse(localStorage.getItem(PARKED_KEY) ?? '[]'); }
  catch { return []; }
}
function saveParked(list: ParkedInvoice[]) {
  localStorage.setItem(PARKED_KEY, JSON.stringify(list));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'نقداً', card: 'شام كاش', credit: 'آجل', mixed: 'مختلط',
};

// ─── POS Page ─────────────────────────────────────────────────────────────────

export default function POSPage() {
  const { fmt, rate, symbol } = useCurrency();
  const [view, setView] = useState<'loading' | 'open-shift' | 'pos' | 'close-shift' | 'receipt'>('loading');

  // ── App Settings ──────────────────────────────────────────────────────────
  const { data: appSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ['settings'],
    queryFn:  () => settingsApi.getAll().then((r) => r.data.settings),
    staleTime: 30_000,
  });
  const shiftsEnabled = appSettings?.enable_shifts === 'true';

  // ── Parked Invoices ───────────────────────────────────────────────────────
  const [parkedList, setParkedList]   = useState<ParkedInvoice[]>(loadParked);
  const [showParked, setShowParked]   = useState(false);

  // ── Shift state ──────────────────────────────────────────────────────────
  const { data: currentShift, isLoading: shiftLoading, refetch: refetchShift } = useCurrentShift();
  const { data: terminals = [] } = useTerminals();
  const openShiftMut  = useOpenShift();
  const closeShiftMut = useCloseShift();

  const [openForm, setOpenForm]   = useState({ terminal_id: '', opening_balance: '0', opening_note: '' });
  const [closeForm, setCloseForm] = useState({ closing_cash_counted: '', closing_note: '' });
  const [shiftSummary, setShiftSummary] = useState<ShiftSummary | null>(null);
  const [shiftError, setShiftError] = useState('');

  // ── Cart state ───────────────────────────────────────────────────────────
  const [cart, setCart]               = useState<CartItem[]>([]);
  const [customer, setCustomer]       = useState<Customer | null>(null);
  const [saleType, setSaleType]       = useState<'retail' | 'wholesale'>('retail');
  const [saleDiscount, setSaleDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'credit' | 'mixed'>('cash');
  const [paidAmount, setPaidAmount]   = useState(0);
  const [saleNotes, setSaleNotes]     = useState('');

  // ── Sync cart count to global store (for Layout nav guard) ───────────────
  const setCartCount = usePosStore((s) => s.setCartCount);
  useEffect(() => {
    if (view === 'pos') setCartCount(cart.length);
    return () => setCartCount(0);   // clear on unmount
  }, [cart.length, view, setCartCount]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  // Keep a stable ref so the effect does not re-register on every render
  const completeSaleRef = useRef<() => void>(() => {});
  useEffect(() => { completeSaleRef.current = completeSale; }); // runs after every render

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (view !== 'pos') return;
      if (e.key === 'F1') { e.preventDefault(); completeSaleRef.current(); }
      if (e.key === 'F8') { e.preventDefault(); setCart([]); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [view]); // only re-register when view changes

  // ── Product search ────────────────────────────────────────────────────────
  const [searchQ, setSearchQ]   = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const barcodeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchQ), 250);
    return () => clearTimeout(t);
  }, [searchQ]);

  const { data: productResults } = useProducts({
    q: debouncedQ,
    is_active: 'true',
    limit: 12,
  });

  // ── Customer search ───────────────────────────────────────────────────────
  const [custQ, setCustQ]             = useState('');
  const [showCustDropdown, setShowCustDropdown] = useState(false);
  const { data: custResults = [] }    = useCustomerSearch(custQ);
  const createCustMut                 = useCreateCustomer();
  const [showNewCustForm, setShowNewCustForm] = useState(false);
  const [newCust, setNewCust]         = useState<{ name: string; phone: string; customer_type: 'retail' | 'wholesale' }>({ name: '', phone: '', customer_type: 'retail' });

  // ── Weighted modal ────────────────────────────────────────────────────────
  const [weightModal, setWeightModal] = useState<{
    product: Parameters<typeof calcCartItem>[0] | null;
    mode: 'weight' | 'amount';
    value: string;
  }>({ product: null, mode: 'weight', value: '' });

  // ── Sale completion ───────────────────────────────────────────────────────
  const createSaleMut = useCreateSale();
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [saleError, setSaleError] = useState('');

  // ── Shift view control ────────────────────────────────────────────────────
  useEffect(() => {
    if (settingsLoading || (shiftsEnabled && shiftLoading)) { setView('loading'); return; }
    if (!shiftsEnabled) { setView('pos'); return; }
    if (currentShift?.status === 'open') setView('pos');
    else setView('open-shift');
  }, [currentShift, shiftLoading, shiftsEnabled, settingsLoading]);

  // ── Computed totals ───────────────────────────────────────────────────────
  const subtotal      = cart.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const itemsDiscount = cart.reduce((s, i) => s + i.item_discount, 0);
  const total         = Math.max(0, subtotal - itemsDiscount - saleDiscount);
  const isPaidFull    = paymentMethod === 'credit';
  const effectivePaid = isPaidFull ? 0 : paidAmount;
  const change        = effectivePaid > total ? effectivePaid - total : 0;
  const due           = total - effectivePaid > 0.001 ? total - effectivePaid : 0;

  // When total changes, reset paidAmount to total for cash
  useEffect(() => {
    if (paymentMethod === 'cash') setPaidAmount(total);
  }, [total, paymentMethod]);

  // ── Add product to cart ───────────────────────────────────────────────────
  const addProduct = useCallback((product: Parameters<typeof calcCartItem>[0]) => {
    if (product.is_weighted) {
      setWeightModal({ product, mode: 'weight', value: '' });
      return;
    }

    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id && i.price_type !== 'custom');
      if (existing) {
        return prev.map((i) => {
          if (i._id !== existing._id) return i;
          const newQty  = i.quantity + 1;
          const resolved = resolveProductPrice(product, newQty, saleType, customer?.customer_type);
          return reCalcItem({
            ...i,
            quantity:   newQty,
            unit_price: resolved.price,
            price_type: resolved.type,
          });
        });
      }
      const item = calcCartItem(product, 1, saleType, customer?.customer_type);
      return [...prev, item];
    });

    setSearchQ('');
    setTimeout(() => barcodeRef.current?.focus(), 50);
  }, [saleType, customer]);

  // ── Confirm weighted add ──────────────────────────────────────────────────
  const confirmWeighted = () => {
    const { product, mode, value } = weightModal;
    if (!product || !value) return;

    const price = parseFloat(product.retail_price);
    let qty: number;

    if (mode === 'weight') {
      qty = parseFloat(value);
      if (isNaN(qty) || qty <= 0) return;
    } else {
      // amount mode: user enters display currency → convert to USD, then divide by USD price
      const amount = parseFloat(value);
      if (isNaN(amount) || amount <= 0 || price <= 0) return;
      qty = (amount / rate) / price;
    }

    const item = calcCartItem(product, qty, saleType, customer?.customer_type);
    setCart((prev) => [...prev, item]);
    setWeightModal({ product: null, mode: 'weight', value: '' });
    setTimeout(() => barcodeRef.current?.focus(), 50);
  };

  // ── Update cart item ──────────────────────────────────────────────────────
  const updateCartItem = (id: string, changes: Partial<CartItem>) => {
    setCart((prev) =>
      prev.map((i) => i._id !== id ? i : reCalcItem({ ...i, ...changes }))
    );
  };

  const removeItem = (id: string) => setCart((prev) => prev.filter((i) => i._id !== id));

  // ── When saleType or customer changes: re-price non-custom items ──────────
  useEffect(() => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.price_type === 'custom') return item;
        const resolved = resolveProductPrice(
          item.product, item.quantity, saleType, customer?.customer_type
        );
        return reCalcItem({ ...item, unit_price: resolved.price, price_type: resolved.type });
      })
    );
  }, [saleType, customer]);

  // ── Complete sale ─────────────────────────────────────────────────────────
  const completeSale = async () => {
    if (shiftsEnabled && !currentShift) return;
    if (cart.length === 0) { setSaleError('السلة فارغة'); return; }
    setSaleError('');

    try {
      const sale = await createSaleMut.mutateAsync({
        shift_id:        shiftsEnabled && currentShift ? parseInt(currentShift.id, 10) : null,
        pos_terminal_id: currentShift?.pos_terminal_id ? parseInt(currentShift.pos_terminal_id, 10) : null,
        customer_id:     customer ? parseInt(customer.id, 10) : null,
        sale_type:       saleType,
        items: cart.map((i) => ({
          product_id:    parseInt(i.product.id, 10),
          quantity:      i.quantity,
          unit_price:    i.unit_price,
          price_type:    i.price_type,
          item_discount: i.item_discount,
        })),
        sale_discount:  saleDiscount,
        payment_method: paymentMethod,
        paid_amount:    effectivePaid,
        notes:          saleNotes || undefined,
      });

      setLastSale(sale);
      setView('receipt');
      clearCart();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } }; message?: string })
        ?.response?.data?.message ?? (e as { message?: string })?.message ?? 'حدث خطأ';
      setSaleError(msg);
    }
  };

  const clearCart = () => {
    setCart([]);
    setCustomer(null);
    setSaleType('retail');
    setSaleDiscount(0);
    setPaymentMethod('cash');
    setPaidAmount(0);
    setSaleNotes('');
    setSaleError('');
  };

  const newSale = () => {
    clearCart();
    setLastSale(null);
    setView('pos');
    setTimeout(() => barcodeRef.current?.focus(), 100);
  };

  // ── Park (احتجاز) current cart ────────────────────────────────────────────
  const parkCart = () => {
    if (cart.length === 0) return;
    const entry: ParkedInvoice = {
      id:           `${Date.now()}`,
      created_at:   new Date().toISOString(),
      customer,
      cart:         [...cart],
      saleType,
      saleDiscount,
      notes:        saleNotes,
    };
    const updated = [entry, ...parkedList];
    setParkedList(updated);
    saveParked(updated);
    clearCart();
    setTimeout(() => barcodeRef.current?.focus(), 100);
  };

  // ── Restore a parked invoice into the current cart ────────────────────────
  const restoreParked = (id: string) => {
    const entry = parkedList.find((p) => p.id === id);
    if (!entry) return;
    setCart(entry.cart);
    setCustomer(entry.customer);
    setSaleType(entry.saleType);
    setSaleDiscount(entry.saleDiscount);
    setSaleNotes(entry.notes);
    setSaleError('');
    const updated = parkedList.filter((p) => p.id !== id);
    setParkedList(updated);
    saveParked(updated);
    setShowParked(false);
    setTimeout(() => barcodeRef.current?.focus(), 100);
  };

  const deleteParked = (id: string) => {
    const updated = parkedList.filter((p) => p.id !== id);
    setParkedList(updated);
    saveParked(updated);
  };

  // ── Open shift ────────────────────────────────────────────────────────────
  const handleOpenShift = async () => {
    setShiftError('');
    try {
      await openShiftMut.mutateAsync({
        terminal_id:     openForm.terminal_id ? parseInt(openForm.terminal_id, 10) : null,
        opening_balance: (parseFloat(openForm.opening_balance) || 0) / rate,
        opening_note:    openForm.opening_note || undefined,
      });
      refetchShift();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } }; message?: string })
        ?.response?.data?.message ?? 'فشل في فتح الوردية';
      setShiftError(msg);
    }
  };

  // ── Close shift ───────────────────────────────────────────────────────────
  const handleCloseShift = async () => {
    if (!currentShift) return;
    setShiftError('');
    try {
      const summary = await closeShiftMut.mutateAsync({
        id:                   parseInt(currentShift.id, 10),
        closing_cash_counted: (parseFloat(closeForm.closing_cash_counted) || 0) / rate,
        closing_note:         closeForm.closing_note || undefined,
      });
      setShiftSummary(summary);
      refetchShift();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } }; message?: string })
        ?.response?.data?.message ?? 'فشل في إغلاق الوردية';
      setShiftError(msg);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // VIEWS
  // ─────────────────────────────────────────────────────────────────────────

  if (view === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <RefreshCw size={28} className="animate-spin text-emerald-600" />
      </div>
    );
  }

  // ── Open Shift View ───────────────────────────────────────────────────────
  if (view === 'open-shift') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50" dir="rtl">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-emerald-600 flex items-center justify-center mx-auto mb-3">
              <Clock size={26} className="text-white" />
            </div>
            <h1 className="text-xl font-black text-slate-800">فتح وردية جديدة</h1>
            <p className="text-sm text-slate-500 mt-1">حدد الجهاز والرصيد الافتتاحي للبدء</p>
          </div>

          {shiftError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex gap-2 items-start mb-4">
              <AlertCircle size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
              <span className="text-red-700 text-sm">{shiftError}</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">جهاز POS</label>
              <select
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 bg-slate-50"
                value={openForm.terminal_id}
                onChange={(e) => setOpenForm((p) => ({ ...p, terminal_id: e.target.value }))}
              >
                <option value="">— اختر الجهاز (اختياري) —</option>
                {terminals.map((t) => (
                  <option key={t.id} value={t.id} disabled={!!t.active_shift_id}>
                    {t.name} ({t.code}){t.active_shift_id ? ' — مشغول' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">الرصيد الافتتاحي ({symbol})</label>
              <input
                type="number" min="0"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 text-left"
                placeholder="0"
                value={openForm.opening_balance}
                onChange={(e) => setOpenForm((p) => ({ ...p, opening_balance: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">ملاحظة (اختياري)</label>
              <input
                type="text"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500"
                placeholder="ملاحظة عند فتح الوردية..."
                value={openForm.opening_note}
                onChange={(e) => setOpenForm((p) => ({ ...p, opening_note: e.target.value }))}
              />
            </div>

            <button
              onClick={handleOpenShift}
              disabled={openShiftMut.isPending}
              className="w-full py-3 rounded-xl text-white font-black text-base transition-opacity disabled:opacity-60"
              style={{ background: '#059669' }}
            >
              {openShiftMut.isPending ? 'جارٍ الفتح...' : 'فتح الوردية والبدء'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Close Shift View ──────────────────────────────────────────────────────
  if (view === 'close-shift') {
    if (shiftSummary) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50" dir="rtl">
          <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <Check size={26} className="text-emerald-600" />
              </div>
              <h1 className="text-xl font-black text-slate-800">تم إغلاق الوردية</h1>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm mb-5">
              {[
                ['عدد المبيعات', shiftSummary.sales_count],
                ['إجمالي المبيعات', fmt(shiftSummary.sales_total)],
                ['مبيعات نقدية', fmt(shiftSummary.cash_total)],
                ['مبيعات شام كاش', fmt(shiftSummary.card_total)],
                ['مبيعات آجل', fmt(shiftSummary.credit_total)],
                ['الرصيد الافتتاحي', fmt(shiftSummary.opening_balance)],
                ['النقد المتوقع', fmt(shiftSummary.expected_cash)],
                ['النقد الفعلي', fmt(shiftSummary.closing_cash_counted)],
                ['الفرق', fmt(shiftSummary.difference)],
              ].map(([label, val]) => (
                <div key={String(label)} className="flex justify-between">
                  <span className="text-slate-500">{label}</span>
                  <span className="font-bold text-slate-800">{val}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                setShiftSummary(null);
                setView('open-shift');
              }}
              className="w-full py-3 rounded-xl text-white font-black"
              style={{ background: '#059669' }}
            >
              فتح وردية جديدة
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50" dir="rtl">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
          <div className="text-center mb-6">
            <h1 className="text-xl font-black text-slate-800">إغلاق الوردية</h1>
            <p className="text-sm text-slate-500 mt-1">أدخل النقد الفعلي في الدرج</p>
          </div>

          {shiftError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex gap-2 mb-4">
              <AlertCircle size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
              <span className="text-red-700 text-sm">{shiftError}</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">النقد الفعلي ({symbol})</label>
              <input
                type="number" min="0"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-lg font-bold focus:outline-none focus:border-emerald-500 text-left"
                placeholder="0"
                value={closeForm.closing_cash_counted}
                onChange={(e) => setCloseForm((p) => ({ ...p, closing_cash_counted: e.target.value }))}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">ملاحظة الإغلاق (اختياري)</label>
              <input
                type="text"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500"
                placeholder="ملاحظة..."
                value={closeForm.closing_note}
                onChange={(e) => setCloseForm((p) => ({ ...p, closing_note: e.target.value }))}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setView('pos')}
                className="flex-1 py-3 rounded-xl font-bold text-slate-600 border border-slate-200 hover:bg-slate-50"
              >
                إلغاء
              </button>
              <button
                onClick={handleCloseShift}
                disabled={closeShiftMut.isPending}
                className="flex-1 py-3 rounded-xl text-white font-black disabled:opacity-60"
                style={{ background: '#ef4444' }}
              >
                {closeShiftMut.isPending ? 'جارٍ الإغلاق...' : 'تأكيد الإغلاق'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Receipt View ──────────────────────────────────────────────────────────
  if (view === 'receipt' && lastSale) {
    const saleDue = parseFloat(lastSale.total_amount) - parseFloat(lastSale.paid_amount);
    const saleChange = parseFloat(lastSale.paid_amount) - parseFloat(lastSale.total_amount);

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4" dir="rtl">
        <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-md">
          <div className="text-center mb-5">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-3">
              <Check size={28} className="text-emerald-600" />
            </div>
            <h1 className="text-xl font-black text-slate-800">تم البيع بنجاح</h1>
            <p className="text-sm text-emerald-600 font-bold mt-1">{lastSale.invoice_number}</p>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm mb-5">
            {lastSale.customer_name && (
              <div className="flex justify-between">
                <span className="text-slate-500">العميل</span>
                <span className="font-bold">{lastSale.customer_name}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">الإجمالي</span>
              <span className="font-black text-lg text-slate-800">{fmt(lastSale.total_amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">طريقة الدفع</span>
              <span className="font-bold">{PAYMENT_LABELS[lastSale.payment_method]}</span>
            </div>
            {parseFloat(lastSale.paid_amount) > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">المدفوع</span>
                <span className="font-bold">{fmt(lastSale.paid_amount)}</span>
              </div>
            )}
            {saleChange > 0.001 && (
              <div className="flex justify-between">
                <span className="text-slate-500">الباقي للعميل</span>
                <span className="font-black text-emerald-600">{fmt(saleChange)}</span>
              </div>
            )}
            {saleDue > 0.001 && (
              <div className="flex justify-between">
                <span className="text-slate-500">متبقي آجل</span>
                <span className="font-black text-red-500">{fmt(saleDue)}</span>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => printInvoice(lastSale, appSettings?.shop_name ?? 'ريان برو', { symbol, rate })}
              className="flex items-center gap-2 px-4 py-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50"
            >
              <Printer size={16} /> طباعة
            </button>
            <button
              onClick={newSale}
              className="flex-1 py-3 rounded-xl text-white font-black text-base"
              style={{ background: '#059669' }}
            >
              بيع جديد
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── MAIN POS VIEW ─────────────────────────────────────────────────────────
  const shift = currentShift as Shift | null;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-100" dir="rtl">

      {/* ─── Top Bar ───────────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-5 py-2.5 border-b flex-shrink-0"
        style={{ background: '#fff', borderColor: '#e2e8f0' }}
      >
        {/* Shift info — only when shifts enabled */}
        {shiftsEnabled && shift && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-sm font-bold text-slate-700">
              {shift.terminal_name ?? 'بلا جهاز'} · {shift.cashier_name}
            </span>
          </div>
        )}
        {!shiftsEnabled && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-sm font-bold text-slate-700">نقطة البيع</span>
          </div>
        )}

        <div className="flex-1" />
        <LiveTime />

        {/* ─ Hold / Park button ─ */}
        <button
          onClick={parkCart}
          disabled={cart.length === 0}
          title="احتجاز الفاتورة الحالية"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-amber-600 hover:bg-amber-50 text-xs font-black border border-amber-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Bookmark size={13} /> احتجاز
        </button>

        {/* ─ Parked list button ─ */}
        <button
          onClick={() => setShowParked(true)}
          title="الفواتير المحتجزة"
          className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sky-600 hover:bg-sky-50 text-xs font-black border border-sky-200 transition-colors"
        >
          <BookOpen size={13} /> محتجزة
          {parkedList.length > 0 && (
            <span className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-black flex items-center justify-center">
              {parkedList.length}
            </span>
          )}
        </button>

        {/* ─ Close shift — only when shifts enabled ─ */}
        {shiftsEnabled && (
          <button
            onClick={() => setView('close-shift')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-red-500 hover:bg-red-50 text-xs font-black border border-red-100 transition-colors"
          >
            إغلاق الوردية
          </button>
        )}
      </div>

      {/* ─── Main Area ──────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 gap-0">

        {/* ── LEFT: Product Search ──────────────────────────────────────────── */}
        <div className="w-5/12 flex flex-col border-l bg-white" style={{ borderColor: '#e2e8f0' }}>
          <div className="p-3 border-b" style={{ borderColor: '#f1f5f9' }}>
            <div className="relative">
              <Search size={16} className="absolute top-1/2 -translate-y-1/2 right-3 text-slate-400" />
              <input
                ref={barcodeRef}
                type="text"
                placeholder="اسم المنتج أو الباركود..."
                className="w-full pl-3 pr-9 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-500 bg-slate-50"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                autoFocus
              />
              {searchQ && (
                <button onClick={() => setSearchQ('')} className="absolute top-1/2 -translate-y-1/2 left-3 text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {(productResults?.products ?? []).length === 0 && debouncedQ && (
              <div className="p-6 text-center text-slate-400 text-sm">لا توجد نتائج</div>
            )}
            {(productResults?.products ?? []).length === 0 && !debouncedQ && (
              <div className="p-6 text-center text-slate-300 text-sm select-none">
                ابحث عن منتج أو امسح الباركود
              </div>
            )}
            {(productResults?.products ?? []).map((product) => {
              const stock = parseFloat(product.stock_quantity);
              const noStock = stock <= 0;
              const resolved = resolveProductPrice(product, 1, saleType, customer?.customer_type);

              return (
                <button
                  key={product.id}
                  onClick={() => !noStock && addProduct(product)}
                  disabled={noStock}
                  className={`w-full flex items-center gap-3 px-4 py-3 border-b text-right transition-colors
                    ${noStock
                      ? 'opacity-40 cursor-not-allowed'
                      : 'hover:bg-emerald-50 active:bg-emerald-100 cursor-pointer'
                    }`}
                  style={{ borderColor: '#f8fafc' }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-slate-800 truncate">{product.name}</span>
                      {product.is_weighted && (
                        <Scale size={12} className="text-violet-500 flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {product.barcode && (
                        <span className="text-[10px] text-slate-400 font-mono">{product.barcode}</span>
                      )}
                      <span className="text-[10px] text-slate-400">
                        مخزون: {stock.toFixed(product.is_weighted ? 3 : 0)} {product.unit}
                      </span>
                    </div>
                  </div>
                  <div className="text-left flex-shrink-0">
                    <div className="text-sm font-black text-emerald-700">{fmt(resolved.price)}</div>
                    {resolved.type === 'wholesale' && (
                      <div className="text-[10px] text-cyan-600 font-bold">جملة</div>
                    )}
                  </div>
                  <Plus size={16} className="text-slate-400 flex-shrink-0" />
                </button>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT: Cart ───────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 bg-white">

          {/* Customer + Sale Type */}
          <div className="px-4 py-2.5 border-b flex gap-3 items-center flex-shrink-0" style={{ borderColor: '#f1f5f9' }}>
            {/* Customer */}
            <div className="flex-1 relative">
              <div className="relative">
                <User size={14} className="absolute top-1/2 -translate-y-1/2 right-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="العميل..."
                  className="w-full pr-8 pl-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-500 bg-slate-50"
                  value={customer ? customer.name : custQ}
                  onChange={(e) => {
                    if (customer) setCustomer(null);
                    setCustQ(e.target.value);
                    setShowCustDropdown(true);
                  }}
                  onFocus={() => setShowCustDropdown(true)}
                />
                {customer && (
                  <button
                    onClick={() => { setCustomer(null); setCustQ(''); }}
                    className="absolute top-1/2 -translate-y-1/2 left-2 text-slate-400"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {showCustDropdown && !customer && custQ.trim() && (
                <div className="absolute top-full right-0 left-0 bg-white border border-slate-200 rounded-xl shadow-lg z-20 mt-1 max-h-48 overflow-y-auto">
                  {custResults.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => { setCustomer(c); setCustQ(''); setShowCustDropdown(false); }}
                      className="w-full text-right px-4 py-2.5 hover:bg-slate-50 text-sm"
                    >
                      <div className="font-bold text-slate-800">{c.name}</div>
                      <div className="text-xs text-slate-400">
                        {c.phone} · {c.customer_type === 'wholesale' ? 'جملة' : 'مفرق'}
                        {parseFloat(c.balance) > 0 && <span className="text-red-500 mr-2">رصيد: {fmt(parseFloat(c.balance))}</span>}
                      </div>
                    </button>
                  ))}
                  <button
                    onClick={() => { setShowCustDropdown(false); setShowNewCustForm(true); }}
                    className="w-full text-right px-4 py-2.5 text-emerald-600 text-sm font-bold hover:bg-emerald-50 border-t border-slate-100"
                  >
                    + إضافة عميل جديد
                  </button>
                </div>
              )}
            </div>

            {/* Sale type toggle */}
            <div className="flex rounded-xl border border-slate-200 overflow-hidden flex-shrink-0">
              {(['retail', 'wholesale'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setSaleType(t)}
                  className={`px-3 py-2 text-xs font-black transition-colors ${
                    saleType === t ? 'text-white' : 'text-slate-500 hover:bg-slate-50'
                  }`}
                  style={saleType === t ? { background: '#059669' } : {}}
                >
                  {t === 'retail' ? 'مفرق' : 'جملة'}
                </button>
              ))}
            </div>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {cart.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-slate-300 select-none">
                <ShoppingCart size={40} className="mb-2" />
                <span className="text-sm">السلة فارغة</span>
              </div>
            )}

            {cart.map((item) => (
              <div
                key={item._id}
                className="flex items-start gap-2 px-4 py-2.5 border-b"
                style={{ borderColor: '#f8fafc' }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-sm font-bold text-slate-800 truncate">{item.product.name}</span>
                    {item.product.is_weighted && <Scale size={11} className="text-violet-500" />}
                    {item.price_type === 'wholesale' && (
                      <span className="text-[10px] text-cyan-600 font-black bg-cyan-50 px-1.5 rounded">جملة</span>
                    )}
                    {item.price_type === 'custom' && (
                      <span className="text-[10px] text-violet-600 font-black bg-violet-50 px-1.5 rounded">مخصص</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Qty control */}
                    {!item.product.is_weighted ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => item.quantity > 1
                            ? updateCartItem(item._id, { quantity: item.quantity - 1 })
                            : removeItem(item._id)
                          }
                          className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 text-slate-600"
                        >
                          <Minus size={11} />
                        </button>
                        <input
                          type="number" min="0.001" step="1"
                          className="w-12 text-center text-sm font-bold border border-slate-200 rounded-lg py-0.5 focus:outline-none focus:border-emerald-500"
                          value={item.quantity}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            if (v > 0) updateCartItem(item._id, { quantity: v });
                          }}
                        />
                        <button
                          onClick={() => updateCartItem(item._id, { quantity: item.quantity + 1 })}
                          className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 text-slate-600"
                        >
                          <Plus size={11} />
                        </button>
                      </div>
                    ) : (
                      <input
                        type="number" min="0.001" step="0.001"
                        className="w-20 text-center text-sm font-bold border border-slate-200 rounded-lg py-0.5 focus:outline-none focus:border-emerald-500"
                        value={item.quantity}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (v > 0) updateCartItem(item._id, { quantity: v });
                        }}
                      />
                    )}

                    {/* Unit price (editable) */}
                    <div className="flex items-center gap-1">
                      <DollarSign size={11} className="text-slate-400" />
                      <input
                        type="number" min="0"
                        className="w-24 text-center text-sm border border-slate-200 rounded-lg py-0.5 focus:outline-none focus:border-emerald-500"
                        value={item.unit_price}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (!isNaN(v)) updateCartItem(item._id, { unit_price: v, price_type: 'custom' });
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <button onClick={() => removeItem(item._id)} className="text-slate-300 hover:text-red-500">
                    <X size={15} />
                  </button>
                  <span className="text-sm font-black text-slate-800">{fmt(item.total)}</span>
                  {item.item_discount > 0 && (
                    <span className="text-[10px] text-red-400">خصم: {fmt(item.item_discount)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* ── Totals + Payment ─────────────────────────────────────────── */}
          <div className="border-t px-4 py-3 space-y-2.5 flex-shrink-0" style={{ borderColor: '#e2e8f0' }}>

            {saleError && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 flex gap-2 items-start">
                <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                <span className="text-red-700 text-xs">{saleError}</span>
              </div>
            )}

            {/* Totals row */}
            <div className="flex items-center gap-3 text-sm">
              <span className="text-slate-500 flex-shrink-0">مجموع</span>
              <span className="font-bold text-slate-700">{fmt(subtotal)}</span>
              <span className="text-slate-400 flex-shrink-0 mr-auto">خصم</span>
              <div className="relative w-28">
                <input
                  type="number" min="0"
                  className="w-full text-left pl-8 pr-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
                  placeholder="0"
                  value={saleDiscount * rate || ''}
                  onChange={(e) => setSaleDiscount((parseFloat(e.target.value) || 0) / rate)}
                />
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">{symbol}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-base font-black text-slate-800">الإجمالي</span>
              <span className="text-xl font-black text-emerald-700">{fmt(total)}</span>
            </div>

            {/* Payment method */}
            <div className="grid grid-cols-4 gap-1.5">
              {(['cash', 'card', 'credit', 'mixed'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setPaymentMethod(m)}
                  className={`py-2 rounded-xl text-xs font-black border transition-colors ${
                    paymentMethod === m
                      ? 'text-white border-transparent'
                      : 'text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
                  style={paymentMethod === m ? { background: '#059669' } : {}}
                >
                  {PAYMENT_LABELS[m]}
                </button>
              ))}
            </div>

            {/* Paid / Change / Due */}
            {paymentMethod !== 'credit' && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500 flex-shrink-0">مدفوع</span>
                <div className="relative flex-1">
                  <input
                    type="number" min="0"
                    className="w-full text-left pl-8 pr-2 py-1.5 border border-slate-200 rounded-lg text-sm font-bold focus:outline-none focus:border-emerald-500"
                    value={paidAmount * rate || ''}
                    onChange={(e) => setPaidAmount((parseFloat(e.target.value) || 0) / rate)}
                  />
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">{symbol}</span>
                </div>
                {change > 0.001 && (
                  <div className="flex-shrink-0 text-sm font-black text-emerald-700">
                    باقي: {fmt(change)}
                  </div>
                )}
                {due > 0.001 && (
                  <div className="flex-shrink-0 text-sm font-black text-red-500">
                    آجل: {fmt(due)}
                  </div>
                )}
              </div>
            )}
            {paymentMethod === 'credit' && (
              <div className="text-sm text-red-500 font-bold text-center bg-red-50 rounded-xl py-2">
                الفاتورة كاملة آجل — {customer ? customer.name : 'يرجى تحديد عميل'}
              </div>
            )}

          </div>

          {/* ── Complete Sale — always visible at bottom ──────────────────── */}
          <div className="px-4 pb-4 pt-2 flex-shrink-0">
            <button
              onClick={completeSale}
              disabled={createSaleMut.isPending || cart.length === 0}
              className="w-full py-4 rounded-xl text-white font-black text-base transition-opacity disabled:opacity-40 flex items-center justify-center gap-3"
              style={{ background: '#059669' }}
            >
              <span>
                {createSaleMut.isPending ? 'جارٍ الحفظ...' : `إتمام البيع · ${fmt(total)}`}
              </span>
              {!createSaleMut.isPending && (
                <span
                  className="text-[10px] font-black px-1.5 py-0.5 rounded"
                  style={{ background: 'rgba(255,255,255,0.2)' }}
                >
                  F1
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ─── Parked Invoices Panel ────────────────────────────────────────── */}
      {showParked && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" dir="rtl"
          onClick={(e) => e.target === e.currentTarget && setShowParked(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div className="flex items-center gap-2">
                <BookOpen size={18} className="text-sky-600" />
                <h2 className="font-black text-slate-800 text-base">الفواتير المحتجزة</h2>
                {parkedList.length > 0 && (
                  <span className="bg-amber-100 text-amber-700 text-xs font-black px-2 py-0.5 rounded-full">
                    {parkedList.length}
                  </span>
                )}
              </div>
              <button onClick={() => setShowParked(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {parkedList.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-slate-300">
                  <Bookmark size={36} className="mb-2" />
                  <span className="text-sm">لا توجد فواتير محتجزة</span>
                </div>
              )}
              {parkedList.map((p) => {
                const itemCount = p.cart.reduce((s, i) => s + i.quantity, 0);
                const total     = p.cart.reduce((s, i) => s + i.total, 0) - p.saleDiscount;
                const time      = new Date(p.created_at).toLocaleTimeString('ar-SY', { hour: '2-digit', minute: '2-digit' });
                return (
                  <div key={p.id} className="border border-slate-200 rounded-xl p-3.5 hover:border-emerald-300 transition-colors group">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono text-slate-400">{time}</span>
                          {p.customer && (
                            <span className="text-sm font-bold text-slate-700 truncate">{p.customer.name}</span>
                          )}
                          {!p.customer && (
                            <span className="text-sm text-slate-400">بدون عميل</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span>{p.cart.length} صنف · {itemCount.toFixed(1)} وحدة</span>
                          <span className="font-black text-emerald-700 text-sm">{fmt(total)}</span>
                        </div>
                        {/* Items preview */}
                        <div className="mt-1.5 text-xs text-slate-400 truncate">
                          {p.cart.slice(0, 3).map((i) => i.product.name).join(' · ')}
                          {p.cart.length > 3 && ` +${p.cart.length - 3}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => deleteParked(p.id)}
                          className="p-1.5 text-slate-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                          title="حذف"
                        >
                          <Trash2 size={14} />
                        </button>
                        <button
                          onClick={() => restoreParked(p.id)}
                          className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-black transition-colors"
                        >
                          استعادة
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── Weighted Product Modal ────────────────────────────────────────── */}
      {weightModal.product && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" dir="rtl">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-black text-slate-800">{weightModal.product.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  السعر: {fmt(parseFloat(weightModal.product.retail_price))} / {weightModal.product.unit}
                </p>
              </div>
              <button onClick={() => setWeightModal({ product: null, mode: 'weight', value: '' })}>
                <X size={18} className="text-slate-400" />
              </button>
            </div>

            {/* Mode toggle */}
            <div className="flex rounded-xl border border-slate-200 overflow-hidden mb-4">
              <button
                onClick={() => setWeightModal((p) => ({ ...p, mode: 'weight', value: '' }))}
                className={`flex-1 py-2 text-sm font-bold transition-colors ${
                  weightModal.mode === 'weight' ? 'text-white' : 'text-slate-500'
                }`}
                style={weightModal.mode === 'weight' ? { background: '#059669' } : {}}
              >
                <Scale size={14} className="inline ml-1" /> بالوزن
              </button>
              <button
                onClick={() => setWeightModal((p) => ({ ...p, mode: 'amount', value: '' }))}
                className={`flex-1 py-2 text-sm font-bold transition-colors ${
                  weightModal.mode === 'amount' ? 'text-white' : 'text-slate-500'
                }`}
                style={weightModal.mode === 'amount' ? { background: '#059669' } : {}}
              >
                <DollarSign size={14} className="inline ml-1" /> بالمبلغ
              </button>
            </div>

            <div className="mb-2">
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                {weightModal.mode === 'weight'
                  ? `الوزن (${weightModal.product.unit})`
                  : `المبلغ المطلوب (${symbol})`}
              </label>
              <input
                type="number" min="0.001" step={weightModal.mode === 'weight' ? '0.001' : '1'}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-lg font-bold text-left focus:outline-none focus:border-emerald-500"
                placeholder={weightModal.mode === 'weight' ? '0.000' : '0'}
                value={weightModal.value}
                onChange={(e) => setWeightModal((p) => ({ ...p, value: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && confirmWeighted()}
                autoFocus
              />
            </div>

            {/* Preview */}
            {weightModal.value && parseFloat(weightModal.value) > 0 && (() => {
              const price = parseFloat(weightModal.product!.retail_price);
              let qty = 0, amount = 0;
              if (weightModal.mode === 'weight') {
                qty = parseFloat(weightModal.value);
                amount = qty * price;
              } else {
                amount = parseFloat(weightModal.value) / rate;
                qty = price > 0 ? amount / price : 0;
              }
              return (
                <div className="bg-emerald-50 rounded-xl p-3 text-sm mb-4 flex justify-between">
                  <span className="text-slate-600">
                    {qty.toFixed(3)} {weightModal.product!.unit}
                  </span>
                  <span className="font-black text-emerald-700">{fmt(amount)}</span>
                </div>
              );
            })()}

            <button
              onClick={confirmWeighted}
              className="w-full py-3 rounded-xl text-white font-black"
              style={{ background: '#059669' }}
            >
              إضافة للسلة
            </button>
          </div>
        </div>
      )}

      {/* ─── New Customer Quick Form ────────────────────────────────────── */}
      {showNewCustForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" dir="rtl">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-slate-800">عميل جديد</h3>
              <button onClick={() => setShowNewCustForm(false)}><X size={18} className="text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              <input
                type="text" placeholder="الاسم *"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500"
                value={newCust.name}
                onChange={(e) => setNewCust((p) => ({ ...p, name: e.target.value }))}
                autoFocus
              />
              <input
                type="text" placeholder="رقم الهاتف"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500"
                value={newCust.phone}
                onChange={(e) => setNewCust((p) => ({ ...p, phone: e.target.value }))}
              />
              <div className="flex gap-2">
                {(['retail', 'wholesale'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setNewCust((p) => ({ ...p, customer_type: t }))}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-colors ${
                      newCust.customer_type === t ? 'text-white border-transparent' : 'border-slate-200 text-slate-600'
                    }`}
                    style={newCust.customer_type === t ? { background: '#059669' } : {}}
                  >
                    {t === 'retail' ? 'مفرق' : 'جملة'}
                  </button>
                ))}
              </div>
              <button
                disabled={!newCust.name.trim() || createCustMut.isPending}
                onClick={async () => {
                  const c = await createCustMut.mutateAsync({
                    name: newCust.name,
                    phone: newCust.phone || undefined,
                    customer_type: newCust.customer_type,
                  });
                  setCustomer(c);
                  setShowNewCustForm(false);
                  setNewCust({ name: '', phone: '', customer_type: 'retail' });
                }}
                className="w-full py-2.5 rounded-xl text-white font-black disabled:opacity-50"
                style={{ background: '#059669' }}
              >
                {createCustMut.isPending ? 'جارٍ الحفظ...' : 'حفظ وإضافة'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ─── Live Time Component ──────────────────────────────────────────────────────

function LiveTime() {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString('en-US', { hour12: false }));
  useEffect(() => {
    const t = setInterval(() => setTime(new Date().toLocaleTimeString('en-US', { hour12: false })), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="text-xs font-mono text-slate-400 font-bold">{time}</span>;
}
