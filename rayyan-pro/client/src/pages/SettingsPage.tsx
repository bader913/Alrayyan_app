import React, { useState, useEffect } from 'react';
import { settingsApi } from '../api/settings.ts';
import { useAuthStore } from '../store/authStore.ts';
import {
  Settings, Save, Check, Download, Trash2, RotateCcw,
  Shield, Eye, EyeOff, AlertTriangle, X,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

interface SettingGroup {
  title:  string;
  keys:   Array<{ key: string; label: string; type: 'text' | 'number' | 'color' | 'select' | 'boolean'; options?: string[] }>;
}

const GROUPS: SettingGroup[] = [
  {
    title: 'بيانات المتجر',
    keys: [
      { key: 'shop_name',      label: 'اسم المتجر',       type: 'text'   },
      { key: 'shop_phone',     label: 'رقم الهاتف',       type: 'text'   },
      { key: 'shop_address',   label: 'العنوان',           type: 'text'   },
      { key: 'receipt_footer', label: 'تذييل الفاتورة',   type: 'text'   },
    ],
  },
  {
    title: 'العملة وأسعار الصرف',
    keys: [
      { key: 'currency',    label: 'العملة الرئيسية',      type: 'select', options: ['USD', 'SYP', 'SAR', 'AED', 'TRY'] },
      { key: 'usd_to_syp',  label: 'دولار → ليرة سورية',  type: 'number' },
      { key: 'usd_to_try',  label: 'دولار → ليرة تركية',  type: 'number' },
      { key: 'usd_to_sar',  label: 'دولار → ريال سعودي',  type: 'number' },
      { key: 'usd_to_aed',  label: 'دولار → درهم إماراتي',type: 'number' },
    ],
  },
  {
    title: 'المخزون والنظام',
    keys: [
      { key: 'low_stock_threshold', label: 'حد المخزون المنخفض', type: 'number'  },
      { key: 'enable_shifts',       label: 'تفعيل الورديات',     type: 'boolean' },
      { key: 'show_usd',            label: 'عرض الأسعار بالدولار',type: 'boolean'},
    ],
  },
  {
    title: 'المظهر',
    keys: [
      { key: 'theme_color', label: 'لون النظام', type: 'color'  },
      { key: 'theme_mode',  label: 'وضع العرض',  type: 'select', options: ['light', 'dark'] },
    ],
  },
];

function applyTheme(s: Record<string, string>) {
  const color = s.theme_color || '#059669';
  document.documentElement.style.setProperty('--primary', color);
  if (s.theme_mode === 'dark') {
    document.documentElement.classList.add('dark-mode');
  } else {
    document.documentElement.classList.remove('dark-mode');
  }
}

// ─── Password Confirmation Modal ──────────────────────────────────────────────
type ActionType = 'backup' | 'clear' | 'restore-defaults';

const ACTION_META: Record<ActionType, {
  title: string; description: string; confirmLabel: string;
  danger: boolean; icon: React.ReactNode;
}> = {
  backup: {
    title:        'تأكيد النسخ الاحتياطي',
    description:  'سيتم تصدير جميع بيانات النظام (مبيعات، مشتريات، عملاء، موردين، منتجات...) إلى ملف JSON.',
    confirmLabel: 'تحميل النسخة الاحتياطية',
    danger:       false,
    icon:         <Download className="w-6 h-6 text-sky-400" />,
  },
  clear: {
    title:        '⚠️ مسح جميع البيانات',
    description:  'سيتم حذف جميع الفواتير والمبيعات والمشتريات والمرتجعات وحركات المخزون وسجل العمليات، وإعادة أرصدة العملاء والموردين والمخزون إلى صفر. هذا الإجراء لا يمكن التراجع عنه.',
    confirmLabel: 'تأكيد المسح الكامل',
    danger:       true,
    icon:         <Trash2 className="w-6 h-6 text-red-400" />,
  },
  'restore-defaults': {
    title:        'استعادة الإعدادات الافتراضية',
    description:  'سيتم إعادة جميع إعدادات النظام إلى قيمها الافتراضية (العملة، الألوان، بيانات المتجر...). البيانات التجارية لن تُمسح.',
    confirmLabel: 'استعادة الافتراضيات',
    danger:       false,
    icon:         <RotateCcw className="w-6 h-6 text-yellow-400" />,
  },
};

interface ConfirmModalProps {
  action:  ActionType;
  onClose: () => void;
  onDone:  (msg: string) => void;
}

function ConfirmModal({ action, onClose, onDone }: ConfirmModalProps) {
  const [password, setPassword]   = useState('');
  const [showPw, setShowPw]       = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const token = useAuthStore.getState().accessToken;
  const meta  = ACTION_META[action];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) { setError('أدخل كلمة المرور'); return; }
    setLoading(true);
    setError('');

    try {
      if (action === 'backup') {
        const res = await fetch('/api/admin/backup', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body:    JSON.stringify({ password }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.message ?? 'فشل النسخ الاحتياطي');
        }
        const blob = await res.blob();
        const date = new Date().toISOString().slice(0, 10);
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `rayyan-backup-${date}.json`;
        a.click();
        URL.revokeObjectURL(url);
        onDone('تم تحميل النسخة الاحتياطية بنجاح');
      } else {
        const endpoint = action === 'clear' ? '/api/admin/clear' : '/api/admin/restore-defaults';
        const res = await fetch(endpoint, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body:    JSON.stringify({ password }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.message ?? 'حدث خطأ');
        onDone(json.message ?? 'تمت العملية بنجاح');
      }
    } catch (err: unknown) {
      setError((err as Error).message ?? 'حدث خطأ');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className={`flex items-center gap-3 p-5 border-b ${meta.danger ? 'border-red-800/50' : 'border-slate-700'}`}>
          {meta.icon}
          <h2 className="text-base font-bold text-white flex-1">{meta.title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className={`rounded-xl p-4 text-sm leading-relaxed ${meta.danger ? 'bg-red-950/40 border border-red-800/40 text-red-300' : 'bg-slate-800 text-slate-300'}`}>
            {meta.danger && <AlertTriangle className="w-4 h-4 inline ml-1 mb-0.5" />}
            {meta.description}
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Shield className="w-4 h-4" />
              كلمة مرور حسابك للتأكيد
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoFocus
                placeholder="أدخل كلمة مرورك..."
                className={`w-full bg-slate-800 border rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none pr-10 ${
                  error ? 'border-red-600 focus:border-red-500' : 'border-slate-600 focus:border-sky-500'
                }`}
              />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {error && <p className="text-red-400 text-xs mt-1.5">{error}</p>}
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-lg text-sm transition">
              إلغاء
            </button>
            <button type="submit" disabled={loading}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition disabled:opacity-50 ${
                meta.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-sky-600 hover:bg-sky-700'
              }`}>
              {loading ? 'جاري التنفيذ...' : meta.confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Settings Page ───────────────────────────────────────────────────────
export default function SettingsPage() {
  const qc = useQueryClient();
  const [values, setValues]   = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState('');

  const [activeAction, setActiveAction] = useState<ActionType | null>(null);
  const [successMsg, setSuccessMsg]     = useState('');

  useEffect(() => {
    settingsApi.getAll().then(res => {
      setValues(res.data.settings);
      applyTheme(res.data.settings);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await settingsApi.bulkUpdate(values);
      applyTheme(values);
      qc.invalidateQueries({ queryKey: ['settings'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError('حدث خطأ أثناء الحفظ');
    }
    setSaving(false);
  };

  const handleActionDone = (msg: string) => {
    setActiveAction(null);
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 5000);
    if (activeAction === 'restore-defaults') {
      settingsApi.getAll().then(res => {
        setValues(res.data.settings);
        applyTheme(res.data.settings);
        qc.invalidateQueries({ queryKey: ['settings'] });
      }).catch(() => {});
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="text-slate-400">جاري التحميل...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="w-7 h-7 text-slate-300" />
          <h1 className="text-2xl font-bold text-white">الإعدادات</h1>
        </div>
        <button onClick={handleSave} disabled={saving}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition ${
            saved ? 'bg-green-600 text-white' : 'bg-sky-600 hover:bg-sky-700 text-white'
          } disabled:opacity-50`}>
          {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? 'تم الحفظ' : saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
        </button>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}
      {successMsg && (
        <div className="bg-green-900/30 border border-green-700 text-green-300 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
          <Check className="w-4 h-4" /> {successMsg}
        </div>
      )}

      {/* Settings Groups */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {GROUPS.map(group => (
          <div key={group.title} className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 border-b border-slate-700 pb-2">
              {group.title}
            </h3>
            <div className="space-y-3">
              {group.keys.map(item => (
                <div key={item.key}>
                  <label className="block text-xs text-slate-400 mb-1">{item.label}</label>

                  {item.type === 'text' && (
                    <input type="text" value={values[item.key] ?? ''}
                      onChange={e => setValues(v => ({ ...v, [item.key]: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500" />
                  )}

                  {item.type === 'number' && (
                    <input type="number" value={values[item.key] ?? ''}
                      onChange={e => setValues(v => ({ ...v, [item.key]: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500" />
                  )}

                  {item.type === 'color' && (
                    <div className="flex items-center gap-3">
                      <input type="color" value={values[item.key] ?? '#059669'}
                        onChange={e => setValues(v => ({ ...v, [item.key]: e.target.value }))}
                        className="w-12 h-9 rounded cursor-pointer border border-slate-600 bg-transparent" />
                      <span className="text-sm text-slate-400 font-mono">{values[item.key] ?? ''}</span>
                    </div>
                  )}

                  {item.type === 'select' && (
                    <select value={values[item.key] ?? ''}
                      onChange={e => setValues(v => ({ ...v, [item.key]: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500">
                      {(item.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  )}

                  {item.type === 'boolean' && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <div
                        onClick={() => setValues(v => ({ ...v, [item.key]: v[item.key] === 'true' ? 'false' : 'true' }))}
                        className={`w-10 h-5 rounded-full transition-colors flex items-center ${values[item.key] === 'true' ? 'bg-sky-600' : 'bg-slate-600'}`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-0.5 ${values[item.key] === 'true' ? 'translate-x-5' : ''}`} />
                      </div>
                      <span className="text-sm text-slate-400">{values[item.key] === 'true' ? 'مفعّل' : 'معطّل'}</span>
                    </label>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ─── Backup & Maintenance ────────────────────────────────────────────── */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-1 flex items-center gap-2">
          <Shield className="w-4 h-4 text-slate-400" />
          النسخ الاحتياطي والصيانة
        </h3>
        <p className="text-xs text-slate-500 mb-5 border-b border-slate-700 pb-4">
          جميع العمليات التالية تتطلب كلمة مرور حسابك للتأكيد
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Backup */}
          <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-sky-900/50 border border-sky-800/50 flex items-center justify-center">
                <Download className="w-4 h-4 text-sky-400" />
              </div>
              <span className="font-semibold text-white text-sm">نسخة احتياطية</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed flex-1">
              تصدير كامل لجميع بيانات النظام: مبيعات، مشتريات، عملاء، موردين، منتجات، فواتير، وكل العمليات.
            </p>
            <button
              onClick={() => setActiveAction('backup')}
              className="w-full py-2 rounded-lg text-sm font-semibold bg-sky-600 hover:bg-sky-700 text-white transition flex items-center justify-center gap-2">
              <Download className="w-4 h-4" /> تحميل النسخة
            </button>
          </div>

          {/* Restore Defaults */}
          <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-yellow-900/50 border border-yellow-800/50 flex items-center justify-center">
                <RotateCcw className="w-4 h-4 text-yellow-400" />
              </div>
              <span className="font-semibold text-white text-sm">استعادة الافتراضيات</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed flex-1">
              إعادة جميع إعدادات النظام إلى قيمها الأصلية (العملة، الألوان، اسم المتجر...). البيانات التجارية لن تُمسح.
            </p>
            <button
              onClick={() => setActiveAction('restore-defaults')}
              className="w-full py-2 rounded-lg text-sm font-semibold bg-yellow-600 hover:bg-yellow-700 text-white transition flex items-center justify-center gap-2">
              <RotateCcw className="w-4 h-4" /> استعادة
            </button>
          </div>

          {/* Clear All */}
          <div className="bg-slate-900/60 border border-red-900/40 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-red-900/50 border border-red-800/50 flex items-center justify-center">
                <Trash2 className="w-4 h-4 text-red-400" />
              </div>
              <span className="font-semibold text-white text-sm">مسح جميع البيانات</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed flex-1">
              حذف كل الفواتير والمبيعات والمشتريات والمرتجعات وتصفير المخزون والأرصدة. <span className="text-red-400 font-semibold">لا يمكن التراجع.</span>
            </p>
            <button
              onClick={() => setActiveAction('clear')}
              className="w-full py-2 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-700 text-white transition flex items-center justify-center gap-2">
              <Trash2 className="w-4 h-4" /> مسح الكل
            </button>
          </div>

        </div>
      </div>

      {/* Password Confirmation Modal */}
      {activeAction && (
        <ConfirmModal
          action={activeAction}
          onClose={() => setActiveAction(null)}
          onDone={handleActionDone}
        />
      )}
    </div>
  );
}
