import React, { useState, useEffect, useRef } from 'react';
import { settingsApi } from '../api/settings.ts';
import { useAuthStore } from '../store/authStore.ts';
import {
  Settings, Save, Check, Download, Upload, Trash2,
  Shield, Eye, EyeOff, AlertTriangle, X, FileJson,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

interface SettingGroup {
  title: string;
  keys:  Array<{ key: string; label: string; type: 'text' | 'number' | 'color' | 'select' | 'boolean'; options?: string[] }>;
}

const GROUPS: SettingGroup[] = [
  {
    title: 'بيانات المتجر',
    keys: [
      { key: 'shop_name',      label: 'اسم المتجر',         type: 'text'   },
      { key: 'shop_phone',     label: 'رقم الهاتف',         type: 'text'   },
      { key: 'shop_address',   label: 'العنوان',             type: 'text'   },
      { key: 'receipt_footer', label: 'تذييل الفاتورة',     type: 'text'   },
    ],
  },
  {
    title: 'العملة وأسعار الصرف',
    keys: [
      { key: 'currency',   label: 'العملة الرئيسية',        type: 'select', options: ['USD', 'SYP', 'SAR', 'AED', 'TRY'] },
      { key: 'usd_to_syp', label: 'دولار → ليرة سورية',    type: 'number' },
      { key: 'usd_to_try', label: 'دولار → ليرة تركية',    type: 'number' },
      { key: 'usd_to_sar', label: 'دولار → ريال سعودي',    type: 'number' },
      { key: 'usd_to_aed', label: 'دولار → درهم إماراتي',  type: 'number' },
    ],
  },
  {
    title: 'المخزون والنظام',
    keys: [
      { key: 'low_stock_threshold', label: 'حد المخزون المنخفض',   type: 'number'  },
      { key: 'enable_shifts',       label: 'تفعيل الورديات',       type: 'boolean' },
      { key: 'show_usd',            label: 'عرض الأسعار بالدولار', type: 'boolean' },
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
  if (s.theme_mode === 'dark') document.documentElement.classList.add('dark-mode');
  else                         document.documentElement.classList.remove('dark-mode');
}

// ─── Password Dialog ──────────────────────────────────────────────────────────
type ActionType = 'backup' | 'import' | 'clear';

interface PwDialogProps {
  action:      ActionType;
  importFile?: File | null;
  onClose:     () => void;
  onDone:      (msg: string) => void;
}

const META: Record<ActionType, {
  title: string; desc: string; confirmLabel: string; danger: boolean; icon: React.ReactNode;
}> = {
  backup: {
    title:        'تأكيد التصدير',
    desc:         'سيتم تصدير جميع بيانات النظام (مبيعات، مشتريات، عملاء، موردين، منتجات، إعدادات...) إلى ملف JSON يمكنك حفظه.',
    confirmLabel: 'تحميل النسخة الاحتياطية',
    danger:       false,
    icon:         <Download className="w-6 h-6 text-sky-400" />,
  },
  import: {
    title:        '⚠️ تأكيد الاستيراد',
    desc:         'سيتم استبدال جميع البيانات الحالية (منتجات، عملاء، فواتير، مخزون...) بما يوجد في ملف النسخة الاحتياطية. هذا الإجراء لا يمكن التراجع عنه.',
    confirmLabel: 'تأكيد الاستيراد',
    danger:       true,
    icon:         <Upload className="w-6 h-6 text-orange-400" />,
  },
  clear: {
    title:        '⚠️ مسح شامل لجميع البيانات',
    desc:         'سيتم حذف كل شيء: منتجات، فئات، عملاء، موردين، مبيعات، مشتريات، مرتجعات، حركات مخزون، سجل العمليات. يبقى المستخدمون فقط. هذا الإجراء لا يمكن التراجع عنه.',
    confirmLabel: 'تأكيد المسح الكامل',
    danger:       true,
    icon:         <Trash2 className="w-6 h-6 text-red-400" />,
  },
};

function PwDialog({ action, importFile, onClose, onDone }: PwDialogProps) {
  const [password, setPw]   = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setBusy]  = useState(false);
  const [error, setError]   = useState('');
  const token = useAuthStore.getState().accessToken;
  const meta  = META[action];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) { setError('أدخل كلمة المرور'); return; }
    setBusy(true); setError('');
    try {
      if (action === 'backup') {
        const res = await fetch('/api/admin/backup', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body:    JSON.stringify({ password }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? 'فشل التصدير');
        const blob = await res.blob();
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `rayyan-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        onDone('تم تحميل النسخة الاحتياطية بنجاح ✓');
      } else if (action === 'import') {
        if (!importFile) { setError('لم يتم اختيار ملف'); setBusy(false); return; }
        const text   = await importFile.text();
        const backup = JSON.parse(text);
        const res = await fetch('/api/admin/import', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body:    JSON.stringify({ password, backup }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.message ?? 'فشل الاستيراد');
        const c = json.counts ?? {};
        onDone(`تمت الاستعادة بنجاح ✓ — منتجات: ${c.products ?? 0}، عملاء: ${c.customers ?? 0}، مبيعات: ${c.sales ?? 0}`);
      } else {
        const res = await fetch('/api/admin/clear', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body:    JSON.stringify({ password }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.message ?? 'حدث خطأ');
        onDone(json.message ?? 'تم المسح بنجاح');
      }
    } catch (err: unknown) {
      setError((err as Error).message ?? 'حدث خطأ');
    }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="rounded-2xl w-full max-w-md shadow-2xl border overflow-hidden"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        {/* Header */}
        <div className="flex items-center gap-3 p-5 border-b"
          style={{ borderColor: meta.danger ? 'rgba(239,68,68,0.3)' : 'var(--border)' }}>
          {meta.icon}
          <h2 className="text-base font-black flex-1" style={{ color: 'var(--text-heading)' }}>{meta.title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg transition hover:opacity-70"
            style={{ color: 'var(--text-muted)' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          {/* Description */}
          <div className="rounded-xl p-4 text-sm leading-relaxed"
            style={meta.danger
              ? { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }
              : { background: 'var(--bg-muted)', color: 'var(--text-body)' }}>
            {meta.danger && <AlertTriangle className="w-4 h-4 inline ml-1 mb-0.5" />}
            {meta.desc}
          </div>

          {/* Import file info */}
          {action === 'import' && importFile && (
            <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm border"
              style={{ background: 'var(--bg-muted)', borderColor: 'var(--border)' }}>
              <FileJson className="w-4 h-4 text-orange-400 flex-shrink-0" />
              <span className="truncate" style={{ color: 'var(--text-body)' }}>{importFile.name}</span>
              <span className="text-xs mr-auto flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                {(importFile.size / 1024).toFixed(0)} KB
              </span>
            </div>
          )}

          {/* Password */}
          <div>
            <label className="flex items-center gap-1.5 text-sm mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              <Shield className="w-4 h-4" /> كلمة مرور حسابك للتأكيد
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPw(e.target.value)}
                autoFocus
                placeholder="أدخل كلمة مرورك..."
                className="w-full rounded-xl px-3 py-2.5 text-sm border focus:outline-none focus:ring-2 focus:ring-sky-500 pr-10"
                style={{
                  background:   'var(--bg-input)',
                  borderColor:  error ? '#ef4444' : 'var(--border)',
                  color:        'var(--text-heading)',
                }}
              />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute left-3 top-1/2 -translate-y-1/2 transition hover:opacity-70"
                style={{ color: 'var(--text-muted)' }}>
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {error && <p className="text-red-500 text-xs mt-1.5">{error}</p>}
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition hover:opacity-80 border"
              style={{ background: 'var(--bg-muted)', borderColor: 'var(--border)', color: 'var(--text-body)' }}>
              إلغاء
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition disabled:opacity-50 hover:opacity-90"
              style={{ background: meta.danger ? '#dc2626' : '#0284c7' }}>
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

  const [activeAction, setActive]   = useState<ActionType | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [successMsg, setSuccess]    = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    settingsApi.getAll().then(res => {
      setValues(res.data.settings);
      applyTheme(res.data.settings);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!loading) applyTheme(values);
  }, [values.theme_color, values.theme_mode]);

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      await settingsApi.bulkUpdate(values);
      applyTheme(values);
      qc.invalidateQueries({ queryKey: ['settings'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { setError('حدث خطأ أثناء الحفظ'); }
    setSaving(false);
  };

  const handleFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (!file.name.endsWith('.json')) { setError('يجب اختيار ملف بصيغة JSON'); return; }
    setImportFile(file);
    setActive('import');
  };

  const handleDone = (msg: string) => {
    setActive(null);
    setImportFile(null);
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 7000);
    settingsApi.getAll().then(res => {
      setValues(res.data.settings);
      applyTheme(res.data.settings);
      qc.invalidateQueries({ queryKey: ['settings'] });
    }).catch(() => {});
  };

  const inputCls = 'w-full rounded-xl px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:ring-sky-500';
  const inputSty = { background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-heading)' };

  if (loading) return (
    <div className="p-6 flex items-center justify-center h-64">
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>جاري التحميل...</p>
    </div>
  );

  return (
    <div className="p-6 space-y-6" dir="rtl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="w-7 h-7" style={{ color: 'var(--text-secondary)' }} />
          <h1 className="text-2xl font-black" style={{ color: 'var(--text-heading)' }}>الإعدادات</h1>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition disabled:opacity-50 hover:opacity-90"
          style={{ background: saved ? '#10b981' : '#0284c7' }}>
          {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? 'تم الحفظ' : saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
        </button>
      </div>

      {error && (
        <div className="rounded-xl px-4 py-3 text-sm text-red-500"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
          {error}
        </div>
      )}
      {successMsg && (
        <div className="rounded-xl px-4 py-3 text-sm text-emerald-600 flex items-center gap-2"
          style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}>
          <Check className="w-4 h-4 flex-shrink-0" /> {successMsg}
        </div>
      )}

      {/* Setting Groups */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {GROUPS.map(group => (
          <div key={group.title} className="rounded-2xl p-5 border"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <h3 className="text-sm font-black mb-4 pb-2 border-b"
              style={{ color: 'var(--text-body)', borderColor: 'var(--border)' }}>
              {group.title}
            </h3>
            <div className="space-y-3">
              {group.keys.map(item => (
                <div key={item.key}>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                    {item.label}
                  </label>

                  {item.type === 'text' && (
                    <input type="text" value={values[item.key] ?? ''}
                      onChange={e => setValues(v => ({ ...v, [item.key]: e.target.value }))}
                      className={inputCls} style={inputSty} />
                  )}
                  {item.type === 'number' && (
                    <input type="number" value={values[item.key] ?? ''}
                      onChange={e => setValues(v => ({ ...v, [item.key]: e.target.value }))}
                      className={inputCls} style={inputSty} />
                  )}
                  {item.type === 'color' && (
                    <div className="flex items-center gap-3">
                      <input type="color" value={values[item.key] ?? '#059669'}
                        onChange={e => setValues(v => ({ ...v, [item.key]: e.target.value }))}
                        className="w-12 h-9 rounded-lg cursor-pointer border"
                        style={{ borderColor: 'var(--border)', background: 'transparent' }} />
                      <span className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>
                        {values[item.key] ?? ''}
                      </span>
                    </div>
                  )}
                  {item.type === 'select' && (
                    <select value={values[item.key] ?? ''}
                      onChange={e => setValues(v => ({ ...v, [item.key]: e.target.value }))}
                      className={inputCls} style={inputSty}>
                      {(item.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  )}
                  {item.type === 'boolean' && (
                    <label className="flex items-center gap-2 cursor-pointer" dir="ltr">
                      <div
                        onClick={() => setValues(v => ({ ...v, [item.key]: v[item.key] === 'true' ? 'false' : 'true' }))}
                        className="w-11 h-6 rounded-full transition-colors flex items-center flex-shrink-0"
                        style={{ background: values[item.key] === 'true' ? '#0ea5e9' : 'var(--bg-muted)', border: '1px solid var(--border)' }}>
                        <div className="w-5 h-5 bg-white rounded-full shadow-md transition-transform mx-0.5"
                          style={{ transform: values[item.key] === 'true' ? 'translateX(20px)' : 'translateX(0)' }} />
                      </div>
                      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {values[item.key] === 'true' ? 'مفعّل' : 'معطّل'}
                      </span>
                    </label>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ─── Backup & Maintenance ─────────────────────────────────────────── */}
      <div className="rounded-2xl p-5 border"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2 mb-1">
          <Shield className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          <h3 className="text-sm font-black" style={{ color: 'var(--text-body)' }}>النسخ الاحتياطي والصيانة</h3>
        </div>
        <p className="text-xs pb-4 mb-5 border-b" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
          جميع العمليات التالية تتطلب كلمة مرور حسابك للتأكيد
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Export */}
          <div className="rounded-2xl p-4 flex flex-col gap-3 border"
            style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.25)' }}>
                <Download className="w-4 h-4 text-sky-500" />
              </div>
              <span className="font-bold text-sm" style={{ color: 'var(--text-heading)' }}>تصدير (نسخة احتياطية)</span>
            </div>
            <p className="text-xs leading-relaxed flex-1" style={{ color: 'var(--text-secondary)' }}>
              تصدير كامل لجميع البيانات — منتجات، مبيعات، مشتريات، عملاء، موردين، فواتير، إعدادات.
              يُحفظ كملف <span className="text-sky-500 font-mono">.json</span> على جهازك.
            </p>
            <button onClick={() => setActive('backup')}
              className="w-full py-2 rounded-xl text-sm font-bold text-white transition hover:opacity-90 flex items-center justify-center gap-2"
              style={{ background: '#0284c7' }}>
              <Download className="w-4 h-4" /> تصدير
            </button>
          </div>

          {/* Import */}
          <div className="rounded-2xl p-4 flex flex-col gap-3 border"
            style={{ background: 'var(--bg-subtle)', borderColor: 'rgba(249,115,22,0.3)' }}>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.25)' }}>
                <Upload className="w-4 h-4 text-orange-500" />
              </div>
              <span className="font-bold text-sm" style={{ color: 'var(--text-heading)' }}>استيراد (استعادة)</span>
            </div>
            <p className="text-xs leading-relaxed flex-1" style={{ color: 'var(--text-secondary)' }}>
              استعادة البيانات من ملف نسخة احتياطية سابق.{' '}
              <span className="text-orange-500 font-semibold">سيُستبدل كل ما هو موجود حالياً</span> بمحتوى الملف.
            </p>
            <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileChosen} />
            <button onClick={() => fileInputRef.current?.click()}
              className="w-full py-2 rounded-xl text-sm font-bold text-white transition hover:opacity-90 flex items-center justify-center gap-2"
              style={{ background: '#ea580c' }}>
              <Upload className="w-4 h-4" /> اختيار ملف واستيراد
            </button>
          </div>

          {/* Clear */}
          <div className="rounded-2xl p-4 flex flex-col gap-3 border"
            style={{ background: 'var(--bg-subtle)', borderColor: 'rgba(239,68,68,0.3)' }}>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
                <Trash2 className="w-4 h-4 text-red-500" />
              </div>
              <span className="font-bold text-sm" style={{ color: 'var(--text-heading)' }}>مسح شامل</span>
            </div>
            <p className="text-xs leading-relaxed flex-1" style={{ color: 'var(--text-secondary)' }}>
              حذف كل شيء — منتجات، فئات، عملاء، موردين، فواتير، مخزون...{' '}
              <span className="font-semibold" style={{ color: 'var(--text-body)' }}>يبقى المستخدمون فقط.</span>{' '}
              <span className="text-red-500 font-semibold">لا يمكن التراجع.</span>
            </p>
            <button onClick={() => setActive('clear')}
              className="w-full py-2 rounded-xl text-sm font-bold text-white transition hover:opacity-90 flex items-center justify-center gap-2"
              style={{ background: '#dc2626' }}>
              <Trash2 className="w-4 h-4" /> مسح الكل
            </button>
          </div>
        </div>
      </div>

      {/* Password Dialog */}
      {activeAction && (
        <PwDialog
          action={activeAction}
          importFile={importFile}
          onClose={() => { setActive(null); setImportFile(null); }}
          onDone={handleDone}
        />
      )}
    </div>
  );
}
