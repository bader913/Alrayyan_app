import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Database,
  Download,
  Upload,
  Printer,
  Store,
  Globe,
  Bell,
  Save,
  CheckCircle,
  Palette,
  AlertTriangle,
  Sun,
  Moon,
  Trash2,
  Loader2,
  Info,
  Calendar,
  Tag,
  Phone,
  Mail,
  MessageCircle,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { appAlert, appError, appSuccess } from '../utils/appAlert';
import { appConfirm } from '../utils/uiDialogs';


const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState('general');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [showPasswordGate, setShowPasswordGate] = useState(false);
const [passwordGateValue, setPasswordGateValue] = useState('');
const [passwordGateAction, setPasswordGateAction] = useState<'reset' | 'restore' | null>(null);
const [pendingRestoreFile, setPendingRestoreFile] = useState<File | null>(null);
const [verifyingPassword, setVerifyingPassword] = useState(false);
const [subscriptionLoading, setSubscriptionLoading] = useState(true);
const [subscriptionRenewing, setSubscriptionRenewing] = useState(false);
const [renewalCode, setRenewalCode] = useState('');
const [subscriptionStatus, setSubscriptionStatus] = useState<null | {
  exists: boolean;
  isExpired: boolean;
  isActive: boolean;
  readOnly: boolean;
  message: string;
  reason?: string;
  subscription: {
    id: number;
    license_type: 'trial' | 'yearly' | 'two_years' | 'three_years';
    starts_at: string;
    expires_at: string;
    is_active: number;
  } | null;
  remainingMinutes: number;
  remainingDays: number;
}>(null);
  const appInfo = {
    appName: 'الريان',
    version: '0.0.5',
    buildDate: '2026-03-17',
    releaseName: 'Stable',
    companyName: 'Bader Alraslan',
    supportPhone: '905316200039',
    supportWhatsapp: '963969321141',
    supportEmail: 'raslanbader@gmail.com'
  };
  const [settings, setSettings] = useState({
  enable_shifts: 'false',
  shop_name: '',
  shop_phone: '',
  shop_address: '',
  shop_tax_number: '',
  currency: 'USD',
  exchange_rate: '1',
  receipt_footer: '',
  low_stock_threshold: '5',
  theme_color: '#059669',
  theme_mode: 'light',
  show_usd: 'true',
  usd_to_syp: '116',
  usd_to_try: '44'
});

  useEffect(() => {
  fetchSettings();
  fetchSubscriptionStatus();
}, []);

  useEffect(() => {
    applyTheme(settings.theme_color, settings.theme_mode);
  }, [settings.theme_color, settings.theme_mode]);

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
  const openPasswordGate = (action: 'reset' | 'restore', file?: File) => {
  setPasswordGateAction(action);
  setPasswordGateValue('');
  setPendingRestoreFile(file || null);
  setShowPasswordGate(true);
};

const closePasswordGate = () => {
  if (verifyingPassword) return;
  setShowPasswordGate(false);
  setPasswordGateValue('');
  setPasswordGateAction(null);
  setPendingRestoreFile(null);
};

const verifyCurrentUserPassword = async (password: string) => {
  const currentUser = JSON.parse(localStorage.getItem('user') || 'null');

  if (!currentUser?.username) {
    throw new Error('تعذر معرفة المستخدم الحالي');
  }

  const loginRes = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: currentUser.username,
      password
    })
  });

  const loginResult = await loginRes.json();

  if (!loginRes.ok || !loginResult.success) {
    throw new Error('كلمة المرور غير صحيحة');
  }

  return currentUser;
};

const executeResetAllData = async () => {
  setResetLoading(true);
  try {
    const res = await fetch('/api/reset-all', {
      method: 'DELETE'
    });

    const result = await res.json();

    if (result.success) {
      appSuccess('تم مسح جميع بيانات التطبيق بنجاح. سيتم إعادة تحميل الصفحة.');
      setTimeout(() => {
        window.location.reload();
      }, 800);
    } else {
      appError('فشل مسح البيانات: ' + (result.message || 'خطأ غير معروف'));
    }
  } catch (error) {
    console.error('Error during reset:', error);
    appError('حدث خطأ أثناء مسح بيانات التطبيق');
  } finally {
    setResetLoading(false);
  }
};

const executeRestore = async (file: File) => {
  setRestoreLoading(true);
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);

    const res = await fetch('/api/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed)
    });

    const result = await res.json();

    if (result.success) {
      appSuccess('تمت استعادة البيانات بنجاح. سيتم إعادة تحميل الصفحة الآن.');
      setTimeout(() => {
        window.location.reload();
      }, 800);
    } else {
      appError('فشل استعادة البيانات: ' + (result.message || 'خطأ غير معروف'));
    }
  } catch (error) {
    console.error('Error during restore:', error);
    appError('ملف النسخة الاحتياطية غير صالح أو تالف');
  } finally {
    setRestoreLoading(false);
  }
};

const handlePasswordGateConfirm = async () => {
  if (verifyingPassword) return;

  if (!passwordGateValue.trim()) {
    appError('أدخل كلمة المرور');
    return;
  }

  setVerifyingPassword(true);

  try {
    await verifyCurrentUserPassword(passwordGateValue);

    const action = passwordGateAction;
    const file = pendingRestoreFile;

    closePasswordGate();

    if (action === 'reset') {
      await executeResetAllData();
    } else if (action === 'restore' && file) {
      await executeRestore(file);
    }
  } catch (error: any) {
    appError(error.message || 'فشل التحقق من كلمة المرور');
  } finally {
    setVerifyingPassword(false);
  }
};


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

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      const merged = {
  enable_shifts: 'false',
  shop_name: '',
  shop_phone: '',
  shop_address: '',
  shop_tax_number: '',
  currency: 'USD',
  exchange_rate: '1',
  receipt_footer: '',
  low_stock_threshold: '5',
  theme_color: '#059669',
  theme_mode: 'light',
  show_usd: 'true',
  usd_to_syp: '116',
  usd_to_try: '44',
  ...data
};
      setSettings(merged);
      applyTheme(merged.theme_color, merged.theme_mode || 'light');
    } catch (error) {
      console.error('Error fetching settings:', error);
      appError('تعذر تحميل الإعدادات');
    } finally {
      setLoading(false);
    }
  };
 const fetchSubscriptionStatus = async () => {
  try {
    const res = await fetch('/api/subscription-status');
    const data = await res.json();

    if (data?.success === false) {
      setSubscriptionStatus(null);
      return;
    }

    setSubscriptionStatus(data);
  } catch (error) {
    console.error('Error fetching subscription status:', error);
    setSubscriptionStatus(null);
  } finally {
    setSubscriptionLoading(false);
  }
};

const getSubscriptionLabel = (type?: string | null) => {
  switch (type) {
    case 'trial':
      return 'تجريبي';
    case 'yearly':
      return 'سنة';
    case 'two_years':
      return 'سنتين';
    case 'three_years':
      return '3 سنوات';
    default:
      return 'غير مفعل';
  }
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('ar-EG');
};

const getRemainingText = () => {
  if (!subscriptionStatus) return '-';
  if (subscriptionStatus.isExpired) return 'منتهي';

  if (subscriptionStatus.subscription?.license_type === 'trial') {
    return `${subscriptionStatus.remainingDays} يوم ` + subscriptionStatus.remainingMinutes + ' دقيقة متبقية';
  }
  

  return `${subscriptionStatus.remainingDays} يوم`;
};
const getSubscriptionReasonText = () => {
  if (!subscriptionStatus) return 'تعذر قراءة حالة الاشتراك حالياً';

  switch (subscriptionStatus.reason) {
    case 'license_missing':
      return 'لا يوجد ملف ترخيص صالح على هذا الجهاز';
    case 'device_mismatch':
      return 'ملف الترخيص لا يعود لهذا الجهاز';
    case 'license_tampered':
      return 'ملف الترخيص تالف أو تم التلاعب به';
    case 'license_expired':
      return 'انتهت مدة الترخيص على هذا الجهاز';
    default:
      return subscriptionStatus.message || 'لا توجد معلومات اشتراك حالياً';
  }
};
const handleRedeemCode = async () => {
  if (subscriptionRenewing) return;

  const code = renewalCode.trim();
  if (!code) {
    appError('أدخل رمز التجديد أولاً');
    return;
  }

  setSubscriptionRenewing(true);

  try {
    const res = await fetch('/api/subscription/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ renewal_code: code })
    });

    const result = await res.json().catch(() => null);

    if (!res.ok || !result?.success) {
      appError(result?.message || 'فشل تفعيل الاشتراك على هذا الجهاز');
      return;
    }

    appSuccess(result?.message || 'تم تفعيل الاشتراك بنجاح على هذا الجهاز');
    setRenewalCode('');
    await fetchSubscriptionStatus();
    window.dispatchEvent(new Event('subscription-updated'));
  } catch (error) {
    console.error('Error redeeming code:', error);
    appError('حدث خطأ أثناء تفعيل الاشتراك');
  } finally {
    setSubscriptionRenewing(false);
  }
};
const isRenewalInputLocked =
  !!subscriptionStatus &&
  subscriptionStatus.isActive &&
  !subscriptionStatus.isExpired &&
  !!subscriptionStatus.subscription;
  const handleSave = async () => {
    
    if (saving) return;
    setSaving(true);
    
    

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      if (res.ok) {
        applyTheme(settings.theme_color, settings.theme_mode);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        
        const result = await res.json().catch(() => null);
        appError(result?.message || 'فشل حفظ الإعدادات');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      appError('حدث خطأ أثناء حفظ الإعدادات');
    } finally {
      setSaving(false);
    }
  };

  const handleBackup = async () => {
    if (backupLoading) return;
    setBackupLoading(true);

    try {
      const res = await fetch('/api/backup');
      const result = await res.json();

      if (!res.ok || !result?.success) {
        throw new Error(result?.message || 'فشل تصدير البيانات');
      }

      const fileData = JSON.stringify(result, null, 2);
      const blob = new Blob([fileData], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `supermarket_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      appSuccess('تم تصدير النسخة الاحتياطية بنجاح');
    } catch (error: any) {
      console.error('Error during backup:', error);
      appError(error?.message || 'فشل تصدير البيانات');
    } finally {
      setBackupLoading(false);
    }
  };

const handleRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;

  openPasswordGate('restore', file);
};


const handleResetAllData = async () => {
  if (resetLoading) return;
  openPasswordGate('reset');
};
const handleChange = (key: string, value: string) => {
  setSettings((prev) => ({ ...prev, [key]: value }));
};

  const presetColors = [
    '#059669',
    '#2563eb',
    '#7c3aed',
    '#dc2626',
    '#ea580c',
    '#0891b2',
    '#4f46e5',
    '#16a34a'
  ];

   const tabs = [
    { id: 'general', name: 'إعدادات المتجر', icon: Store },
    { id: 'creative', name: 'إعدادات المظهر', icon: Palette },
    { id: 'printing', name: 'إعدادات الفاتورة', icon: Printer },
    { id: 'backup', name: 'النسخ الاحتياطي', icon: Database },
    { id: 'about', name: '  عن البرنامج - الاشتراك والدعم ', icon: Info }
  ];

  if (loading) {
    return (
      <div className="p-8 text-center" dir="rtl">
        <div className="inline-flex items-center gap-3 app-text-muted font-black">
          <Loader2 size={20} className="animate-spin" />
          جاري تحميل الإعدادات...
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-10" dir="rtl">
      <div className="w-full lg:w-80 space-y-3">
        <div
          className="app-card p-4 rounded-[2.5rem] border shadow-sm space-y-2"
          style={{ borderColor: 'var(--border-color)' }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 group ${
                activeTab === tab.id ? 'text-white shadow-xl' : 'app-text hover:app-muted'
              }`}
              style={activeTab === tab.id ? { background: 'var(--theme-primary)' } : {}}
            >
              <div
                className={`p-2 rounded-xl transition-colors ${
                  activeTab === tab.id ? 'bg-white/20' : 'app-muted'
                }`}
              >
                <tab.icon
                  size={20}
                  strokeWidth={activeTab === tab.id ? 2.5 : 2}
                  className={activeTab === tab.id ? 'text-white' : 'app-text-muted'}
                />
              </div>
              <span className="font-black text-sm tracking-tight">{tab.name}</span>
            </button>
          ))}
        </div>

        <div
          className="rounded-[2.5rem] p-8 text-white relative overflow-hidden group"
          style={{ background: 'var(--theme-primary)' }}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 transition-transform duration-700 group-hover:scale-150" />
          <div className="relative z-10 space-y-4">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
              <SettingsIcon size={24} className="animate-spin-slow" />
            </div>
            <h4 className="font-black text-lg leading-tight">مركز التحكم والإعدادات</h4>
            <p className="text-white/80 text-xs font-bold leading-relaxed">
              خصص تجربتك في استخدام النظام بما يتناسب مع احتياجات عملك الخاص.
            </p>
          </div>
        </div>
      </div>

      <div
        className="flex-1 app-card rounded-[3rem] border shadow-sm overflow-hidden flex flex-col"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <div className="p-10 flex-1 overflow-y-auto custom-scrollbar">
          {activeTab === 'general' && (
            
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-10">
              <div
                className="flex items-center gap-4 border-b pb-6"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ background: 'var(--theme-primary-soft)', color: 'var(--theme-primary)' }}
                >
                  <Store size={24} strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="text-2xl font-black app-text tracking-tight">معلومات المتجر</h3>
                  <p className="app-text-muted text-xs font-bold uppercase tracking-widest">
                    البيانات الأساسية التي تظهر في الفواتير
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
                                 <div
                  className="p-8 app-muted rounded-[2.5rem] border space-y-6"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 app-card rounded-2xl flex items-center justify-center shadow-sm border"
                      style={{ borderColor: 'var(--border-color)', color: '#2563eb' }}
                    >
                      <Globe size={24} />
                    </div>
                    <div>
                      <h4 className="font-black app-text">العملة المزدوجة</h4>
                      
                      <p className="text-[10px] font-bold app-text-muted uppercase tracking-widest">
                        عرض الأسعار بالدولار الأمريكي
                      </p>
                    </div>
                    
                  </div>
<div
  className="p-8 app-muted rounded-[2.5rem] border space-y-6"
  style={{ borderColor: 'var(--border-color)' }}
>
  <div className="flex items-center gap-4">
    <div
      className="w-12 h-12 app-card rounded-2xl flex items-center justify-center shadow-sm border"
      style={{ borderColor: 'var(--border-color)', color: 'var(--theme-primary)' }}
    >
      <ShieldCheck size={24} />
    </div>
    <div>
      <h4 className="font-black app-text">نظام الورديات</h4>
      <p className="text-[10px] font-bold app-text-muted uppercase tracking-widest">
        تشغيل أو إيقاف البيع بنظام الوردية
      </p>
    </div>
  </div>

  <div
    className="flex items-center justify-between app-card p-4 rounded-2xl border"
    style={{ borderColor: 'var(--border-color)' }}
  >
    <div>
      <div className="text-sm font-bold app-text">تفعيل نظام الورديات</div>
      <div className="text-[10px] font-bold app-text-muted mt-1">
        عند التفعيل: لا يمكن البيع بدون وردية مفتوحة
      </div>
    </div>

    <button
      onClick={() =>
        handleChange(
          'enable_shifts',
          settings.enable_shifts === 'true' ? 'false' : 'true'
        )
      }
      className={`w-14 h-7 rounded-full relative transition-all duration-500 ${
        settings.enable_shifts === 'true' ? '' : 'bg-slate-300'
      }`}
      style={settings.enable_shifts === 'true' ? { background: 'var(--theme-primary)' } : {}}
    >
      <div
        className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-500 ${
          settings.enable_shifts === 'true' ? 'right-1' : 'left-1'
        }`}
      />
    </button>
  </div>

  <div
    className="rounded-2xl p-4 border"
    style={{
      borderColor:
        settings.enable_shifts === 'true'
          ? 'rgba(34,197,94,0.18)'
          : 'rgba(148,163,184,0.18)',
      background:
        settings.enable_shifts === 'true'
          ? 'rgba(34,197,94,0.06)'
          : 'rgba(148,163,184,0.06)'
    }}
  >
    <div
      className="text-sm font-black mb-2"
      style={{
        color: settings.enable_shifts === 'true' ? 'rgb(22,163,74)' : 'rgb(100,116,139)'
      }}
    >
      {settings.enable_shifts === 'true'
        ? 'نظام الورديات مفعّل'
        : 'نظام الورديات غير مفعّل'}
    </div>

    <p className="text-xs font-bold app-text-muted leading-relaxed">
      {settings.enable_shifts === 'true'
        ? 'سيظهر فتح وإغلاق الوردية داخل الكاشير، ولن تتم أي عملية بيع بدون وردية مفتوحة.'
        : 'سيعمل الكاشير بشكل طبيعي بدون ورديات، ولن يتم ربط الفواتير بأي وردية.'}
    </p>
  </div>
</div>
                  <div
                    className="flex items-center justify-between app-card p-4 rounded-2xl border"
                    style={{ borderColor: 'var(--border-color)' }}
                  >
                    <span className="text-sm font-bold app-text">تفعيل العرض المزدوج</span>
                    <button
                      onClick={() => handleChange('show_usd', settings.show_usd === 'true' ? 'false' : 'true')}
                      className={`w-14 h-7 rounded-full relative transition-all duration-500 ${
                        settings.show_usd === 'true' ? '' : 'bg-slate-300'
                      }`}
                      style={settings.show_usd === 'true' ? { background: 'var(--theme-primary)' } : {}}
                    >
                      <div
                        className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-500 ${
                          settings.show_usd === 'true' ? 'right-1' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>
{settings.show_usd === 'true' && (
  <motion.div
    initial={{ opacity: 0, height: 0 }}
    animate={{ opacity: 1, height: 'auto' }}
    className="space-y-4"
  >
    <div className="space-y-2">
      <label className="text-[10px] font-black app-text-muted uppercase tracking-widest mr-2">
        سعر الدولار مقابل الليرة السورية
      </label>
      <div className="relative">
        <input
          type="number"
          value={settings.usd_to_syp || 116}
          onChange={(e) => handleChange('usd_to_syp', e.target.value)}
          className="w-full app-card border rounded-2xl p-4 font-black app-text outline-none transition-all"
          style={{ borderColor: 'var(--border-color)' }}
        />
        <span className="absolute left-4 top-1/2 -translate-y-1/2 app-text-muted font-bold text-xs">
          ل.س
        </span>
      </div>
    </div>

    <div className="space-y-2">
      <label className="text-[10px] font-black app-text-muted uppercase tracking-widest mr-2">
        سعر الدولار مقابل الليرة التركية
      </label>
      <div className="relative">
        <input
          type="number"
          value={settings.usd_to_try || 44}
          onChange={(e) => handleChange('usd_to_try', e.target.value)}
          className="w-full app-card border rounded-2xl p-4 font-black app-text outline-none transition-all"
          style={{ borderColor: 'var(--border-color)' }}
        />
        <span className="absolute left-4 top-1/2 -translate-y-1/2 app-text-muted font-bold text-xs">
          TRY
        </span>
      </div>
    </div>
  </motion.div>
)}
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-black app-text-muted uppercase tracking-widest mr-2">
                    اسم المحل / النشاط
                  </label>
                  <input
                    type="text"
                    value={settings.shop_name}
                    onChange={(e) => handleChange('shop_name', e.target.value)}
                    className="w-full app-muted border rounded-2xl p-5 outline-none font-bold app-text transition-all"
                    style={{ borderColor: 'var(--border-color)' }}
                    placeholder="مثال: سوبر ماركت الخير"
                  />
                   <div className="space-y-3">
                  <label className="text-xs font-black app-text-muted uppercase tracking-widest mr-2">
                    العملة الأساسية
                  </label>
                  <select
                    value={settings.currency}
                    onChange={(e) => handleChange('currency', e.target.value)}
                    className="w-full app-muted border rounded-2xl p-5 outline-none font-bold app-text transition-all"
                    style={{ borderColor: 'var(--border-color)' }}
                  >
                    <option value="SYP">ليرة سورية (ل.س)</option>
    <option value="USD">دولار أمريكي ($)</option>
    <option value="TRY">ليرة تركية (TL)</option>
    <option value="SAR">ريال سعودي (SAR)</option>
    <option value="AED">درهم إماراتي (AED)</option>
                  </select>
                </div>
                 <div className="space-y-3">
                  <label className="text-xs font-black app-text-muted uppercase tracking-widest mr-2">
                    رقم الهاتف
                  </label>
                  <input
                    type="text"
                    value={settings.shop_phone}
                    onChange={(e) => handleChange('shop_phone', e.target.value)}
                    className="w-full app-muted border rounded-2xl p-5 outline-none font-bold app-text transition-all text-left"
                    style={{ borderColor: 'var(--border-color)' }}
                    placeholder="09xx xxx xxx"
                  />
                </div>
                 <div className="space-y-3 col-span-full">
                  <label className="text-xs font-black app-text-muted uppercase tracking-widest mr-2">
                    العنوان بالتفصيل
                  </label>
                  <input
                    type="text"
                    value={settings.shop_address}
                    onChange={(e) => handleChange('shop_address', e.target.value)}
                    className="w-full app-muted border rounded-2xl p-5 outline-none font-bold app-text transition-all"
                    style={{ borderColor: 'var(--border-color)' }}
                    placeholder="دمشق، الميدان، الشارع الرئيسي"
                  />
                </div>
                </div>
                

               

               

                <div className="space-y-3">
                  <label className="text-xs font-black app-text-muted uppercase tracking-widest mr-2">
                    الرقم الضريبي (اختياري)
                  </label>
                  <input
                    type="text"
                    value={settings.shop_tax_number}
                    onChange={(e) => handleChange('shop_tax_number', e.target.value)}
                    className="w-full app-muted border rounded-2xl p-5 outline-none font-bold app-text transition-all text-left"
                    style={{ borderColor: 'var(--border-color)' }}
                  />
                </div>

               
              </div>
            </motion.div>
          )}

          {activeTab === 'creative' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-10">
              <div
                className="flex items-center gap-4 border-b pb-6"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ background: 'var(--theme-primary-soft)', color: 'var(--theme-primary)' }}
                >
                  <Palette size={24} strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="text-2xl font-black app-text tracking-tight">إعدادات إبداعية</h3>
                  <p className="app-text-muted text-xs font-bold uppercase tracking-widest">
                    ألوان وثيمات وخيارات عرض متقدمة
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div
                  className="p-8 app-muted rounded-[2.5rem] border space-y-6"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 app-card rounded-2xl flex items-center justify-center shadow-sm border"
                      style={{ color: 'var(--theme-primary)', borderColor: 'var(--border-color)' }}
                    >
                      <Palette size={24} />
                    </div>
                    <div>
                      <h4 className="font-black app-text">لون السمة الرئيسي</h4>
                      <p className="text-[10px] font-bold app-text-muted uppercase tracking-widest">
                        تخصيص اللون الأساسي للنظام
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <input
                      type="color"
                      value={settings.theme_color}
                      onChange={(e) => handleChange('theme_color', e.target.value)}
                      className="w-16 h-16 rounded-2xl cursor-pointer border-4 border-white shadow-lg overflow-hidden"
                    />
                    <div>
                      <div className="text-lg font-black app-text font-mono tracking-tighter">
                        {settings.theme_color}
                      </div>
                      <p className="text-[10px] font-bold app-text-muted">يتم تطبيقه مباشرة على الواجهة</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {presetColors.map((color) => (
                      <button
                        key={color}
                        onClick={() => handleChange('theme_color', color)}
                        className="w-10 h-10 rounded-2xl border-4 border-white shadow-md"
                        style={{ background: color }}
                      />
                    ))}
                  </div>
                </div>

                <div
                  className="p-8 app-muted rounded-[2.5rem] border space-y-6"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 app-card rounded-2xl flex items-center justify-center shadow-sm border"
                      style={{ borderColor: 'var(--border-color)', color: 'var(--text-color)' }}
                    >
                      {settings.theme_mode === 'dark' ? <Moon size={24} /> : <Sun size={24} />}
                    </div>
                    <div>
                      <h4 className="font-black app-text">الثيم</h4>
                      <p className="text-[10px] font-bold app-text-muted uppercase tracking-widest">فاتح أو داكن</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => handleChange('theme_mode', 'light')}
                      className={`p-5 rounded-2xl border font-black transition-all ${
                        settings.theme_mode === 'light' ? 'text-white' : 'app-card app-text'
                      }`}
                      style={
                        settings.theme_mode === 'light'
                          ? { background: 'var(--theme-primary)', borderColor: 'var(--theme-primary)' }
                          : { borderColor: 'var(--border-color)' }
                      }
                    >
                      <div className="flex items-center justify-center gap-3">
                        <Sun size={18} />
                        فاتح
                      </div>
                    </button>

                    <button
                      onClick={() => handleChange('theme_mode', 'dark')}
                      className={`p-5 rounded-2xl border font-black transition-all ${
                        settings.theme_mode === 'dark' ? 'text-white' : 'app-card app-text'
                      }`}
                      style={
                        settings.theme_mode === 'dark'
                          ? { background: 'var(--theme-primary)', borderColor: 'var(--theme-primary)' }
                          : { borderColor: 'var(--border-color)' }
                      }
                    >
                      <div className="flex items-center justify-center gap-3">
                        <Moon size={18} />
                        داكن
                      </div>
                    </button>
                  </div>
                </div>


                <div
                  className="p-8 app-muted rounded-[2.5rem] border space-y-6"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 app-card text-amber-600 rounded-2xl flex items-center justify-center shadow-sm border"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      <AlertTriangle size={24} />
                    </div>
                    <div>
                      <h4 className="font-black app-text">تنبيهات المخزون</h4>
                      <p className="text-[10px] font-bold app-text-muted uppercase tracking-widest">
                        إدارة مستويات الأمان
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black app-text-muted uppercase tracking-widest mr-2">
                      نبهني عندما تصل كمية المنتج إلى:
                    </label>
                    <div className="flex items-center gap-4">
                      <input
                        type="number"
                        value={settings.low_stock_threshold}
                        onChange={(e) => handleChange('low_stock_threshold', e.target.value)}
                        className="w-full app-card border rounded-2xl p-4 font-black app-text outline-none transition-all"
                        style={{ borderColor: 'var(--border-color)' }}
                      />
                      <span className="text-sm font-black app-text-muted">وحدات</span>
                    </div>
                  </div>
                </div>

                <div
                  className="md:col-span-2 p-8 rounded-[2.5rem] border"
                  style={{
                    background: 'var(--theme-primary-soft)',
                    borderColor: 'var(--theme-primary-soft-2)'
                  }}
                >
                  <h4 className="font-black app-text mb-4">معاينة مباشرة</h4>
                  <div className="flex flex-wrap gap-4 items-center">
                    <button
                      className="px-6 py-3 rounded-2xl text-white font-black shadow-lg"
                      style={{ background: 'var(--theme-primary)' }}
                    >
                      زر رئيسي
                    </button>
                    <button
                      className="px-6 py-3 rounded-2xl font-black border"
                      style={{ color: 'var(--theme-primary)', borderColor: 'var(--theme-primary)' }}
                    >
                      زر ثانوي
                    </button>
                    <div
                      className="px-5 py-3 rounded-2xl font-black"
                      style={{ background: 'var(--theme-primary-soft-2)', color: 'var(--theme-primary)' }}
                    >
                      شارة لونية
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'printing' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-10">
              <div
                className="flex items-center gap-4 border-b pb-6"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ background: 'var(--theme-primary-soft)', color: 'var(--theme-primary)' }}
                >
                  <Printer size={24} strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="text-2xl font-black app-text tracking-tight">إعدادات الفاتورة</h3>
                  <p className="app-text-muted text-xs font-bold uppercase tracking-widest">
                    تخصيص شكل ومحتوى الفاتورة المطبوعة
                  </p>
                </div>
              </div>

              <div className="space-y-8">
                <div className="space-y-4">
                  <label className="text-xs font-black app-text-muted uppercase tracking-widest mr-2">
                    رسالة تذييل الفاتورة
                  </label>
                  <textarea
                    value={settings.receipt_footer}
                    onChange={(e) => handleChange('receipt_footer', e.target.value)}
                    className="w-full app-muted border rounded-[2rem] p-8 outline-none font-bold app-text transition-all h-48 resize-none"
                    style={{ borderColor: 'var(--border-color)' }}
                    placeholder="مثال: شكراً لزيارتكم.. البضاعة المباعة لا ترد ولا تستبدل بعد 3 أيام"
                  />
                </div>

                <div
                  className="p-8 rounded-[2.5rem] border shadow-2xl relative overflow-hidden"
                  style={{
                    background: 'var(--muted-bg)',
                    borderColor: 'var(--border-color)'
                  }}
                >
                  <div className="absolute top-0 left-0 w-full h-1" style={{ background: 'var(--theme-primary)' }} />
                  <h4
                    className="text-[10px] font-black uppercase tracking-[0.2em] mb-6 text-center"
                    style={{ color: 'var(--theme-primary)' }}
                  >
                    معاينة الفاتورة
                  </h4>
                  <div className="space-y-4 text-center">
                    <div
                      className="w-16 h-1 mx-auto rounded-full"
                      style={{ background: 'var(--border-color)' }}
                    />
                    <p className="app-text text-sm font-bold italic leading-relaxed px-10">
                      "{settings.receipt_footer || 'شكراً لزيارتكم، نرجو زيارتنا مرة أخرى!'}"
                    </p>
                    <div
                      className="w-16 h-1 mx-auto rounded-full"
                      style={{ background: 'var(--border-color)' }}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'backup' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-10">
              <div
                className="flex items-center gap-4 border-b pb-6"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{
                    background: 'rgba(59,130,246,0.08)',
                    color: '#2563eb'
                  }}
                >
                  <Database size={24} strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="text-2xl font-black app-text tracking-tight">النسخ الاحتياطي</h3>
                  <p className="app-text-muted text-xs font-bold uppercase tracking-widest">حماية بياناتك من الضياع</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div
                  className="p-10 app-muted rounded-[3rem] border space-y-6"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <div
                    className="w-16 h-16 app-card rounded-[1.5rem] flex items-center justify-center shadow-sm border"
                    style={{ borderColor: 'var(--border-color)', color: '#2563eb' }}
                  >
                    <Download size={32} />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xl font-black app-text">تصدير البيانات</h4>
                    <p className="text-xs font-bold app-text-muted leading-relaxed">
                      قم بتحميل نسخة كاملة من قاعدة البيانات لحفظها في مكان آمن.
                    </p>
                  </div>
                  <button
                    onClick={handleBackup}
                    disabled={backupLoading}
                    className={`w-full text-white font-black py-5 rounded-2xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3 ${
                      backupLoading ? 'opacity-70 cursor-not-allowed' : ''
                    }`}
                    style={{ background: 'var(--theme-primary)' }}
                  >
                    {backupLoading ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} strokeWidth={2.5} />}
                    {backupLoading ? 'جاري التصدير...' : 'تصدير الآن'}
                  </button>
                </div>

                <div
                  className="p-10 app-muted rounded-[3rem] border space-y-6"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <div
                    className="w-16 h-16 app-card rounded-[1.5rem] flex items-center justify-center shadow-sm border"
                    style={{ borderColor: 'var(--border-color)', color: '#e11d48' }}
                  >
                    <Upload size={32} />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xl font-black app-text">استعادة البيانات</h4>
                  
                    <p className="text-xs font-bold text-rose-400 leading-relaxed">
                      تحذير: هذا الإجراء سيقوم باستبدال كافة البيانات الحالية ببيانات النسخة المرفوعة.
                    </p>
                  </div>
                  <label
                    className={`w-full text-white font-black py-5 rounded-2xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3 cursor-pointer ${
                      restoreLoading ? 'opacity-70 pointer-events-none' : ''
                    }`}
                    style={{ background: '#e11d48' }}
                  >
                    {restoreLoading ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} strokeWidth={2.5} />}
                    {restoreLoading ? 'جاري الاستعادة...' : 'رفع واستعادة'}
                    <input type="file" accept=".json,application/json" onChange={handleRestore} className="hidden" />
                  </label>
                </div>
              </div>

              <div
                className="p-10 rounded-[3rem] border space-y-6"
                style={{
                  background: 'rgba(239,68,68,0.08)',
                  borderColor: 'rgba(239,68,68,0.18)'
                }}
              >
                <div
                  className="w-16 h-16 app-card rounded-[1.5rem] flex items-center justify-center shadow-sm border"
                  style={{ borderColor: 'rgba(239,68,68,0.18)', color: '#dc2626' }}
                >
                  <Trash2 size={32} />
                </div>
                <div className="space-y-2">
                  <h4 className="text-xl font-black app-text">مسح كل بيانات التطبيق</h4>
                  <p className="text-xs font-bold text-red-500 leading-relaxed">
                    هذا الإجراء خطير جداً وسيحذف جميع المنتجات والفواتير والعملاء والموردين والمصاريف والإعدادات من التطبيق.
                  </p>
                </div>
                <button
                  onClick={handleResetAllData}
                  disabled={resetLoading}
                  className={`w-full text-white font-black py-5 rounded-2xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3 ${
                    resetLoading ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                  style={{ background: '#dc2626' }}
                >
                  {resetLoading ? <Loader2 size={20} className="animate-spin" /> : <Trash2 size={20} strokeWidth={2.5} />}
                  {resetLoading ? 'جاري المسح...' : 'مسح كل البيانات'}
                </button>
              </div>
            </motion.div>
          )}
                    {activeTab === 'about' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-10">
              <div
  className="p-10 rounded-[3rem] border space-y-6"
  style={{
    background: subscriptionStatus?.isExpired
      ? 'rgba(239,68,68,0.08)'
      : 'var(--theme-primary-soft)',
    borderColor: subscriptionStatus?.isExpired
      ? 'rgba(239,68,68,0.18)'
      : 'var(--theme-primary-soft-2)'
  }}
>
  <div className="flex items-center gap-4">
    <div
      className="w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-white shadow-lg"
      style={{ background: subscriptionStatus?.isExpired ? '#dc2626' : 'var(--theme-primary)' }}
    >
      <ShieldCheck size={30} />
    </div>

    <div>
      <h4 className="text-2xl font-black app-text">الاشتراك والترخيص</h4>
      <p className="text-xs font-bold app-text-muted">
        أدخل رمز التجديد لتفعيل أو تمديد الاشتراك
      </p>
    </div>
  </div>

  {subscriptionLoading ? (
    <div className="flex items-center gap-3 app-text-muted font-black">
      <Loader2 size={18} className="animate-spin" />
      جاري تحميل حالة الاشتراك...
    </div>
  ) : (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div
          className="app-card border rounded-2xl p-4"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="text-[10px] font-black app-text-muted uppercase tracking-widest mb-2">
            نوع الاشتراك
          </div>
          <div className="font-black app-text">
            {getSubscriptionLabel(subscriptionStatus?.subscription?.license_type)}
          </div>
        </div>

        <div
          className="app-card border rounded-2xl p-4"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="text-[10px] font-black app-text-muted uppercase tracking-widest mb-2">
            بداية الاشتراك
          </div>
          <div className="font-black app-text">
            {formatDateTime(subscriptionStatus?.subscription?.starts_at)}
          </div>
        </div>

        <div
          className="app-card border rounded-2xl p-4"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="text-[10px] font-black app-text-muted uppercase tracking-widest mb-2">
            نهاية الاشتراك
          </div>
          <div className="font-black app-text">
            {formatDateTime(subscriptionStatus?.subscription?.expires_at)}
          </div>
        </div>

        <div
          className="app-card border rounded-2xl p-4"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="text-[10px] font-black app-text-muted uppercase tracking-widest mb-2">
            الحالة
          </div>
          <div
            className="font-black"
            style={{ color: subscriptionStatus?.isExpired ? '#dc2626' : 'var(--theme-primary)' }}
          >
            {getRemainingText()}
          </div>
        </div>
      </div>

      <div
        className="rounded-[2rem] border p-5 app-card"
        style={{
          borderColor: subscriptionStatus?.isExpired
            ? 'rgba(239,68,68,0.18)'
            : 'var(--border-color)',
          background: 'var(--muted-bg)'
        }}
      >
        <div
          className="text-sm font-black mb-2 "
          style={{ color: subscriptionStatus?.isExpired ? '#dc2626' : '#06aa40' }}
        >
          {subscriptionStatus?.isExpired
            ? 'الاشتراك منتهي'
            : 'الاشتراك فعال'}
        </div>

       <p className="text-xs font-bold app-text-muted leading-relaxed">
  {getSubscriptionReasonText()}
</p>
      </div>

      <div className="space-y-4">
        <label className="text-xs font-black app-text-muted uppercase tracking-widest mr-2">
          رمز التجديد
        </label>

        <div className="flex flex-col md:flex-row gap-4">
        <input
  type="text"
  value={renewalCode}
  onChange={(e) => setRenewalCode(e.target.value)}
placeholder={
  isRenewalInputLocked
    ? 'الاشتراك مفعل على هذا الجهاز'
    : 'أدخل رمز التجديد هنا'
}
  readOnly={isRenewalInputLocked}
  disabled={isRenewalInputLocked}
  className={`flex-1 app-card border rounded-2xl p-5 outline-none font-bold app-text transition-all ${
    isRenewalInputLocked ? 'opacity-60 cursor-not-allowed' : ''
  }`}
  style={{ borderColor: 'var(--border-color)' }}
  dir="ltr"
/>

      <button
  onClick={handleRedeemCode}
  disabled={subscriptionRenewing || isRenewalInputLocked}
  className={`text-white font-black py-5 px-10 rounded-2xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3 ${
    subscriptionRenewing || isRenewalInputLocked ? 'opacity-70 cursor-not-allowed' : ''
  }`}
  style={{ background: 'var(--theme-primary)' }}
>
            {subscriptionRenewing ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <ShieldCheck size={20} strokeWidth={2.5} />
            )}
            {subscriptionRenewing
  ? 'جارٍ التفعيل...'
  : isRenewalInputLocked
  ? 'الاشتراك مفعل'
  : 'تفعيل / تجديد الاشتراك'}
          </button>
        </div>

     <p className="text-xs font-bold app-text-muted leading-relaxed">
  {isRenewalInputLocked
    ? 'الاشتراك مفعل على هذا الجهاز حالياً. عند انتهاء المدة ستُفتح خانة الترخيص تلقائياً لإدخال رمز جديد.'
    : 'عند إدخال رمز صحيح سيتم تفعيل الاشتراك وربطه بهذا الجهاز مباشرة.'}
</p>
      </div>
    </>
  )}
</div>
              <div
                className="flex items-center gap-4 border-b pb-6"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ background: 'var(--theme-primary-soft)', color: 'var(--theme-primary)' }}
                >
                  <Info size={24} strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="text-2xl font-black app-text tracking-tight">معلومات البرنامج</h3>
                  <p className="app-text-muted text-xs font-bold uppercase tracking-widest">
                    معلومات النسخة والدعم الفني
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div
                  className="p-10 rounded-[3rem] border space-y-6"
                  style={{
                    background: 'var(--theme-primary-soft)',
                    borderColor: 'var(--theme-primary-soft-2)'
                  }}
                >
                  <div
                    className="w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-white shadow-lg"
                    style={{ background: 'var(--theme-primary)' }}
                  >
                    <SettingsIcon size={30} />
                  </div>

                  <div className="space-y-2">
                
                    <h4 className="text-3xl font-black app-text">{appInfo.appName}</h4>
                    <p className="text-sm font-bold app-text-muted">
                      نظام إدارة ومبيعات احترافي مخصص للمتاجر والسوبر ماركت
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div
                      className="app-card border rounded-2xl p-4"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      <div className="text-[10px] font-black app-text-muted uppercase tracking-widest mb-2">
                        الإصدار
                      </div>
                      <div className="font-black app-text">{appInfo.version}</div>
                    </div>

                    <div
                      className="app-card border rounded-2xl p-4"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      <div className="text-[10px] font-black app-text-muted uppercase tracking-widest mb-2">
                        تاريخ البناء
                      </div>
                      <div className="font-black app-text">{appInfo.buildDate}</div>
                    </div>

                    <div
                      className="app-card border rounded-2xl p-4"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      <div className="text-[10px] font-black app-text-muted uppercase tracking-widest mb-2">
                        النسخة
                      </div>
                      <div className="font-black app-text">{appInfo.releaseName}</div>
                    </div>
                  </div> <div className="font-bold text-sm app-text-muted italic">
قناة التلغرام الرئيسية للدعم والتحديثات  
   
   https://t.me/ALRAYYAN_APP  
                  </div>
                  <div className="flex items-center justify-center">
  <img src="/Telegram.png" alt="Telegram" className="w-36 h-36 object-contain" />
</div>
                </div>

                <div
                  className="p-10 app-muted rounded-[3rem] border space-y-6"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <div className="space-y-2">
                    <h4 className="text-xl font-black app-text">بيانات المطور / الدعم</h4>
                    <p className="text-xs font-bold app-text-muted leading-relaxed">
                      للمراجعة والاستعلام عن الخدمات أو في حال طلب تجديد الاشتراك يمكنك التواصل مع فريق الدعم
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div
                      className="app-card border rounded-2xl p-5 flex items-center gap-4"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-white shadow-sm">
                        <Store size={22} style={{ color: 'var(--theme-primary)' }} />
                      </div>
                      <div>
                        <div className="text-[10px] font-black app-text-muted uppercase tracking-widest">
                          الاسم / الشركة
                        </div>
                        <div className="font-black app-text">{appInfo.companyName}</div>
                      </div>
                    </div>

                    <div
                      className="app-card border rounded-2xl p-5 flex items-center gap-4"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-white shadow-sm">
                        <Phone size={22} style={{ color: 'var(--theme-primary)' }} />
                      </div>
                      <div>
                        <div className="text-[10px] font-black app-text-muted uppercase tracking-widest">
                          رقم الدعم
                        </div>
                        <div className="font-black app-text">{appInfo.supportPhone}</div>
                      </div>
                    </div>

                    <div
                      className="app-card border rounded-2xl p-5 flex items-center gap-4"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-white shadow-sm">
                        <MessageCircle size={22} style={{ color: 'var(--theme-primary)' }} />
                      </div>
                      <div>
                        <div className="text-[10px] font-black app-text-muted uppercase tracking-widest">
                          واتساب
                        </div>
                        <div className="font-black app-text">{appInfo.supportWhatsapp}</div>
                      </div>
                    </div>

                    <div
                      className="app-card border rounded-2xl p-5 flex items-center gap-4"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-white shadow-sm">
                        <Mail size={22} style={{ color: 'var(--theme-primary)' }} />
                      </div>
                      <div>
                        <div className="text-[10px] font-black app-text-muted uppercase tracking-widest">
                          البريد الإلكتروني
                        </div>
                        <div className="font-black app-text break-all">{appInfo.supportEmail}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
            </motion.div>
          )}
        </div>

        <div
          className="p-10 app-muted border-t flex flex-col sm:flex-row items-center justify-between gap-6"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 app-card rounded-2xl flex items-center justify-center border shadow-sm"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <Bell size={20} className="app-text-muted" />
            </div>
            <p className="text-xs font-bold app-text-muted leading-tight max-w-[200px]">
              تأكد من مراجعة كافة التغييرات قبل الضغط على زر الحفظ.
            </p>
          </div>

          <div className="flex items-center gap-6">
            <AnimatePresence>
              {saved && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-center gap-3 font-black"
                  style={{ color: 'var(--theme-primary)' }}
                >
                  <CheckCircle size={24} strokeWidth={3} />
                  <span className="text-sm">تم الحفظ بنجاح</span>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={handleSave}
              disabled={saving}
              className={`text-white font-black py-5 px-16 rounded-2xl shadow-xl transition-all active:scale-95 flex items-center gap-3 ${
                saving ? 'opacity-70 cursor-not-allowed' : ''
              }`}
              style={{ background: 'var(--theme-primary)' }}
              onMouseEnter={(e) => {
                if (!saving) e.currentTarget.style.background = 'var(--theme-primary-hover)';
              }}
              onMouseLeave={(e) => {
                if (!saving) e.currentTarget.style.background = 'var(--theme-primary)';
              }}
            >
              {saving ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save size={22} strokeWidth={2.5} />
              )}
              
              {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
            </button>
          </div>
        </div>
      </div>
      {showPasswordGate && (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
    <div
      className="absolute inset-0 bg-slate-900/40"
      onClick={closePasswordGate}
    />

    <div className="relative w-full max-w-md rounded-[2rem] bg-white shadow-2xl border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-xl font-black text-slate-900">
          تأكيد كلمة المرور
        </h3>
        <button
          type="button"
          onClick={closePasswordGate}
          className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100"
        >
          ×
        </button>
      </div>

      <div className="p-6 space-y-5">
        <p className="text-sm font-bold text-slate-600 leading-7">
          أدخل كلمة مرور المستخدم الحالي للمتابعة
        </p>

        <input
          type="password"
          value={passwordGateValue}
          onChange={(e) => setPasswordGateValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handlePasswordGateConfirm();
            }
          }}
          autoFocus
          className="w-full bg-slate-50 border border-slate-200 rounded-[1rem] py-4 px-4 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 font-bold text-slate-700"
          placeholder="أدخل كلمة المرور"
        />

        <div className="flex gap-4 pt-2">
          <button
            type="button"
            onClick={closePasswordGate}
            disabled={verifyingPassword}
            className="flex-1 py-4 bg-slate-100 text-slate-700 font-black rounded-[1rem] disabled:opacity-50"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handlePasswordGateConfirm}
            disabled={verifyingPassword}
            className="flex-1 py-4 bg-emerald-600 text-white font-black rounded-[1rem] disabled:opacity-50"
          >
            {verifyingPassword ? 'جارٍ التحقق...' : 'تأكيد'}
          </button>
        </div>
      </div>
    </div>
  </div>
)}
    </div>
  );
};

export default Settings;