import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/client.ts';
import { useAuthStore } from '../store/authStore.ts';

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await authApi.login(username, password);
      const { user, access_token, refresh_token } = res.data;
      setAuth(user, access_token, refresh_token);
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'فشل تسجيل الدخول. تحقق من البيانات.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)' }}
      dir="rtl"
    >
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">

          {/* ── شريط التعريف المميز ── */}
          <div
            className="flex items-center justify-between px-5 py-2.5"
            style={{ background: 'linear-gradient(90deg, #059669 0%, #0d9488 100%)' }}
          >
            <span className="text-white text-xs font-black tracking-widest uppercase opacity-90">
              RAYYAN PRO
            </span>
            <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              v1.0 — النظام الجديد
            </span>
          </div>

          <div className="p-8">
          <div className="text-center mb-8">
            <div
              className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-white text-2xl font-black shadow-lg"
              style={{ background: 'linear-gradient(135deg, #059669, #0d9488)' }}
            >
              ر
            </div>
            <h1 className="text-2xl font-black text-slate-800 mb-1">ريان برو</h1>
            <p className="text-sm text-slate-400 font-medium">نظام المبيعات والمحاسبة الاحترافي</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-1.5">
                اسم المستخدم
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="أدخل اسم المستخدم"
                required
                autoFocus
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-emerald-400 transition-colors bg-slate-50"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-600 mb-1.5">
                كلمة المرور
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="أدخل كلمة المرور"
                required
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-emerald-400 transition-colors bg-slate-50"
              />
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-600 rounded-xl px-4 py-3 text-sm font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 text-white font-black rounded-xl transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              style={{ background: 'var(--primary, #059669)' }}
            >
              {loading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
            </button>
          </form>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6 font-medium">
          Rayyan Pro v1.0 — النظام الاحترافي الجديد
        </p>
      </div>
    </div>
  );
}
