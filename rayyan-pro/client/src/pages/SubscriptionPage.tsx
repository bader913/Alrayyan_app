import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { licenseApi } from '../api/license.ts';
import {
  BadgeCheck, Shield, Key, Copy, CheckCircle, AlertCircle,
  Clock, RefreshCw, XCircle, Lock, Zap, Server, User,
  Calendar, CalendarClock, Infinity, AlertTriangle,
} from 'lucide-react';

const VERSION = '1.0.0';
const DEVELOPER = 'ريان برو — Rayyan Pro';
const DEVELOPER_CONTACT = 'للدعم الفني والتراخيص';

const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  trial:     { bg: '#fef3c7', text: '#92400e', border: '#fbbf24' },
  monthly:   { bg: '#dbeafe', text: '#1e40af', border: '#60a5fa' },
  quarterly: { bg: '#ede9fe', text: '#5b21b6', border: '#a78bfa' },
  semi:      { bg: '#cffafe', text: '#0e7490', border: '#22d3ee' },
  annual:    { bg: '#d1fae5', text: '#065f46', border: '#34d399' },
  biennial:  { bg: '#ecfdf5', text: '#064e3b', border: '#10b981' },
  lifetime:  { bg: '#fce7f3', text: '#9d174d', border: '#f472b6' },
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  trial:     <Clock className="w-4 h-4" />,
  monthly:   <Calendar className="w-4 h-4" />,
  quarterly: <Calendar className="w-4 h-4" />,
  semi:      <Calendar className="w-4 h-4" />,
  annual:    <CalendarClock className="w-4 h-4" />,
  biennial:  <CalendarClock className="w-4 h-4" />,
  lifetime:  <Infinity className="w-4 h-4" />,
};

function DaysBar({ days, type }: { days: number | null; type: string }) {
  if (days === null || type === 'lifetime') {
    return (
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-muted)' }}>
        <div className="h-full rounded-full" style={{ width: '100%', background: '#f472b6' }} />
      </div>
    );
  }

  const maxDays: Record<string, number> = {
    trial: 7, monthly: 30, quarterly: 90, semi: 180, annual: 365, biennial: 730,
  };
  const total = maxDays[type] ?? 365;
  const pct   = Math.min(100, Math.max(0, Math.round((days / total) * 100)));
  const color = days <= 7 ? '#ef4444' : days <= 30 ? '#f59e0b' : '#10b981';

  return (
    <div className="space-y-1">
      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-muted)' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <div className="flex justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
        <span>{days} يوم متبقٍ</span>
        <span>{pct}%</span>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value, valueColor }: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  valueColor?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b last:border-0"
      style={{ borderColor: 'var(--border)' }}>
      <span className="mt-0.5 flex-shrink-0 text-emerald-500">{icon}</span>
      <span className="text-sm flex-1" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span className="text-sm font-bold text-right" style={{ color: valueColor ?? 'var(--text-heading)' }}>
        {value}
      </span>
    </div>
  );
}

export default function SubscriptionPage() {
  const qc = useQueryClient();
  const [newKey,   setNewKey]   = useState('');
  const [copied,   setCopied]   = useState(false);
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['license-status'],
    queryFn:  () => licenseApi.getStatus().then((r) => r.data),
    refetchInterval: 60_000,
  });

  const activateMutation = useMutation({
    mutationFn: (key: string) => licenseApi.activate(key, true),
    onSuccess: () => {
      setNewKey('');
      setShowForm(false);
      refetch();
      qc.invalidateQueries({ queryKey: ['license-status'] });
    },
  });

  const copyMachineId = () => {
    if (!data?.machine_id) return;
    navigator.clipboard.writeText(data.machine_id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const lic = data?.license;
  const isActive  = data?.active;
  const isExpired = data?.expired;
  const isFpMiss  = data?.fingerprint_mismatch;

  // ── Days color ────────────────────────────────────────────────────────
  const daysColor = (d: number | null) => {
    if (d === null) return '#f472b6';
    if (d <= 7)    return '#ef4444';
    if (d <= 30)   return '#f59e0b';
    return '#10b981';
  };

  const statusLabel = isActive
    ? 'مفعّل ✓'
    : isExpired
    ? 'منتهي الصلاحية'
    : isFpMiss
    ? 'جهاز غير مطابق'
    : 'غير مفعّل';

  const statusColor = isActive ? '#10b981' : '#ef4444';

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6" dir="rtl">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <BadgeCheck className="w-7 h-7 text-emerald-500" />
        <div>
          <h1 className="text-2xl font-black" style={{ color: 'var(--text-heading)' }}>
            الاشتراك والنظام
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            معلومات الترخيص والإصدار الحالي
          </p>
        </div>

        <button
          onClick={() => refetch()}
          className="mr-auto p-2 rounded-xl transition hover:bg-slate-100"
          style={{ color: 'var(--text-muted)' }}
          title="تحديث">
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* ── Status Banner ───────────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-5 border flex items-center gap-4"
        style={{
          background: isActive ? '#f0fdf4' : '#fef2f2',
          borderColor: isActive ? '#86efac' : '#fca5a5',
        }}>
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-white flex-shrink-0 shadow-lg"
          style={{ background: statusColor }}>
          {isActive
            ? <BadgeCheck className="w-8 h-8" />
            : isExpired
            ? <Clock className="w-8 h-8" />
            : <Lock className="w-8 h-8" />
          }
        </div>
        <div className="flex-1">
          <div className="font-black text-lg" style={{ color: statusColor }}>
            {statusLabel}
          </div>
          <div className="text-sm mt-0.5" style={{ color: isActive ? '#065f46' : '#7f1d1d' }}>
            {isActive
              ? lic?.type === 'lifetime'
                ? 'ترخيص مدى الحياة — لا يحتاج تجديداً'
                : `ينتهي في ${lic?.expires_at ? new Date(lic.expires_at).toLocaleDateString('ar-SA') : ''}`
              : isExpired
              ? 'انتهى الترخيص، يرجى التجديد'
              : 'يرجى إدخال مفتاح ترخيص صالح'
            }
          </div>
        </div>
        {lic && (
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold flex-shrink-0"
            style={TYPE_COLORS[lic.type] ?? { bg: '#f1f5f9', text: '#64748b', border: '#cbd5e1' }}>
            {TYPE_ICONS[lic.type]}
            {lic.type_label}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* ── License Details ─────────────────────────────────────────── */}
        <div className="rounded-2xl p-5 border space-y-0"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <h2 className="text-sm font-black mb-4 flex items-center gap-2"
            style={{ color: 'var(--text-heading)' }}>
            <Key className="w-4 h-4 text-emerald-500" />
            تفاصيل الترخيص
          </h2>

          {lic ? (
            <>
              <InfoRow
                icon={<User className="w-4 h-4" />}
                label="اسم العميل"
                value={lic.customer_name}
              />
              <InfoRow
                icon={<Zap className="w-4 h-4" />}
                label="نوع الاشتراك"
                value={lic.type_label}
              />
              <InfoRow
                icon={<Calendar className="w-4 h-4" />}
                label="تاريخ الإصدار"
                value={new Date(lic.issued_at).toLocaleDateString('ar-SA')}
              />
              <InfoRow
                icon={<CalendarClock className="w-4 h-4" />}
                label="تاريخ الانتهاء"
                value={lic.expires_at
                  ? new Date(lic.expires_at).toLocaleDateString('ar-SA')
                  : '∞ مدى الحياة'
                }
                valueColor={lic.expires_at ? daysColor(lic.days_remaining) : '#f472b6'}
              />
              <InfoRow
                icon={<Shield className="w-4 h-4" />}
                label="مقيّد بالجهاز"
                value={lic.machine_bound ? 'نعم — مرتبط بهذا الجهاز' : 'لا — يعمل على أي جهاز'}
                valueColor={lic.machine_bound ? '#f59e0b' : '#10b981'}
              />

              {/* Days bar */}
              {lic.days_remaining !== null && (
                <div className="pt-4">
                  <div className="flex items-center justify-between text-xs mb-2"
                    style={{ color: 'var(--text-muted)' }}>
                    <span>المدة المتبقية</span>
                    <span className="font-bold" style={{ color: daysColor(lic.days_remaining) }}>
                      {lic.days_remaining === 0 ? 'آخر يوم!' : `${lic.days_remaining} يوم`}
                    </span>
                  </div>
                  <DaysBar days={lic.days_remaining} type={lic.type} />
                </div>
              )}
              {lic.type === 'lifetime' && (
                <div className="pt-4">
                  <DaysBar days={null} type="lifetime" />
                  <p className="text-xs mt-1 text-center" style={{ color: '#f472b6' }}>
                    ترخيص مدى الحياة ∞
                  </p>
                </div>
              )}

              {/* Warning if expiring soon */}
              {lic.days_remaining !== null && lic.days_remaining <= 14 && lic.days_remaining > 0 && (
                <div className="mt-3 flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  تنتهي صلاحية اشتراكك خلال {lic.days_remaining} يوم. تواصل مع المطوّر للتجديد.
                </div>
              )}
            </>
          ) : (
            <div className="py-8 text-center">
              <XCircle className="w-10 h-10 mx-auto mb-3 text-red-400" />
              <p className="text-sm font-bold text-red-500">لا يوجد ترخيص مفعّل</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                أدخل مفتاح الترخيص أدناه للتفعيل
              </p>
            </div>
          )}
        </div>

        {/* ── System Info ─────────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* App Info */}
          <div className="rounded-2xl p-5 border"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-black mb-4 flex items-center gap-2"
              style={{ color: 'var(--text-heading)' }}>
              <Zap className="w-4 h-4 text-emerald-500" />
              معلومات التطبيق
            </h2>
            <InfoRow icon={<BadgeCheck className="w-4 h-4" />} label="اسم النظام" value="Rayyan Pro" />
            <InfoRow icon={<Zap className="w-4 h-4" />} label="الإصدار" value={`v${VERSION}`} />
            <InfoRow icon={<User className="w-4 h-4" />} label="المطوّر" value={DEVELOPER} />
            <InfoRow icon={<Shield className="w-4 h-4" />} label="الدعم الفني" value={DEVELOPER_CONTACT} />
          </div>

          {/* Machine ID */}
          <div className="rounded-2xl p-5 border"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-black mb-3 flex items-center gap-2"
              style={{ color: 'var(--text-heading)' }}>
              <Server className="w-4 h-4 text-emerald-500" />
              معرّف الجهاز
            </h2>
            <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
              أرسل هذا الرمز للمطوّر عند طلب ترخيص مرتبط بجهازك
            </p>
            <div
              className="flex items-center gap-2 p-3 rounded-xl font-mono text-sm border"
              style={{
                background: 'var(--bg-muted)',
                borderColor: 'var(--border)',
              }}>
              <span
                className="flex-1 font-black tracking-widest select-all"
                style={{ color: 'var(--text-heading)' }}>
                {data?.machine_id ?? '——'}
              </span>
              <button
                onClick={copyMachineId}
                className="p-1.5 rounded-lg transition hover:bg-emerald-50"
                title="نسخ المعرّف">
                {copied
                  ? <CheckCircle className="w-4 h-4 text-emerald-500" />
                  : <Copy className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                }
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Activate / Renew ────────────────────────────────────────────── */}
      <div className="rounded-2xl p-5 border"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <button
          onClick={() => setShowForm(!showForm)}
          className="w-full flex items-center gap-3 text-right"
        >
          <Key className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          <span className="flex-1 font-black text-sm" style={{ color: 'var(--text-heading)' }}>
            {isActive ? 'تجديد أو تغيير الترخيص' : 'تفعيل مفتاح ترخيص'}
          </span>
          <span className="text-xs px-2 py-1 rounded-full"
            style={{ background: 'var(--bg-muted)', color: 'var(--text-muted)' }}>
            {showForm ? 'إخفاء' : 'فتح'}
          </span>
        </button>

        {showForm && (
          <div className="mt-4 space-y-3">
            {activateMutation.isError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {(activateMutation.error as { response?: { data?: { message?: string } } })
                  ?.response?.data?.message ?? 'مفتاح غير صالح'}
              </div>
            )}
            {activateMutation.isSuccess && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                تم تفعيل الترخيص بنجاح!
              </div>
            )}

            <textarea
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="RP-..."
              rows={3}
              dir="ltr"
              className="w-full rounded-xl p-3 text-sm font-mono resize-none border focus:outline-none focus:ring-2 focus:ring-emerald-500"
              style={{
                background: 'var(--bg-input)',
                borderColor: 'var(--border)',
                color: 'var(--text-heading)',
              }}
            />

            <button
              onClick={() => activateMutation.mutate(newKey.trim())}
              disabled={activateMutation.isPending || !newKey.trim()}
              className="w-full py-2.5 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition hover:opacity-90"
              style={{ background: '#059669' }}>
              {activateMutation.isPending
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> جاري التفعيل...</>
                : <><Key className="w-4 h-4" /> تفعيل الترخيص</>
              }
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
