import React, { useState, useEffect } from 'react';
import { auditLogsApi, type AuditLogRow } from '../api/auditLogs.ts';
import { Shield, Search, ChevronLeft, ChevronRight, Info } from 'lucide-react';

const today     = new Date().toISOString().split('T')[0];
const weekStart = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

const ACTION_COLOR: Record<string, string> = {
  login:           'bg-green-900/40 text-green-400',
  logout:          'bg-slate-700 text-slate-400',
  create:          'bg-blue-900/40 text-blue-400',
  update:          'bg-yellow-900/40 text-yellow-400',
  delete:          'bg-red-900/40 text-red-400',
  activate:        'bg-emerald-900/40 text-emerald-400',
  deactivate:      'bg-orange-900/40 text-orange-400',
  change_password: 'bg-purple-900/40 text-purple-400',
  payment:         'bg-cyan-900/40 text-cyan-400',
  bulk_update:     'bg-indigo-900/40 text-indigo-400',
};

const ACTION_LABELS: Record<string, string> = {
  login: 'دخول', logout: 'خروج', create: 'إنشاء', update: 'تعديل',
  delete: 'حذف', activate: 'تفعيل', deactivate: 'تعطيل',
  change_password: 'تغيير كلمة مرور', payment: 'دفعة', bulk_update: 'تعديل جماعي',
};

const ENTITY_LABELS: Record<string, string> = {
  auth: 'المصادقة', user: 'مستخدم', product: 'منتج', sale: 'مبيعة',
  purchase: 'مشترى', customer: 'عميل', supplier: 'مورد', setting: 'إعداد',
};

export default function AuditLogPage() {
  const [from, setFrom] = useState(weekStart);
  const [to, setTo]     = useState(today);
  const [action, setAction]           = useState('');
  const [entityType, setEntityType]   = useState('');
  const [page, setPage]               = useState(1);

  const [rows, setRows]         = useState<AuditLogRow[]>([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(false);
  const [actions, setActions]   = useState<string[]>([]);
  const [entityTypes, setEntityTypes] = useState<string[]>([]);
  const [detail, setDetail]     = useState<AuditLogRow | null>(null);

  const limit = 50;

  const load = async (p = page) => {
    setLoading(true);
    try {
      const res = await auditLogsApi.list({ from, to, action: action || undefined, entity_type: entityType || undefined, page: p });
      setRows(res.data.data);
      setTotal(res.data.total);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => {
    auditLogsApi.meta().then(m => { setActions(m.data.actions); setEntityTypes(m.data.entityTypes); }).catch(() => {});
    load(1);
  }, []);

  const handleSearch = () => { setPage(1); load(1); };
  const totalPages   = Math.ceil(total / limit);

  return (
    <div className="p-6 space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield className="w-7 h-7 text-violet-400" />
        <h1 className="text-2xl font-bold text-white">سجل العمليات</h1>
        <span className="text-sm text-slate-400 mr-auto">{total.toLocaleString('en-US')} سجل</span>
      </div>

      {/* Filters */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-slate-500 mb-1">من</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">إلى</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">العملية</label>
            <select value={action} onChange={e => setAction(e.target.value)}
              className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500">
              <option value="">الكل</option>
              {actions.map(a => <option key={a} value={a}>{ACTION_LABELS[a] ?? a}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">نوع الكيان</label>
            <select value={entityType} onChange={e => setEntityType(e.target.value)}
              className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500">
              <option value="">الكل</option>
              {entityTypes.map(e => <option key={e} value={e}>{ENTITY_LABELS[e] ?? e}</option>)}
            </select>
          </div>
          <button onClick={handleSearch} disabled={loading}
            className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold transition">
            <Search className="w-4 h-4" /> {loading ? 'جاري...' : 'بحث'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-700/60 text-slate-300 text-right">
              <th className="px-4 py-3">المستخدم</th>
              <th className="px-4 py-3">العملية</th>
              <th className="px-4 py-3">الكيان</th>
              <th className="px-4 py-3">رقم الكيان</th>
              <th className="px-4 py-3">IP</th>
              <th className="px-4 py-3">الوقت</th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="text-center py-12 text-slate-500">جاري التحميل...</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={7} className="text-center py-12 text-slate-500">لا توجد سجلات</td></tr>
            )}
            {!loading && rows.map(r => (
              <tr key={r.id} className="border-t border-slate-700 hover:bg-slate-700/30">
                <td className="px-4 py-2">
                  <p className="text-white text-sm">{r.user_name ?? '—'}</p>
                  <p className="text-slate-500 text-xs">{r.username ?? ''}</p>
                </td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_COLOR[r.action] ?? 'bg-slate-700 text-slate-400'}`}>
                    {ACTION_LABELS[r.action] ?? r.action}
                  </span>
                </td>
                <td className="px-4 py-2 text-slate-300">{ENTITY_LABELS[r.entity_type] ?? r.entity_type}</td>
                <td className="px-4 py-2 text-slate-400 font-mono text-xs">{r.entity_id ?? '—'}</td>
                <td className="px-4 py-2 text-slate-500 text-xs font-mono">{r.ip_address ?? '—'}</td>
                <td className="px-4 py-2 text-slate-400 text-xs">{fmtDate(r.created_at)}</td>
                <td className="px-4 py-2">
                  {(r.old_data || r.new_data) && (
                    <button onClick={() => setDetail(r)}
                      className="text-slate-500 hover:text-violet-400 transition">
                      <Info className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center gap-2 justify-center">
          <button disabled={page <= 1} onClick={() => { setPage(page - 1); load(page - 1); }}
            className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 disabled:opacity-40 transition">
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="text-sm text-slate-400 px-3">{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => { setPage(page + 1); load(page + 1); }}
            className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 disabled:opacity-40 transition">
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Detail Modal */}
      {detail && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setDetail(null)}>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 max-w-lg w-full max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-violet-400" />
              تفاصيل السجل #{detail.id}
            </h3>
            {detail.old_data && (
              <div className="mb-3">
                <p className="text-xs text-slate-500 mb-1 font-semibold uppercase tracking-wider">البيانات القديمة</p>
                <pre className="bg-slate-900 rounded-lg p-3 text-xs text-red-400 overflow-auto">
                  {JSON.stringify(detail.old_data, null, 2)}
                </pre>
              </div>
            )}
            {detail.new_data && (
              <div>
                <p className="text-xs text-slate-500 mb-1 font-semibold uppercase tracking-wider">البيانات الجديدة</p>
                <pre className="bg-slate-900 rounded-lg p-3 text-xs text-green-400 overflow-auto">
                  {JSON.stringify(detail.new_data, null, 2)}
                </pre>
              </div>
            )}
            <button onClick={() => setDetail(null)}
              className="mt-4 w-full bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg text-sm font-medium transition">
              إغلاق
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
