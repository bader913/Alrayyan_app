const hexToRgba = (hex: string, alpha: number) => {
  const cleanHex = hex.replace('#', '');
  const bigint = parseInt(cleanHex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const darkenHex = (hex: string, amount: number) => {
  const cleanHex = hex.replace('#', '');
  let r = parseInt(cleanHex.substring(0, 2), 16);
  let g = parseInt(cleanHex.substring(2, 4), 16);
  let b = parseInt(cleanHex.substring(4, 6), 16);

  r = Math.max(0, r - amount);
  g = Math.max(0, g - amount);
  b = Math.max(0, b - amount);

  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
};

const applyTheme = (color: string, mode: string) => {
  const root = document.documentElement;

  root.style.setProperty('--theme-primary', color);
  root.style.setProperty('--theme-primary-text', color);
  root.style.setProperty('--theme-primary-hover', darkenHex(color, 18));
  root.style.setProperty('--theme-primary-soft', hexToRgba(color, 0.10));
  root.style.setProperty('--theme-primary-soft-2', hexToRgba(color, 0.18));

  if (mode === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
};

import { installSafeFetch } from './lib/installSafeFetch';
import React, { useState, useEffect, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import POS from './components/POS';
import Purchases from './components/Purchases';
import People from './components/People';
import Reports from './components/Reports';
import Expenses from './components/Expenses';
import Users from './components/Users';
import Settings from './components/Settings';
import Invoices from './components/Invoices';
import { User } from './types';
import BarcodeGenerator from './components/BarcodeGenerator';
import PriceLabels from './components/PriceLabels';
import QrGenerator from './components/QrGenerator';
import CurrencyConverter from './components/CurrencyConverter';
import ProfitCalculator from './components/ProfitCalculator';
import PrintTemplates from './components/PrintTemplates';

type SubscriptionStatus = {
  success?: boolean;
  exists: boolean;
  isExpired: boolean;
  isActive: boolean;
  readOnly: boolean;
  message: string;
  subscription: {
    id: number;
    license_type: 'trial' | 'yearly' | 'two_years' | 'three_years';
    starts_at: string;
    expires_at: string;
    is_active: number;
  } | null;
  remainingMinutes: number;
  remainingDays: number;
};

export default function App() {
  useEffect(() => {
    installSafeFetch();
  }, []);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const res = await fetch('/api/settings');
        const settings = await res.json();
        applyTheme(settings.theme_color || '#059669', settings.theme_mode || 'light');
      } catch (error) {
        console.error('Error loading theme:', error);
      }
    };

    loadTheme();
  }, []);

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
  let mounted = true;

  const loadSubscriptionStatus = async () => {
    try {
      const res = await fetch('/api/subscription-status');
      const data = await res.json();

      if (mounted) {
        setSubscriptionStatus(data);
      }
    } catch (error) {
      console.error('Error loading subscription status:', error);
    } finally {
      if (mounted) {
        setSubscriptionLoading(false);
      }
    }
  };

  const handleSubscriptionUpdated = () => {
    loadSubscriptionStatus();
  };

  loadSubscriptionStatus();

  const interval = setInterval(loadSubscriptionStatus, 30000);
  window.addEventListener('subscription-updated', handleSubscriptionUpdated);

  return () => {
    mounted = false;
    clearInterval(interval);
    window.removeEventListener('subscription-updated', handleSubscriptionUpdated);
  };
}, []);

  const handleLogin = async (username: string, password: string) => {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.success) {
      setUser(data.user);
      localStorage.setItem('user', JSON.stringify(data.user));
    } else {
      throw new Error(data.message);
    }
  };
const handleSwitchUser = async (username: string, password: string) => {
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  const data = await res.json();

  if (data.success) {
    setUser(data.user);
    localStorage.setItem('user', JSON.stringify(data.user));
  } else {
    throw new Error(data.message || 'فشل تبديل الحساب');
  }
};
  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  const subscriptionLabel = useMemo(() => {
    const type = subscriptionStatus?.subscription?.license_type;

    switch (type) {
      case 'trial':
        return 'تجريبي';
      case 'yearly':
        return 'سنوي';
      case 'two_years':
        return 'سنتين';
      case 'three_years':
        return '3 سنوات';
      default:
        return 'غير محدد';
    }
  }, [subscriptionStatus]);

  const subscriptionExpiryText = useMemo(() => {
    const expiresAt = subscriptionStatus?.subscription?.expires_at;
    if (!expiresAt) return '-';

    const date = new Date(expiresAt);
    if (Number.isNaN(date.getTime())) return '-';

    return date.toLocaleString('ar-EG');
  }, [subscriptionStatus]);

  const subscriptionRemainingText = useMemo(() => {
    if (!subscriptionStatus) return '';

    if (subscriptionStatus.isExpired) {
      return 'منتهي';
    }

    if (subscriptionStatus.subscription?.license_type === 'trial') {
      return `${subscriptionStatus.remainingDays} أيام متبقية`;
    }

    return `${subscriptionStatus.remainingDays} يوم متبقي`;
  }, [subscriptionStatus]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50">جاري التحميل...</div>;

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Router>
      <Layout user={user} onLogout={handleLogout} onSwitchUser={handleSwitchUser}>
      {/* subseccribion*/}
      {!subscriptionLoading && subscriptionStatus && (
  <div
    className="mx-4 -mt-4 mb-2 rounded-[2rem] border px-5 py-5 shadow-sm"
    style={{
      background: subscriptionStatus.isExpired
        ? 'rgba(239,68,68,0.10)'
        : 'var(--theme-primary-soft)',
      borderColor: subscriptionStatus.isExpired
        ? 'rgba(239,68,68,0.22)'
        : 'var(--theme-primary-soft-2)'
    }}
  >
    <div
      className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5"
      dir="rtl"
    >
      <div className="space-y-1">
        <div
          className="text-base font-black"
          style={{
            color: subscriptionStatus.isExpired ? 'rgb(220,38,38)' : 'var(--theme-primary)'
          }}
        >
          {subscriptionStatus.isExpired
            ? 'انتهى الاشتراك — البرنامج الآن في وضع القراءة فقط'
            : 'الاشتراك فعال'}
        </div>

        <div
          className="text-xs font-bold leading-relaxed"
          style={{ color: 'var(--text-muted)' }}
        >
          {subscriptionStatus.isExpired
            ? 'انتهى الاشتراك. لا يمكن تنفيذ عمليات البيع أو الإضافة أو التعديل أو الحذف. للتجديد يرجى التواصل مع المزود.'
            : `الاشتراك يعمل بشكل طبيعي حاليًا، والمتبقي: ${subscriptionRemainingText}`}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 xl:min-w-[620px]">
        <div
          className="rounded-[1.5rem] border p-4 cursor-default select-none"
          style={{
            borderColor: 'var(--border-color)',
            background: 'var(--card-bg)'
          }}
        >
          <div
            className="text-[10px] font-black uppercase tracking-widest mb-2"
            style={{ color: 'var(--text-muted)' }}
          >
            النوع
          </div>

          <div
            className="text-sm font-black"
            style={{ color: 'var(--theme-primary)' }}
          >
            {subscriptionLabel}
          </div>
        </div>

        <div
          className="rounded-[1.5rem] border p-4 cursor-default select-none"
          style={{
            borderColor: 'var(--border-color)',
            background: 'var(--card-bg)'
          }}
        >
          <div
            className="text-[10px] font-black uppercase tracking-widest mb-2"
            style={{ color: 'var(--text-muted)' }}
          >
            الانتهاء
          </div>

          <div
            className="text-sm font-black"
            style={{ color: 'var(--text-color)' }}
          >
            {subscriptionExpiryText}
          </div>
        </div>

        <div
          className="rounded-[1.5rem] border p-4 cursor-default select-none"
          style={{
            borderColor: subscriptionStatus.isExpired
              ? 'rgba(239,68,68,0.25)'
              : 'var(--border-color)',
            background: 'var(--card-bg)'
          }}
        >
          <div
            className="text-[10px] font-black uppercase tracking-widest mb-2"
            style={{ color: 'var(--text-muted)' }}
          >
            الحالة
          </div>

          <div
            className="text-sm font-black"
            style={{
              color: subscriptionStatus.isExpired
                ? 'rgb(220,38,38)'
                : 'var(--theme-primary)'
            }}
          >
            {subscriptionRemainingText}
          </div>
        </div>
      </div>
    </div>
  </div>
)}

        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/pos" element={<POS user={user} />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/purchases" element={<Purchases user={user} />} />
          <Route path="/suppliers" element={<People type="suppliers" />} />
          <Route path="/customers" element={<People type="customers" />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/expenses" element={<Expenses user={user} />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/users" element={<Users />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
          <Route path="/barcode-generator" element={<BarcodeGenerator />} />
          <Route path="/price-labels" element={<PriceLabels />} />
          <Route path="/qr-generator" element={<QrGenerator />} />
          <Route path="/currency-converter" element={<CurrencyConverter />} />
          <Route path="/profit-calculator" element={<ProfitCalculator />} />
          <Route path="/print-templates" element={<PrintTemplates />} />
        </Routes>
      </Layout>
    </Router>
  );
}