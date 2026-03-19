import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { licenseApi, type LicenseStatus } from '../api/license.ts';
import {
  Shield, Key, Copy, CheckCircle, AlertCircle, Clock,
  RefreshCw, XCircle, Lock, Unlock,
} from 'lucide-react';

const TYPE_COLORS: Record<string, string> = {
  trial:     '#f59e0b',
  monthly:   '#3b82f6',
  quarterly: '#8b5cf6',
  semi:      '#06b6d4',
  annual:    '#059669',
  biennial:  '#10b981',
  lifetime:  '#f43f5e',
};

export default function LicensePage() {
  const navigate = useNavigate();

  const [status,       setStatus]   = useState<LicenseStatus | null>(null);
  const [loading,      setLoading]  = useState(true);
  const [key,          setKey]      = useState('');
  const [activating,   setActivating] = useState(false);
  const [error,        setError]    = useState('');
  const [success,      setSuccess]  = useState('');
  const [copied,       setCopied]   = useState(false);
  const [bindMachine,  setBindMachine] = useState(true);

  const loadStatus = async () => {
    try {
      const res = await licenseApi.getStatus();
      setStatus(res.data);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStatus(); }, []);

  const copyMachineId = () => {
    if (!status?.machine_id) return;
    navigator.clipboard.writeText(status.machine_id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) return;
    setActivating(true); setError(''); setSuccess('');
    try {
      const res = await licenseApi.activate(key.trim(), bindMachine);
      if (res.data.success) {
        setSuccess(res.data.message);
        setKey('');
        await loadStatus();
        setTimeout(() => navigate('/dashboard'), 2500);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? 'حدث خطأ أثناء التفعيل';
      setError(msg);
    }
    setActivating(false);
  };

  const daysColor = (d: number | null) => {
    if (d === null) return '#10b981';
    if (d <= 7)  return '#ef4444';
    if (d <= 30) return '#f59e0b';
    return '#10b981';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--bg-page)' }}>
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="animate-spin text-emerald-500 w-10 h-10" />
          <p style={{ color: 'var(--text-secondary)' }}>جاري التحقق من الترخيص...</p>
        </div>
      </div>
    );
  }

  const isActive  = status?.active;
  const isExpired = status?.expired;
  const isFpMismatch = status?.fingerprint_mismatch;
  const lic = status?.license;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" dir="rtl"
      style={{ background: 'var(--bg-page)' }}>

      {/* Header */}
      <div className="flex flex-col items-center gap-3 mb-8">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-white shadow-xl"
          style={{ background: isActive ? '#059669' : '#ef4444' }}>
          {isActive ? <Shield className="w-10 h-10" /> : <Lock className="w-10 h-10" />}
        </div>
        <h1 className="text-3xl font-black" style={{ color: 'var(--text-heading)' }}>
          ريان برو
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          نظام إدارة المبيعات الاحترافي
        </p>
      </div>

      {/* Status Card */}
      {lic && (
        <div className="w-full max-w-md rounded-2xl p-5 mb-6 border"
          style={{
            background: 'var(--bg-card)',
            borderColor: isActive ? '#059669' : '#ef4444',
            boxShadow: `0 0 20px ${isActive ? '#059669' : '#ef4444'}22`,
          }}>

          <div className="flex items-center gap-3 mb-4">
            {isActive
              ? <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
              : <XCircle    className="w-5 h-5 text-red-500 flex-shrink-0" />
            }
            <span className="font-black text-base"
              style={{ color: isActive ? '#059669' : '#ef4444' }}>
              {isActive ? 'الترخيص مفعّل' : isExpired ? 'انتهى الترخيص' : isFpMismatch ? 'جهاز غير مطابق' : 'غير نشط'}
            </span>
            <span className="mr-auto text-xs px-2 py-1 rounded-full font-bold text-white"
              style={{ background: TYPE_COLORS[lic.type] ?? '#64748b' }}>
              {lic.type_label}
            </span>
          </div>

          <div className="space-y-2 text-sm" style={{ color: 'var(--text-body)' }}>
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-muted)' }}>العميل</span>
              <span className="font-bold">{lic.customer_name}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-muted)' }}>تاريخ الإصدار</span>
              <span>{new Date(lic.issued_at).toLocaleDateString('ar-SA')}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-muted)' }}>تاريخ الانتهاء</span>
              <span className="font-bold" style={{ color: lic.expires_at ? daysColor(lic.days_remaining) : '#10b981' }}>
                {lic.expires_at
                  ? new Date(lic.expires_at).toLocaleDateString('ar-SA')
                  : 'مدى الحياة ∞'}
              </span>
            </div>
            {lic.expires_at && (
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-muted)' }}>الأيام المتبقية</span>
                <span className="font-black text-base"
                  style={{ color: daysColor(lic.days_remaining) }}>
                  {lic.days_remaining === 0 ? 'آخر يوم!' : `${lic.days_remaining} يوم`}
                </span>
              </div>
            )}
            {lic.machine_bound && (
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-muted)' }}>مقيّد بالجهاز</span>
                <span className="text-amber-500 font-semibold">نعم ✓</span>
              </div>
            )}
          </div>

          {isActive && (
            <button onClick={() => navigate('/dashboard')}
              className="w-full mt-4 py-2.5 rounded-xl font-bold text-white text-sm transition-all hover:opacity-90"
              style={{ background: '#059669' }}>
              <Unlock className="w-4 h-4 inline ml-2" />
              الدخول إلى النظام
            </button>
          )}
        </div>
      )}

      {/* Machine ID */}
      <div className="w-full max-w-md rounded-2xl p-5 mb-6 border"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <h3 className="font-bold text-sm mb-3 flex items-center gap-2"
          style={{ color: 'var(--text-heading)' }}>
          <Shield className="w-4 h-4 text-emerald-500" />
          معرّف الجهاز (Machine ID)
        </h3>
        <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
          أرسل هذا المعرّف للمطوّر لإنشاء مفتاح ترخيص مرتبط بجهازك
        </p>
        <div className="flex items-center gap-2 p-3 rounded-xl font-mono text-sm"
          style={{ background: 'var(--bg-muted)', color: 'var(--text-heading)' }}>
          <span className="flex-1 select-all tracking-wider font-bold text-emerald-600">
            {status?.machine_id ?? '...'}
          </span>
          <button onClick={copyMachineId}
            className="flex-shrink-0 p-1.5 rounded-lg transition-colors hover:bg-emerald-100"
            title="نسخ">
            {copied
              ? <CheckCircle className="w-4 h-4 text-emerald-500" />
              : <Copy className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />}
          </button>
        </div>
      </div>

      {/* Activation Form */}
      <div className="w-full max-w-md rounded-2xl p-5 border"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <h3 className="font-bold text-sm mb-4 flex items-center gap-2"
          style={{ color: 'var(--text-heading)' }}>
          <Key className="w-4 h-4 text-emerald-500" />
          {isActive ? 'تجديد أو تغيير الترخيص' : 'تفعيل الترخيص'}
        </h3>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl mb-4 bg-red-50 border border-red-200 text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 p-3 rounded-xl mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            {success}
          </div>
        )}

        <form onSubmit={handleActivate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5"
              style={{ color: 'var(--text-secondary)' }}>
              مفتاح الترخيص
            </label>
            <textarea
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="RP-..."
              rows={3}
              dir="ltr"
              className="w-full rounded-xl p-3 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 border"
              style={{
                background: 'var(--bg-input)',
                borderColor: 'var(--border)',
                color: 'var(--text-heading)',
              }}
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer" dir="ltr">
            <div
              onClick={() => setBindMachine(!bindMachine)}
              className={`w-11 h-6 rounded-full transition-colors flex items-center flex-shrink-0 ${bindMachine ? 'bg-emerald-500' : 'bg-slate-400'}`}>
              <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform mx-0.5 ${bindMachine ? 'translate-x-5' : 'translate-x-0'}`} />
            </div>
            <span className="text-sm" style={{ color: 'var(--text-body)' }}>
              ربط الترخيص بهذا الجهاز (أمان أعلى)
            </span>
          </label>

          <button
            type="submit"
            disabled={activating || !key.trim()}
            className="w-full py-3 rounded-xl font-bold text-white text-sm transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: '#059669' }}>
            {activating
              ? <><RefreshCw className="w-4 h-4 animate-spin" /> جاري التفعيل...</>
              : <><Key className="w-4 h-4" /> تفعيل الترخيص</>
            }
          </button>
        </form>
      </div>

      <p className="mt-6 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
        Rayyan Pro v1.0.0 — جميع الحقوق محفوظة
      </p>
    </div>
  );
}
