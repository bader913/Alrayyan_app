export type CurrencyCode = 'SYP' | 'USD' | 'TRY' | 'SAR' | 'AED';

export const currencySymbols: Record<CurrencyCode, string> = {
  SYP: 'ل.س',
  USD: '$',
  TRY: 'TL',
  SAR: 'ر.س',
  AED: 'د.إ',
};

export const getExchangeRatesFromUSD = (settings?: any): Record<CurrencyCode, number> => ({
  USD: 1,
  SYP: Number(settings?.usd_to_syp || 11000),
  TRY: Number(settings?.usd_to_try || 36),
  SAR: Number(settings?.usd_to_sar || 3.75),
  AED: Number(settings?.usd_to_aed || 3.67),
});

// تحويل من الدولار إلى العملة المطلوبة
export const convertFromUSD = (
  amountInUSD: number,
  targetCurrency: CurrencyCode,
  settings?: any
) => {
  if (!amountInUSD) return 0;
  const rates = getExchangeRatesFromUSD(settings);
  return amountInUSD * rates[targetCurrency];
};

// تحويل من أي عملة إلى الدولار
export const convertToUSD = (
  amount: number,
  sourceCurrency: CurrencyCode,
  settings?: any
) => {
  if (!amount) return 0;
  const rates = getExchangeRatesFromUSD(settings);
  return amount / rates[sourceCurrency];
};

export const formatMoney = (
  amountInUSD: number,
  currency: CurrencyCode = 'USD',
  settings?: any
) => {
  const converted = convertFromUSD(amountInUSD, currency, settings);

  const fractionDigits =
    currency === 'USD' || currency === 'SAR' || currency === 'AED' || currency === 'TRY'
      ? 2
      : 0;

  return `${converted.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  })} ${currencySymbols[currency]}`;
};

// تعرض العملة الأساسية المختارة من الإعدادات
export const getDisplayCurrency = (settings?: any): CurrencyCode => {
  const currency = settings?.currency;
  if (currency === 'SYP' || currency === 'USD' || currency === 'TRY' || currency === 'SAR' || currency === 'AED') {
    return currency;
  }
  return 'USD';
};

// تنسيق حسب إعدادات البرنامج
export const formatBySettings = (amountInUSD: number, settings?: any) => {
  const displayCurrency = getDisplayCurrency(settings);
  return formatMoney(amountInUSD, displayCurrency, settings);
};

// عرض ثانوي بالدولار أو بغيره
export const formatSecondaryMoney = (
  amountInUSD: number,
  secondaryCurrency: CurrencyCode,
  settings?: any
) => {
  return formatMoney(amountInUSD, secondaryCurrency, settings);
};