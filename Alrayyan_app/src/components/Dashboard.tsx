import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Package,
  AlertTriangle,
  ShoppingCart,
} from 'lucide-react';
import { motion } from 'motion/react';

interface StatsResponse {
  salesToday: number;
  expensesToday: number;
  lowStockCount: number;
  productsCount: number;
}

interface TopProduct {
  id: number;
  name: string;
  sale_price: number;
  total_sold: number;
  total_sales_amount: number;
}

interface SalesChartItem {
  date: string;
  total: number;
  count: number;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<StatsResponse>({
    salesToday: 0,
    expensesToday: 0,
    lowStockCount: 0,
    productsCount: 0
  });
  const [settings, setSettings] = useState<any>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [salesChart, setSalesChart] = useState<SalesChartItem[]>([]);
  const [chartRange, setChartRange] = useState<7 | 30>(7);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllData();
  }, []);

  useEffect(() => {
    fetchSalesChart(chartRange);
  }, [chartRange]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [statsRes, settingsRes, topProductsRes, chartRes] = await Promise.all([
        fetch('/api/stats'),
        fetch('/api/settings'),
        fetch('/api/dashboard/top-products'),
        fetch('/api/dashboard/sales-chart?days=7')
      ]);

      const statsData = await statsRes.json();
      const settingsData = await settingsRes.json();
      const topProductsData = await topProductsRes.json();
      const chartData = await chartRes.json();

      setStats(statsData || {
        salesToday: 0,
        expensesToday: 0,
        lowStockCount: 0,
        productsCount: 0
      });
      setSettings(settingsData || null);
      setTopProducts(Array.isArray(topProductsData) ? topProductsData : []);
      setSalesChart(Array.isArray(chartData) ? chartData : []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setTopProducts([]);
      setSalesChart([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSalesChart = async (days: 7 | 30) => {
    try {
      const res = await fetch(`/api/dashboard/sales-chart?days=${days}`);
      const data = await res.json();
      setSalesChart(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching sales chart:', error);
      setSalesChart([]);
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

 

  const showUsd = settings?.show_usd === 'true';

  const cards = [
    {
      title: 'مبيعات اليوم',
      value: stats.salesToday,
      icon: TrendingUp,
      color: 'emerald',
      trend: 'يومي',
      isCurrency: true,
      description: 'إجمالي المبيعات المسجلة اليوم'
    },
    {
      title: 'مصروفات اليوم',
      value: stats.expensesToday,
      icon: TrendingDown,
      color: 'rose',
      trend: 'يومي',
      isCurrency: true,
      description: 'إجمالي المصاريف التشغيلية'
    },
    {
      title: 'نواقص المخزون',
      value: stats.lowStockCount,
      icon: AlertTriangle,
      color: 'amber',
      trend: 'تنبيه',
      isCurrency: false,
      description: 'منتجات وصلت للحد الأدنى'
    },
    {
      title: 'إجمالي الأصناف',
      value: stats.productsCount,
      icon: Package,
      color: 'indigo',
      trend: 'نشط',
      isCurrency: false,
      description: 'عدد المنتجات المسجلة'
    },
  ];

  const maxChartValue = Math.max(...salesChart.map(item => Number(item.total) || 0), 1);

  const productColors = ['indigo', 'amber', 'emerald', 'rose', 'blue', 'violet'];

  const formatChartLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ar-SA', {
      month: '2-digit',
      day: '2-digit'
    });
  };

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className="group app-card p-6 rounded-[2.5rem] border shadow-sm hover:shadow-xl transition-all duration-500 relative overflow-hidden"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <div className={`absolute top-0 right-0 w-32 h-32 bg-${card.color}-50/50 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-700`} />

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <div className={`p-4 rounded-2xl bg-${card.color}-50 text-${card.color}-600 shadow-sm`}>
                  <card.icon size={24} strokeWidth={2.5} />
                </div>
                <div className={`text-[10px] font-black px-2.5 py-1 rounded-full bg-${card.color}-100/50 text-${card.color}-700 uppercase tracking-wider`}>
                  {card.trend}
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="app-text-muted text-xs font-bold uppercase tracking-widest">{card.title}</h3>
                <div className="flex flex-col">
                  <div className="text-3xl font-black app-text tracking-tight">
  {card.isCurrency ? formatMoney(Number(card.value || 0)) : Number(card.value).toLocaleString()}
</div>
{card.isCurrency && showUsd && (
  <div className="text-xs app-text-muted font-bold mt-1">
    {formatMoney(Number(card.value || 0), 'USD')}
  </div>
)}
                </div>
              </div>

              <p className="mt-4 text-[10px] app-text-muted font-medium leading-relaxed">
                {card.description}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div
  className="lg:col-span-8 app-card p-8 lg:p-10 rounded-[3rem] border shadow-sm"
  style={{ borderColor: 'var(--border-color)' }}
>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
            <div>
              <h3 className="text-2xl font-black app-text tracking-tight">نظرة عامة على المبيعات</h3>
              <p className="app-text-muted text-lg font-medium">تحليل أداء المبيعات خلال الفترة الماضية</p>
            </div>

            <div className="flex items-center gap-2 app-muted p-1.5 rounded-2xl">
             <button
  onClick={() => setChartRange(7)}
  className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
    chartRange === 7 ? 'shadow-sm' : 'app-text-muted'
  }`}
  style={chartRange === 7 ? { background: 'var(--card-bg)', color: 'var(--theme-primary)' } : {}}
>
                آخر 7 أيام
              </button>
             <button
  onClick={() => setChartRange(30)}
  className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
    chartRange === 30 ? 'shadow-sm' : 'app-text-muted'
  }`}
  style={chartRange === 30 ? { background: 'var(--card-bg)', color: 'var(--theme-primary)' } : {}}
>
                آخر 30 يوم
              </button>
            </div>
          </div>

          <div className="h-72 flex items-end justify-between gap-2 sm:gap-4">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center app-text-muted font-black">
                جاري التحميل...
              </div>
            ) : salesChart.length === 0 ? (
              <div className="w-full h-full flex flex-col items-center justify-center app-text-muted gap-4">
                <TrendingUp size={64} strokeWidth={1} />
                <p className="text-[10px] font-black uppercase tracking-widest">لا توجد بيانات مبيعات</p>
              </div>
            ) : (
              salesChart.map((item, i) => {
                const heightPercent = Math.max((Number(item.total) / maxChartValue) * 100, 4);

                return (
                  <div style={{ color: 'var(--theme-primary)', border: '2px solid var(--theme-primary)', background: 'var(--theme-primary-soft)' }}
                   key={`${item.date}-${i}`} className="flex-1 flex flex-col items-center gap-4 group">
                    <div className="w-full relative flex flex-col items-center justify-end h-full">
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${heightPercent}%` }}
                        transition={{ duration: 0.8, delay: i * 0.04, ease: 'circOut' }}
                        className="w-full max-w-[40px] bg-gradient-to-t from-emerald-500 to-teal-400 group-hover:from-emerald-600 group-hover:to-teal-500 transition-all duration-500 rounded-2xl shadow-lg shadow-emerald-100"
                      />
                      <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-bold px-3 py-2 rounded-lg text-center whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-xl z-20">
  <div>{formatMoney(Number(item.total || 0))}</div>
  <div>{item.count} فاتورة</div>
</div>
                    </div>
                    <span className="text-[20px] font-bold text-slate-400 uppercase tracking-tighter">
                      {formatChartLabel(item.date)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div
  className="lg:col-span-4 app-card p-8 lg:p-10 rounded-[3rem] border shadow-sm flex flex-col"
  style={{ borderColor: 'var(--border-color)' }}
>
          <div className="mb-8">
            <h3 className="text-xl font-black app-text tracking-tight">الاكثر طلباً </h3>
            <p className="app-text-muted text-sm font-medium">المنتجات الأعلى طلباً من المبيعات الحقيقية</p>
          </div>

          <div className="space-y-8 flex-1">
            {loading ? (
              <div className="flex-1 flex items-center justify-center text-slate-300 font-black">
                جاري التحميل...
              </div>
            ) : topProducts.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-300 gap-4">
                <Package size={64} strokeWidth={1} />
                <p className="text-[10px] font-black uppercase tracking-widest">لا توجد بيانات مبيعات بعد</p>
              </div>
            ) : (
              topProducts.slice(0, 6).map((item, i) => {
                const color = productColors[i % productColors.length];
                return (
                  <div key={item.id} className="flex items-center justify-between group cursor-pointer">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`w-12 h-12 bg-${color}-50 text-${color}-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-500 flex-shrink-0`}>
                        <Package size={22} strokeWidth={2.5} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-black app-text mb-0.5 truncate">{item.name}</div>
                        <div className="text-[10px] font-bold app-text-muted uppercase tracking-wider">
                          {Number(item.total_sold).toLocaleString()} قطعة مباعة
                        </div>
                      </div>
                    </div>

                    <div className="text-left flex-shrink-0">
                      <div className="text-sm font-black" style={{ color: 'var(--theme-primary)' }}>
  {formatMoney(Number(item.total_sales_amount || 0))}
</div>
{showUsd && (
  <div className="text-[10px] font-bold app-text-muted">
    {formatMoney(Number(item.total_sales_amount || 0), 'USD')}
  </div>
)}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div
  className="w-full mt-10 py-4 text-sm font-black rounded-[1.5rem] text-center"
  style={{ color: 'var(--theme-primary)', background: 'var(--theme-primary-soft)' }}
>
            {topProducts.length > 0
              ? `عدد المنتجات المباعة: ${topProducts.length}`
              : 'بانتظار تسجيل مبيعات'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;