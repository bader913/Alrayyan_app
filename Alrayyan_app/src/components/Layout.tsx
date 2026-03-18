import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Truck,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Wallet,
  UserCircle,
  Receipt,
  RefreshCw,
  Barcode,
  Tag,
  QrCode,
  Coins,
  Calculator,
  Minus,
  Plus,
  FileText
  
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from '../types';
import { appConfirm } from '../utils/appConfirm';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  onLogout: () => void;
  onSwitchUser: (username: string, password: string) => Promise<void>;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout, onSwitchUser }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [showSwitchUserModal, setShowSwitchUserModal] = useState(false);
  const [switchPassword, setSwitchPassword] = useState('');
  const [usersList, setUsersList] = useState<User[]>([]);
  const [selectedSwitchUsername, setSelectedSwitchUsername] = useState('');
  const [isSwitchingUser, setIsSwitchingUser] = useState(false);
  const [switchUserError, setSwitchUserError] = useState('');

  // حالة التكبير
  const [zoomFactor, setZoomFactor] = useState(1.0);

  const location = useLocation();
  const navigate = useNavigate();

  const menuItems = [
    { name: 'لوحة التحكم', path: '/', icon: LayoutDashboard, roles: ['admin', 'cashier', 'warehouse'] },
    { name: 'نقطة البيع (الكاشير)', path: '/pos', icon: ShoppingCart, roles: ['admin', 'cashier'] },
    { name: 'المخزون', path: '/inventory', icon: Package, roles: ['admin', 'warehouse'] },
    { name: 'المشتريات', path: '/purchases', icon: Truck, roles: ['admin', 'warehouse'] },
    { name: 'الموردين', path: '/suppliers', icon: Users, roles: ['admin', 'warehouse'] },
    { name: 'العملاء - الديون', path: '/customers', icon: UserCircle, roles: ['admin', 'cashier'] },
    { name: 'فواتير المبيع + الشراء', path: '/invoices', icon: Receipt, roles: ['admin', 'cashier'] },
    { name: 'حاسبة الربح', path: '/profit-calculator', icon: Calculator, roles: ['admin', 'warehouse', 'cashier'] },
    { name: 'المصروفات', path: '/expenses', icon: Wallet, roles: ['admin'] },
    { name: 'الفواتير وعروض السعر', path: '/print-templates', icon: FileText, roles: ['admin', 'warehouse', 'cashier'] },
    { name: 'التقارير', path: '/reports', icon: BarChart3, roles: ['admin'] },
    { name: 'أداة توليد الباركود', path: '/barcode-generator', icon: Barcode, roles: ['admin', 'warehouse'] },
    { name: 'طباعة بطاقات الأسعار', path: '/price-labels', icon: Tag, roles: ['admin', 'warehouse'] },
    { name: 'إنشاء أكواد QR', path: '/qr-generator', icon: QrCode, roles: ['admin', 'warehouse'] },
    { name: 'محول العملات', path: '/currency-converter', icon: Coins, roles: ['admin', 'warehouse', 'cashier'] },
    { name: 'المستخدمين', path: '/users', icon: Users, roles: ['admin'] },
    { name: 'الإعدادات', path: '/settings', icon: Settings, roles: ['admin'] }
  ];

  useEffect(() => {
    fetchSettings();

    const handleResize = () => {
      if (window.innerWidth > 1024) {
        setIsSidebarOpen(true);
      } else {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // استرجاع مستوى التكبير الحالي عند تحميل المكون (إذا كان في Electron)
  useEffect(() => {
    try {
      // التحقق مما إذا كان الكود يعمل داخل Electron
      const electron = (window as any).require?.('electron');
      if (electron?.webFrame) {
        const currentZoom = electron.webFrame.getZoomFactor();
        setZoomFactor(currentZoom);
      }
    } catch (error) {
      console.log('ليس في بيئة Electron أو لا يمكن الوصول إلى webFrame');
    }
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!user) return;

    const currentItem = menuItems.find((item) => item.path === location.pathname);

    if (currentItem && !currentItem.roles.includes(user.role)) {
      if (user.role === 'cashier') {
        navigate('/pos', { replace: true });
      } else if (user.role === 'warehouse') {
        navigate('/inventory', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [user, location.pathname, navigate]);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      setSettings(data);
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const fetchUsersList = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      setUsersList(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching users list:', error);
      setUsersList([]);
    }
  };
const [liveUser, setLiveUser] = useState<User | null>(user || null);

useEffect(() => {
  setLiveUser(user || null);
}, [user]);

useEffect(() => {
  if (!user?.id) return;

  const fetchCurrentUserFresh = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      const usersArray = Array.isArray(data) ? data : [];
      const matchedUser = usersArray.find((u: User) => Number(u.id) === Number(user.id));

      if (matchedUser) {
        setLiveUser(matchedUser);
      }
    } catch (error) {
      console.error('Error fetching fresh current user:', error);
    }
  };

  fetchCurrentUserFresh();
}, [user?.id]);
  const filteredItems = menuItems.filter((item) => user && item.roles.includes(user.role));

  const appTitle = settings?.shop_name || 'سوبر ماركت';
  const appShortLogo = appTitle?.charAt(0) || 'س';

  const roleText =
  liveUser?.role === 'admin'
    ? 'مدير النظام'
    : liveUser?.role === 'cashier'
    ? 'كاشير'
    : 'موظف مخزن';

  const hasPendingCartInCashier = () => {
    return sessionStorage.getItem('cashier_has_pending_cart') === 'true';
  };

  const askCashierLeaveConfirmation = async () => {
    if (!hasPendingCartInCashier()) return true;

    try {
      const confirmed = await Promise.resolve(
        appConfirm('يوجد منتجات في السلة الحالية، وعند الانتقال ستفقد هذه السلة غير المحفوظة. هل أنت متأكد؟')
      );
      return Boolean(confirmed);
    } catch (error) {
      console.error('appConfirm error:', error);
      return false;
    }
  };

  const handleMenuNavigation = async (path: string) => {
    if (path === location.pathname) {
      setIsMobileMenuOpen(false);
      return;
    }

    const ok = await askCashierLeaveConfirmation();
    if (!ok) return;

    setIsMobileMenuOpen(false);
    navigate(path);
  };

  const handleLogoutClick = async () => {
    const ok = await askCashierLeaveConfirmation();
    if (!ok) return;

    onLogout();
  };

  const handleOpenSwitchUserModal = async () => {
    const ok = await askCashierLeaveConfirmation();
    if (!ok) return;

    await fetchUsersList();
    setSelectedSwitchUsername('');
    setSwitchPassword('');
    setSwitchUserError('');
    setShowSwitchUserModal(true);
  };

  const handleSwitchUserSubmit = async () => {
    if (!selectedSwitchUsername) {
      setSwitchUserError('اختر المستخدم أولًا');
      return;
    }

    if (!switchPassword.trim()) {
      setSwitchUserError('أدخل كلمة المرور');
      return;
    }

    try {
      setIsSwitchingUser(true);
      setSwitchUserError('');

      await onSwitchUser(selectedSwitchUsername, switchPassword.trim());

      setShowSwitchUserModal(false);
      setSelectedSwitchUsername('');
      setSwitchPassword('');
      setSwitchUserError('');
    } catch (error: any) {
      setSwitchUserError(error?.message || 'فشل تبديل الحساب');
    } finally {
      setIsSwitchingUser(false);
    }
  };

  // دوال التحكم بالتكبير
  const zoomIn = () => {
  if (window.electronAPI?.zoomIn) {
    window.electronAPI.zoomIn();
    setZoomFactor(prev => Math.min(2.0, prev + 0.1));
  } else {
    console.warn('electronAPI غير متوفر');
  }
};

  const zoomOut = () => {
  if (window.electronAPI?.zoomOut) {
    window.electronAPI.zoomOut();
    setZoomFactor(prev => Math.max(0.5, prev - 0.1));
  } else {
    console.warn('electronAPI غير متوفر');
  }
};

  const resetZoom = () => {
    try {
      const electron = (window as any).require?.('electron');
      if (electron?.webFrame) {
        electron.webFrame.setZoomFactor(1.0);
        setZoomFactor(1.0);
      }
    } catch (error) {
      console.log('لا يمكن إعادة التعيين - ليس في Electron');
    }
  };

  return (
    <div
      className="min-h-screen flex flex-row-reverse font-sans overflow-x-hidden"
      dir="rtl"
      style={{ background: 'var(--app-bg)', color: 'var(--text-color)' }}
    >
      {/* Mobile Header */}
      <div
        className="lg:hidden fixed top-0 right-0 left-0 h-16 z-40 px-4 flex items-center justify-between no-print border-b"
        style={{
          background: 'var(--card-bg)',
          borderColor: 'var(--border-color)'
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-lg"
            style={{ background: 'var(--theme-primary)' }}
          >
            <ShoppingCart size={18} />
          </div>
          <span className="text-lg font-black tracking-tight" style={{ color: 'var(--theme-primary)' }}>
            {appTitle}
          </span>
        </div>

        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 rounded-xl transition-colors"
          style={{ color: 'var(--text-muted)', background: 'transparent' }}
          type="button"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && window.innerWidth < 1024 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 z-40 no-print"
            style={{ background: 'rgba(15, 23, 42, 0.45)' }}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 bottom-0 right-0 z-50 transition-all duration-300 ease-in-out no-print border-l
          ${isSidebarOpen ? 'w-72' : 'w-24'}
          ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
        `}
        style={{
          background: 'var(--card-bg)',
          borderColor: 'var(--border-color)'
        }}
      >
        <div className="h-full flex flex-col">
          <div className="p-6 flex items-center justify-between">
            <AnimatePresence mode="wait">
              {isSidebarOpen ? (
                <motion.div
                  key="logo-full"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="flex items-center gap-3 min-w-0"
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg flex-shrink-0"
                    style={{ background: 'var(--theme-primary)' }}
                  >
                    <ShoppingCart size={18} />
                  </div>
                  <span
                    className="text-xl font-black tracking-tight truncate"
                    style={{ color: 'var(--theme-primary)' }}
                  >
                    {appTitle}
                  </span>
                </motion.div>
              ) : (
                <motion.div
                  key="logo-short"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg"
                  style={{ background: 'var(--theme-primary)' }}
                >
                  {appShortLogo}
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="hidden lg:flex p-2 rounded-xl transition-all"
              style={{
                color: 'var(--text-muted)',
                background: isSidebarOpen ? 'transparent' : 'var(--theme-primary-soft)'
              }}
              type="button"
            >
              <Menu size={20} />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1 custom-scrollbar">
            {filteredItems.map((item) => {
              const isActive = location.pathname === item.path;

              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => handleMenuNavigation(item.path)}
                  className="group flex items-center w-full p-3.5 rounded-2xl transition-all duration-200 relative text-right"
                  style={{
                    color: isActive ? '#ffffff' : 'var(--text-muted)',
                    background: isActive ? 'var(--theme-primary)' : 'transparent',
                    boxShadow: isActive ? '0 12px 22px -8px rgba(0,0,0,0.18)' : 'none'
                  }}
                >
                  <div
                    className="flex items-center justify-center transition-colors"
                    style={{
                      color: isActive ? '#ffffff' : 'var(--text-muted)'
                    }}
                  >
                    <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                  </div>

                  {isSidebarOpen && (
                    <motion.span
                      initial={{ opacity: 0, x: 5 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="mr-3.5 font-bold text-sm"
                    >
                      {item.name}
                    </motion.span>
                  )}

                  {!isSidebarOpen && (
                    <div
                      className="absolute right-full mr-4 px-3 py-2 text-white text-xs font-bold rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50"
                      style={{ background: 'var(--text-color)' }}
                    >
                      {item.name}
                    </div>
                  )}

                  {!isActive && (
                    <div
                      className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity -z-10"
                      style={{ background: 'var(--theme-primary-soft)' }}
                    />
                  )}
                </button>
              );
            })}
          </nav>

          <div className="p-6 border-t" style={{ borderColor: 'var(--border-color)' }}>
            <button
              onClick={handleLogoutClick}
              type="button"
              className={`flex items-center w-full p-3.5 rounded-2xl transition-all group ${
                !isSidebarOpen ? 'justify-center' : ''
              }`}
              style={{
                color: 'var(--text-muted)',
                background: 'transparent'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                e.currentTarget.style.color = '#dc2626';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-muted)';
              }}
            >
              <LogOut size={22} className="group-hover:scale-110 transition-transform" />
              {isSidebarOpen && <span className="mr-3.5 font-bold text-sm">تسجيل الخروج</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={`
          flex-1 transition-all duration-300 ease-in-out min-h-screen flex flex-col
          ${isSidebarOpen ? 'lg:mr-72' : 'lg:mr-24'}
          pt-20 lg:pt-0
        `}
      >
        <header
          className="top-0 z-30 px-5 py-3 lg:py-4 flex items-center justify-between border-b no-print"
          style={{
            background: 'var(--card-bg)',
            borderColor: 'var(--border-color)'
          }}
        >
          <div className="flex flex-col min-w-0">
            <h1
              className="text-lg lg:text-xl font-black tracking-tight truncate"
              style={{ color: 'var(--text-color)' }}
            >
              {menuItems.find((i) => i.path === location.pathname)?.name || 'النظام'}
            </h1>
            
          <div
  className="flex items-center gap-2 text-xs lg:text-sm font-medium mt-0.5"
  style={{ color: 'var(--text-muted)' }}
>
  <span>أهلاً بك مجدداً،</span>
  <span className="font-bold" style={{ color: 'var(--theme-primary)' }}>
    {liveUser?.full_name}
  </span>
</div>
          </div>

          <div className="flex items-center gap-3 lg:gap-5">
            {/* Zoom Controls */}
            <div
              className="hidden sm:flex items-center gap-2 p-1 rounded-2xl border shadow-sm"
              style={{
                background: 'var(--card-bg)',
                borderColor: 'var(--border-color)'
              }}
            >
              <button
                onClick={zoomOut}
                className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-black/5"
                style={{ color: 'var(--text-color)' }}
                title="تصغير"
              >
                <Minus size={16} />
              </button>
              <span className="text-xs font-bold min-w-[40px] text-center" style={{ color: 'var(--text-color)' }}>
                {Math.round(zoomFactor * 100)}%
              </span>
              <button
                onClick={zoomIn}
                className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-black/5"
                style={{ color: 'var(--text-color)' }}
                title="تكبير"
              >
                <Plus size={16} />
              </button>
             
            </div>

            <button
              type="button"
              onClick={handleOpenSwitchUserModal}
              className="hidden sm:flex items-center gap-2 px-4 py-3 rounded-2xl border font-black text-sm transition-all"
              style={{
                background: 'var(--card-bg)',
                borderColor: 'var(--border-color)',
                color: 'var(--theme-primary)'
              }}
            >
              <RefreshCw size={16} strokeWidth={2.5} />
              تبديل الحساب
            </button>

            <div
  className="hidden sm:flex items-center gap-4 p-2 pr-4 rounded-2xl border shadow-sm"
  style={{
    background: 'var(--card-bg)',
    borderColor: 'var(--border-color)'
  }}
>
  <div className="text-left">
    <div className="text-base font-black leading-tight" style={{ color: 'var(--text-color)' }}>
      {liveUser?.full_name}
    </div>
    <div
      className="text-[11px] uppercase tracking-wider font-bold mt-1"
      style={{ color: 'var(--text-muted)' }}
    >
      {roleText}
    </div>
  </div>

  <div
    className="w-16 h-16 rounded-[1.25rem] overflow-hidden flex items-center justify-center font-black shadow-lg shrink-0"
    style={{
      background: 'var(--theme-primary)',
      color: '#ffffff'
    }}
  >
    {liveUser?.avatar_url ? (
      <img
        src={liveUser.avatar_url}
        alt={liveUser.full_name}
        className="w-full h-full object-cover"
      />
    ) : (
      <span className="text-xl">
        {liveUser?.full_name?.charAt(0)}
      </span>
    )}
  </div>
</div>
          </div>
        </header>

        <div className="flex-1 p-3 lg:p-5">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            {children}
          </motion.div>
        </div>
      </main>

      {/* Switch User Modal */}
      <AnimatePresence>
        {showSwitchUserModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              className="w-full max-w-md app-card rounded-[2rem] border shadow-2xl overflow-hidden"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <div
                className="p-6 border-b flex items-center justify-between"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ background: 'var(--theme-primary-soft)', color: 'var(--theme-primary)' }}
                  >
                    <RefreshCw size={22} strokeWidth={2.5} />
                  </div>

                  <div>
                    <h3 className="text-xl font-black" style={{ color: 'var(--text-color)' }}>
                      تبديل الحساب
                    </h3>
                    <p className="text-xs font-bold mt-1" style={{ color: 'var(--text-muted)' }}>
                      اختر المستخدم وأدخل كلمة المرور
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowSwitchUserModal(false);
                    setSwitchPassword('');
                  }}
                  className="w-11 h-11 rounded-2xl flex items-center justify-center transition-colors"
                  style={{ background: 'var(--theme-primary-soft)', color: 'var(--theme-primary)' }}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="space-y-4">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
                      اختر المستخدم
                    </div>
                    <select
                      value={selectedSwitchUsername}
                      onChange={(e) => {
                        setSelectedSwitchUsername(e.target.value);
                        setSwitchUserError('');
                      }}
                      className="w-full app-muted border rounded-2xl py-4 px-4 text-sm font-black outline-none transition-all"
                      style={{ borderColor: 'var(--border-color)', color: 'var(--theme-primary)' }}
                    >
                      <option value="">اختر مستخدمًا</option>
                      {usersList.map((u) => (
                        <option key={u.id} value={u.username}>
                          {u.full_name} ({u.username})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
                      كلمة المرور
                    </div>
                    <input
                      type="password"
                      value={switchPassword}
                      onChange={(e) => {
                        setSwitchPassword(e.target.value);
                        setSwitchUserError('');
                      }}
                      placeholder="أدخل كلمة المرور"
                      className="w-full app-muted border rounded-2xl py-4 px-4 text-sm font-black outline-none transition-all"
                      style={{ borderColor: 'var(--border-color)', color: 'var(--text-color)' }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          void handleSwitchUserSubmit();
                        }
                      }}
                    />
                  </div>

                  {switchUserError && (
                    <div className="text-sm font-black text-rose-600 text-center">
                      {switchUserError}
                    </div>
                  )}
                </div>
              </div>

              <div
                className="p-4 border-t flex flex-col sm:flex-row justify-end gap-3"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowSwitchUserModal(false);
                    setSelectedSwitchUsername('');
                    setSwitchPassword('');
                    setSwitchUserError('');
                  }}
                  className="px-6 py-3 app-card border font-black rounded-2xl transition-all"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  إغلاق
                </button>

                <button
                  type="button"
                  onClick={() => {
                    void handleSwitchUserSubmit();
                  }}
                  disabled={isSwitchingUser}
                  className="px-6 py-3 text-white font-black rounded-2xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: 'var(--theme-primary)' }}
                >
                  {isSwitchingUser ? 'جاري التبديل...' : 'دخول بالحساب المحدد'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Layout;