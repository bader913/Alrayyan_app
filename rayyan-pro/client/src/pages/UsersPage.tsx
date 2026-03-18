import React, { useState, useRef } from 'react';
import { Plus, Search, Edit2, KeyRound, Power, Shield, UserCheck, UserX } from 'lucide-react';
import {
  useUsers, useCreateUser, useUpdateUser,
  useChangePassword, useToggleActive,
  type UserPublic, type CreateUserInput, type UpdateUserInput,
} from '../api/users.ts';
import { useAuthStore } from '../store/authStore.ts';

// ==================== Helpers ====================

const ROLE_LABELS: Record<string, string> = {
  admin:     'مدير عام',
  manager:   'مدير',
  cashier:   'كاشير',
  warehouse: 'مخزن',
};

const ROLE_COLORS: Record<string, string> = {
  admin:     '#7c3aed',
  manager:   '#0369a1',
  cashier:   '#059669',
  warehouse: '#b45309',
};

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('ar-SY', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

// ==================== Modal ====================

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-black text-slate-800 text-base">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none font-bold">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function InputField({
  label, name, type = 'text', value, onChange, placeholder, required, disabled,
}: {
  label: string; name: string; type?: string; value: string;
  onChange: (v: string) => void; placeholder?: string; required?: boolean; disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-black text-slate-600 mb-1.5">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:border-emerald-400 transition-colors bg-slate-50 disabled:opacity-50"
      />
    </div>
  );
}

function RoleSelect({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-black text-slate-600 mb-1.5">
        الدور <span className="text-rose-500">*</span>
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:border-emerald-400 transition-colors bg-slate-50 disabled:opacity-50"
      >
        <option value="cashier">كاشير</option>
        <option value="warehouse">مخزن</option>
        <option value="manager">مدير</option>
        <option value="admin">مدير عام</option>
      </select>
    </div>
  );
}

function ErrorBanner({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div className="bg-rose-50 border border-rose-200 text-rose-600 rounded-xl px-4 py-2.5 text-sm font-medium">
      {msg}
    </div>
  );
}

function SubmitBtn({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full py-3 text-white font-black rounded-xl transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed mt-1"
      style={{ background: '#059669' }}
    >
      {loading ? 'جاري الحفظ...' : label}
    </button>
  );
}

// ==================== Create Modal ====================

function CreateUserModal({ onClose }: { onClose: () => void }) {
  const createUser = useCreateUser();
  const [form, setForm] = useState<CreateUserInput>({ username: '', password: '', full_name: '', role: 'cashier' });
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof CreateUserInput) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await createUser.mutateAsync(form);
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'حدث خطأ';
      setError(msg);
    }
  };

  return (
    <Modal title="إضافة مستخدم جديد" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <InputField label="الاسم الكامل" name="full_name" value={form.full_name} onChange={set('full_name')} placeholder="مثال: أحمد محمد" required />
        <InputField label="اسم المستخدم" name="username" value={form.username} onChange={set('username')} placeholder="مثال: ahmed_m" required />
        <InputField label="كلمة المرور" name="password" type="password" value={form.password} onChange={set('password')} placeholder="6 أحرف على الأقل" required />
        <RoleSelect value={form.role} onChange={(v) => setForm((f) => ({ ...f, role: v as CreateUserInput['role'] }))} />
        <ErrorBanner msg={error} />
        <SubmitBtn loading={createUser.isPending} label="إنشاء المستخدم" />
      </form>
    </Modal>
  );
}

// ==================== Edit Modal ====================

function EditUserModal({ user, onClose }: { user: UserPublic; onClose: () => void }) {
  const updateUser = useUpdateUser();
  const [form, setForm] = useState<UpdateUserInput>({ full_name: user.full_name, role: user.role as UpdateUserInput['role'] });
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await updateUser.mutateAsync({ id: user.id, data: form });
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'حدث خطأ';
      setError(msg);
    }
  };

  return (
    <Modal title={`تعديل: ${user.full_name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <InputField
          label="الاسم الكامل" name="full_name"
          value={form.full_name ?? ''} onChange={(v) => setForm((f) => ({ ...f, full_name: v }))}
          required
        />
        <RoleSelect
          value={form.role ?? 'cashier'}
          onChange={(v) => setForm((f) => ({ ...f, role: v as UpdateUserInput['role'] }))}
          disabled={user.is_protected}
        />
        {user.is_protected && (
          <p className="text-xs text-amber-600 font-medium bg-amber-50 rounded-lg px-3 py-2">
            هذا المستخدم محمي — لا يمكن تغيير دوره
          </p>
        )}
        <ErrorBanner msg={error} />
        <SubmitBtn loading={updateUser.isPending} label="حفظ التعديلات" />
      </form>
    </Modal>
  );
}

// ==================== Password Modal ====================

function PasswordModal({ user, onClose }: { user: UserPublic; onClose: () => void }) {
  const changePassword = useChangePassword();
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPass !== confirm) { setError('كلمتا المرور غير متطابقتين'); return; }
    if (newPass.length < 6) { setError('كلمة المرور 6 أحرف على الأقل'); return; }
    try {
      await changePassword.mutateAsync({ id: user.id, newPassword: newPass });
      setSuccess(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'حدث خطأ';
      setError(msg);
    }
  };

  if (success) {
    return (
      <Modal title="تغيير كلمة المرور" onClose={onClose}>
        <div className="text-center py-4">
          <div className="text-4xl mb-3">✅</div>
          <p className="font-black text-slate-700">تم تغيير كلمة المرور</p>
          <p className="text-xs text-slate-400 mt-1 font-medium">تم إلغاء جميع جلسات المستخدم</p>
          <button onClick={onClose} className="mt-4 px-6 py-2 rounded-xl font-black text-white text-sm" style={{ background: '#059669' }}>
            إغلاق
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={`كلمة مرور: ${user.full_name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <InputField label="كلمة المرور الجديدة" name="newPass" type="password" value={newPass} onChange={setNewPass} placeholder="6 أحرف على الأقل" required />
        <InputField label="تأكيد كلمة المرور" name="confirm" type="password" value={confirm} onChange={setConfirm} placeholder="أعد إدخال كلمة المرور" required />
        <ErrorBanner msg={error} />
        <SubmitBtn loading={changePassword.isPending} label="تغيير كلمة المرور" />
      </form>
    </Modal>
  );
}

// ==================== Main Page ====================

type ModalType = 'create' | 'edit' | 'password' | null;

export default function UsersPage() {
  const currentUser = useAuthStore((s) => s.user);
  const { data: users = [], isLoading, error } = useUsers();
  const toggleActive = useToggleActive();

  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<ModalType>(null);
  const [selectedUser, setSelectedUser] = useState<UserPublic | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = users.filter(
    (u) =>
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.username.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: users.length,
    active: users.filter((u) => u.is_active).length,
    inactive: users.filter((u) => !u.is_active).length,
  };

  const openEdit = (u: UserPublic) => { setSelectedUser(u); setModal('edit'); };
  const openPassword = (u: UserPublic) => { setSelectedUser(u); setModal('password'); };
  const closeModal = () => { setModal(null); setSelectedUser(null); };

  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="p-8" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-800 mb-0.5">إدارة المستخدمين</h1>
          <p className="text-sm text-slate-400 font-medium">التحكم في حسابات وصلاحيات الموظفين</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setModal('create')}
            className="flex items-center gap-2 px-5 py-2.5 text-white font-black text-sm rounded-xl transition-all active:scale-95 shadow-sm hover:shadow-md"
            style={{ background: '#059669' }}
          >
            <Plus size={16} />
            مستخدم جديد
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'إجمالي المستخدمين', value: stats.total, color: '#059669', bg: '#f0fdf4' },
          { label: 'نشط',               value: stats.active, color: '#0369a1', bg: '#eff6ff' },
          { label: 'معطّل',             value: stats.inactive, color: '#dc2626', bg: '#fef2f2' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border p-4 shadow-sm" style={{ borderColor: '#e2e8f0' }}>
            <div className="text-2xl font-black mb-0.5" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs text-slate-400 font-semibold">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="bg-white rounded-2xl border shadow-sm mb-4 p-4" style={{ borderColor: '#e2e8f0' }}>
        <div className="relative">
          <Search size={15} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو اسم المستخدم..."
            className="w-full border border-slate-200 rounded-xl pr-10 pl-4 py-2.5 text-sm font-medium outline-none focus:border-emerald-400 transition-colors bg-slate-50"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden" style={{ borderColor: '#e2e8f0' }}>
        {isLoading && (
          <div className="p-12 text-center text-slate-400 font-medium text-sm">جاري التحميل...</div>
        )}
        {error && (
          <div className="p-8 text-center text-rose-500 font-medium text-sm">
            خطأ في تحميل البيانات — تحقق من الصلاحيات
          </div>
        )}
        {!isLoading && !error && (
          <table className="w-full">
            <thead>
              <tr className="border-b text-right" style={{ borderColor: '#f1f5f9', background: '#f8fafc' }}>
                {['المستخدم', 'الدور', 'الحالة', 'آخر دخول', 'تاريخ الإنشاء', 'إجراءات'].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-xs font-black text-slate-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-400 text-sm font-medium">
                    {search ? 'لا توجد نتائج للبحث' : 'لا يوجد مستخدمون'}
                  </td>
                </tr>
              )}
              {filtered.map((u) => (
                <tr
                  key={u.id}
                  className="border-b last:border-b-0 hover:bg-slate-50 transition-colors"
                  style={{ borderColor: '#f1f5f9' }}
                >
                  {/* User Info */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-sm flex-shrink-0"
                        style={{ background: ROLE_COLORS[u.role] ?? '#64748b' }}
                      >
                        {u.full_name[0]}
                      </div>
                      <div>
                        <div className="font-black text-slate-700 text-sm flex items-center gap-1.5">
                          {u.full_name}
                          {u.is_protected && (
                            <Shield size={12} className="text-amber-500" aria-label="محمي" />
                          )}
                        </div>
                        <div className="text-xs text-slate-400 font-medium">@{u.username}</div>
                      </div>
                    </div>
                  </td>

                  {/* Role */}
                  <td className="px-5 py-4">
                    <span
                      className="text-xs font-black px-2.5 py-1 rounded-lg"
                      style={{
                        background: ROLE_COLORS[u.role] + '18',
                        color: ROLE_COLORS[u.role],
                      }}
                    >
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-5 py-4">
                    {u.is_active ? (
                      <span className="flex items-center gap-1.5 text-xs font-black text-emerald-600">
                        <UserCheck size={13} />
                        نشط
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs font-black text-slate-400">
                        <UserX size={13} />
                        معطّل
                      </span>
                    )}
                  </td>

                  {/* Last Login */}
                  <td className="px-5 py-4">
                    <span className="text-xs text-slate-500 font-medium">{fmt(u.last_login_at)}</span>
                  </td>

                  {/* Created At */}
                  <td className="px-5 py-4">
                    <span className="text-xs text-slate-400 font-medium">{fmt(u.created_at)}</span>
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-4">
                    {isAdmin ? (
                      <div className="flex items-center gap-1">
                        {/* Edit */}
                        <button
                          onClick={() => openEdit(u)}
                          title="تعديل"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Edit2 size={14} />
                        </button>

                        {/* Password */}
                        <button
                          onClick={() => openPassword(u)}
                          title="تغيير كلمة المرور"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                        >
                          <KeyRound size={14} />
                        </button>

                        {/* Toggle Active */}
                        {!u.is_protected && String(u.id) !== String(currentUser?.id) && (
                          <button
                            onClick={() => toggleActive.mutate(u.id)}
                            title={u.is_active ? 'تعطيل' : 'تفعيل'}
                            disabled={toggleActive.isPending}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 ${
                              u.is_active
                                ? 'text-slate-500 hover:text-rose-600 hover:bg-rose-50'
                                : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                          >
                            <Power size={14} />
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-300 font-medium">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {modal === 'create' && <CreateUserModal onClose={closeModal} />}
      {modal === 'edit' && selectedUser && <EditUserModal user={selectedUser} onClose={closeModal} />}
      {modal === 'password' && selectedUser && <PasswordModal user={selectedUser} onClose={closeModal} />}
    </div>
  );
}
