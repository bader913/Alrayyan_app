import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Lock,
  User,
  AlertCircle,
  Phone,
  MessageCircle,
  ShieldCheck
} from 'lucide-react';

interface LoginProps {
  onLogin: (username: string, password: string) => Promise<void>;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await onLogin(username, password);
    } catch (err: any) {
      setError(err.message || 'فشل تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden"
      dir="rtl"
      style={{ background: 'var(--bg-color)' }}
    >
      <div
        className="absolute top-0 left-0 w-[420px] h-[420px] rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        style={{ background: 'var(--theme-primary-soft)' }}
      />
      <div
        className="absolute bottom-0 right-0 w-[420px] h-[420px] rounded-full blur-[120px] translate-x-1/2 translate-y-1/2 pointer-events-none"
        style={{ background: 'var(--theme-primary-soft)' }}
      />

      <motion.div
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] rounded-[2.5rem] overflow-hidden border shadow-2xl relative z-10"
        style={{
          borderColor: 'var(--border-color)',
          background: 'var(--card-bg)'
        }}
      >
        <div
          className="hidden lg:flex flex-col justify-between p-8 xl:p-10 border-l"
          style={{
            borderColor: 'var(--border-color)',
            background: 'var(--theme-primary-soft)'
          }}
        >
          <div>
            <div className="flex items-center gap-4 mb-8">
              <div
                className="w-20 h-20 rounded-[2rem] flex items-center justify-center shadow-lg"
                style={{
                  background: 'var(--theme-primary)',
                  color: '#ffffff'
                }}
              >
                <ShieldCheck size={34} strokeWidth={2.4} />
              </div>

              <div>
                <div
                  className="text-[10px] font-black uppercase tracking-[0.35em] mb-2"
                  style={{ color: 'var(--text-muted)' }}
                >
                  ALRAYYAN POS
                </div>
                <h1
                  className="text-3xl xl:text-4xl font-black tracking-tight"
                  style={{ color: 'var(--text-color)' }}
                >
                  نظام الريان
                </h1>
              </div>
            </div>

            <div className="space-y-5">
              <div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-black"
                style={{
                  background: 'var(--card-bg)',
                  color: 'var(--theme-primary)',
                  border: '1px solid var(--border-color)'
                }}
              >
                <Lock size={14} />
                تسجيل دخول آمن وواجهة متناسقة مع هوية البرنامج
              </div>

              <div>
                <h2
                  className="text-4xl xl:text-5xl font-black leading-tight"
                  style={{ color: 'var(--text-color)' }}
                >
                  إدارة المبيعات
                  <br />
                  والمخزون
                  <br />
                  بشكل احترافي
                </h2>

                <p
                  className="text-sm xl:text-base font-bold mt-4 leading-8 max-w-xl"
                  style={{ color: 'var(--text-muted)' }}
                >
                  ادخل إلى النظام لمتابعة نقطة البيع، إدارة العملاء، المشتريات،
                  التقارير، العملات، والورديات ضمن تجربة موحدة ومتوافقة مع الثيم.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-8">
              <div
                className="rounded-[1.75rem] border p-5"
                style={{
                  borderColor: 'var(--border-color)',
                  background: 'var(--card-bg)'
                }}
              >
                <div
                  className="text-[10px] font-black uppercase tracking-widest mb-2"
                  style={{ color: 'var(--text-muted)' }}
                >
                  صلاحيات
                </div>
                <div
                  className="text-sm font-black leading-7"
                  style={{ color: 'var(--text-color)' }}
                >
                  دخول حسب نوع المستخدم والصلاحيات المحددة داخل النظام.
                </div>
              </div>

              <div
                className="rounded-[1.75rem] border p-5"
                style={{
                  borderColor: 'var(--border-color)',
                  background: 'var(--card-bg)'
                }}
              >
                <div
                  className="text-[10px] font-black uppercase tracking-widest mb-2"
                  style={{ color: 'var(--text-muted)' }}
                >
                  سرعة
                </div>
                <div
                  className="text-sm font-black leading-7"
                  style={{ color: 'var(--text-color)' }}
                >
                  وصول سريع إلى العمليات اليومية دون تعقيد وبواجهة واضحة.
                </div>
              </div>

              <div
                className="rounded-[1.75rem] border p-5"
                style={{
                  borderColor: 'var(--border-color)',
                  background: 'var(--card-bg)'
                }}
              >
                <div
                  className="text-[10px] font-black uppercase tracking-widest mb-2"
                  style={{ color: 'var(--text-muted)' }}
                >
                  موثوق
                </div>
                <div
                  className="text-sm font-black leading-7"
                  style={{ color: 'var(--text-color)' }}
                >
                  بياناتك محفوظة محليًا ضمن بيئة البرنامج على نفس الجهاز.
                </div>
              </div>
            </div>
          </div>

          <div
            className="rounded-[2rem] border p-6"
            style={{
              borderColor: 'var(--border-color)',
              background: 'var(--card-bg)'
            }}
          >
            <div
              className="text-[10px] font-black uppercase tracking-widest mb-4"
              style={{ color: 'var(--text-muted)' }}
            >
              للحصول على حساب أو اشتراك
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center"
                  style={{
                    background: 'var(--theme-primary-soft)',
                    color: 'var(--theme-primary)'
                  }}
                >
                  <Phone size={18} strokeWidth={2.3} />
                </div>

                <div>
                  <div
                    className="text-[10px] font-black uppercase tracking-widest mb-1"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    رقم التواصل
                  </div>
                  <div
                    className="text-sm font-black"
                    style={{ color: 'var(--text-color)' }}
                  >
                    0969 321 141
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center"
                  style={{
                    background: 'var(--theme-primary-soft)',
                    color: 'var(--theme-primary)'
                  }}
                >
                  <MessageCircle size={18} strokeWidth={2.3} />
                </div>

                <div>
                  <div
                    className="text-[10px] font-black uppercase tracking-widest mb-1"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    واتساب / تيليجرام
                  </div>
                  <div
                    className="text-sm font-black"
                    style={{ color: 'var(--text-color)' }}
                  >
                    https://t.me/ALRAYYAN_APP
                  </div>
                </div>
              </div>
            </div>

            <div
              className="mt-5 text-xs font-bold leading-6"
              style={{ color: 'var(--text-muted)' }}
            >
              للتجديد أو التفعيل أو طلب نسخة جديدة، تواصل عبر المعلومات الظاهرة
              هنا.
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8 lg:p-10 flex flex-col justify-center">
          <div className="lg:hidden text-center mb-8">
            <div
              className="w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto mb-5 shadow-lg"
              style={{
                background: 'var(--theme-primary)',
                color: '#ffffff'
              }}
            >
              <Lock size={34} strokeWidth={2.4} />
            </div>

            <h1
              className="text-3xl font-black tracking-tight"
              style={{ color: 'var(--text-color)' }}
            >
              نظام الريان
            </h1>

            <p
              className="text-xs font-black uppercase tracking-widest mt-2"
              style={{ color: 'var(--text-muted)' }}
            >
              سجل دخولك للمتابعة
            </p>
          </div>

          <div className="mb-8">
            <h2
              className="text-3xl lg:text-4xl font-black tracking-tight"
              style={{ color: 'var(--text-color)' }}
            >
              تسجيل الدخول
            </h2>

            <p
              className="text-sm font-bold mt-3 leading-7"
              style={{ color: 'var(--text-muted)' }}
            >
              أدخل اسم المستخدم وكلمة المرور للوصول إلى النظام.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  className="rounded-[1.5rem] border p-4 flex items-center gap-3"
                  style={{
                    background: 'rgba(244,63,94,0.10)',
                    borderColor: 'rgba(244,63,94,0.22)',
                    color: 'rgb(225,29,72)'
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0"
                    style={{ background: 'var(--card-bg)' }}
                  >
                    <AlertCircle size={20} strokeWidth={2.4} />
                  </div>

                  <span className="text-sm font-black">{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <div
                className="text-[10px] font-black uppercase tracking-widest mb-2"
                style={{ color: 'var(--text-muted)' }}
              >
                اسم المستخدم
              </div>

              <div className="relative group">
                <User
                  className="absolute right-5 top-1/2 -translate-y-1/2"
                  size={20}
                  strokeWidth={2.4}
                  style={{ color: 'var(--text-muted)' }}
                />

                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="اسم المستخدم"
                  required
                  className="w-full app-muted border rounded-[1.5rem] py-4 pr-14 pl-5 outline-none transition-all font-black text-sm text-left"
                  style={{
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-color)'
                  }}
                />
              </div>
            </div>

            <div>
              <div
                className="text-[10px] font-black uppercase tracking-widest mb-2"
                style={{ color: 'var(--text-muted)' }}
              >
                كلمة المرور
              </div>

              <div className="relative group">
                <Lock
                  className="absolute right-5 top-1/2 -translate-y-1/2"
                  size={20}
                  strokeWidth={2.4}
                  style={{ color: 'var(--text-muted)' }}
                />

                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full app-muted border rounded-[1.5rem] py-4 pr-14 pl-5 outline-none transition-all font-black text-sm text-left"
                  style={{
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-color)'
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full text-white font-black py-4 rounded-[1.5rem] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg"
              style={{ background: 'var(--theme-primary)' }}
            >
              {loading ? (
                <div className="w-6 h-6 border-[3px] border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>تسجيل الدخول</span>
                  <motion.div
                    animate={{ x: [0, -4, 0] }}
                    transition={{ repeat: Infinity, duration: 1.4 }}
                  >
                    <Lock size={18} strokeWidth={2.8} />
                  </motion.div>
                </>
              )}
            </button>
          </form>

          <div
            className="lg:hidden mt-6 rounded-[1.75rem] border p-5"
            style={{
              borderColor: 'var(--border-color)',
              background: 'var(--theme-primary-soft)'
            }}
          >
            <div
              className="text-[10px] font-black uppercase tracking-widest mb-3"
              style={{ color: 'var(--text-muted)' }}
            >
              للحصول على حساب أو اشتراك
            </div>

            <div className="space-y-2 text-sm font-black">
              <div style={{ color: 'var(--text-color)' }}>
                رقم التواصل: 09XX XXX XXX
              </div>
              <div style={{ color: 'var(--text-color)' }}>
                واتساب / تيليجرام: @your_username
              </div>
            </div>
          </div>

          <div
            className="mt-8 pt-6 border-t text-center"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <p
              className="text-[10px] font-black uppercase tracking-widest leading-6"
              style={{ color: 'var(--text-muted)' }}
            >
              جميع البيانات تخزن محليًا على هذا الجهاز
              <br />
              نظام إدارة السوبر ماركت المتكامل
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;