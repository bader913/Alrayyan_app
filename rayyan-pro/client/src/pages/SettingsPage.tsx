import React, { useState, useEffect } from 'react';
import { settingsApi } from '../api/settings.ts';
import { Settings, Save, Check } from 'lucide-react';

interface SettingGroup {
  title:  string;
  keys:   Array<{ key: string; label: string; type: 'text' | 'number' | 'color' | 'select' | 'boolean'; options?: string[] }>;
}

const GROUPS: SettingGroup[] = [
  {
    title: 'بيانات المتجر',
    keys: [
      { key: 'shop_name',    label: 'اسم المتجر',     type: 'text'   },
      { key: 'shop_phone',   label: 'رقم الهاتف',     type: 'text'   },
      { key: 'shop_address', label: 'العنوان',         type: 'text'   },
      { key: 'receipt_footer', label: 'تذييل الفاتورة', type: 'text' },
    ],
  },
  {
    title: 'العملة وأسعار الصرف',
    keys: [
      { key: 'currency',    label: 'العملة الرئيسية', type: 'select', options: ['USD', 'SYP', 'SAR', 'AED', 'TRY'] },
      { key: 'usd_to_syp',  label: 'دولار → ليرة سورية', type: 'number' },
      { key: 'usd_to_try',  label: 'دولار → ليرة تركية', type: 'number' },
      { key: 'usd_to_sar',  label: 'دولار → ريال سعودي', type: 'number' },
      { key: 'usd_to_aed',  label: 'دولار → درهم إماراتي', type: 'number' },
    ],
  },
  {
    title: 'المخزون والنظام',
    keys: [
      { key: 'low_stock_threshold', label: 'حد المخزون المنخفض', type: 'number' },
      { key: 'enable_shifts',       label: 'تفعيل الورديات',      type: 'boolean' },
      { key: 'show_usd',            label: 'عرض الأسعار بالدولار', type: 'boolean' },
    ],
  },
  {
    title: 'المظهر',
    keys: [
      { key: 'theme_color', label: 'لون النظام',  type: 'color'  },
      { key: 'theme_mode',  label: 'وضع العرض',   type: 'select', options: ['light', 'dark'] },
    ],
  },
];

export default function SettingsPage() {
  const [values, setValues]     = useState<Record<string, string>>({});
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    settingsApi.getAll().then(res => {
      setValues(res.settings);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await settingsApi.bulkUpdate(values);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError('حدث خطأ أثناء الحفظ');
    }
    setSaving(false);
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
                    <input
                      type="text"
                      value={values[item.key] ?? ''}
                      onChange={e => setValues(v => ({ ...v, [item.key]: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                    />
                  )}

                  {item.type === 'number' && (
                    <input
                      type="number"
                      value={values[item.key] ?? ''}
                      onChange={e => setValues(v => ({ ...v, [item.key]: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                    />
                  )}

                  {item.type === 'color' && (
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={values[item.key] ?? '#059669'}
                        onChange={e => setValues(v => ({ ...v, [item.key]: e.target.value }))}
                        className="w-12 h-9 rounded cursor-pointer border border-slate-600 bg-transparent"
                      />
                      <span className="text-sm text-slate-400 font-mono">{values[item.key] ?? ''}</span>
                    </div>
                  )}

                  {item.type === 'select' && (
                    <select
                      value={values[item.key] ?? ''}
                      onChange={e => setValues(v => ({ ...v, [item.key]: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                    >
                      {(item.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  )}

                  {item.type === 'boolean' && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <div
                        onClick={() => setValues(v => ({ ...v, [item.key]: v[item.key] === 'true' ? 'false' : 'true' }))}
                        className={`w-10 h-5 rounded-full transition-colors flex items-center ${values[item.key] === 'true' ? 'bg-sky-600' : 'bg-slate-600'}`}
                      >
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
    </div>
  );
}
