import React, { useEffect, useMemo, useState } from 'react';
import { Coins, ArrowUpDown, RefreshCw } from 'lucide-react';
import {
  CurrencyCode,
  currencySymbols,
  getExchangeRatesFromUSD,
  convertFromUSD,
  convertToUSD,
  getDisplayCurrency
} from '../components/currency';

const CurrencyConverter: React.FC = () => {
  const [settings, setSettings] = useState<any>(null);
  const [amountInput, setAmountInput] = useState('1');
  const [fromCurrency, setFromCurrency] = useState<CurrencyCode>('USD');
  const [toCurrency, setToCurrency] = useState<CurrencyCode>('USD');
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    void fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      setSettings(data);

      const baseCurrency = getDisplayCurrency(data);
      setToCurrency(baseCurrency);
    } catch (error) {
      console.error('Error fetching settings:', error);
      setSettings(null);
      setToCurrency('USD');
    }
  };

  const currencies = useMemo(
    () => [
      { code: 'USD' as CurrencyCode, label: 'دولار أمريكي' },
      { code: 'SYP' as CurrencyCode, label: 'ليرة سورية' },
      { code: 'TRY' as CurrencyCode, label: 'ليرة تركية' },
      { code: 'SAR' as CurrencyCode, label: 'ريال سعودي' },
      { code: 'AED' as CurrencyCode, label: 'درهم إماراتي' }
    ],
    []
  );

  const normalizeDigits = (value: string) => {
    return value
      .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      .replace(/,/g, '.')
      .replace(/[^\d.]/g, '')
      .replace(/(\..*)\./g, '$1');
  };

  const parsedAmount = useMemo(() => {
    const normalized = normalizeDigits(amountInput.trim());
    const num = Number(normalized);
    return Number.isFinite(num) ? num : 0;
  }, [amountInput]);

  const convertAmount = (amount: number, from: CurrencyCode, to: CurrencyCode) => {
    if (!Number.isFinite(amount)) return 0;
    if (from === to) return amount;

    try {
      if (from === 'USD') {
        return Number(convertFromUSD(amount, to, settings));
      }

      if (to === 'USD') {
        return Number(convertToUSD(amount, from, settings));
      }

      const usdValue = Number(convertToUSD(amount, from, settings));
      return Number(convertFromUSD(usdValue, to, settings));
    } catch (error) {
      console.error('Currency conversion error:', error);
      return 0;
    }
  };

  const convertedAmount = useMemo(() => {
    return convertAmount(parsedAmount, fromCurrency, toCurrency);
  }, [parsedAmount, fromCurrency, toCurrency, settings, refreshTick]);

  const formatNumber = (value: number, currency: CurrencyCode) => {
    if (!Number.isFinite(value)) return '0.00';

    const fractionDigits = currency === 'SYP' ? 0 : 2;

    return value.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: fractionDigits
    });
  };

  const exchangeRates = useMemo(() => {
    return getExchangeRatesFromUSD(settings);
  }, [settings, refreshTick]);

  const directRate = useMemo(() => {
    if (fromCurrency === toCurrency) return 1;

    try {
      if (fromCurrency === 'USD') {
        return Number(exchangeRates[toCurrency]);
      }

      if (toCurrency === 'USD') {
        return Number(convertToUSD(1, fromCurrency, settings));
      }

      const usdValue = Number(convertToUSD(1, fromCurrency, settings));
      return Number(convertFromUSD(usdValue, toCurrency, settings));
    } catch (error) {
      console.error('Rate calculation error:', error);
      return 0;
    }
  }, [fromCurrency, toCurrency, exchangeRates, settings, refreshTick]);

  const baseCurrency = useMemo(() => {
    return getDisplayCurrency(settings);
  }, [settings]);

  const fromSymbol = currencySymbols[fromCurrency];
  const toSymbol = currencySymbols[toCurrency];

  const rateCards = useMemo(() => {
    return [
      {
        code: 'SYP' as CurrencyCode,
        label: 'سعر الدولار مقابل الليرة السورية',
        value: Number(exchangeRates.SYP)
      },
      {
        code: 'TRY' as CurrencyCode,
        label: 'سعر الدولار مقابل الليرة التركية',
        value: Number(exchangeRates.TRY)
      },
      {
        code: 'SAR' as CurrencyCode,
        label: 'سعر الدولار مقابل الريال السعودي',
        value: Number(exchangeRates.SAR)
      },
      {
        code: 'AED' as CurrencyCode,
        label: 'سعر الدولار مقابل الدرهم الإماراتي',
        value: Number(exchangeRates.AED)
      }
    ];
  }, [exchangeRates]);

  const swapCurrencies = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  };

  const handleRefreshRates = async () => {
    setRefreshTick((prev) => prev + 1);
    await fetchSettings();
  };

  return (
    <div className="space-y-6">
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
              <Coins size={28} style={{ color: 'var(--theme-primary)' }} />
              محول العملات
            </h2>

            <p className="text-sm font-bold mt-2" style={{ color: 'var(--text-muted)' }}>
              تحويل سريع بين العملات المعتمدة في الريان باستخدام أسعار التحويل الحالية داخل النظام
            </p>
          </div>

          <button
            type="button"
            onClick={() => void handleRefreshRates()}
            className="px-5 py-3 rounded-2xl border font-black flex items-center justify-center gap-2 transition-all"
            style={{
              borderColor: 'var(--border-color)',
              color: 'var(--theme-primary)',
              background: 'var(--card-bg)'
            }}
          >
            <RefreshCw size={18} />
            تحديث الأسعار
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-4">
            <div>
              <div
                className="text-[10px] font-black uppercase tracking-widest mb-2"
                style={{ color: 'var(--text-muted)' }}
              >
                المبلغ
              </div>

              <input
                type="text"
                inputMode="decimal"
                lang="en"
                dir="ltr"
                value={amountInput}
                onChange={(e) => setAmountInput(normalizeDigits(e.target.value))}
                placeholder="0.00"
                className="w-full app-muted border rounded-2xl py-4 px-4 text-xl font-black outline-none transition-all text-center"
                style={{
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-color)'
                }}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-end">
              <div>
                <div
                  className="text-[10px] font-black uppercase tracking-widest mb-2"
                  style={{ color: 'var(--text-muted)' }}
                >
                  من عملة
                </div>

                <select
                  value={fromCurrency}
                  onChange={(e) => setFromCurrency(e.target.value as CurrencyCode)}
                  className="w-full app-muted border rounded-2xl py-4 px-4 text-sm font-black outline-none transition-all"
                  style={{
                    borderColor: 'var(--border-color)',
                    color: 'var(--theme-primary)'
                  }}
                >
                  {currencies.map((currency) => (
                    <option key={currency.code} value={currency.code}>
                      {currency.label} ({currency.code})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={swapCurrencies}
                className="h-[56px] w-full md:w-14 rounded-2xl border flex items-center justify-center transition-all"
                style={{
                  borderColor: 'var(--border-color)',
                  color: 'var(--theme-primary)',
                  background: 'var(--card-bg)'
                }}
                title="تبديل العملات"
              >
                <ArrowUpDown size={20} />
              </button>

              <div>
                <div
                  className="text-[10px] font-black uppercase tracking-widest mb-2"
                  style={{ color: 'var(--text-muted)' }}
                >
                  إلى عملة
                </div>

                <select
                  value={toCurrency}
                  onChange={(e) => setToCurrency(e.target.value as CurrencyCode)}
                  className="w-full app-muted border rounded-2xl py-4 px-4 text-sm font-black outline-none transition-all"
                  style={{
                    borderColor: 'var(--border-color)',
                    color: 'var(--theme-primary)'
                  }}
                >
                  {currencies.map((currency) => (
                    <option key={currency.code} value={currency.code}>
                      {currency.label} ({currency.code})
                    </option>
                  ))}
                </select>
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
                النتيجة
              </div>

              <div className="space-y-3">
                <div
                  className="text-3xl lg:text-4xl font-black text-center"
                  dir="ltr"
                  style={{ color: 'var(--theme-primary)' }}
                >
                  {formatNumber(convertedAmount, toCurrency)} {toSymbol}
                </div>

                <div
                  className="text-sm font-bold text-center"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {formatNumber(parsedAmount, fromCurrency)} {fromSymbol} ={' '}
                  {formatNumber(convertedAmount, toCurrency)} {toSymbol}
                </div>

                <div
                  className="text-xs font-bold text-center"
                  style={{ color: 'var(--text-muted)' }}
                >
                  1 {fromCurrency} = {formatNumber(directRate, toCurrency)} {toCurrency}
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
                  <span style={{ color: 'var(--text-muted)' }}>عملة البرنامج الأساسية</span>
                  <span style={{ color: 'var(--theme-primary)' }}>{baseCurrency}</span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span style={{ color: 'var(--text-muted)' }}>التحويل الحالي</span>
                  <span style={{ color: 'var(--text-color)' }}>
                    {fromCurrency} ←→ {toCurrency}
                  </span>
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
                أسعار الدولار
              </div>

              <div className="space-y-3">
                {rateCards.map((item) => (
                  <div
                    key={item.code}
                    className="rounded-2xl border px-4 py-3 flex items-center justify-between gap-3"
                    style={{ borderColor: 'var(--border-color)' }}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-black" style={{ color: 'var(--text-color)' }}>
                        {item.code}
                      </div>
                      <div className="text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>
                        {item.label}
                      </div>
                    </div>

                    <div
                      className="text-sm font-black text-left"
                      dir="ltr"
                      style={{ color: 'var(--theme-primary)' }}
                    >
                      {formatNumber(item.value, item.code)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CurrencyConverter;