import { afterMutationRefresh } from '../utils/afterMutationRefresh';
import React, { useState, useEffect } from 'react';
import { appSuccess, appError } from '../utils/appAlert';
import {
  Plus,
  User,
  Shield,
  Calendar,
  Trash2,
  UserCircle,
  Lock,
  X,
  Image as ImageIcon
} from 'lucide-react';
import { User as UserType } from '../types';
import { appConfirm } from '../utils/appConfirm';

const Users: React.FC = () => {
  const [users, setUsers] = useState<UserType[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedUsername, setSelectedUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
 const [formData, setFormData] = useState({
  username: '',
  password: '',
  full_name: '',
  role: 'cashier',
  avatar_url: ''
});
  const [loading, setLoading] = useState(true);
  const [savingUser, setSavingUser] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
const [avatarPreview, setAvatarPreview] = useState('');
  useEffect(() => {
    fetchUsers();
  }, []);
  const [updatingAvatarUserId, setUpdatingAvatarUserId] = useState<number | null>(null);

  const currentUser = JSON.parse(localStorage.getItem('user') || 'null');

  const isChangingOwnPassword =
    !!selectedUserId && Number(currentUser?.id) === Number(selectedUserId);

  const isProtectedAdminTarget = selectedUsername === 'admin';

const closeUserForm = () => {
  setShowForm(false);
  setFormData({
    username: '',
    password: '',
    full_name: '',
    role: 'cashier',
    avatar_url: ''
  });
  setAvatarPreview('');
};

  const closePasswordForm = () => {
    setShowPasswordForm(false);
    setNewPassword('');
    setCurrentPassword('');
    setSelectedUserId(null);
    setSelectedUsername('');
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching users:', error);
      appError('حدث خطأ أثناء تحميل المستخدمين');
    } finally {
      setLoading(false);
    }
  };

  const resizeImageToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const img = new Image();

      img.onload = () => {
        const maxSize = 160;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }

        let { width, height } = img;

        if (width > height) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }

        canvas.width = width;
        canvas.height = height;

        ctx.drawImage(img, 0, 0, width, height);

        const compressed = canvas.toDataURL('image/jpeg', 0.82);
        resolve(compressed);
      };

      img.onerror = () => reject(new Error('Image load failed'));
      img.src = String(reader.result || '');
    };

    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });
};

const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    const compressedImage = await resizeImageToDataUrl(file);

    setFormData((prev) => ({
      ...prev,
      avatar_url: compressedImage
    }));

    setAvatarPreview(compressedImage);
  } catch (error) {
    console.error('Error processing avatar:', error);
    appError('فشل في تجهيز الصورة');
  }
};
const handleUpdateUserAvatar = async (user: UserType, file: File) => {
  if (updatingAvatarUserId === user.id) return;

  try {
    setUpdatingAvatarUserId(user.id);

    const compressedImage = await resizeImageToDataUrl(file);

    const currentUser = JSON.parse(localStorage.getItem('user') || 'null');

    const res = await fetch(`/api/users/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: user.username,
        full_name: user.full_name,
        role: user.role,
        avatar_url: compressedImage,
        currentUserId: currentUser?.id,
        currentUserRole: currentUser?.role
      })
    });

    const data = await res.json();

    if (data.success) {
      await fetchUsers();
      await afterMutationRefresh();
      appSuccess('تم تحديث صورة المستخدم بنجاح');
    } else {
      appError(data.message || 'حدث خطأ أثناء تحديث صورة المستخدم');
    }
  } catch (error) {
    console.error('Error updating user avatar:', error);
    appError('حدث خطأ أثناء تحديث الصورة');
  } finally {
    setUpdatingAvatarUserId(null);
  }
};

const handleRemoveUserAvatar = async (user: UserType) => {
  if (updatingAvatarUserId === user.id) return;

  try {
    setUpdatingAvatarUserId(user.id);

    const currentUser = JSON.parse(localStorage.getItem('user') || 'null');

    const res = await fetch(`/api/users/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: user.username,
        full_name: user.full_name,
        role: user.role,
        avatar_url: '',
        currentUserId: currentUser?.id,
        currentUserRole: currentUser?.role
      })
    });

    const data = await res.json();

    if (data.success) {
      await fetchUsers();
      await afterMutationRefresh();
      appSuccess('تم حذف صورة المستخدم بنجاح');
    } else {
      appError(data.message || 'حدث خطأ أثناء حذف صورة المستخدم');
    }
  } catch (error) {
    console.error('Error removing user avatar:', error);
    appError('حدث خطأ أثناء حذف الصورة');
  } finally {
    setUpdatingAvatarUserId(null);
  }
};

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingUser) return;

    setSavingUser(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();

      if (data.success) {
        closeUserForm();
        await fetchUsers();
        await afterMutationRefresh();
        appSuccess('تمت إضافة المستخدم بنجاح');
      } else {
        appError(data.message || 'حدث خطأ أثناء إضافة المستخدم');
      }
    } catch (error) {
      console.error('Error adding user:', error);
      appError('حدث خطأ في الاتصال');
      await afterMutationRefresh();
    } finally {
      setSavingUser(false);
    }
  };

  const handleDeleteUser = async (id: number, username: string) => {
    if (username === 'admin') {
      appError('لا يمكن حذف المدير الرئيسي');
      await afterMutationRefresh();
      return;
    }

    const confirmed = await Promise.resolve(
      appConfirm('هل أنت متأكد من حذف هذا المستخدم؟')
    );

    if (!confirmed) return;
    if (deletingUserId === id) return;

    setDeletingUserId(id);
    try {
      const currentUser = JSON.parse(localStorage.getItem('user') || 'null');

      const res = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentUserId: currentUser?.id,
          currentUserRole: currentUser?.role
        })
      });

      const data = await res.json();

      if (data.success) {
        appSuccess('تم حذف المستخدم بنجاح');
        await fetchUsers();
        await afterMutationRefresh();
      } else {
        appError(data.message || 'حدث خطأ أثناء الحذف');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      appError('حدث خطأ في الاتصال');
      await afterMutationRefresh();
    } finally {
      setDeletingUserId(null);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || savingPassword) return;

    if (!newPassword.trim()) {
      appError('يرجى إدخال كلمة المرور الجديدة');
      return;
    }

    if (isChangingOwnPassword && !currentPassword.trim()) {
      appError('يجب إدخال كلمة المرور الحالية');
      return;
    }

    if (!isChangingOwnPassword && isProtectedAdminTarget) {
      appError('لا يمكن تغيير كلمة مرور المدير الرئيسي إلا من داخل حسابه نفسه');
      return;
    }

    setSavingPassword(true);
    try {
      const res = await fetch(`/api/users/${selectedUserId}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: newPassword,
          currentPassword: isChangingOwnPassword ? currentPassword : '',
          currentUserId: currentUser?.id,
          currentUserRole: currentUser?.role
        })
      });

      const data = await res.json();

      if (data.success) {
        closePasswordForm();
        await afterMutationRefresh();
        appSuccess(data.message || 'تم تغيير كلمة المرور بنجاح');
      } else {
        appError(data.message || 'حدث خطأ أثناء تغيير كلمة المرور');
      }
    } catch (error) {
      console.error('Error changing password:', error);
      appError('حدث خطأ في الاتصال');
      await afterMutationRefresh();
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-10" dir="rtl">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
        <div>
          <h2 className="text-2xl font-black tracking-tight app-text">
            إدارة المستخدمين والصلاحيات
          </h2>
          <p className="app-text-muted text-xs font-bold uppercase tracking-widest mt-1">
            التحكم في وصول الموظفين للنظام
          </p>
        </div>

        <button
          onClick={() => setShowForm(true)}
          className="w-full sm:w-auto text-white font-black py-4 px-10 rounded-[1.5rem] shadow-xl flex items-center justify-center gap-3 transition-all active:scale-95 group"
          style={{
            background: 'var(--theme-primary)',
            boxShadow: '0 20px 40px -18px rgba(0,0,0,0.28)'
          }}
        >
          <Plus
            size={22}
            strokeWidth={2.5}
            className="group-hover:rotate-90 transition-transform duration-500"
          />
          إضافة مستخدم جديد
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {loading ? (
          <div className="col-span-full py-32 flex flex-col items-center justify-center gap-4 app-text-muted">
            <div
              className="w-16 h-16 border-4 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: 'var(--theme-primary)', borderTopColor: 'transparent' }}
            />
            <p className="text-[10px] font-black uppercase tracking-widest">
              جاري تحميل المستخدمين...
            </p>
          </div>
        ) : (
          users.map((u) => (
            <div
              key={u.id}
              className="app-card p-8 rounded-[2.5rem] border shadow-sm hover:shadow-2xl transition-all duration-300 group relative"
              style={{
                borderColor: 'var(--border-color)',
                boxShadow: '0 10px 30px -18px rgba(0,0,0,0.20)'
              }}
            >
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-8">
                  <div className="flex items-center gap-5">
                    <div
  className="w-16 h-16 rounded-[1.5rem] overflow-hidden flex items-center justify-center shadow-lg transition-transform duration-300 group-hover:scale-110"
  style={{
    background:
      u.role === 'admin'
        ? 'rgba(139, 92, 246, 0.14)'
        : u.role === 'cashier'
        ? 'rgba(59, 130, 246, 0.14)'
        : 'rgba(249, 115, 22, 0.14)',
    color:
      u.role === 'admin'
        ? '#8b5cf6'
        : u.role === 'cashier'
        ? '#2563eb'
        : '#ea580c',
    boxShadow: '0 12px 24px -16px rgba(0,0,0,0.25)'
  }}
>
  {u.avatar_url ? (
    <img
      src={u.avatar_url}
      alt={u.full_name}
      className="w-full h-full object-cover"
    />
  ) : (
    <UserCircle size={32} strokeWidth={2.5} />
  )}
</div>

                    <div>
                      <h3 className="font-black app-text text-lg tracking-tight">
                        {u.full_name}
                      </h3>
                      <div className="flex items-center gap-2 app-text-muted text-[10px] font-black uppercase tracking-widest mt-1">
                        <User size={12} strokeWidth={3} />
                        <span>@{u.username}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
  <label
    className="w-10 h-10 flex items-center justify-center rounded-xl transition-all cursor-pointer disabled:opacity-50"
    title="تغيير الصورة"
    style={{ color: 'var(--text-muted)' }}
    onMouseEnter={(e) => {
      e.currentTarget.style.color = 'var(--theme-primary)';
      e.currentTarget.style.background = 'var(--theme-primary-soft)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.color = 'var(--text-muted)';
      e.currentTarget.style.background = 'transparent';
    }}
  >
    <ImageIcon size={18} strokeWidth={2.5} />
    <input
      type="file"
      accept="image/*"
      className="hidden"
      disabled={updatingAvatarUserId === u.id}
      onChange={async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        await handleUpdateUserAvatar(u, file);
        e.currentTarget.value = '';
      }}
    />
  </label>

  {u.avatar_url && (
    <button
      onClick={() => handleRemoveUserAvatar(u)}
      disabled={updatingAvatarUserId === u.id}
      className="w-10 h-10 flex items-center justify-center rounded-xl transition-all disabled:opacity-50"
      title="حذف الصورة"
      style={{ color: 'var(--text-muted)' }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = '#f59e0b';
        e.currentTarget.style.background = 'rgba(245, 158, 11, 0.10)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = 'var(--text-muted)';
        e.currentTarget.style.background = 'transparent';
      }}
    >
      <X size={18} strokeWidth={2.5} />
    </button>
  )}

  <button
    onClick={() => handleDeleteUser(u.id, u.username)}
    disabled={deletingUserId === u.id}
    className="w-10 h-10 flex items-center justify-center rounded-xl transition-all disabled:opacity-50"
    title="حذف المستخدم"
    style={{ color: 'var(--text-muted)' }}
    onMouseEnter={(e) => {
      e.currentTarget.style.color = '#e11d48';
      e.currentTarget.style.background = 'rgba(225, 29, 72, 0.10)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.color = 'var(--text-muted)';
      e.currentTarget.style.background = 'transparent';
    }}
  >
    <Trash2 size={18} strokeWidth={2.5} />
  </button>
</div>
                </div>

                <div className="space-y-4">
                  <div
                    className="flex items-center justify-between p-4 rounded-2xl border app-muted"
                    style={{ borderColor: 'var(--border-color)' }}
                  >
                    <div className="flex items-center gap-3 text-[10px] font-black app-text-muted uppercase tracking-widest">
                      <Shield size={16} strokeWidth={2.5} />
                      <span>الصلاحية</span>
                    </div>

                    <span
                      className="px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm"
                      style={{
                        background:
                          u.role === 'admin'
                            ? '#8b5cf6'
                            : u.role === 'cashier'
                            ? '#2563eb'
                            : '#ea580c',
                        color: '#ffffff'
                      }}
                    >
                      {u.role === 'admin'
                        ? 'مدير نظام'
                        : u.role === 'cashier'
                        ? 'كاشير'
                        : 'موظف مخزن'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] font-black app-text-muted uppercase tracking-widest px-2">
                    <Calendar size={14} strokeWidth={2.5} />
                    <span>انضم في: {new Date(u.created_at).toLocaleDateString('ar-SA')}</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSelectedUserId(u.id);
                    setSelectedUsername(u.username);
                    setCurrentPassword('');
                    setNewPassword('');
                    setShowPasswordForm(true);
                  }}
                  className="w-full mt-8 py-4 text-xs font-black rounded-2xl transition-all border flex items-center justify-center gap-3 group/btn"
                  style={{
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-muted)',
                    background: 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--theme-primary)';
                    e.currentTarget.style.background = 'var(--theme-primary-soft)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--text-muted)';
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <Lock size={16} strokeWidth={2.5} className="group-hover/btn:animate-bounce" />
                  تغيير كلمة المرور
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 backdrop-blur-sm"
            style={{ background: 'rgba(15, 23, 42, 0.45)' }}
            onClick={closeUserForm}
          />

          <div
            className="relative app-card w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden border"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <div
              className="p-8 border-b flex items-center justify-between"
              style={{
                borderColor: 'var(--border-color)',
                background: 'var(--theme-primary-soft)'
              }}
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm"
                  style={{
                    background: 'rgba(16, 185, 129, 0.12)',
                    color: 'var(--theme-primary)'
                  }}
                >
                  <Plus size={24} strokeWidth={2.5} />
                </div>
                <h2 className="text-2xl font-black tracking-tight app-text">
                  إضافة مستخدم
                </h2>
              </div>

              <button
                onClick={closeUserForm}
                className="w-12 h-12 flex items-center justify-center rounded-full transition-all"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(0,0,0,0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <X size={28} strokeWidth={2.5} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-10 space-y-8">
              <div className="space-y-3">
                <div className="space-y-3">
  <label className="text-[10px] font-black app-text-muted uppercase tracking-widest mr-2">
    الصورة الشخصية
  </label>

  <div className="flex items-center gap-4">
    <div
      className="w-20 h-20 rounded-[1.5rem] overflow-hidden flex items-center justify-center border app-muted shrink-0"
      style={{ borderColor: 'var(--border-color)' }}
    >
      {avatarPreview ? (
        <img
          src={avatarPreview}
          alt="معاينة الصورة"
          className="w-full h-full object-cover"
        />
      ) : (
        <UserCircle size={34} strokeWidth={2.2} style={{ color: 'var(--text-muted)' }} />
      )}
    </div>

    <label
      className="flex-1 cursor-pointer app-muted border rounded-[1.5rem] py-5 px-6 transition-all font-bold app-text flex items-center justify-center gap-3"
      style={{ borderColor: 'var(--border-color)' }}
    >
      <ImageIcon size={20} />
      <span>{avatarPreview ? 'تغيير الصورة' : 'اختيار صورة'}</span>
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarChange}
      />
    </label>
  </div>

  {avatarPreview && (
    <button
      type="button"
      onClick={() => {
        setAvatarPreview('');
        setFormData((prev) => ({
          ...prev,
          avatar_url: ''
        }));
      }}
      className="text-xs font-black px-4 py-2 rounded-xl transition-all"
      style={{
        color: '#dc2626',
        background: 'rgba(220, 38, 38, 0.08)'
      }}
    >
      حذف الصورة
    </button>
  )}
</div>
                <label className="text-[10px] font-black app-text-muted uppercase tracking-widest mr-2">
                  الاسم الكامل
                </label>
                <div className="relative group">
                  <UserCircle
                    className="absolute right-5 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                    size={22}
                  />
                  <input
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full app-muted border rounded-[1.5rem] py-5 pr-14 pl-6 outline-none transition-all font-bold app-text"
                    style={{ borderColor: 'var(--border-color)' }}
                    placeholder="أدخل الاسم الرباعي"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black app-text-muted uppercase tracking-widest mr-2">
                  اسم المستخدم
                </label>
                <div className="relative group">
                  <User
                    className="absolute right-5 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                    size={22}
                  />
                  <input
                    type="text"
                    required
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full app-muted border rounded-[1.5rem] py-5 pr-14 pl-6 outline-none transition-all font-bold app-text text-left"
                    style={{ borderColor: 'var(--border-color)' }}
                    placeholder="username"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black app-text-muted uppercase tracking-widest mr-2">
                  كلمة المرور
                </label>
                <div className="relative group">
                  <Lock
                    className="absolute right-5 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                    size={22}
                  />
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full app-muted border rounded-[1.5rem] py-5 pr-14 pl-6 outline-none transition-all font-bold app-text text-left"
                    style={{ borderColor: 'var(--border-color)' }}
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black app-text-muted uppercase tracking-widest mr-2">
                  الصلاحية
                </label>
                <div className="relative group">
                  <Shield
                    className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                    size={22}
                  />
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full app-muted border rounded-[1.5rem] py-5 pr-14 pl-6 outline-none transition-all font-bold app-text appearance-none cursor-pointer"
                    style={{ borderColor: 'var(--border-color)' }}
                  >
                    <option value="admin">مدير نظام</option>
                    <option value="cashier">كاشير</option>
                    <option value="warehouse">موظف مخزن</option>
                  </select>
                </div>
              </div>

              <div className="pt-6 flex gap-6">
                <button
                  type="button"
                  onClick={closeUserForm}
                  disabled={savingUser}
                  className="flex-1 py-5 font-black rounded-[1.5rem] transition-all active:scale-95 disabled:opacity-50 border"
                  style={{
                    borderColor: 'var(--border-color)',
                    background: 'var(--theme-primary-soft)',
                    color: 'var(--text-color)'
                  }}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={savingUser}
                  className="flex-1 py-5 text-white font-black rounded-[1.5rem] shadow-2xl transition-all active:scale-95 disabled:opacity-50"
                  style={{
                    background: 'var(--theme-primary)',
                    boxShadow: '0 20px 40px -18px rgba(0,0,0,0.28)'
                  }}
                >
                  {savingUser ? 'جاري الحفظ...' : 'حفظ المستخدم'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPasswordForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 backdrop-blur-sm"
            style={{ background: 'rgba(15, 23, 42, 0.45)' }}
            onClick={closePasswordForm}
          />

          <div
            className="relative app-card w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden border"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <div
              className="p-8 border-b flex items-center justify-between"
              style={{
                borderColor: 'var(--border-color)',
                background: 'var(--theme-primary-soft)'
              }}
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm"
                  style={{
                    background: 'rgba(16, 185, 129, 0.12)',
                    color: 'var(--theme-primary)'
                  }}
                >
                  <Lock size={24} strokeWidth={2.5} />
                </div>
                <div>
                  <h2 className="text-2xl font-black tracking-tight app-text">
                    تغيير كلمة المرور
                  </h2>
                  <p className="text-[10px] font-black app-text-muted uppercase tracking-widest mt-1">
                    @{selectedUsername}
                  </p>
                </div>
              </div>

              <button
                onClick={closePasswordForm}
                className="w-12 h-12 flex items-center justify-center rounded-full transition-all"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(0,0,0,0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <X size={28} strokeWidth={2.5} />
              </button>
            </div>

            <form onSubmit={handlePasswordChange} className="p-10 space-y-8">
              {isChangingOwnPassword && (
                <div className="space-y-3">
                  <label className="text-[10px] font-black app-text-muted uppercase tracking-widest mr-2">
                    كلمة المرور الحالية
                  </label>
                  <div className="relative group">
                    <Lock
                      className="absolute right-5 top-1/2 -translate-y-1/2 transition-colors"
                      style={{ color: 'var(--text-muted)' }}
                      size={22}
                    />
                    <input
                      type="password"
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full app-muted border rounded-[1.5rem] py-5 pr-14 pl-6 outline-none transition-all font-bold app-text text-left"
                      style={{ borderColor: 'var(--border-color)' }}
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              )}

              {!isChangingOwnPassword && isProtectedAdminTarget && (
                <div
                  className="rounded-[1.5rem] border px-5 py-4 text-sm font-bold"
                  style={{
                    borderColor: 'rgba(239, 68, 68, 0.25)',
                    background: 'rgba(239, 68, 68, 0.08)',
                    color: '#b91c1c'
                  }}
                >
                  لا يمكن تغيير كلمة مرور المدير الرئيسي إلا من داخل حسابه نفسه وبعد إدخال كلمة المرور الحالية.
                </div>
              )}

              <div className="space-y-3">
                <label className="text-[10px] font-black app-text-muted uppercase tracking-widest mr-2">
                  كلمة المرور الجديدة
                </label>
                <div className="relative group">
                  <Lock
                    className="absolute right-5 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                    size={22}
                  />
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full app-muted border rounded-[1.5rem] py-5 pr-14 pl-6 outline-none transition-all font-bold app-text text-left"
                    style={{ borderColor: 'var(--border-color)' }}
                    placeholder="••••••••"
                    disabled={!isChangingOwnPassword && isProtectedAdminTarget}
                  />
                </div>
              </div>

              <div className="pt-6 flex gap-6">
                <button
                  type="button"
                  onClick={closePasswordForm}
                  disabled={savingPassword}
                  className="flex-1 py-5 font-black rounded-[1.5rem] transition-all active:scale-95 disabled:opacity-50 border"
                  style={{
                    borderColor: 'var(--border-color)',
                    background: 'var(--theme-primary-soft)',
                    color: 'var(--text-color)'
                  }}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={savingPassword || (!isChangingOwnPassword && isProtectedAdminTarget)}
                  className="flex-1 py-5 text-white font-black rounded-[1.5rem] shadow-2xl transition-all active:scale-95 disabled:opacity-50"
                  style={{
                    background: 'var(--theme-primary)',
                    boxShadow: '0 20px 40px -18px rgba(0,0,0,0.28)'
                  }}
                >
                  {savingPassword ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;