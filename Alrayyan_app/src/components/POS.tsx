import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  User,
  CreditCard,
  Banknote,
  Printer,
  Barcode as BarcodeIcon,
  X,
  Package,
  Wallet,
  Archive,
  FolderOpen,
  RotateCcw,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Product, Customer, User as UserType } from '../types';
import { appAlert, appSuccess, appError } from '../utils/appAlert';
import {appConfirm} from '../utils/appConfirm'
import { formatAppDateTime } from '../utils/formatDateTime';



interface POSProps {
  user: UserType | null;
}

interface CartItem extends Product {
  quantity: number;
  quantityInput: string;
  desiredTotalInput: string;
}

type PaymentMethod = 'cash' | 'card' | 'credit';
type CurrencyCode = 'SYP' | 'USD' | 'TRY' | 'SAR' | 'AED';

interface SuspendedSale {
  id: string;
  createdAt: string;
  customerId: number | null;
  customerName: string;
  paymentMethod: PaymentMethod;
  paidAmountInput: string;
  discountInput: string;
  saleCurrency: CurrencyCode;
  cart: CartItem[];
  grandTotal: number;
  totalItems: number;
}

const POS: React.FC<POSProps> = ({ user }) => {
  const navigate = useNavigate();
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const isBypassingLeaveGuardRef = useRef(false);

const [showReturnModal, setShowReturnModal] = useState(false);
const [returnSaleIdInput, setReturnSaleIdInput] = useState('');
const [isReturnLoading, setIsReturnLoading] = useState(false);
const [returnContext, setReturnContext] = useState<any>(null);
const [returnReasonInput, setReturnReasonInput] = useState('');
const [returnNotesInput, setReturnNotesInput] = useState('');
const [returnMethod, setReturnMethod] = useState<'cash_refund' | 'debt_discount' | 'stock_only'>('cash_refund');
const [returnItemsState, setReturnItemsState] = useState<Record<number, string>>({});
const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);
const [showReturnReceipt, setShowReturnReceipt] = useState(false);
const [lastReturnId, setLastReturnId] = useState<number | null>(null);
const [lastReturnData, setLastReturnData] = useState<any>(null);
const [isPrintingReturn, setIsPrintingReturn] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [lastAddedCartItemId, setLastAddedCartItemId] = useState<number | null>(null);

  const [showBarcodeMatchesModal, setShowBarcodeMatchesModal] = useState(false);
const [barcodeMatchedProducts, setBarcodeMatchedProducts] = useState<Product[]>([]);
const [barcodeLookupValue, setBarcodeLookupValue] = useState('');
  // صارت نصوص حتى تبقى الحقول فارغة فعلًا ولا تتأثر بلغة النظام
  const [paidAmountInput, setPaidAmountInput] = useState('');
  const [discountInput, setDiscountInput] = useState('');

  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSaleId, setLastSaleId] = useState<number | null>(null);
  const [lastSaleData, setLastSaleData] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [saleCurrency, setSaleCurrency] = useState<CurrencyCode>('SYP');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isPaidAmountManuallyEdited, setIsPaidAmountManuallyEdited] = useState(false);

  const [suspendedSales, setSuspendedSales] = useState<SuspendedSale[]>(() => {
    try {
      const raw = localStorage.getItem('pos_suspended_sales');
      if (!raw) return [];

      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.error('Error reading suspended sales from localStorage:', err);
      return [];
    }
  });

  const [showSuspendedSales, setShowSuspendedSales] = useState(false);
  const [currentShift, setCurrentShift] = useState<any>(null);
const [openingBalanceInput, setOpeningBalanceInput] = useState('');
const [openingNoteInput, setOpeningNoteInput] = useState('');
const [closingCashInput, setClosingCashInput] = useState('');
const [closingNoteInput, setClosingNoteInput] = useState('');
const [isShiftLoading, setIsShiftLoading] = useState(false);
const [shiftHistory, setShiftHistory] = useState<any[]>([]);
const [showShiftHistory, setShowShiftHistory] = useState(false);
const [isShiftHistoryLoading, setIsShiftHistoryLoading] = useState(false);

  const suspendedSalesStorageKey = 'pos_suspended_sales';

  const getLeaveWarningMessage = () =>
    'يوجد منتجات في السلة , عملية التأكيد ستمسح السلة هل انت متأكد';

  const hasPendingCart = cart.length > 0 && !showReceipt && lastSaleId === null;

  const normalizeDigits = (value: string) => {
    return value
      .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
      .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
      .replace(/٫/g, '.')
      .replace(/,/g, '.')
      .replace(/[^\d.]/g, '')
      .replace(/(\..*)\./g, '$1');
  };

  const withBypassedLeaveGuard = (callback: () => void) => {
    isBypassingLeaveGuardRef.current = true;
    callback();
    setTimeout(() => {
      isBypassingLeaveGuardRef.current = false;
    }, 300);
  };

  const askBeforeLeavingCashier = async (): Promise<boolean> => {
    if (!hasPendingCart || isBypassingLeaveGuardRef.current) return true;

    try {
      const confirmed = await Promise.resolve(
        appConfirm('يوجد منتجات في السلة في حال ضغطت تأكيد ستمسح سلة المبيعات')
      );

      return Boolean(confirmed);
    } catch (err) {
      console.error('appConfirm failed:', err);

      if (typeof appError === 'function') {
        appError('تعذر عرض رسالة التنبيه الخاصة بالخروج من صفحة الكاشير.');
      }

      return false;
    }
  };
  const getCurrencySymbol = (currencyCode?: CurrencyCode): string => {
  const code: CurrencyCode = currencyCode ?? getActiveCurrencyCode();

  const symbols: Record<CurrencyCode, string> = {
    SYP: 'ل.س',
    USD: '$',
    TRY: 'TL',
    SAR: 'ر.س',
    AED: 'د.إ'
  };

  return symbols[code];
};

  const safeNavigate = async (to: string) => {
    const confirmed = await askBeforeLeavingCashier();
    if (!confirmed) return;

    withBypassedLeaveGuard(() => {
      navigate(to);
    });
  };

  useEffect(() => {
    loadInitialData();
    barcodeInputRef.current?.focus();
  }, []);


  useEffect(() => {
    if (!settings?.currency) return;

    const currency = settings.currency;
    if (
      currency === 'USD' ||
      currency === 'TRY' ||
      currency === 'SAR' ||
      currency === 'AED' ||
      currency === 'SYP'
    ) {
      setSaleCurrency(currency);
    } else if (currency === '$') {
      setSaleCurrency('USD');
    } else if (currency === 'ل.س') {
      setSaleCurrency('SYP');
    } else {
      setSaleCurrency('SYP');
    }
  }, [settings]);
useEffect(() => {
  if (!settings) return;

  if (settings.enable_shifts === 'true') {
    fetchCurrentShift();
  } else {
    setCurrentShift(null);
  }
}, [settings]);
  useEffect(() => {
    if (hasPendingCart) {
      sessionStorage.setItem('cashier_has_pending_cart', 'true');
    } else {
      sessionStorage.removeItem('cashier_has_pending_cart');
    }

    return () => {
      sessionStorage.removeItem('cashier_has_pending_cart');
    };
  }, [hasPendingCart]);

  useEffect(() => {
    try {
      localStorage.setItem(suspendedSalesStorageKey, JSON.stringify(suspendedSales));
    } catch (err) {
      console.error('Failed to persist suspended sales:', err);
    }
  }, [suspendedSales]);

const loadInitialData = async () => {
  await Promise.all([
    fetchProducts(),
    fetchCustomers(),
    fetchSettings()
  ]);
};

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      setSettings(data);
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching products:', err);
      setProducts([]);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers');
      const data = await res.json();
      setCustomers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching customers:', err);
      setCustomers([]);
    }
  };
const fetchCurrentShift = async () => {
  try {
    const res = await fetch('/api/shifts/current');
    const data = await res.json();
    setCurrentShift(data?.shift || null);
  } catch (err) {
    console.error('Error fetching current shift:', err);
    setCurrentShift(null);
  }
};

const openShift = async () => {
  
  if (!user?.id) {
    appError('لا يوجد مستخدم مسجل دخول');
    return;
  }

  const openingBalance = Number(openingBalanceInput || 0);

  if (!Number.isFinite(openingBalance) || openingBalance < 0) {
    appError('رصيد بداية الوردية غير صالح');
    return;
  }

  try {
    setIsShiftLoading(true);

    const res = await fetch('/api/shifts/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
  user_id: user.id,
  opening_balance: openingBalance,
  opening_note: openingNoteInput.trim() || null,
  currency_code: getCurrencyCode()
})
    });

    const result = await res.json();

    if (!result?.success) {
      appError(result?.message || 'تعذر فتح الوردية');
      return;
    }

    setCurrentShift(result.shift || null);
    setOpeningBalanceInput('');
    setOpeningNoteInput('');
    appSuccess('تم فتح الوردية بنجاح');
  } catch (err) {
    console.error('Open shift error:', err);
    appError('حدث خطأ أثناء فتح الوردية');
  } finally {
    setIsShiftLoading(false);
  }
};

const closeShift = async () => {
  if (!user?.id) {
    appError('لا يوجد مستخدم مسجل دخول');
    return;
  }

  const countedCash = Number(closingCashInput || 0);

  if (!Number.isFinite(countedCash) || countedCash < 0) {
    appError('المبلغ النقدي عند الإغلاق غير صالح');
    return;
  }

  try {
    setIsShiftLoading(true);

    const res = await fetch('/api/shifts/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: user.id,
        closing_cash_counted: countedCash,
        closing_note: closingNoteInput.trim() || null
      })
    });

    const result = await res.json();

    if (!result?.success) {
      appError(result?.message || 'تعذر إغلاق الوردية');
      return;
    }

    setCurrentShift(null);
    setClosingCashInput('');
    setClosingNoteInput('');
    appSuccess('تم إغلاق الوردية بنجاح');
  } catch (err) {
    console.error('Close shift error:', err);
    appError('حدث خطأ أثناء إغلاق الوردية');
  } finally {
    setIsShiftLoading(false);
  }
};
const fetchShiftHistory = async () => {
  try {
    setIsShiftHistoryLoading(true);

    const res = await fetch('/api/shifts');
    const data = await res.json();

    if (!data?.success) {
      appError(data?.message || 'تعذر تحميل سجل الورديات');
      return;
    }

    setShiftHistory(Array.isArray(data.shifts) ? data.shifts : []);
  } catch (err) {
    console.error('Fetch shift history error:', err);
    appError('حدث خطأ أثناء تحميل سجل الورديات');
  } finally {
    setIsShiftHistoryLoading(false);
  }
};
const fetchReturnContext = async () => {
  const saleId = Number(returnSaleIdInput || 0);

  if (!saleId || Number.isNaN(saleId)) {
    appError('أدخل رقم فاتورة صالح');
    return;
  }

  try {
    setIsReturnLoading(true);
    setReturnContext(null);

    const res = await fetch(`/api/sales/${saleId}/return-context`);
    const data = await res.json();

    if (!data?.success) {
      appError(data?.message || 'تعذر تحميل بيانات المرتجع');
      return;
    }

    setReturnContext(data);
    setReturnItemsState({});
  } catch (err) {
    console.error('Fetch return context error:', err);
    appError('حدث خطأ أثناء تحميل بيانات الفاتورة');
  } finally {
    setIsReturnLoading(false);
  }
};

const submitReturn = async () => {
  if (!returnContext?.sale?.id) {
    appError('لا توجد فاتورة محملة للمرتجع');
    return;
  }

  const preparedItems = (returnContext.items || [])
    .map((item: any) => {
      const rawValue = returnItemsState[item.id] ?? '';
      const qty = Number(rawValue || 0);
      const remainingQty = Number(item.remaining_quantity || 0);

      return {
        sale_item_id: Number(item.id),
        product_name: item.product_name,
        quantity: qty,
        remaining_quantity: remainingQty
      };
    })
    .filter((item: any) => Number(item.quantity || 0) > 0);

  if (preparedItems.length === 0) {
    appError('أدخل كمية مرتجع لصنف واحد على الأقل');
    return;
  }

  for (const item of preparedItems) {
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      appError(`كمية المرتجع غير صالحة للصنف "${item.product_name}"`);
      return;
    }

    if (item.quantity > item.remaining_quantity) {
      appError(`كمية المرتجع للصنف "${item.product_name}" أكبر من الكمية المتبقية`);
      return;
    }
  }

  if (returnMethod === 'debt_discount' && !returnContext.sale?.customer_id) {
    appError('لا يمكن خصم المرتجع من دين فاتورة لا تحتوي على عميل');
    return;
  }

  try {
    setIsSubmittingReturn(true);

    const res = await fetch(`/api/sales/${returnContext.sale.id}/returns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: user?.id,
        reason: returnReasonInput.trim() || null,
        notes: returnNotesInput.trim() || null,
        return_method: returnMethod,
        return_currency: getActiveCurrencyCode(),
        items: preparedItems.map((item: any) => ({
          sale_item_id: item.sale_item_id,
          quantity: item.quantity
        }))
      })
    });

    const data = await res.json();

 if (!data?.success) {
  appError(data?.message || 'تعذر تنفيذ المرتجع');
  return;
}

await fetchProducts();
await fetchCurrentShift().catch(() => null);

setLastReturnId(Number(data?.return_record?.id || 0) || null);
setLastReturnData(data);
setShowReturnReceipt(true);

resetReturnModalState();
appSuccess('تم تنفيذ المرتجع بنجاح');
  } catch (err) {
    console.error('Submit return error:', err);
    appError('حدث خطأ أثناء تنفيذ المرتجع');
  } finally {
    setIsSubmittingReturn(false);
  }
};
const setReturnItemQuantityInput = (saleItemId: number, value: string) => {
  setReturnItemsState((prev) => ({
    ...prev,
    [saleItemId]: normalizeDigits(value)
  }));
};

const resetReturnModalState = () => {
  
  setShowReturnModal(false);
  setReturnSaleIdInput('');
  setReturnContext(null);
  setReturnReasonInput('');
  setReturnNotesInput('');
  setReturnMethod('cash_refund');
  setReturnItemsState({});
  setIsSubmittingReturn(false);
};
const openShiftHistoryModal = async () => {
  await fetchShiftHistory();
  setShowShiftHistory(true);
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

    return 'SYP';
  };
const shiftsEnabled = settings?.enable_shifts === 'true';
  const getActiveCurrencyCode = (): CurrencyCode => {
    if (
      saleCurrency === 'USD' ||
      saleCurrency === 'TRY' ||
      saleCurrency === 'SAR' ||
      saleCurrency === 'AED' ||
      saleCurrency === 'SYP'
    ) {
      return saleCurrency;
    }

    return getCurrencyCode();
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

const convertFromUSD = (amount: number, targetCurrency?: CurrencyCode) => {
  const currencyCode = targetCurrency || getActiveCurrencyCode();
  const rate = getRateFromUSD(currencyCode);
  return Number(amount || 0) * rate;
};

const convertToUSD = (amount: number, sourceCurrency?: CurrencyCode) => {
  const currencyCode = sourceCurrency || getActiveCurrencyCode();
  const rate = getRateFromUSD(currencyCode);
  if (!rate) return Number(amount || 0);
  return Number(amount || 0) / rate;
};

  const roundQuantity = (value: number) => Number((value || 0).toFixed(3));

  const numberToInputString = (value: number, maxDecimals: number) => {
    const safeValue = Number(value || 0);
    if (!Number.isFinite(safeValue)) return '';

    return safeValue
      .toFixed(maxDecimals)
      .replace(/\.?0+$/, '');
  };

  const quantityToInputString = (quantity: number) => {
    return numberToInputString(quantity, 3);
  };

  const moneyInputFromUSD = (amount: number, currencyCode?: CurrencyCode) => {
  const code = currencyCode || getActiveCurrencyCode();
  const converted = convertFromUSD(Number(amount || 0), code);
  const fractionDigits = code === 'SYP' ? 0 : 2;

  if (code === 'SYP') {
    return Math.round(converted).toString();
  }

  return converted.toFixed(fractionDigits);
};

 const syncCartItemByQuantity = (
  item: CartItem,
  nextQuantity: number,
  currencyCode?: CurrencyCode
): CartItem => {
  const minimumQuantity = isWeightedProduct(item) ? 0.001 : 1;

  const safeQuantity = isWeightedProduct(item)
    ? roundQuantity(Math.max(minimumQuantity, nextQuantity))
    : Math.max(1, Math.round(nextQuantity));

  return {
    ...item,
    quantity: safeQuantity,
    quantityInput: isWeightedProduct(item)
      ? quantityToInputString(safeQuantity)
      : String(safeQuantity),
    desiredTotalInput: moneyInputFromUSD(item.sale_price * safeQuantity, currencyCode)
  };
};


  const createCartItem = (product: Product, quantity = 1): CartItem => {
  return syncCartItemByQuantity(
    {
      ...product,
      quantity,
      quantityInput: '',
      desiredTotalInput: ''
    },
    quantity
  );
};
const normalizeUnitValue = (unit?: string) => (unit || '').trim().toLowerCase();

const isWeightedUnit = (unit?: string) => {
  const normalized = normalizeUnitValue(unit);
  return (
    normalized === 'كيلو' ||
    normalized === 'kg' ||
    normalized === 'kilo' ||
    normalized === 'kilogram' ||
    normalized === 'كيلوغرام' ||
    normalized === 'لتر' ||
    normalized === 'ltr' ||
    normalized === 'liter' ||
    normalized === 'litre'
  );
};

const isWeightedProduct = (product: Product | CartItem) => {
  return isWeightedUnit(product.unit);
};

 const formatMoney = (amount: number, currencyCode?: CurrencyCode) => {
  const code = currencyCode || getActiveCurrencyCode();
  const converted = convertFromUSD(Number(amount || 0), code);
  const fractionDigits = code === 'SYP' ? 0 : 2;

  return `${converted.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  })} ${getCurrencySymbol(code)}`;
};

const formatMoneyRaw = (amount: number, currencyCode?: CurrencyCode) => {
  const code = currencyCode || getActiveCurrencyCode();
  const converted = convertFromUSD(Number(amount || 0), code);
  const fractionDigits = code === 'SYP' ? 0 : 2;

  return converted.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  });
};
const formatShiftMoney = (amount: number, currencyCode?: string) => {
  const code = (currencyCode || getCurrencyCode()) as CurrencyCode;
  const fractionDigits = code === 'SYP' ? 0 : 2;

  return `${Number(amount || 0).toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  })} ${getCurrencySymbol(code)}`;
};
  const showUsd = settings?.show_usd === 'true';

  const formatImageUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http') || url.startsWith('data:')) return url;
    return `/api/local-image?path=${encodeURIComponent(url)}`;
  };
const closeBarcodeMatchesModal = () => {
  setShowBarcodeMatchesModal(false);
  setBarcodeMatchedProducts([]);
  setBarcodeLookupValue('');
  setSearchQuery('');

  setTimeout(() => {
    barcodeInputRef.current?.focus();
  }, 50);
};

const handleSelectBarcodeMatchedProduct = (product: Product) => {
  addToCart(product);
  setShowBarcodeMatchesModal(false);
  setBarcodeMatchedProducts([]);
  setBarcodeLookupValue('');
};
const addToCart = (product: Product) => {
  setCart((prev) => {
    const existing = prev.find((item) => item.id === product.id);

    if (existing) {
      const updated = prev.map((item) =>
        item.id === product.id ? syncCartItemByQuantity(item, item.quantity + 1) : item
      );

      const target = updated.find((item) => item.id === product.id);
      const others = updated.filter((item) => item.id !== product.id);

      return target ? [target, ...others] : updated;
    }

    return [createCartItem(product, 1), ...prev];
  });

  setLastAddedCartItemId(product.id);

  setTimeout(() => {
    setLastAddedCartItemId((current) => (current === product.id ? null : current));
  }, 1800);

  setSearchQuery('');
  barcodeInputRef.current?.focus();
};
  const updateQuantity = (id: number, delta: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return syncCartItemByQuantity(item, item.quantity + delta);
        }
        return item;
      })
    );
  };

  const setExactQuantity = (id: number, qty: number) => {
    if (Number.isNaN(qty)) return;

    setCart((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return syncCartItemByQuantity(item, qty);
        }
        return item;
      })
    );
  };
const setQuantityInputValue = (id: number, rawValue: string) => {
  const normalized = normalizeDigits(rawValue);

  setCart((prev) =>
    prev.map((item) => {
      if (item.id !== id) return item;

      if (normalized === '') {
        return {
          ...item,
          quantityInput: '',
          desiredTotalInput: ''
        };
      }

      const parsedQuantity = Number(normalized);

      if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
        return {
          ...item,
          quantityInput: normalized
        };
      }

      const safeQuantity = isWeightedProduct(item)
        ? roundQuantity(parsedQuantity)
        : Math.max(1, Math.round(parsedQuantity));

      const lineTotal = item.sale_price * safeQuantity;

      return {
        ...item,
        quantity: safeQuantity,
        quantityInput: isWeightedProduct(item)
          ? normalized
          : String(safeQuantity),
        desiredTotalInput: moneyInputFromUSD(lineTotal)
      };
    })
  );
};
const setDesiredLineTotal = (id: number, rawValue: string) => {
  const normalized = normalizeDigits(rawValue);

  setCart((prev) =>
    prev.map((item) => {
      if (item.id !== id) return item;

      if (normalized === '') {
        return {
          ...item,
          desiredTotalInput: '',
          quantityInput: ''
        };
      }

      const targetAmountInCurrentCurrency = Number(normalized);

      if (!Number.isFinite(targetAmountInCurrentCurrency) || targetAmountInCurrentCurrency <= 0) {
        return {
          ...item,
          desiredTotalInput: normalized
        };
      }

      const targetAmountInUSD = convertToUSD(
        targetAmountInCurrentCurrency,
        getActiveCurrencyCode()
      );

      const nextQuantity =
        item.sale_price > 0 ? targetAmountInUSD / item.sale_price : item.quantity;

     if (isWeightedProduct(item)) {
  const safeQuantity = roundQuantity(Math.max(0.001, nextQuantity));

  return {
    ...item,
    quantity: safeQuantity,
    quantityInput: quantityToInputString(safeQuantity),
    desiredTotalInput: normalized
  };
}

appError('السعر المطلوب متاح فقط للمنتجات التي وحدتها كيلو');
return item;

      const roundedQuantity = Math.max(1, Math.round(nextQuantity));

      return {
        ...item,
        quantity: roundedQuantity,
        quantityInput: String(roundedQuantity),
        desiredTotalInput: moneyInputFromUSD(item.sale_price * roundedQuantity)
      };
    })
  );
};

  const finalizeDesiredLineTotal = (id: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        return {
          ...item,
          desiredTotalInput: moneyInputFromUSD(item.sale_price * item.quantity)
        };
      })
    );
  };

  const removeFromCart = (id: number) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

const clearCartOnly = async () => {
  try {
    if (cart.length > 0) {
      const confirmed = await Promise.resolve(
        appConfirm('هل أنت متأكد من مسح السلة الحالية؟')
      );

      if (!confirmed) return;
    }

    setCart([]);
    setDiscountInput('');
    setPaidAmountInput('');
    setIsPaidAmountManuallyEdited(false);
    setSelectedCustomer(null);
    setPaymentMethod('cash');
    setSearchQuery('');
    setError(null);
    setSaleCurrency(getCurrencyCode());
    setLastAddedCartItemId(null);

    setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 0);

    if (typeof appSuccess === 'function') {
      appSuccess('تم مسح السلة بنجاح.');
    }
  } catch (err) {
    console.error('clearCartOnly error:', err);

    if (typeof appError === 'function') {
      appError('حدث خطأ أثناء مسح السلة.');
    } else {
      appAlert('Wrong-Pascket not Removed')
    }
  }
};

const handleBarcodeSearch = (e: React.FormEvent) => {
  e.preventDefault();

  const normalizedQuery = searchQuery.trim();
  if (!normalizedQuery) return;

  const matchedProducts = products.filter((p) => p.barcode === normalizedQuery);

  if (matchedProducts.length === 1) {
    addToCart(matchedProducts[0]);
    return;
  }

  if (matchedProducts.length > 1) {
    setBarcodeMatchedProducts(matchedProducts);
    setBarcodeLookupValue(normalizedQuery);
    setShowBarcodeMatchesModal(true);
    return;
  }

  appError('لم يتم العثور على منتج بهذا الباركود.');
};
  const resetSaleForm = async () => {
    setLastAddedCartItemId(null);
    setCart([]);
    setDiscountInput('');
    setPaidAmountInput('');
    setSelectedCustomer(null);
    setPaymentMethod('cash');
    setSearchQuery('');
    setLastSaleId(null);
    setLastSaleData(null);
    setShowReceipt(false);
    setError(null);
    setIsProcessing(false);
    setIsPrinting(false);
    setSaleCurrency(getCurrencyCode());
    setIsPaidAmountManuallyEdited(false);

    await fetchProducts();
    barcodeInputRef.current?.focus();
  };

  const closeReceipt = async () => {
    await resetSaleForm();
  };

  const refreshPOS = async (): Promise<void> => {
    try {
      setSearchQuery('');
      setCart([]);
      setSelectedCustomer(null);
      setPaymentMethod('cash');
      setPaidAmountInput('');
      setDiscountInput('');
      setShowReceipt(false);
      setLastSaleId(null);
      setLastSaleData(null);
      setError(null);
      setIsProcessing(false);
      setIsPrinting(false);
      setIsPaidAmountManuallyEdited(false);

      await loadInitialData();
      setSaleCurrency(getCurrencyCode());
      barcodeInputRef.current?.focus();

      appSuccess('تم تحديث شاشة الكاشير بنجاح.');
    } catch (err) {
      console.error('Refresh POS error:', err);
      appError('فشل تحديث شاشة الكاشير.');
    }
  };

 const discount = convertToUSD(Number(discountInput || 0), getActiveCurrencyCode());

const total = cart.reduce((sum, item) => sum + item.sale_price * item.quantity, 0);
const grandTotal = total - discount;

const autoPaidAmount = convertFromUSD(grandTotal, getActiveCurrencyCode());

const paidAmount =
  paymentMethod === 'credit'
    ? 0
    : isPaidAmountManuallyEdited
    ? Number(paidAmountInput || 0)
    : autoPaidAmount;

const paidAmountInUSD =
  paymentMethod === 'credit' ? 0 : convertToUSD(paidAmount, getActiveCurrencyCode());

const difference = paidAmountInUSD - grandTotal;
const change = Math.max(difference, 0);
const remaining = Math.max(-difference, 0);
 useEffect(() => {
  const isTypingElement = (target: EventTarget | null) => {
    const element = target as HTMLElement | null;
    if (!element) return false;

    const tagName = element.tagName;
    return (
      tagName === 'INPUT' ||
      tagName === 'TEXTAREA' ||
      tagName === 'SELECT' ||
      element.isContentEditable
    );
  };

  const handleKeyDown = async (e: KeyboardEvent) => {
    const typingNow = isTypingElement(e.target);
const isFunctionShortcut =
  e.key === 'F2' ||
  e.key === 'F4' ||
  e.key === 'F6' ||
  e.key === 'F7' ||
  e.key === 'F1' ||
  e.key === 'F3' ||
  e.key === 'F5' ||
  e.key === 'F9' ||
  e.key === 'Escape';

    // F2 = التركيز على البحث / الباركود
    if (e.key === 'F2') {
      e.preventDefault();
      barcodeInputRef.current?.focus();
      barcodeInputRef.current?.select();
      return;
    }

    // ESC = إغلاق النوافذ أو تنظيف البحث
   if (e.key === 'Escape') {
  e.preventDefault();

  if (showReceipt) {
    await closeReceipt();
    return;
  }

  if (showBarcodeMatchesModal) {
    closeBarcodeMatchesModal();
    return;
  }

  if (showSuspendedSales) {
    setShowSuspendedSales(false);
    return;
  }

  if (showReturnModal) {
    resetReturnModalState();
    return;
  }

  if (showShiftHistory) {
    setShowShiftHistory(false);
    return;
  }

  if (searchQuery) {
    setSearchQuery('');
    barcodeInputRef.current?.focus();
    return;
  }
}

    // لا ننفذ بقية الاختصارات إذا المستخدم يكتب داخل حقل
    // حتى لا نخرب عليه الكتابة
    if (typingNow && !isFunctionShortcut) return;

    // F1 = إتمام الدفع
    if (e.key === 'F1') {
      e.preventDefault();

      const checkoutDisabled =
        cart.length === 0 ||
        isProcessing ||
        grandTotal <= 0 ||
        (paymentMethod !== 'credit' && paidAmountInUSD + 0.0001 < grandTotal);

      if (!checkoutDisabled) {
        await handleCheckout();
      }
      return;
    }

    // F6 = حفظ مؤقت
    if (e.key === 'F6') {
      e.preventDefault();
      if (cart.length > 0 && !isProcessing) {
        await suspendCurrentSale();
      }
      return;
    }

    // F7 = فتح الفواتير المؤقتة
    if (e.key === 'F7') {
      e.preventDefault();
      setShowSuspendedSales(true);
      return;
    }

    // F8 = مسح السلة
    if (e.key === 'F8') {
  e.preventDefault();
  if (cart.length > 0) {
    await clearCartOnly();
  }
  return;
}
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => {
    window.removeEventListener('keydown', handleKeyDown);
  };
}, [
  searchQuery,
  showReceipt,
  showBarcodeMatchesModal,
  showSuspendedSales,
  showReturnModal,
  showShiftHistory,
  cart.length,
  isProcessing,
  grandTotal,
  paymentMethod,
  paidAmountInUSD
]);
  useEffect(() => {
    if (paymentMethod === 'credit') return;
    if (showReceipt) return;
    if (isPaidAmountManuallyEdited) return;

    const currentCurrencyTotal = convertFromUSD(grandTotal, getActiveCurrencyCode());
    const fractionDigits = getActiveCurrencyCode() === 'SYP' ? 0 : 2;

    setPaidAmountInput(grandTotal > 0 ? currentCurrencyTotal.toFixed(fractionDigits) : '');
  }, [
    cart,
    discountInput,
    saleCurrency,
    paymentMethod,
    showReceipt,
    grandTotal,
    isPaidAmountManuallyEdited
  ]);
useEffect(() => {
  if (!shiftsEnabled) {
    setCurrentShift(null);
    setShowShiftHistory(false);
  }
}, [shiftsEnabled]);
  useEffect(() => {
    setCart((prev) =>
      prev.map((item) => ({
        ...item,
        desiredTotalInput: moneyInputFromUSD(item.sale_price * item.quantity, saleCurrency)
      }))
    );
  }, [saleCurrency]);

  const getSuspendedSaleCustomerName = (customerId: number | null) => {
    return customers.find((c) => c.id === customerId)?.name || 'عميل عام (افتراضي)';
  };

  const suspendCurrentSale = async () => {
    if (cart.length === 0) {
      appError('لا يمكن حفظ فاتورة مؤقتة لأن السلة فارغة.');
      return;
    }

    try {
      const suspendedSale: SuspendedSale = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        createdAt: new Date().toISOString(),
        customerId: selectedCustomer,
        customerName: getSuspendedSaleCustomerName(selectedCustomer),
        paymentMethod,
        paidAmountInput,
        discountInput,
        saleCurrency: getActiveCurrencyCode(),
        cart: cart.map((item) => ({ ...item })),
        grandTotal,
        totalItems: cart.reduce((sum, item) => sum + item.quantity, 0)
      };

      setSuspendedSales((prev) => [suspendedSale, ...prev]);

      setCart([]);
      setLastAddedCartItemId(null);
      setPaidAmountInput('');
      setDiscountInput('');
      setSelectedCustomer(null);
      setPaymentMethod('cash');
      setSearchQuery('');
      setError(null);
      setSaleCurrency(getCurrencyCode());
      setShowReceipt(false);
      setLastSaleId(null);
      setLastSaleData(null);
      setIsPaidAmountManuallyEdited(false);

      sessionStorage.removeItem('cashier_has_pending_cart');

      setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 50);

      appSuccess('تم حفظ الفاتورة مؤقتًا بنجاح.');
    } catch (err) {
      console.error('Suspend sale error:', err);
      appError('حدث خطأ أثناء حفظ الفاتورة مؤقتًا.');
    }
  };

  const restoreSuspendedSale = async (sale: SuspendedSale) => {
    try {
      if (hasPendingCart) {
        const confirmed = await Promise.resolve(
          appConfirm('يوجد فاتورة حالية في السلة. هل تريد استبدالها بالفاتورة المؤقتة؟')
        );

        if (!confirmed) return;
      }

   setCart(
  (sale.cart || []).map((item) =>
    syncCartItemByQuantity(
      {
        ...item,
        quantityInput: item.quantityInput || quantityToInputString(Number(item.quantity || 0)),
        desiredTotalInput: item.desiredTotalInput || ''
      },
      Number(item.quantity || 0),
      sale.saleCurrency || getCurrencyCode()
    )
  )
);

      setSelectedCustomer(sale.customerId ?? null);
setPaymentMethod(sale.paymentMethod || 'cash');
setPaidAmountInput(sale.paidAmountInput || '');
setDiscountInput(sale.discountInput || '');
setSaleCurrency(sale.saleCurrency || getCurrencyCode());
setSearchQuery('');
setError(null);
setShowReceipt(false);
setLastSaleId(null);
setLastSaleData(null);
setShowSuspendedSales(false);
setIsPaidAmountManuallyEdited(false);

      setSuspendedSales((prev) => prev.filter((item) => item.id !== sale.id));

      setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 50);

      appSuccess('تمت استعادة الفاتورة المؤقتة بنجاح.');
    } catch (err) {
      console.error('Restore suspended sale error:', err);
      appError('تعذر استعادة الفاتورة المؤقتة.');
    }
  };

  const deleteSuspendedSale = async (saleId: string) => {
    try {
      const confirmed = await Promise.resolve(
        appConfirm('هل أنت متأكد من حذف هذه الفاتورة المؤقتة؟')
      );

      if (!confirmed) return;

      setSuspendedSales((prev) => prev.filter((item) => item.id !== saleId));
      appSuccess('تم حذف الفاتورة المؤقتة.');
    } catch (err) {
      console.error('Delete suspended sale error:', err);
      appError('تعذر حذف الفاتورة المؤقتة.');
    }
  };

  const escapeHtml = (value: unknown) => {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  };

 const renderInvoiceHtml = (invoiceData: any) => {
  const items = invoiceData.items || invoiceData.sale_items || invoiceData.purchase_items || [];

  const invoiceNumber =
    invoiceData.id || invoiceData.saleId || invoiceData.sale_id || lastSaleId || '';

  const invoiceDate = invoiceData.created_at || new Date();

  const paymentMethodValue =
  invoiceData.payment_method || invoiceData.paymentMethod || lastSaleData?.paymentMethod || 'cash';

const customerName =
  invoiceData.customer_name ||
  invoiceData.customer?.name ||
  lastSaleData?.customer_name ||
  'عميل نقدي';

const totalAmount = Number(invoiceData.total_amount ?? invoiceData.total ?? lastSaleData?.total ?? 0);
const discountAmount = Number(invoiceData.discount ?? lastSaleData?.discount ?? 0);
const grandTotalAmount = totalAmount - discountAmount;

const paidAmountValue = Number(
  invoiceData.paid_amount ?? invoiceData.paidAmount ?? lastSaleData?.paidAmount ?? 0
);

const remainingValue = Math.max(0, grandTotalAmount - paidAmountValue);
const changeValue = Math.max(0, paidAmountValue - grandTotalAmount);

const paymentMethodLabel =
  paymentMethodValue === 'cash'
    ? 'نقدي'
    : paymentMethodValue === 'card'
    ? 'بطاقة'
    : paidAmountValue > 0 && remainingValue > 0
    ? 'دفع جزئي'
    : 'دين';

  const activeCurrency = (lastSaleData?.saleCurrency || getActiveCurrencyCode()) as CurrencyCode;

  const money = (amount: number, currencyCode?: CurrencyCode) => {
    const code = currencyCode || activeCurrency;
    const converted = convertFromUSD(Number(amount || 0), code);
    const fractionDigits = code === 'SYP' ? 0 : 2;
    return `${converted.toLocaleString('en-US', {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits
    })} ${getCurrencySymbol(code)}`;
  };

  const moneyRaw = (amount: number, currencyCode?: CurrencyCode) => {
    const code = currencyCode || activeCurrency;
    const converted = convertFromUSD(Number(amount || 0), code);
    const fractionDigits = code === 'SYP' ? 0 : 2;
    return converted.toLocaleString('en-US', {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits
    });
  };

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
          <span class="col-price">${moneyRaw(unitPrice)}</span>
          <span class="col-total">${moneyRaw(lineTotal)}</span>
        </div>
      `;
    })
    .join('');

  return `
    <html lang="ar" dir="rtl">
      <head>
        <meta charset="utf-8" />
        <title>طباعة الفاتورة</title>
   <style>
  @page {
    size: auto;
    margin: 0;
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  html, body {
    background: #fff;
    color: #000;
    font-family: Arial, monospace;
  }

  body {
    padding: 0;
    font-size: 10px;
  }

.receipt {
    max-width: 54mm;
    margin-left: auto;
    margin-right: auto;
    padding: 1px 0 ;
}

  /* شبكة رباعية الأعمدة – نسب مرنة */
  .header-row, .item-row {
    display: grid;
    grid-template-columns: 42% 13% 20% 25%; /* صنف، كمية، سعر، إجمالي */
    align-items: center;
    gap: 0.5mm;           /* فجوة صغيرة جداً بين الأعمدة */
    margin: 0;
    padding: 2px 0;
    border-bottom: 1px solid #eee;
  }

  .header-row {
    font-weight: bold;
    border-bottom: 1px solid #999;
  }

  /* محاذاة وتنسيق الأعمدة */
  .col-name {
    text-align: left;
    margin-left=auto;
    word-break: break-word;   /* النص الطويل يلف إلى أسفل */
    padding-left: 0;
    padding-right: 0.5mm;
  }

  .col-qty {
    text-align: center;
  }

  .col-price {
    text-align: right;        /* السعر محاذى لليمين */
    direction: ltr;           /* للأرقام العربية */
    unicode-bidi: embed;
  }

  .col-total {
    text-align: right;
    font-weight: bold;
    direction: ltr;
    unicode-bidi: embed;
    white-space: nowrap;      /* منع التفاف الإجمالي */
  }

  /* باقي التنسيقات الأساسية */
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

  /* صفوف الإجمالي */
  .totals .row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 2mm;
    margin: 2px 0;
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
</style>
      </head>
      <body>
        <div class="receipt">
          <div class="text-center">
            <div class="title">${escapeHtml(settings?.shop_name || 'سوبر ماركت الخير')}</div>
            <div class="base muted">${escapeHtml(settings?.shop_address || 'دمشق، الميدان')}</div>
            ${
              settings?.shop_tax_number
                ? `<div class="small muted">الرقم الضريبي: ${escapeHtml(settings.shop_tax_number)}</div>`
                : ''
            }
          </div>

          <div class="sep"></div>

          <div class="row base">
            <span>رقم الفاتورة: #${escapeHtml(invoiceNumber)}</span>
            <span>${escapeHtml(
              formatAppDateTime(invoiceDate)
            )}</span>
          </div>

          <div class="row base" style="margin-top: 4px;">
            <span>الكاشير: ${escapeHtml(user?.full_name || '')}</span>
            <span>طريقة الدفع: ${escapeHtml(paymentMethodLabel)}</span>
          </div>

          <div class="row base" style="margin-top: 4px;">
            <span>العميل: ${escapeHtml(customerName)}</span>
          </div>

          <div class="row base" style="margin-top: 4px;">
            <span>عملة العملية: ${escapeHtml(getCurrencySymbol(activeCurrency))}</span>
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
              <span>${money(totalAmount)}</span>
            </div>

            ${
              discountAmount > 0
                ? `
                  <div class="row base" style="margin-top: 4px;">
                    <span>الخصم:</span>
                    <span>- ${money(discountAmount)}</span>
                  </div>
                `
                : ''
            }

            <div class="row lg bold" style="margin-top: 6px;">
              <span>الإجمالي:</span>
              <span>${money(grandTotalAmount)}</span>
            </div>

           ${
  paidAmountValue > 0 || remainingValue > 0 || changeValue > 0
    ? `
      <div class="row base" style="margin-top: 4px;">
        <span>المدفوع:</span>
        <span>${money(paidAmountValue)}</span>
      </div>
      <div class="row base" style="margin-top: 4px;">
        <span>${remainingValue > 0 ? 'المتبقي:' : 'الباقي:'}</span>
        <span>${money(remainingValue > 0 ? remainingValue : changeValue)}</span>
      </div>

      ${
        remainingValue > 0
          ? `
            <div class="text-center small bold" style="margin-top: 6px;">
              الباقي تم تسجيله عليك دين
            </div>
          `
          : ''
      }
    `
    : ''
}
          </div>

          <div class="footer">
            <div class="invoice-no">#${escapeHtml(invoiceNumber)}</div>
            <div class="small muted">${
              escapeHtml(settings?.receipt_footer || 'شكراً لزيارتكم، نرجو زيارتنا مرة أخرى!')
            }</div>
          </div>
        </div>
      </body>
    </html>
  `;
};
const renderReturnReceiptHtml = (returnData: any) => {
  const record = returnData?.return_record || {};
  const items = returnData?.items || [];
  const returnNumber = record.id || lastReturnId || '';
  const returnDate = record.created_at ? new Date(record.created_at) : new Date();

  const returnMethodValue = record.return_method || 'cash_refund';
  const returnMethodLabel =
    returnMethodValue === 'cash_refund'
      ? 'استرداد نقدي'
      : returnMethodValue === 'debt_discount'
      ? 'خصم من دين العميل'
      : 'إرجاع مخزون فقط';

  const customerName = record.customer_name || 'عميل نقدي';
  const activeCurrency = getActiveCurrencyCode();

  const money = (amount: number, currencyCode?: CurrencyCode) => {
    const code = currencyCode || activeCurrency;
    const converted = convertFromUSD(Number(amount || 0), code);
    const fractionDigits = code === 'SYP' ? 0 : 2;
    return `${converted.toLocaleString('en-US', {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits
    })} ${getCurrencySymbol(code)}`;
  };

  const moneyRaw = (amount: number, currencyCode?: CurrencyCode) => {
    const code = currencyCode || activeCurrency;
    const converted = convertFromUSD(Number(amount || 0), code);
    const fractionDigits = code === 'SYP' ? 0 : 2;
    return converted.toLocaleString('en-US', {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits
    });
  };

  const itemsHtml = items
    .map((item: any) => {
      const itemName = escapeHtml(item.product_name || 'صنف');
      const qty = Number(item.quantity || 0);
      const unitPrice = Number(item.unit_price || 0);
      const lineTotal = Number(item.total_price || unitPrice * qty);

      return `
        <div class="row item-row">
          <span class="col-name">${itemName}</span>
          <span class="col-qty">${qty.toLocaleString('en-US', { maximumFractionDigits: 3 })}</span>
          <span class="col-price">${moneyRaw(unitPrice)}</span>
          <span class="col-total">${moneyRaw(lineTotal)}</span>
        </div>
      `;
    })
    .join('');

  return `
    <html lang="ar" dir="rtl">
      <head>
        <meta charset="utf-8" />
        <title>سند مرتجع</title>
        <style>
          @page {
            size: auto;
            margin: 0;
          }

          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }

          html, body {
            background: #fff;
            color: #000;
            font-family: Arial, monospace;
          }

          body {
            padding: 0;
            font-size: 10px;
          }

          .receipt {
            max-width: 54mm;
            margin-left: auto;
            margin-right: auto;
            padding: 1px 0;
          }

          .header-row, .item-row {
            display: grid;
            grid-template-columns: 42% 13% 20% 25%;
            align-items: center;
            gap: 0.5mm;
            margin: 0;
            padding: 2px 0;
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

          .col-price,
          .col-total {
            text-align: right;
            direction: ltr;
            unicode-bidi: embed;
          }

          .col-total {
            font-weight: bold;
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

          .return-badge {
            text-align: center;
            font-size: 12px;
            font-weight: bold;
            margin: 6px 0;
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="text-center">
            <div class="title">${escapeHtml(settings?.shop_name || 'سوبر ماركت الخير')}</div>
            <div class="base muted">${escapeHtml(settings?.shop_address || 'دمشق، الميدان')}</div>
            ${
              settings?.shop_tax_number
                ? `<div class="small muted">الرقم الضريبي: ${escapeHtml(settings.shop_tax_number)}</div>`
                : ''
            }
          </div>

          <div class="return-badge">سند مرتجع مبيعات</div>

          <div class="sep"></div>

          <div class="row base">
            <span>رقم المرتجع: #${escapeHtml(returnNumber)}</span>
            <span>${escapeHtml(formatAppDateTime(returnDate))}</span>
          </div>

          <div class="row base" style="margin-top: 4px;">
            <span>رقم الفاتورة الأصلية: #${escapeHtml(record.sale_id || '')}</span>
            <span>الطريقة: ${escapeHtml(returnMethodLabel)}</span>
          </div>

          <div class="row base" style="margin-top: 4px;">
            <span>الموظف: ${escapeHtml(record.user_name || user?.full_name || '')}</span>
          </div>

          <div class="row base" style="margin-top: 4px;">
            <span>العميل: ${escapeHtml(customerName)}</span>
          </div>

          ${
            record.reason
              ? `
                <div class="row base" style="margin-top: 4px;">
                  <span>السبب: ${escapeHtml(record.reason)}</span>
                </div>
              `
              : ''
          }

          ${
            record.notes
              ? `
                <div class="row base" style="margin-top: 4px;">
                  <span>ملاحظات: ${escapeHtml(record.notes)}</span>
                </div>
              `
              : ''
          }

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
            <div class="row lg bold" style="margin-top: 6px;">
              <span>قيمة المرتجع:</span>
              <span>${money(Number(record.total_amount || 0))}</span>
            </div>
          </div>

          <div class="footer">
            <div class="invoice-no">#${escapeHtml(returnNumber)}</div>
            <div class="small muted">
              ${escapeHtml(settings?.receipt_footer || 'شكراً لزيارتكم، نرجو زيارتنا مرة أخرى!')}
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
};
const handlePrintReturnReceipt = async (returnId: number) => {
  if (!returnId) return;

  const printWindow = window.open('', '', 'width=380,height=760');

  if (!printWindow) {
    setError('المتصفح منع نافذة الطباعة. اسمح بالنوافذ المنبثقة ثم جرّب مرة ثانية.');
    setTimeout(() => setError(null), 5000);
    return;
  }

  try {
    setIsPrintingReturn(true);

    printWindow.document.open();
    printWindow.document.write(`
      <html lang="ar" dir="rtl">
        <head>
          <meta charset="utf-8" />
          <title>جاري التحضير...</title>
          <style>
            html, body {
              margin: 0;
              padding: 0;
              font-family: Arial, monospace;
              background: #fff;
            }
            body {
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              font-size: 13px;
            }
          </style>
        </head>
        <body>جاري تجهيز سند المرتجع للطباعة...</body>
      </html>
    `);
    printWindow.document.close();

    const res = await fetch(`/api/returns/${returnId}`);
    const data = await res.json();

    if (!data?.success) {
      throw new Error(data?.message || 'تعذر تحميل بيانات المرتجع');
    }

    const html = renderReturnReceiptHtml(data);
    openPrintWindowWithHtml(html, printWindow);
  } catch (err) {
    console.error('Error fetching return details for printing:', err);
    printWindow.close();
    setError('فشل تحميل بيانات المرتجع للطباعة');
    setTimeout(() => setError(null), 5000);
  } finally {
    setIsPrintingReturn(false);
  }
};
  const openPrintWindowWithHtml = (html: string, printWindow: Window) => {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 300);
    };

    printWindow.onafterprint = () => {
      printWindow.close();
    };
  };

 const handlePrintInvoice = async (saleId: number) => {
  if (!saleId) return;

  const printWindow = window.open('', '', 'width=380,height=760');

  if (!printWindow) {
    setError('المتصفح منع نافذة الطباعة. اسمح بالنوافذ المنبثقة ثم جرّب مرة ثانية.');
    setTimeout(() => setError(null), 5000);
    return;
  }

  try {
    setIsPrinting(true);

    printWindow.document.open();
    printWindow.document.write(`
      <html lang="ar" dir="rtl">
        <head>
          <meta charset="utf-8" />
          <title>جاري التحضير...</title>
          <style>
            html, body {
              margin: 0;
              padding: 0;
              font-family: Arial, monospace;
              background: #fff;
            }
            body {
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              font-size: 13px;
            }
          </style>
        </head>
        <body>جاري تجهيز الفاتورة للطباعة...</body>
      </html>
    `);
    printWindow.document.close();

    const res = await fetch(`/api/sales/${saleId}`);
    const data = await res.json();

    const html = renderInvoiceHtml(data);
    openPrintWindowWithHtml(html, printWindow);
  } catch (err) {
    console.error('Error fetching invoice details for printing:', err);
    printWindow.close();
    setError('فشل تحميل بيانات الفاتورة للطباعة');
    setTimeout(() => setError(null), 5000);
  } finally {
    setIsPrinting(false);
  }
};

const handleCheckout = async () => {
  if (cart.length === 0 || isProcessing || grandTotal <= 0) return;

  const hasZeroOrNegativePrice = cart.some(
    (item) => Number(item.sale_price ?? 0) <= 0
  );

  if (hasZeroOrNegativePrice) {
    setError('لا يمكن إتمام البيع لأن هناك صنفًا واحدًا على الأقل سعره صفر أو أقل');
    setTimeout(() => setError(null), 5000);
    return;
  }

  const paidAmountInUSD = convertToUSD(paidAmount, getActiveCurrencyCode());
  const grandTotalInUSD = Number(grandTotal || 0);
  const isPartialPayment = paymentMethod !== 'credit' && paidAmountInUSD < grandTotalInUSD;
  const isFullCredit = paymentMethod === 'credit';

  // ممنوع الدفع الجزئي لعميل غير مسجل
  if (isPartialPayment && !selectedCustomer) {
    setError('لا يمكن تسجيل دفعة جزئية إلا لعميل مسجل في النظام');
    setTimeout(() => setError(null), 5000);
    return;
  }

  // إن كان دين كامل بدون عميل مسجل يبقى نفس التنبيه الحالي
  if (isFullCredit && !selectedCustomer) {
    const confirmed = await appConfirm(
      'أنت على وشك تسجيل عملية بيع بالدين لعميل غير مسجل في النظام. هذا قد يصعّب متابعة الذمم لاحقًا. هل تريد المتابعة؟'
    );

    if (!confirmed) return;
  }

  setIsProcessing(true);
  setError(null);

  const paidAmountInUSDForSave = isFullCredit ? 0 : paidAmountInUSD;

  // إذا كان دفع جزئي نخزنها credit حتى تُحسب ذمة بدون كسر النظام الحالي
  const paymentMethodForSave =
    isPartialPayment || isFullCredit ? 'credit' : paymentMethod;

  const saleData = {
    customer_id: selectedCustomer || null,
    total_amount: total,
    discount,
    paid_amount: paidAmountInUSDForSave,
    payment_method: paymentMethodForSave,
    user_id: user?.id,
    sale_currency: getActiveCurrencyCode(),
    items: cart.map((item) => ({
      product_id: item.id,
      quantity: item.quantity,
      unit_price: item.sale_price,
      total_price: item.sale_price * item.quantity
    }))
  };

  try {
    const res = await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(saleData)
    });

    const result = await res.json();

    if (!result.success) {
      setError(result.message || 'فشل حفظ الفاتورة');
      setIsProcessing(false);
      setTimeout(() => setError(null), 5000);
      return;
    }

    const previewData = {
      items: [...cart],
      total,
      discount,
      grandTotal,
      paidAmount: isFullCredit ? 0 : paidAmountInUSDForSave,
      change: isFullCredit || isPartialPayment ? 0 : change,
      remaining: isFullCredit
        ? grandTotal
        : Math.max(0, grandTotal - paidAmountInUSDForSave),
      paymentMethod: paymentMethodForSave,
      saleCurrency: getActiveCurrencyCode(),
      customer_name:
        customers.find((c) => c.id === selectedCustomer)?.name || 'عميل نقدي'
    };

    setLastSaleId(result.saleId);
    setLastSaleData(previewData);
    setShowReceipt(true);
    setIsProcessing(false);
    sessionStorage.removeItem('cashier_has_pending_cart');
  } catch (err) {
    console.error('Checkout error:', err);
    setError('حدث خطأ أثناء حفظ الفاتورة');
    setIsProcessing(false);
    setTimeout(() => setError(null), 5000);
  }
};

  const filteredProducts = searchQuery
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.barcode.includes(searchQuery)
      )
    : [];

  return (
    
    <div className="flex flex-col lg:flex-row gap-5 h-[calc(100vh-230px)]" dir="rtl">
      <div
        className="lg:w-[46%] xl:w-[38%] 2xl:w-[38%] flex flex-col app-card rounded-[2.5rem] border shadow-sm overflow-hidden no-print"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <div
          className="p-6 border-b app-muted"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-black app-text tracking-tight flex items-center gap-2">
              <ShoppingCart size={24} strokeWidth={2.5} style={{ color: 'var(--theme-primary)' }} />
              سلة المشتريات
            </h2>
            

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
  void clearCartOnly();
}}
                type="button"
                disabled={cart.length === 0}
                className="w-fit px-5 py-3 app-card font-black rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                مسح السلة
              </button>
            </div>

           <span
  className="text-white text-xs font-black px-3 py-1 rounded-full shadow-lg"
  style={{ background: 'var(--theme-primary)' }}
>
  {(() => {
    const itemCount = cart.length;

    const itemLabel =
      itemCount === 1
        ? 'صنف'
        : itemCount === 2
        ? 'صنفين'
        : 'أصناف';

    return `${itemCount.toLocaleString('en-US')} ${itemLabel}`;
  })()}
</span>
          </div>

          <div className="relative group">
            <BarcodeIcon
              className="absolute right-4 top-1/2 -translate-y-1/2 app-text-muted transition-colors"
              size={18}
            />
            <form onSubmit={handleBarcodeSearch}>
              <input
                ref={barcodeInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="امسح الباركود أو ابحث..."
                className="w-full app-card border rounded-2xl py-3.5 pr-11 pl-4 outline-none transition-all text-sm font-bold app-text"
                style={{ borderColor: 'var(--border-color)' }}
              />
            </form>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
  {cart.length === 0 ? (
    <div className="h-full flex flex-col items-center justify-center app-text-muted gap-4 opacity-60">
      <div className="w-20 h-20 app-muted rounded-[2rem] flex items-center justify-center">
        <ShoppingCart size={40} strokeWidth={1.5} />
      </div>
      <p className="text-sm font-black uppercase tracking-widest">السلة فارغة</p>
    </div>
  ) : (
    <div className="grid grid-cols-1 2xl:grid-cols-2 gap-3">
      {cart.map((item) => (
        <motion.div
          layout
          key={item.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className={`p-3 rounded-[1.25rem] border group transition-all duration-300 relative ${
            lastAddedCartItemId === item.id ? 'shadow-lg scale-[1.01]' : ''
          }`}
          style={{
            borderColor:
              lastAddedCartItemId === item.id ? 'var(--theme-primary)' : 'var(--border-color)',
            background:
              lastAddedCartItemId === item.id ? 'var(--theme-primary-soft)' : 'var(--card-bg)'
          }}
        >


                {lastAddedCartItemId === item.id && (
  <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-black text-white shadow-md"
       style={{ background: 'var(--theme-primary)' }}>
    آخر إضافة
  </div>
)}
                <div className="flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className="w-12 h-12 app-card rounded-xl flex items-center justify-center overflow-hidden border flex-shrink-0"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      {item.image_url ? (
                        <img
                          src={formatImageUrl(item.image_url)}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Package size={20} className="app-text" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="font-black app-text text-lg truncate leading-tight">{item.name}</div>
                      <div
                        style={{ color: 'var(--theme-primary)' }}
                        className="text-[9px] font-bold uppercase tracking-wider"
                      >
                        سعر الوحدة: {formatMoney(item.sale_price)}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeFromCart(item.id)}
                      className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="flex flex-col xl:flex-row gap-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="text-[9px] font-black uppercase tracking-widest app-text-muted mb-2">
                        الكمية
                      </div>

                      <div
                        className="flex items-center app-card rounded-xl border p-1 shadow-sm"
                        style={{ borderColor: 'var(--border-color)' }}
                      >
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, -1)}
                          className="w-8 h-8 flex items-center justify-center app-text hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                        >
                          <Minus size={14} strokeWidth={3} />
                        </button>

                <input
  type="text"
  inputMode="decimal"
  lang="en"
  dir="ltr"
  value={item.quantityInput}
  onChange={(e) => setQuantityInputValue(item.id, e.target.value)}
  className="flex-1 min-w-0 text-center font-black text-sm app-text bg-transparent outline-none px-2"
/>

                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, 1)}
                          className="w-7 h-7 flex items-center justify-center app-text-muted hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                        >
                          <Plus size={14} strokeWidth={3} />
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-[9px] font-black uppercase tracking-widest app-text-muted mb-2">
                        السعر المطلوب
                      </div>

                      <div
                        className="flex items-center app-card rounded-xl border px-3 py-2 shadow-sm"
                        style={{ borderColor: 'var(--border-color)' }}
                      >
                       <input
  type="text"
  inputMode="decimal"
  lang="en"
  dir="ltr"
  value={item.desiredTotalInput}
  onChange={(e) => setDesiredLineTotal(item.id, e.target.value)}
  disabled={!isWeightedProduct(item)}
  placeholder=""
  className="flex-1 min-w-0 bg-transparent outline-none font-black text-sm app-text text-center disabled:cursor-not-allowed"
/>
                        <span className="text-[10px] mr-2 font-bold app-text-muted">
                          {getCurrencySymbol()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs font-bold app-text-muted">
                    <span>
                       عدد القطع:{' '}
                      <span className="app-text font-black">
                        {item.quantity.toLocaleString('en-US', { maximumFractionDigits: 3 })}
                      </span>
                    </span>
                    <span>
                      إجمالي السعر:{' '}
                      <span style={{ color: 'var(--theme-primary)' }} className="font-black">
                        {formatMoney(item.sale_price * item.quantity)}
                      </span>
                    </span>
                  </div>
                </div>
                      </motion.div>
      ))}
    </div>
  )}
</div>

        <div
          className="p-4 rounded-t-[2rem] shadow-2xl border-t"
          style={{
            background: 'var(--card-bg)',
            color: 'var(--text-color)',
            borderColor: 'var(--border-color)'
          }}
        >
         <div className="space-y-2 mb-2">
  <div className="flex justify-between items-center app-text-muted text-xs font-black uppercase tracking-widest">
    <span>المجموع الفرعي</span>
    <span>{formatMoney(total)}</span>
  </div>

  <div className="flex items-center justify-between gap-2">
    <span className="app-text-muted text-xs font-black uppercase tracking-widest">الخصم</span>

    <div className="flex items-center rounded-lg px-2 py-0.5 border border-app-card/10 bg-white/10">
      <input
        type="text"
        inputMode="decimal"
        lang="en"
        dir="ltr"
        value={discountInput}
        onChange={(e) => setDiscountInput(normalizeDigits(e.target.value))}
        placeholder=""
        className="bg-transparent border-none outline-none text-right w-14 text-[11px] font-black leading-none"
      />
      <span className="text-[9px] mr-1 font-bold app-text-muted leading-none">
        {getCurrencySymbol()}
      </span>
    </div>
  </div>

  <div className="pt-1.5 border-t border-white/10 flex justify-between items-end">
    <div>
      <div
        style={{ color: 'var(--theme-primary)' }}
        className="text-[9px] font-black uppercase tracking-widest mb-0.5"
      >
        الإجمالي النهائي
      </div>
      <div className="text-2xl font-black tracking-tight leading-none">
        {formatMoney(grandTotal)}
      </div>
    </div>

    {showUsd && (
      <div className="text-right leading-none">
        <div className="text-slate-500 text-[9px] font-bold uppercase tracking-widest mb-0.5">
          بالدولار
        </div>
        <div className="text-sm font-black text-slate-300">
          {formatMoney(grandTotal, 'USD')}
        </div>
      </div>
    )}
  </div>
</div>

        <div className="grid grid-cols-3 gap-3 mb-3">
  <button
    type="button"
    onClick={() => setShowReturnModal(true)}
    disabled={isProcessing}
    className="py-4 app-card border font-black rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
    style={{ borderColor: 'var(--border-color)', color: 'var(--theme-primary)' }}
  >
    <RotateCcw size={18} strokeWidth={2.5} />
    مرتجع
  </button>

  <button
    type="button"
    onClick={suspendCurrentSale}
    disabled={cart.length === 0 || isProcessing}
    className="py-4 app-card border font-black rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
    style={{ borderColor: 'var(--border-color)', color: 'var(--theme-primary)' }}
  >
    <Archive size={18} strokeWidth={2.5} />
    حفظ مؤقت
  </button>

  <button
    type="button"
    onClick={() => setShowSuspendedSales(true)}
    className="py-4 app-card border font-black rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 relative"
    style={{ borderColor: 'var(--border-color)', color: 'var(--theme-primary)' }}
  >
    <FolderOpen size={18} strokeWidth={2.5} />
    الفواتير المؤقتة

    {suspendedSales.length > 0 && (
      <span
        className="absolute -top-2 -left-2 text-white text-[10px] font-black px-2 py-1 rounded-full shadow-lg"
        style={{ background: 'var(--theme-primary)' }}
      >
        {suspendedSales.length.toLocaleString('en-US')}
      </span>
    )}
  </button>
</div>

        <button
  type="button"
  disabled={
    cart.length === 0 ||
    isProcessing ||
    grandTotal <= 0 ||
    (
      paymentMethod !== 'credit' &&
      paidAmountInUSD + 0.0001 < grandTotal &&
      !selectedCustomer
    )
  }
  onClick={handleCheckout}
  className="w-full py-5 text-white font-black rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
  style={{ background: 'var(--theme-primary)' }}
>
  <Wallet size={22} strokeWidth={3.5} />
  {isProcessing ? 'جاري المعالجة...' : 'إتمام عملية الدفع'}
</button>

          {error && (
            <div className="mt-4 text-sm text-rose-500 font-black text-center">
              {error}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-6 no-print">
        {searchQuery && filteredProducts.length > 0 && (
          <div
            className="app-card p-6 rounded-[2.5rem] border shadow-xl z-20"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black app-text uppercase tracking-widest">نتائج البحث</h3>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-2 app-muted rounded-xl transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredProducts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addToCart(p)}
                  className="flex items-center justify-between p-4 app-muted rounded-2xl border transition-all group"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 app-card rounded-xl flex items-center justify-center app-text-muted border"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      {p.image_url ? (
                        <img
                          src={formatImageUrl(p.image_url)}
                          alt={p.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Package size={22} />
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-black app-text text-sm">{p.name}</div>
                      <div className="text-[10px] font-bold app-text-muted">{p.barcode}</div>
                    </div>
                  </div>

                  <div className="text-left">
                    <div className="font-black">{formatMoney(p.sale_price)}</div>
                    {showUsd && (
                      <div className="text-[10px] font-bold app-text-muted">
                        {formatMoney(p.sale_price, 'USD')}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        <AnimatePresence>
  {showReturnModal && (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[112] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        className="w-full max-w-2xl max-h-[90vh] app-card rounded-[2rem] border shadow-2xl overflow-hidden flex flex-col"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <div
          className="p-6 border-b flex items-center justify-between"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--theme-primary-soft)', color: 'var(--theme-primary)' }}
            >
              <RotateCcw size={22} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-xl font-black app-text">مرتجع مبيعات</h3>
              <p className="text-xs font-bold app-text-muted mt-1">
                سيتم هنا البحث عن الفاتورة وتجهيز المرتجع
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowReturnModal(false)}
            className="w-11 h-11 rounded-2xl app-muted flex items-center justify-center transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-4">
  <div
    className="rounded-[1.5rem] border p-4"
    style={{ borderColor: 'var(--border-color)', background: 'var(--card-bg)' }}
  >
    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
      <input
        type="text"
        inputMode="numeric"
        lang="en"
        dir="ltr"
        value={returnSaleIdInput}
        onChange={(e) => setReturnSaleIdInput(normalizeDigits(e.target.value))}
        placeholder="أدخل رقم الفاتورة الأصلية"
        className="w-full app-muted border rounded-2xl py-4 px-4 text-sm font-black outline-none transition-all app-text"
        style={{ borderColor: 'var(--border-color)' }}
      />

      <button
        type="button"
        onClick={fetchReturnContext}
        disabled={isReturnLoading}
        className="px-6 py-4 text-white font-black rounded-2xl transition-all active:scale-95 disabled:opacity-50"
        style={{ background: 'var(--theme-primary)' }}
      >
        {isReturnLoading ? 'جاري الجلب...' : 'جلب الفاتورة'}
      </button>
      
    </div>
  </div>

  {!returnContext ? (
    <div
      className="rounded-[1.5rem] border p-6 text-center"
      style={{ borderColor: 'var(--border-color)', background: 'var(--card-bg)' }}
    >
      <div className="text-lg font-black app-text mb-2">
        ابحث عن الفاتورة الأصلية أولًا
      </div>
      <div className="text-sm font-bold app-text-muted">
        بعد جلب الفاتورة سنعرض الأصناف القابلة للمرتجع
      </div>
    </div>
  ) : (
    <div className="space-y-4">
      <div
        className="rounded-[1.5rem] border p-5"
        style={{ borderColor: 'var(--border-color)', background: 'var(--card-bg)' }}
      >
        <div
  className="rounded-[1.5rem] border p-5 space-y-4"
  style={{ borderColor: 'var(--border-color)', background: 'var(--card-bg)' }}
>
  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
    <div>
      <div className="text-[10px] font-black uppercase tracking-widest app-text-muted mb-2">
        طريقة المرتجع
      </div>
      <select
        value={returnMethod}
        onChange={(e) => setReturnMethod(e.target.value as 'cash_refund' | 'debt_discount' | 'stock_only')}
        className="w-full app-muted border rounded-2xl py-4 px-4 text-sm font-black outline-none transition-all"
        style={{ borderColor: 'var(--border-color)', color: 'var(--theme-primary)' }}
      >
        <option value="cash_refund">استرداد نقدي</option>
        <option value="debt_discount">خصم من دين العميل</option>
        <option value="stock_only">إرجاع مخزون فقط</option>
      </select>
    </div>

    <div>
      <div className="text-[10px] font-black uppercase tracking-widest app-text-muted mb-2">
        سبب المرتجع
      </div>
      <input
        type="text"
        value={returnReasonInput}
        onChange={(e) => setReturnReasonInput(e.target.value)}
        placeholder="سبب المرتجع"
        className="w-full app-muted border rounded-2xl py-4 px-4 text-sm font-black outline-none transition-all app-text"
        style={{ borderColor: 'var(--border-color)' }}
      />
    </div>

    <div>
      <div className="text-[10px] font-black uppercase tracking-widest app-text-muted mb-2">
        ملاحظات
      </div>
      <input
        type="text"
        value={returnNotesInput}
        onChange={(e) => setReturnNotesInput(e.target.value)}
        placeholder="ملاحظات إضافية"
        className="w-full app-muted border rounded-2xl py-4 px-4 text-sm font-black outline-none transition-all app-text"
        style={{ borderColor: 'var(--border-color)' }}
      />
    </div>
  </div>
</div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <div className="text-xs font-black uppercase tracking-widest app-text-muted mb-1">
              الفاتورة الأصلية
            </div>
            <div className="text-xl font-black app-text">
              #{returnContext.sale?.id}
            </div>
          </div>

          <div
            className="px-4 py-2 rounded-2xl text-sm font-black"
            style={{
              background: returnContext.can_create_return
                ? 'rgba(34,197,94,0.10)'
                : 'rgba(244,63,94,0.10)',
              color: returnContext.can_create_return
                ? 'rgb(22,163,74)'
                : 'rgb(225,29,72)'
            }}
          >
            {returnContext.can_create_return ? 'يمكن إنشاء مرتجع' : 'مستنفدة بالكامل'}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest app-text-muted mb-1">
              العميل
            </div>
            <div className="text-base font-black app-text">
              {returnContext.sale?.customer_name || 'عميل نقدي'}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-black uppercase tracking-widest app-text-muted mb-1">
              طريقة الدفع
            </div>
            <div className="text-base font-black app-text">
              {returnContext.sale?.payment_method === 'cash'
                ? 'نقدي'
                : returnContext.sale?.payment_method === 'card'
                ? 'شام كاش'
                : 'دين'}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-black uppercase tracking-widest app-text-muted mb-1">
              تاريخ الفاتورة
            </div>
            <div className="text-base font-black app-text">
              {returnContext.sale?.created_at
  ? formatAppDateTime(returnContext.sale.created_at)
  : '-'}
            </div>
          </div>
        </div>
      </div>

      <div
        className="rounded-[1.5rem] border p-5"
        style={{ borderColor: 'var(--border-color)', background: 'var(--card-bg)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-black app-text">أصناف الفاتورة</h4>
          <div className="text-xs font-black app-text-muted">
            {(returnContext.items || []).length.toLocaleString('en-US')} صنف
          </div>
        </div>

        <div className="space-y-3">
          {(returnContext.items || []).map((item: any) => (
            
            <div
            
              key={item.id}
              className="rounded-2xl border p-4"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <div className="text-base font-black app-text">{item.product_name}</div>
                  <div className="text-xs font-bold app-text-muted mt-1">
                    باركود: {item.product_barcode || '-'}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center min-w-[280px]">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest app-text-muted mb-1">
                      المباع
                    </div>
                    <div className="font-black app-text">
                      {Number(item.quantity || 0).toLocaleString('en-US', {
                        maximumFractionDigits: 3
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest app-text-muted mb-1">
                      المرجع سابقًا
                    </div>
                    <div className="font-black text-amber-600">
                      {Number(item.returned_quantity || 0).toLocaleString('en-US', {
                        maximumFractionDigits: 3
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest app-text-muted mb-1">
                      المتبقي
                    </div>
                    <div className="mt-4">
  <div className="text-[10px] font-black uppercase tracking-widest app-text-muted mb-2">
    كمية المرتجع الآن
  </div>

  <input
    type="text"
    inputMode="decimal"
    lang="en"
    dir="ltr"
    value={returnItemsState[item.id] ?? ''}
    onChange={(e) => setReturnItemQuantityInput(item.id, e.target.value)}
    disabled={Number(item.remaining_quantity || 0) <= 0}
    placeholder={
      Number(item.remaining_quantity || 0) > 0
        ? `الحد الأقصى ${Number(item.remaining_quantity || 0).toLocaleString('en-US', {
            maximumFractionDigits: 3
          })}`
        : 'مستنفد بالكامل'
    }
    className="w-full app-muted border rounded-2xl py-3 px-4 text-sm font-black outline-none transition-all app-text disabled:opacity-50 disabled:cursor-not-allowed"
    style={{ borderColor: 'var(--border-color)' }}
  />
</div>
                    <div
                      className="font-black"
                      style={{
                        color:
                          Number(item.remaining_quantity || 0) > 0
                            ? 'rgb(22,163,74)'
                            : 'rgb(225,29,72)'
                      }}
                    >
                      {Number(item.remaining_quantity || 0).toLocaleString('en-US', {
                        maximumFractionDigits: 3
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )}
</div>

        <div
          className="p-4 border-t flex justify-end"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <button
            type="button"
          onClick={resetReturnModalState}
            className="px-6 py-3 app-card border font-black rounded-2xl transition-all"
            style={{ borderColor: 'var(--border-color)' }}
          >
            إغلاق
          </button>
          <button
    type="button"
    onClick={submitReturn}
    disabled={!returnContext?.can_create_return || isSubmittingReturn}
    className="px-6 py-3 text-white font-black rounded-2xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
    style={{ background: 'var(--theme-primary)' }}
  >
    {isSubmittingReturn ? 'جاري تنفيذ المرتجع...' : 'تنفيذ المرتجع'}
  </button>
        </div>
      </motion.div>
    </div>
  )}
</AnimatePresence>
<AnimatePresence>
  {showBarcodeMatchesModal && (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[109] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        className="w-full max-w-3xl max-h-[90vh] app-card rounded-[2rem] border shadow-2xl overflow-hidden flex flex-col"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <div
          className="p-6 border-b flex items-center justify-between"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--theme-primary-soft)', color: 'var(--theme-primary)' }}
            >
              <BarcodeIcon size={22} strokeWidth={2.5} />
            </div>

            <div>
              <h3 className="text-xl font-black app-text">تم العثور على عدة منتجات</h3>
              <p className="text-xs font-bold app-text-muted mt-1">
                الباركود: {barcodeLookupValue || '-'} — اختر المنتج المطلوب إضافته إلى السلة
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeBarcodeMatchesModal}
            className="w-11 h-11 rounded-2xl app-muted flex items-center justify-center transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {barcodeMatchedProducts.length === 0 ? (
            <div className="py-16 text-center font-black app-text-muted">
              لا توجد منتجات مطابقة
            </div>
          ) : (
            barcodeMatchedProducts.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => handleSelectBarcodeMatchedProduct(product)}
                className="w-full text-right app-muted rounded-[1.5rem] border p-4 transition-all hover:scale-[1.01]"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="w-16 h-16 rounded-2xl overflow-hidden border flex items-center justify-center app-card flex-shrink-0"
                    style={{ borderColor: 'var(--border-color)' }}
                  >
                    {product.image_url ? (
                      <img
                        src={formatImageUrl(product.image_url)}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package size={24} className="app-text-muted" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-lg font-black app-text truncate">
                      {product.name}
                    </div>

                    <div className="text-xs font-bold app-text-muted mt-1">
                      الباركود: {product.barcode || '-'}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span
                        className="px-3 py-1 rounded-full text-[10px] font-black"
                        style={{
                          background: 'var(--theme-primary-soft)',
                          color: 'var(--theme-primary)'
                        }}
                      >
                        {formatMoney(product.sale_price)}
                      </span>

                      <span
                        className="px-3 py-1 rounded-full text-[10px] font-black app-card border app-text-muted"
                        style={{ borderColor: 'var(--border-color)' }}
                      >
                        {product.stock_quantity} {product.unit}
                      </span>

                      {product.category_name && (
                        <span
                          className="px-3 py-1 rounded-full text-[10px] font-black app-card border app-text-muted"
                          style={{ borderColor: 'var(--border-color)' }}
                        >
                          {product.category_name}
                        </span>
                      )}
                    </div>
                  </div>

                  <div
                    className="px-4 py-2 rounded-2xl text-sm font-black text-white"
                    style={{ background: 'var(--theme-primary)' }}
                  >
                    اختيار
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        <div
          className="p-4 border-t flex justify-end"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <button
            type="button"
            onClick={closeBarcodeMatchesModal}
            className="px-6 py-3 app-card border font-black rounded-2xl transition-all"
            style={{ borderColor: 'var(--border-color)' }}
          >
            إغلاق
          </button>
        </div>
      </motion.div>
    </div>
  )}
</AnimatePresence>
<AnimatePresence>
  {showReturnReceipt && lastReturnData && (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[105] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="w-full max-w-sm max-h-[90vh] bg-white rounded-3xl shadow-2xl border overflow-hidden flex flex-col"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <div className="flex-1 min-h-[420px] overflow-y-auto p-8 bg-white text-gray-800 font-mono text-sm">
          <div className="text-center mb-6 space-y-1">
            <h2 className="text-2xl font-bold mb-2">{settings?.shop_name || 'سوبر ماركت الخير'}</h2>
            <p className="text-lg text-gray-500">{settings?.shop_address || 'دمشق، الميدان'}</p>
            {settings?.shop_tax_number && (
              <p className="text-base text-gray-500">الرقم الضريبي: {settings.shop_tax_number}</p>
            )}
            <div className="text-lg font-black text-rose-600 mt-3">سند مرتجع مبيعات</div>
            <div className="border-t border-dashed border-gray-300 my-4"></div>

            <div className="flex justify-between text-base">
              <span>رقم المرتجع: #{lastReturnData.return_record?.id}</span>
              <span>
  {lastReturnData.return_record?.created_at
    ? formatAppDateTime(lastReturnData.return_record.created_at)
    : formatAppDateTime()}
</span>
            </div>

            <div className="flex justify-between text-base">
              <span>الفاتورة الأصلية: #{lastReturnData.return_record?.sale_id}</span>
              <span>
                {lastReturnData.return_record?.return_method === 'cash_refund'
                  ? 'استرداد نقدي'
                  : lastReturnData.return_record?.return_method === 'debt_discount'
                  ? 'خصم من دين العميل'
                  : 'إرجاع مخزون فقط'}
              </span>
            </div>

            <div className="flex justify-between text-base">
              <span>العميل: {lastReturnData.return_record?.customer_name || 'عميل نقدي'}</span>
            </div>

            {lastReturnData.return_record?.reason && (
              <div className="flex justify-between text-base">
                <span>السبب: {lastReturnData.return_record.reason}</span>
              </div>
            )}

            <div className="border-t border-dashed border-gray-300 my-4"></div>
          </div>

          <div className="space-y-3 mb-6">
            <div className="flex justify-between text-[10px] font-bold border-b border-gray-200 pb-2">
              <span className="w-24">الصنف</span>
              <span className="w-10 text-center">الكمية</span>
              <span className="w-16 text-center">السعر</span>
              <span className="w-20 text-left">الإجمالي</span>
            </div>

            {(lastReturnData.items || []).map((item: any, i: number) => (
              <div
                key={i}
                className="flex justify-between text-[10px] py-1 border-b border-gray-50 last:border-none"
              >
                <span className="w-24 truncate pr-1">{item.product_name}</span>
                <span className="w-10 text-center">
                  {Number(item.quantity).toLocaleString('en-US', { maximumFractionDigits: 3 })}
                </span>
                <span className="w-16 text-center">
                  {formatMoneyRaw(Number(item.unit_price || 0), getActiveCurrencyCode())}
                </span>
                <span className="w-20 text-left">
                  {formatMoneyRaw(Number(item.total_price || 0), getActiveCurrencyCode())}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-gray-300 pt-4 space-y-2">
            <div className="flex justify-between text-lg font-bold mt-2">
              <span>قيمة المرتجع:</span>
              <div className="text-left">
                <div className="text-rose-600">
                  {formatMoney(Number(lastReturnData.return_record?.total_amount || 0), getActiveCurrencyCode())}
                </div>
                {showUsd && (
                  <div className="text-xs text-rose-400">
                    {formatMoney(Number(lastReturnData.return_record?.total_amount || 0), 'USD')}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="text-center mt-8 space-y-2">
            <div className="text-center text-sm font-bold">#{lastReturnData.return_record?.id}</div>
            <RotateCcw size={44} className="mx-auto text-rose-600" />
            <p className="text-xs text-gray-500">
              {settings?.receipt_footer || 'شكراً لزيارتكم، نرجو زيارتنا مرة أخرى!'}
            </p>
          </div>
        </div>

        <div className="p-4 bg-gray-50 flex gap-3 border-t border-gray-200">
          <button
            type="button"
            onClick={() => {
              setShowReturnReceipt(false);
              setLastReturnId(null);
              setLastReturnData(null);
            }}
            className="flex-1 bg-white border border-gray-200 text-gray-700 font-bold py-3 rounded-2xl flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
            إغلاق
          </button>

          <button
            type="button"
            onClick={() => lastReturnId && handlePrintReturnReceipt(lastReturnId)}
            disabled={!lastReturnId || isPrintingReturn}
            className="flex-1 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            style={{ background: 'var(--theme-primary)' }}
          >
            <Printer size={18} />
            {isPrintingReturn ? 'جاري الطباعة...' : 'طباعة السند'}
          </button>
        </div>
      </motion.div>
    </div>
  )}
</AnimatePresence>
        {shiftsEnabled && (
<div

  className="app-card p-6 rounded-[2.5rem] border shadow-sm space-y-4"
  style={{ borderColor: 'var(--border-color)' }}
>
  <div className="flex items-center justify-between gap-4">
    
    <div>
      <h3 className="text-sm font-black app-text-muted uppercase tracking-widest">
        حالة الوردية - ملاحظة : في هذه الخانة يتم حساب كل وردية مع حساب الكاشير الخاص به يعني في حال فتحت الوردية اكتب رصيد بداية الوردية أي المبلغ الذي كان في الصندوق اول ما فتحت ورديتك واضف ملاحظة بجانبها واضغط فتح وردية وبنفس الطريقة ضع المبلغ الذي اصبح في الصندوق قبل ان تغلق الوردية
      </h3>
      <div className="mt-2 text-xl font-black app-text">
        {currentShift ? 'وردية مفتوحة' : 'لا توجد وردية مفتوحة'}
                    <button
  type="button"
  onClick={openShiftHistoryModal}
  className="px-4 py-2 rounded-2xl border font-black text-sm transition-all"
  style={{ borderColor: 'var(--border-color)', color: 'var(--theme-primary)' }}
>
  سجل الورديات
</button>
      </div>
      <div className="text-xs font-bold app-text-muted mt-1">
        {currentShift
          ? `باسم ${currentShift.user_name || currentShift.username || 'مستخدم'}`
          : 'افتح وردية قبل البدء بعمليات البيع'}
          
      </div>
      
    </div>

    <div
      className="px-4 py-2 rounded-2xl text-sm font-black"
      style={{
        background: currentShift ? 'rgba(34,197,94,0.10)' : 'rgba(244,63,94,0.10)',
        color: currentShift ? 'rgb(22,163,74)' : 'rgb(225,29,72)'
      }}
    >
      {currentShift ? 'مفتوحة' : 'مغلقة'}
    </div>
  </div>

  {!currentShift ? (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <input
        type="text"
        inputMode="decimal"
        lang="en"
        dir="ltr"
        value={openingBalanceInput}
        onChange={(e) => setOpeningBalanceInput(normalizeDigits(e.target.value))}
        placeholder="رصيد بداية الوردية"
        className="w-full app-muted border rounded-2xl py-4 px-4 text-sm font-black outline-none transition-all app-text"
        style={{ borderColor: 'var(--border-color)' }}
      />

      <input
        type="text"
        value={openingNoteInput}
        onChange={(e) => setOpeningNoteInput(e.target.value)}
        placeholder="ملاحظة افتتاحية (اختياري)"
        className="w-full app-muted border rounded-2xl py-4 px-4 text-sm font-black outline-none transition-all app-text"
        style={{ borderColor: 'var(--border-color)' }}
      />

      <button
        type="button"
        onClick={openShift}
        disabled={isShiftLoading}
        className="w-full py-4 text-white font-black rounded-2xl transition-all active:scale-95 disabled:opacity-50"
        style={{ background: 'var(--theme-primary)' }}
      >
        {isShiftLoading ? 'جاري الفتح...' : 'فتح وردية'}
      </button>
    </div>
  ) : (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div
          className="app-muted border rounded-2xl py-4 px-4 text-sm font-black"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="text-[10px] app-text-muted mb-1">وقت الفتح</div>
          <div className="app-text">
  {formatAppDateTime(currentShift.opened_at)}
</div>
        </div>

        <div
          className="app-muted border rounded-2xl py-4 px-4 text-sm font-black"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="text-[10px] app-text-muted mb-1">رصيد البداية</div>
          <div className="app-text">
            {formatShiftMoney(
  Number(currentShift.opening_balance_original ?? currentShift.opening_balance ?? 0),
  currentShift.currency_code
)}
          </div>
        </div>

        <div
          className="app-muted border rounded-2xl py-4 px-4 text-sm font-black"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="text-[10px] app-text-muted mb-1">الكاشير</div>
          <div className="app-text">
            {currentShift.user_name || currentShift.username || '-'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input
          type="text"
          inputMode="decimal"
          lang="en"
          dir="ltr"
          value={closingCashInput}
          onChange={(e) => setClosingCashInput(normalizeDigits(e.target.value))}
          placeholder="النقد الفعلي عند الإغلاق"
          className="w-full app-muted border rounded-2xl py-4 px-4 text-sm font-black outline-none transition-all app-text"
          style={{ borderColor: 'var(--border-color)' }}
        />

        <input
          type="text"
          value={closingNoteInput}
          onChange={(e) => setClosingNoteInput(e.target.value)}
          placeholder="ملاحظة الإغلاق (اختياري)"
          className="w-full app-muted border rounded-2xl py-4 px-4 text-sm font-black outline-none transition-all app-text"
          style={{ borderColor: 'var(--border-color)' }}
        />

        <button
          type="button"
          onClick={closeShift}
          disabled={isShiftLoading}
          className="w-full py-4 text-white font-black rounded-2xl transition-all active:scale-95 disabled:opacity-50"
          style={{ background: '#dc2626' }}
        >
          {isShiftLoading ? 'جاري الإغلاق...' : 'إغلاق الوردية'}
        </button>
      </div>
    </div>
  )}
</div>)}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          <div
            className="app-card p-6 rounded-[2.5rem] border shadow-sm space-y-4"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <h3 className="text-sm font-black app-text-muted uppercase tracking-widest flex items-center gap-2">
              <User size={14} strokeWidth={3} />
              اختيار العميل
            </h3>
            <select
              value={selectedCustomer || ''}
              onChange={(e) => setSelectedCustomer(Number(e.target.value) || null)}
              className="w-full app-muted border rounded-1xl py-5 px-6 text-sm font-black outline-none transition-all"
              style={{ borderColor: 'var(--border-color)', color: 'var(--theme-primary)' }}
            >
              <option value="">عميل عام (افتراضي)</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} - {c.phone}
                </option>
              ))}
            </select>
          </div>

          <div
            className="app-card p-6 rounded-[2.5rem] border shadow-sm space-y-4"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <h3 className="text-sm font-black app-text-muted uppercase tracking-widest flex items-center gap-2">
              <Wallet size={14} strokeWidth={3} />
              عملة العملية
            </h3>
            <select
              value={saleCurrency}
              onChange={(e) => {
                setSaleCurrency(e.target.value as CurrencyCode);
                setPaidAmountInput('');
                setDiscountInput('');
                setIsPaidAmountManuallyEdited(false);
              }}
              className="w-full app-muted border rounded-2xl py-5 px-6 text-sm font-black outline-none transition-all"
              style={{ borderColor: 'var(--border-color)', color: 'var(--theme-primary)' }}
            >
              <option value="SYP">ليرة سورية (ل.س)</option>
              <option value="USD">دولار أمريكي ($)</option>
              <option value="TRY">ليرة تركية (TL)</option>
              <option value="SAR">ريال سعودي (ر.س)</option>
              <option value="AED">درهم إماراتي (د.إ)</option>
            </select>
          </div>

          <div
            className="app-card p-6 rounded-[2.5rem] border shadow-sm space-y-4"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <h3 className="text-lg font-black app-text-muted uppercase tracking-widest flex items-center gap-2">
              <CreditCard size={14} strokeWidth={3} />
              طريقة الدفع
            </h3>
            <div className="grid grid-cols-3 gap-3">
             {[
  {
    id: 'cash',
    name: 'نقدي',
    icon: Banknote,
    activeStyle: {
      background: 'linear-gradient(135deg, #16a34a, #22c55e)',
      borderColor: '#16a34a',
      color: '#ffffff'
    },
    inactiveClass: 'app-text-muted hover:text-emerald-600'
  },
  {
    id: 'card',
    name: 'شام كاش',
    icon: CreditCard,
    activeStyle: {
      background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
      borderColor: '#2563eb',
      color: '#ffffff'
    },
    inactiveClass: 'app-text-muted hover:text-blue-600'
  },
  {
    id: 'credit',
    name: 'دين',
    icon: User,
    activeStyle: {
      background: 'linear-gradient(135deg, #ea580c, #f97316)',
      borderColor: '#ea580c',
      color: '#ffffff'
    },
    inactiveClass: 'app-text-muted hover:text-orange-600'
  }
].map((method) => (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => {
                    const nextMethod = method.id as PaymentMethod;
                    setPaymentMethod(nextMethod);

                    if (nextMethod === 'credit') {
                      setPaidAmountInput('');
                      setIsPaidAmountManuallyEdited(false);
                    } else {
                      setIsPaidAmountManuallyEdited(false);
                    }
                  }}
                style={
  paymentMethod === method.id
    ? method.activeStyle
    : {
        borderColor: 'var(--border-color)',
        background: 'var(--card-bg)',
        color: 'var(--text-muted)'
      }
}
className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all group ${
  paymentMethod === method.id ? 'shadow-lg scale-[1.02]' : method.inactiveClass
}`}
                >
                  <method.icon size={20} strokeWidth={paymentMethod === method.id ? 2.5 : 2} />
                  <span className="text-[10px] font-black uppercase tracking-wider">{method.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {paymentMethod !== 'credit' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="app-card p-6 rounded-[2.5rem] border shadow-sm space-y-4"
            style={{ borderColor: 'var(--border-color)' }}
          >
<div className="grid grid-cols-2 gap-3 items-start">
  <div className="space-y-1">
    <h3 className="text-xs font-black app-text-muted uppercase tracking-widest text-center sm:text-right">
      المبلغ المدفوع
    </h3>

    <div className="relative">
      <input
        type="text"
        inputMode="decimal"
        lang="en"
        dir="ltr"
        value={paidAmountInput}
        onChange={(e) => {
          setIsPaidAmountManuallyEdited(true);
          setPaidAmountInput(normalizeDigits(e.target.value));
        }}
        placeholder=""
        className="w-full app-muted border rounded-xl py-2.5 px-5 text-xl sm:text-2xl font-black outline-none transition-all app-text text-center"
        style={{
          borderColor: 'var(--border-color)',
          color: 'var(--theme-primary)'
        }}
      />
      <div className="absolute left-4 top-1/2 -translate-y-1/2 app-text-muted font-black text-xs sm:text-sm">
        {getCurrencySymbol()}
      </div>
    </div>
  </div>

  <div className="space-y-1">
    <h3 className="text-xs font-black app-text-muted uppercase tracking-widest text-center sm:text-right">
      {difference >= 0 ? 'الباقي (الفكة)' : 'المتبقي على العميل'}
    </h3>

    <div
      className={`w-full app-muted border rounded-xl py-2.5 px-5 text-xl sm:text-2xl font-black text-center transition-all ${
        difference >= 0 ? 'text-emerald-600' : 'text-rose-500'
      }`}
      style={{
        borderColor: 'var(--border-color)'
      }}
    >
      {formatMoney(Math.abs(difference))}
    </div>

    {showUsd && (
      <div className="text-xs sm:text-sm font-bold app-text-muted text-center sm:text-right leading-none min-h-[16px]">
        {formatMoney(Math.abs(difference), 'USD')}
      </div>
    )}
  </div>
</div>
          </motion.div>
        )}

        <div
          className="flex-1 app-card p-8 rounded-[3rem] border shadow-sm overflow-hidden flex flex-col"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-black app-text tracking-tight">أحدث المنتجات</h3>
            <div className="flex items-center gap-2">
              <span
                style={{ background: 'var(--theme-primary)' }}
                className="w-2 h-2 rounded-full animate-pulse"
              />
              <span className="text-[10px] font-black app-text-muted uppercase tracking-widest">متوفر الآن</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
              {products.slice(0, 15).map((product) => (
                <motion.button
                  key={product.id}
                  type="button"
                  whileHover={{ y: -5 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => addToCart(product)}
                  className="app-muted p-4 rounded-[2rem] border transition-all duration-500 flex flex-col text-right group relative"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <div
                    className="aspect-square app-card rounded-2xl mb-4 overflow-hidden border transition-colors"
                    style={{ borderColor: 'var(--border-color)' }
                  }
                  ><div
  className="inline-flex items-center  px-2.5 py-1 rounded-lg text-[17px] font-black border"
  style={{
    
    background:
      product.stock_quantity <= product.min_stock_level
        ? 'rgba(244,63,94,0.10)'
        : 'var(--theme-primary-soft)',
    color:
      product.stock_quantity <= product.min_stock_level
        ? 'rgb(244,63,94)'
        : 'var(--theme-primary)',
    borderColor:
      product.stock_quantity <= product.min_stock_level
        ? 'rgba(244,63,94,0.22)'
        : 'var(--theme-primary-soft-2)'
         
  }}
>
  {product.stock_quantity} {product.unit}
</div>
                    {product.image_url ? (
                      <img
                        src={formatImageUrl(product.image_url)}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-200">
                        <Package size={32} strokeWidth={1.5} />
                      </div>
                    )}
                  </div>

                  <h3 className="font-black app-text text-lg truncate transition-colors">{product.name}</h3>

                  <div className="flex items-center justify-between mt-2">
                    <span style={{ color: 'var(--theme-primary)' }} className="text-sm font-black">
                      {formatMoney(product.sale_price)}
                    </span>
                    <div
                      className="w-6 h-6 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                      style={{ background: 'var(--theme-primary-soft)', color: 'var(--theme-primary)' }}
                    >
                      <Plus size={14} strokeWidth={3} />
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showReceipt && lastSaleData && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-sm max-h-[90vh] bg-white rounded-3xl shadow-2xl border overflow-hidden flex flex-col"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <div className="receipt-modal-content flex-1 min-h-[420px] overflow-y-auto p-8 bg-white text-gray-800 font-mono text-sm">
                <div className="text-center mb-6 space-y-1">
                  <h2 className="text-2xl font-bold mb-2">{settings?.shop_name || 'سوبر ماركت الخير'}</h2>
                  <p className="text-lg text-gray-500">{settings?.shop_address || 'دمشق، الميدان'}</p>
                  {settings?.shop_tax_number && (
                    <p className="text-base text-gray-500">الرقم الضريبي: {settings.shop_tax_number}</p>
                  )}
                  <div className="border-t border-dashed border-gray-300 my-4"></div>

                  <div className="flex justify-between text-base">
                    <span>رقم الفاتورة: #{lastSaleId}</span>
                    <span>{formatAppDateTime()}</span>
                  </div>

                  <div className="flex justify-between text-base">
                    <span>الكاشير: {user?.full_name}</span>
                    <span>
  طريقة الدفع:{' '}
  {lastSaleData.paymentMethod === 'cash'
    ? 'نقدي'
    : lastSaleData.paymentMethod === 'card'
    ? 'شام كاش'
    : Number(lastSaleData.paidAmount || 0) > 0
    ? 'دفع جزئي'
    : 'دين'}
</span>
                  </div>

                  <div className="flex justify-between text-base">
                    <span>العميل: {lastSaleData.customer_name || 'عميل نقدي'}</span>
                  </div>

                  <div className="flex justify-between text-base">
                    <span>عملة العملية: {getCurrencySymbol(lastSaleData.saleCurrency)}</span>
                  </div>

                  <div className="border-t border-dashed border-gray-300 my-4"></div>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-[10px] font-bold border-b border-gray-200 pb-2">
                    <span className="w-24">الصنف</span>
                    <span className="w-10 text-center">الكمية</span>
                    <span className="w-16 text-center">السعر</span>
                    <span className="w-20 text-left">الإجمالي</span>
                  </div>

                  {(lastSaleData.items || []).map((item: any, i: number) => (
                    <div
                      key={i}
                      className="flex justify-between text-[10px] py-1 border-b border-gray-50 last:border-none"
                    >
                      <span className="w-24 truncate pr-1">{item.name}</span>
                      <span className="w-10 text-center">
                        {Number(item.quantity).toLocaleString('en-US', { maximumFractionDigits: 3 })}
                      </span>
                      <span className="w-16 text-center">
                        {formatMoneyRaw(item.sale_price, lastSaleData.saleCurrency)}
                      </span>
                      <span className="w-20 text-left">
                        {formatMoneyRaw(item.sale_price * item.quantity, lastSaleData.saleCurrency)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-dashed border-gray-300 pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>المجموع الفرعي:</span>
                    <div className="text-left">
                      <div>{formatMoney(lastSaleData.total, lastSaleData.saleCurrency)}</div>
                      {showUsd && (
                        <div className="text-[10px] text-gray-500">
                          {formatMoney(lastSaleData.total, 'USD')}
                        </div>
                      )}
                    </div>
                  </div>

                  {lastSaleData.discount > 0 && (
                    <div className="flex justify-between text-sm text-red-500">
                      <span>الخصم:</span>
                      <span>-{formatMoney(lastSaleData.discount, lastSaleData.saleCurrency)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-lg font-bold mt-2 border-t border-gray-100 pt-2">
                    <span>الإجمالي:</span>
                    <div className="text-left">
                      <div className="text-emerald-600">
                        {formatMoney(lastSaleData.grandTotal, lastSaleData.saleCurrency)}
                      </div>
                      {showUsd && (
                        <div className="text-xs text-emerald-500">
                          {formatMoney(lastSaleData.grandTotal, 'USD')}
                        </div>
                      )}
                    </div>
                  </div>

                  {(Number(lastSaleData.paidAmount || 0) > 0 ||
  Number(lastSaleData.remaining || 0) > 0 ||
  Number(lastSaleData.change || 0) > 0) && (
  <>
    <div className="flex justify-between text-sm mt-4">
      <span>المدفوع:</span>
      <span>{formatMoney(lastSaleData.paidAmount, lastSaleData.saleCurrency)}</span>
    </div>

    <div className="flex justify-between text-sm">
      <span>{Number(lastSaleData.remaining || 0) > 0 ? 'المتبقي:' : 'الباقي:'}</span>
      <span>
        {formatMoney(
          Number(lastSaleData.remaining || 0) > 0
            ? lastSaleData.remaining
            : lastSaleData.change,
          lastSaleData.saleCurrency
        )}
      </span>
    </div>
  </>
)}
                </div>

                <div className="text-center mt-8 space-y-2">
                  <div className="text-center text-sm font-bold">#{lastSaleId}</div>
                  <BarcodeIcon size={48} className="mx-auto text-gray-800" />
                  <p className="text-xs text-gray-500">
                    {settings?.receipt_footer || 'شكراً لزيارتكم، نرجو زيارتنا مرة أخرى!'}
                  </p>
                </div>
              </div>

              <div className="p-4 bg-gray-50 flex gap-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={closeReceipt}
                  className="flex-1 bg-white border border-gray-200 text-gray-700 font-bold py-3 rounded-2xl flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors"
                >
                  <X size={18} />
                  إغلاق
                </button>

                <button
                  type="button"
                  onClick={() => lastSaleId && handlePrintInvoice(lastSaleId)}
                  disabled={!lastSaleId || isPrinting}
                  className="flex-1 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  style={{ background: 'var(--theme-primary)' }}
                >
                  <Printer size={18} />
                  {isPrinting ? 'جاري الطباعة...' : 'طباعة'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSuspendedSales && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              className="w-full max-w-3xl max-h-[90vh] app-card rounded-[2rem] border shadow-2xl overflow-hidden flex flex-col"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <div
                className="p-6 border-b flex items-center justify-between"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ background: 'var(--theme-primary-soft)', color: 'var(--theme-primary)' }}
                  >
                    <FolderOpen size={22} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black app-text">الفواتير المؤقتة</h3>
                    <p className="text-xs font-bold app-text-muted">
                      {suspendedSales.length.toLocaleString('en-US')} فاتورة محفوظة مؤقتًا
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowSuspendedSales(false)}
                  className="w-11 h-11 rounded-2xl app-muted flex items-center justify-center transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                {suspendedSales.length === 0 ? (
                  <div className="h-full min-h-[260px] flex flex-col items-center justify-center app-text-muted gap-4 opacity-70">
                    <div className="w-20 h-20 app-muted rounded-[2rem] flex items-center justify-center">
                      <Archive size={34} strokeWidth={1.8} />
                    </div>
                    <p className="text-lg font-black">لا يوجد فواتير مؤقتة</p>
                    <p className="text-sm font-bold">أي فاتورة تحفظها مؤقتًا ستظهر هنا</p>
                  </div>
                ) : (
                  suspendedSales.map((sale) => (
                    <motion.div
                      key={sale.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="app-muted rounded-[2rem] border p-5"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div className="space-y-3 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className="px-3 py-1 rounded-full text-xs font-black text-white"
                              style={{ background: 'var(--theme-primary)' }}
                            >
                              فاتورة مؤقتة
                            </span>

                            <span className="px-3 py-1 rounded-full text-xs font-black app-card app-text-muted">
                              {sale.totalItems.toLocaleString('en-US', { maximumFractionDigits: 3 })} صنف
                            </span>

                            <span className="px-3 py-1 rounded-full text-xs font-black app-card app-text-muted">
                              {sale.paymentMethod === 'cash'
                                ? 'نقدي'
                                : sale.paymentMethod === 'card'
                                ? 'شام كاش'
                                : 'دين'}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <div className="text-[10px] font-black uppercase tracking-widest app-text-muted mb-1">
                                العميل
                              </div>
                              <div className="text-base font-black app-text">
                                {sale.customerName || 'عميل عام (افتراضي)'}
                              </div>
                            </div>

                            <div>
                              <div className="text-[10px] font-black uppercase tracking-widest app-text-muted mb-1">
                                وقت الحفظ
                              </div>
                              <div className="text-base font-black app-text flex items-center gap-2">
  <Clock size={14} strokeWidth={2.5} />
  {formatAppDateTime(sale.createdAt)}
</div>
                            </div>

                            <div>
                              <div className="text-[10px] font-black uppercase tracking-widest app-text-muted mb-1">
                                الإجمالي
                              </div>
                              <div className="text-base font-black" style={{ color: 'var(--theme-primary)' }}>
                                {formatMoney(sale.grandTotal, sale.saleCurrency)}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {(sale.cart || []).slice(0, 4).map((item) => (
                              <div
                                key={`${sale.id}_${item.id}`}
                                className="px-3 py-2 rounded-xl app-card text-xs font-bold app-text-muted border"
                                style={{ borderColor: 'var(--border-color)' }}
                              >
                                {item.name} ×{' '}
                                {Number(item.quantity).toLocaleString('en-US', {
                                  maximumFractionDigits: 3
                                })}
                              </div>
                            ))}

                            {(sale.cart || []).length > 4 && (
                              <div
                                className="px-3 py-2 rounded-xl app-card text-xs font-bold app-text-muted border"
                                style={{ borderColor: 'var(--border-color)' }}
                              >
                                +{((sale.cart || []).length - 4).toLocaleString('en-US')} أكثر
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 lg:w-auto">
                          <button
                            type="button"
                            onClick={() => restoreSuspendedSale(sale)}
                            className="px-5 py-3 text-white font-black rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2"
                            style={{ background: 'var(--theme-primary)' }}
                          >
                            <RotateCcw size={18} strokeWidth={2.5} />
                            استعادة الفاتورة
                          </button>

                          <button
                            type="button"
                            onClick={() => deleteSuspendedSale(sale.id)}
                            className="px-5 py-3 app-card border font-black rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 text-rose-500"
                            style={{ borderColor: 'var(--border-color)' }}
                          >
                            <Trash2 size={18} strokeWidth={2.5} />
                            حذف
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>

            <div
  className="p-4 border-t flex flex-col sm:flex-row justify-end gap-3"
  style={{ borderColor: 'var(--border-color)' }}
>
  
  <button
    type="button"
    onClick={() => setShowSuspendedSales(false)}
    className="px-6 py-3 app-card border font-black rounded-2xl transition-all"
    style={{ borderColor: 'var(--border-color)' }}
  >
    إغلاق
  </button>

  
</div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {shiftsEnabled && (
      <AnimatePresence>
  {showShiftHistory && (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[115] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        className="w-full max-w-5xl max-h-[90vh] app-card rounded-[2rem] border shadow-2xl overflow-hidden flex flex-col"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <div
          className="p-6 border-b flex items-center justify-between"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div>
            <h3 className="text-xl font-black app-text">سجل الورديات</h3>
            <p className="text-xs font-bold app-text-muted mt-1">
              آخر الورديات المسجلة في النظام
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowShiftHistory(false)}
            className="w-11 h-11 rounded-2xl app-muted flex items-center justify-center transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {isShiftHistoryLoading ? (
            <div className="py-16 text-center font-black app-text-muted">
              جاري تحميل سجل الورديات...
            </div>
          ) : shiftHistory.length === 0 ? (
            <div className="py-16 text-center font-black app-text-muted">
              لا يوجد ورديات مسجلة بعد
            </div>
          ) : (
            <div className="space-y-4">
              {shiftHistory.map((shift) => (
                <div
                  key={shift.id}
                  className="app-muted rounded-[1.5rem] border p-5"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="space-y-3 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="px-3 py-1 rounded-full text-xs font-black text-white"
                          style={{
                            background:
                              shift.status === 'open' ? 'rgb(22,163,74)' : 'rgb(59,130,246)'
                          }}
                        >
                          {shift.status === 'open' ? 'مفتوحة' : 'مغلقة'}
                        </span>

                        <span className="px-3 py-1 rounded-full text-xs font-black app-card app-text-muted">
                          وردية #{shift.id}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-widest app-text-muted mb-1">
                            المستخدم
                          </div>
                          <div className="text-base font-black app-text">
                            {shift.user_name || shift.username || '-'}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] font-black uppercase tracking-widest app-text-muted mb-1">
                            وقت الفتح
                          </div>
                          <div className="text-base font-black app-text">
  {shift.opened_at
    ? formatAppDateTime(shift.opened_at)
    : '-'}
</div>
                        </div>

                        <div>
                          <div className="text-[10px] font-black uppercase tracking-widest app-text-muted mb-1">
                            وقت الإغلاق
                          </div>
                          <div className="text-base font-black app-text">
                            {shift.closed_at
                              ? formatAppDateTime(shift.closed_at)
                              : 'لم تغلق بعد'}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] font-black uppercase tracking-widest app-text-muted mb-1">
                            رصيد البداية
                          </div>
                          <div className="text-base font-black app-text">
                            {formatShiftMoney(
  Number(shift.opening_balance_original ?? shift.opening_balance ?? 0),
  shift.currency_code
)}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] font-black uppercase tracking-widest app-text-muted mb-1">
                           المبلغ المفترض في الصندوق
                          </div>
                          <div className="text-base font-black app-text">
                            {formatShiftMoney(
  Number(shift.expected_cash_original ?? shift.expected_cash ?? 0),
  shift.currency_code
)}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] font-black uppercase tracking-widest app-text-muted mb-1">
                           المبلغ الموجود فعليًا بالصندوق
                          </div>
                          <div className="text-base font-black app-text">
                            {formatShiftMoney(
  Number(shift.closing_cash_counted_original ?? shift.closing_cash_counted ?? 0),
  shift.currency_code
)}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] font-black uppercase tracking-widest app-text-muted mb-1">
                            الفرق النقدي
                          </div>
                          <div
                            className="text-base font-black"
                            style={{
                              color:
                                Number(shift.difference || 0) === 0
                                  ? 'var(--text-color)'
                                  : Number(shift.difference || 0) > 0
                                  ? 'rgb(22,163,74)'
                                  : 'rgb(225,29,72)'
                            }}
                          >
                            {formatShiftMoney(
  Number(shift.difference_original ?? shift.difference ?? 0),
  shift.currency_code
)}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] font-black uppercase tracking-widest app-text-muted mb-1">
                            ملاحظة الفتح
                          </div>
                          <div className="text-sm font-bold app-text">
                            {shift.opening_note || '-'}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] font-black uppercase tracking-widest app-text-muted mb-1">
                            ملاحظة الإغلاق
                          </div>
                          <div className="text-sm font-bold app-text">
                            {shift.closing_note || '-'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          className="p-4 border-t flex justify-end"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <button
            type="button"
            onClick={() => setShowShiftHistory(false)}
            className="px-6 py-3 app-card border font-black rounded-2xl transition-all"
            style={{ borderColor: 'var(--border-color)' }}
          >
            إغلاق
          </button>
        </div>
      </motion.div>
    </div>
  )}
</AnimatePresence>
)}
    </div>
  );
};

export default POS;