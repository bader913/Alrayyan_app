import React, { useState, useEffect, useRef, useMemo } from 'react';
import { appSuccess, appError, appInfo, appWarning, appAlert } from '../utils/appAlert';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Package,
  AlertTriangle,
  Filter,
  Download,
  LayoutGrid,
  List,
  FileSpreadsheet,
  Calendar,
  Eye,
  X,
  Upload
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Product, Category } from '../types';
import ProductForm from './ProductForm';
import { appConfirm } from '../utils/appConfirm';
const Inventory: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('grid');
  const [importing, setImporting] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [showInventoryPreview, setShowInventoryPreview] = useState(false);
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'expired' | 'noImage'>('all');
const [sortBy, setSortBy] = useState<'name' | 'stockAsc' | 'stockDesc' | 'expirySoon' | 'priceDesc'>('name');

  const isMountedRef = useRef(true);
  const fetchingRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;

    fetchData();
    fetchSettings();

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const hardRefreshApp = () => {
    try {
      const user = localStorage.getItem('user');
      const token = localStorage.getItem('token');

      localStorage.clear();
      sessionStorage.clear();

      if (user) localStorage.setItem('user', user);
      if (token) localStorage.setItem('token', token);
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      window.location.reload();
    }
  };

  const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 10000) => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  // const getCurrencyCode = () => {
  //   const currency = settings?.currency;

  //   if (
  //     currency === 'USD' ||
  //     currency === 'TRY' ||
  //     currency === 'SAR' ||
  //     currency === 'AED' ||
  //     currency === 'SYP'
  //   ) {
  //     return currency;
  //   }

  //   if (currency === '$') return 'USD';
  //   if (currency === 'ل.س') return 'SYP';

  //   return 'SYP';
  // };

type CurrencyCode = 'SYP' | 'USD' | 'TRY' | 'SAR' | 'AED';

const getCurrencyCode = (): CurrencyCode => {
  const currency = settings?.currency;

  if (
    currency === 'USD' ||
    currency === 'TRY' ||
    currency === 'SAR' ||
    currency === 'AED' ||
    currency === 'SYP'
  ) {
    return currency;
  }

  if (currency === '$') return 'USD';
  if (currency === 'ل.س') return 'SYP';

  return 'USD';
};

const getUsdToSyp = () => {
  return parseFloat(settings?.usd_to_syp || '11000');
};

const getUsdToTry = () => {
  return parseFloat(settings?.usd_to_try || '44');
};

const getUsdToSar = () => {
  return parseFloat(settings?.usd_to_sar || '3.75');
};

const getUsdToAed = () => {
  return parseFloat(settings?.usd_to_aed || '3.67');
};

const getRateFromUSD = (currencyCode: CurrencyCode) => {
  switch (currencyCode) {
    case 'USD':
      return 1;
    case 'SYP':
      return getUsdToSyp();
    case 'TRY':
      return getUsdToTry();
    case 'SAR':
      return getUsdToSar();
    case 'AED':
      return getUsdToAed();
    default:
      return 1;
  }
};

const getCurrencySymbol = (currencyCode?: CurrencyCode): string => {
  const code = currencyCode || getCurrencyCode();

  const symbols: Record<CurrencyCode, string> = {
    SYP: 'ل.س',
    USD: '$',
    TRY: 'TL',
    SAR: 'ر.س',
    AED: 'د.إ'
  };

  return symbols[code];
};

const convertFromUSD = (amount: number, targetCurrency?: CurrencyCode) => {
  const currencyCode = targetCurrency || getCurrencyCode();
  const rate = getRateFromUSD(currencyCode);
  return Number(amount || 0) * rate;
};

const formatMoney = (amount: number, currencyCode?: CurrencyCode) => {
  const code = currencyCode || getCurrencyCode();
  const converted = convertFromUSD(Number(amount || 0), code);
  const fractionDigits = code === 'SYP' ? 0 : 2;

  return `${converted.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  })} ${getCurrencySymbol(code)}`;
};

  const showUsd = settings?.show_usd === 'true';

  const formatImageUrl = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('http') || url.startsWith('data:')) return url;
    return `/api/local-image?path=${encodeURIComponent(url)}`;
  };

  const isExpired = (expiryDate?: string) => {
  if (!expiryDate) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(expiryDate);
  if (Number.isNaN(expiry.getTime())) return false;

  expiry.setHours(0, 0, 0, 0);
  return expiry < today;
};

const getExpirySortValue = (expiryDate?: string) => {
  if (!expiryDate) return Number.MAX_SAFE_INTEGER;

  const date = new Date(expiryDate);
  if (Number.isNaN(date.getTime())) return Number.MAX_SAFE_INTEGER;

  return date.getTime();
};
  const fetchSettings = async () => {
    try {
      const res = await fetchWithTimeout('/api/settings', {}, 8000);
      if (!res.ok) throw new Error('Failed to fetch settings');
      const data = await res.json();

      if (!isMountedRef.current) return;
      setSettings(data);
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const fetchData = async () => {
    if (fetchingRef.current) return;

    fetchingRef.current = true;
    setLoading(true);

    try {
      const [prodRes, catRes] = await Promise.all([
        fetchWithTimeout('/api/products', {}, 10000),
        fetchWithTimeout('/api/categories', {}, 10000)
      ]);

      if (!prodRes.ok || !catRes.ok) {
        throw new Error('فشل تحميل بيانات المخزون');
      }

      const [prodData, catData] = await Promise.all([prodRes.json(), catRes.json()]);

      if (!isMountedRef.current) return;

      setProducts(Array.isArray(prodData) ? prodData : []);
      setCategories(Array.isArray(catData) ? catData : []);
    } catch (error: any) {
      console.error('Error fetching inventory data:', error);

      if (error?.name === 'AbortError') {
        appError('انتهت مهلة تحميل بيانات المخزون. سيتم إعادة تحميل التطبيق.');
        hardRefreshApp();
        return;
      }

      appError('حدث خطأ أثناء تحميل بيانات المخزون');
    } finally {
      fetchingRef.current = false;
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = await appConfirm('هل أنت متأكد من حذف هذا المنتج؟');
    if (!confirmed) return;

    try {
      const res = await fetchWithTimeout(`/api/products/${id}`, { method: 'DELETE' }, 10000);
      const data = await res.json();

      if (res.ok && data.success) {
        setProducts(prev => prev.filter(p => p.id !== id));
      } else {
        appError(data.message || 'لا يمكن حذف المنتج لأنه يحتوي على مخزون أو مرتبط بحركات');
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        appError('انتهت مهلة الحذف. سيتم إعادة تحميل التطبيق.');
        hardRefreshApp();
        return;
      }

      appError('حدث خطأ أثناء حذف المنتج');
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setShowForm(true);
  };

  const handleAdd = () => {
    
    setEditingProduct(null);
    setShowForm(true);
  };

const handleCSVImport  = async (e: React.ChangeEvent<HTMLInputElement>) => {
  
  const file = e.target.files?.[0];
  if (!file) return;

  setImporting(true);

  const normalizeValue = (value: any) => String(value ?? '').trim();

 const normalizeDigits = (value: string) => {
  let normalized = value
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
    .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
    .replace(/٫/g, '.')
    .replace(/,/g, '.')
    .replace(/[^\d.]/g, '')
    .trim();

  const firstDotIndex = normalized.indexOf('.');
  if (firstDotIndex !== -1) {
    normalized =
      normalized.slice(0, firstDotIndex + 1) +
      normalized.slice(firstDotIndex + 1).replace(/\./g, '');
  }

  if (normalized.startsWith('.')) {
    normalized = `0${normalized}`;
  }

  return normalized;
};

  const toNumber = (value: any, fallback = 0) => {
  const normalized = normalizeDigits(normalizeValue(value));

  if (!normalized || normalized === '.' || normalized === '0.') {
    return fallback;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
};

  const mapRowsToProducts = (rows: any[]) => {
    return rows
      .map((row: any) => {
        const categoryName = normalizeValue(
          row.category ||
            row.category_name ||
            row['التصنيف']
        );

        let categoryId = toNumber(
          row.category_id || row['رقم_التصنيف'],
          0
        );

        if (categoryName) {
          const foundCat = categories.find(
            (c) => c.name.trim().toLowerCase() === categoryName.toLowerCase()
          );
          if (foundCat) categoryId = foundCat.id;
        }

        return {
          barcode: normalizeDigits(
            normalizeValue(row.barcode || row['الباركود'])
          ),
          name: normalizeValue(row.name || row['الاسم']),
          category_id: categoryId || 1,
          unit: normalizeValue(row.unit || row['الوحدة'] || 'قطعة'),
          purchase_price: toNumber(row.purchase_price || row['سعر_الشراء'], 0),
          sale_price: toNumber(row.sale_price || row['سعر_البيع'], 0),
          stock_quantity: toNumber(row.stock_quantity || row['الكمية'], 0),
          min_stock_level: toNumber(row.min_stock_level || row['الحد_الأدنى'], 5),
          expiry_date: normalizeValue(row.expiry_date || row['تاريخ_الصلاحية']),
          image_url: normalizeValue(
            row.image_url ||
              row['رابط_الصورة'] ||
              row['رابط الصورة']
          ),
          notes: normalizeValue(row.notes || row['ملاحظات'])
        };
      })
      .filter((p) => p.barcode && p.name);
  };

  const importProducts = async (productsToImport: any[]) => {
    if (productsToImport.length === 0) {
      appError('لم يتم العثور على بيانات صالحة في الملف. تأكد من وجود أعمدة "الباركود" و "الاسم".');
      return;
    }

    const res = await fetchWithTimeout(
      '/api/products/bulk',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productsToImport)
      },
      15000
    );

    const data = await res.json();

    if (data.success) {
  const insertedRows = Number(data.inserted_rows ?? 0);
  const ignoredRows = Number(data.ignored_rows ?? 0);
  const ignoredDetails = Array.isArray(data.ignored_details) ? data.ignored_details : [];

  if (ignoredRows > 0) {
    const previewText = ignoredDetails
      .slice(0, 5)
      .map((row: any) => `السطر ${row.row_number}: ${row.name || '-'} / ${row.barcode || '-'} (${row.reason})`)
      .join('\n');

    appWarning(
      `تم استيراد ${insertedRows} منتج، وتم تجاهل ${ignoredRows} صف.\n\n${previewText}${
        ignoredDetails.length > 5 ? '\n...' : ''
      }`
    );
  } else {
    appSuccess(`تم استيراد ${insertedRows} منتج بنجاح`);
  }

  await fetchData();
} else {
  appError('فشل استيراد المنتجات: ' + (data.message || 'خطأ غير معروف'));
}
  };

  try {
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            const rows = Array.isArray(results.data) ? results.data : [];
            const productsToImport = mapRowsToProducts(rows);
            await importProducts(productsToImport);
          } catch (err: any) {
            if (err?.name === 'AbortError') {
              appError('انتهت مهلة الاستيراد. سيتم إعادة تحميل التطبيق.');
              hardRefreshApp();
              return;
            }

            console.error(err);
            appError('حدث خطأ أثناء استيراد ملف CSV');
          } finally {
            setImporting(false);
            e.target.value = '';
          }
        },
        error: (err) => {
          console.error(err);
          appError('خطأ في قراءة ملف CSV');
          setImporting(false);
          e.target.value = '';
        }
      });

      return;
    }

    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });

      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      const rows = XLSX.utils.sheet_to_json(worksheet, {
        defval: '',
        raw: false
      });

      const productsToImport = mapRowsToProducts(rows as any[]);
      await importProducts(productsToImport);

      setImporting(false);
      e.target.value = '';
      return;
    }

    appError('نوع الملف غير مدعوم. الرجاء اختيار ملف CSV أو Excel');
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      appError('انتهت مهلة الاستيراد. سيتم إعادة تحميل التطبيق.');
      hardRefreshApp();
      return;
    }

    console.error(err);
    appError('حدث خطأ أثناء الاستيراد');
  } finally {
    setImporting(false);
    e.target.value = '';
  }
};

 const downloadTemplate = () => {
  const headers = [
    'الباركود',
    'الاسم',
    'التصنيف',
    'الوحدة',
    'سعر_الشراء',
    'سعر_البيع',
    'الكمية',
    'الحد_الأدنى',
    'تاريخ_الصلاحية',
    'رابط_الصورة',
    'ملاحظات'
  ];

 const sampleRow = [
  '123456789',
  'مثال منتج',
  'مواد غذائية',
  'قطعة',
  '0.40',
  '0.55',
  '50',
  '5',
  '2026-12-31',
  'https://example.com/image.jpg',
  'ملاحظات اختيارية'
];

  const csvContent = [headers.join(','), sampleRow.join(',')].join('\n');

  const blob = new Blob(['\ufeff' + csvContent], {
    type: 'text/csv;charset=utf-8;'
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'inventory_template.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

 const exportAllInventoryToExcel = () => {
  const exportData = products.map((p) => ({
    'الباركود': p.barcode || '',
    'الاسم': p.name || '',
    'التصنيف': p.category_name || 'بدون تصنيف',
    'الوحدة': p.unit || '',
    'سعر_الشراء': Number(p.purchase_price || 0),
    'سعر_البيع': Number(p.sale_price || 0),
    'الكمية': p.stock_quantity ?? 0,
    'الحد_الأدنى': p.min_stock_level ?? 0,
    'تاريخ_الصلاحية': p.expiry_date || '',
    'رابط_الصورة': p.image_url || '',
    'ملاحظات': p.notes || ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory');

  const fileName = `inventory_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};
const exportFilteredInventoryToExcel = () => {
  const exportData = filteredProducts.map((p) => ({
    'الباركود': p.barcode || '',
    'الاسم': p.name || '',
    'التصنيف': p.category_name || 'بدون تصنيف',
    'الوحدة': p.unit || '',
    'سعر_الشراء': Number(p.purchase_price || 0),
    'سعر_البيع': Number(p.sale_price || 0),
    'الكمية': Number(p.stock_quantity ?? 0),
    'الحد_الأدنى': Number(p.min_stock_level ?? 0),
    'تاريخ_الصلاحية': p.expiry_date || '',
    'رابط_الصورة': p.image_url || '',
    'ملاحظات': p.notes || ''
  }));

  if (exportData.length === 0) {
    appWarning('لا توجد نتائج حالية لتصديرها');
    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, 'FilteredInventory');

  const fileName = `inventory_filtered_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};

  const filteredProducts = useMemo(() => {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const result = products.filter((p) => {
    const matchesSearch =
      !normalizedQuery ||
      p.name.toLowerCase().includes(normalizedQuery) ||
      p.barcode.includes(normalizedQuery) ||
      (p.category_name || '').toLowerCase().includes(normalizedQuery);

    const matchesCategory = selectedCategory ? p.category_id === selectedCategory : true;

    const matchesStockFilter =
      stockFilter === 'all'
        ? true
        : stockFilter === 'low'
        ? Number(p.stock_quantity || 0) <= Number(p.min_stock_level || 0)
        : stockFilter === 'expired'
        ? isExpired(p.expiry_date)
        : stockFilter === 'noImage'
        ? !p.image_url
        : true;

    return matchesSearch && matchesCategory && matchesStockFilter;
  });

  result.sort((a, b) => {
    switch (sortBy) {
      case 'stockAsc':
        return Number(a.stock_quantity || 0) - Number(b.stock_quantity || 0);

      case 'stockDesc':
        return Number(b.stock_quantity || 0) - Number(a.stock_quantity || 0);

      case 'expirySoon':
        return getExpirySortValue(a.expiry_date) - getExpirySortValue(b.expiry_date);

      case 'priceDesc':
        return Number(b.sale_price || 0) - Number(a.sale_price || 0);

      case 'name':
      default:
        return a.name.localeCompare(b.name, 'ar');
    }
  });

  return result;
}, [products, searchQuery, selectedCategory, stockFilter, sortBy]);

  const defaultCategories = [
    'مواد غذائية',
    'منظفات',
    'مشروبات',
    'أدوية ومستحضرات صحية',
    'خضروات وفواكه',
    'ألبان وأجبان',
    'دخان '
  ];

  const categoryOptions =
    categories && categories.length > 0
      ? categories
      : defaultCategories.map((name, index) => ({
          id: index + 1,
          name
        }));

  const totalProducts = filteredProducts.length;
const lowStockProducts = filteredProducts.filter(
  (p) => Number(p.stock_quantity || 0) <= Number(p.min_stock_level || 0)
).length;
const expiredProducts = filteredProducts.filter((p) => isExpired(p.expiry_date)).length;
const noImageProducts = filteredProducts.filter((p) => !p.image_url).length;
const totalStockQuantity = filteredProducts.reduce(
  (sum, p) => sum + Number(p.stock_quantity || 0),
  0
);

  const tone = {
    primary: {
      background: 'color-mix(in srgb, var(--theme-primary) 14%, transparent)',
      color: 'var(--theme-primary)',
      borderColor: 'color-mix(in srgb, var(--theme-primary) 24%, var(--border-color))'
    },
    primaryStrong: {
      background: 'var(--theme-primary)',
      color: '#fff',
      borderColor: 'var(--theme-primary)'
    },
    neutral: {
      background: 'var(--muted-bg)',
      borderColor: 'var(--border-color)'
    },
    surface: {
      borderColor: 'var(--border-color)'
    },
    dangerSoft: {
      background: 'rgba(244, 63, 94, 0.12)',
      color: 'rgb(244, 63, 94)',
      borderColor: 'rgba(244, 63, 94, 0.22)'
    },
    successSoft: {
      background: 'color-mix(in srgb, var(--theme-primary) 12%, transparent)',
      color: 'var(--theme-primary)',
      borderColor: 'color-mix(in srgb, var(--theme-primary) 24%, var(--border-color))'
    },
    infoSoft: {
      background: 'rgba(59, 130, 246, 0.12)',
      color: 'rgb(59, 130, 246)',
      borderColor: 'rgba(59, 130, 246, 0.22)'
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="space-y-5">
  <div className="flex flex-col 2xl:flex-row 2xl:items-center justify-between gap-4">
    <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 flex-1 min-w-0">
      <div className="relative flex-1 min-w-0 2xl:max-w-[480px] group">
        <Search
          className="absolute right-4 top-1/2 -translate-y-1/2 app-text-muted transition-colors"
          size={20}
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ابحث بالاسم أو الباركود..."
          style={{
            borderColor: 'var(--theme-primary)',
            borderTopColor: 'transparent'
          }}
          className="w-full app-card app-text border rounded-[1.4rem] h-12 pr-12 pl-4 focus:ring-4 focus:outline-none transition-all font-bold shadow-sm placeholder:opacity-70"
        />
      </div>

      <div className="relative lg:min-w-[220px]">
        <Filter
          className="absolute right-4 top-1/2 -translate-y-1/2 app-text-muted pointer-events-none transition-colors"
          size={17}
        />
        <select
          value={selectedCategory ?? ''}
          onChange={(e) =>
            setSelectedCategory(e.target.value ? Number(e.target.value) : null)
          }
          style={tone.surface}
          className="w-full app-card app-text border rounded-[1.4rem] h-12 pr-12 pl-4 focus:ring-4 outline-none transition-all font-bold appearance-none cursor-pointer"
        >
          <option value="">كل التصنيفات</option>
          {categoryOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
    </div>

    <div className="flex items-center gap-3 flex-wrap">
      <div
        className="flex items-center app-card border rounded-[1.2rem] p-1 shadow-sm"
        style={tone.surface}
      >
        <button
          type="button"
          style={viewMode === 'grid' ? tone.primaryStrong : {}}
          onClick={() => setViewMode('grid')}
          className={`w-10 h-10 rounded-[0.9rem] transition-all duration-300 flex items-center justify-center ${
            viewMode === 'grid'
              ? 'text-white shadow-md'
              : 'app-text-muted hover:app-text hover:opacity-90'
          }`}
        >
          <LayoutGrid size={18} strokeWidth={2.5} />
        </button>
        <button
          type="button"
          style={viewMode === 'table' ? tone.primaryStrong : {}}
          onClick={() => setViewMode('table')}
          className={`w-10 h-10 rounded-[0.9rem] transition-all duration-300 flex items-center justify-center ${
            viewMode === 'table'
              ? 'text-white shadow-md'
              : 'app-text-muted hover:app-text hover:opacity-90'
          }`}
        >
          <List size={18} strokeWidth={2.5} />
        </button>
      </div>

      <button
        type="button"
        onClick={() => setShowInventoryPreview(true)}
        className="h-12 px-5 app-card border rounded-[1.3rem] app-text flex items-center gap-2.5 font-black shadow-sm hover:shadow-md transition-all whitespace-nowrap"
        style={tone.surface}
      >
        <Eye size={18} strokeWidth={2.5} />
        عرض المخزون
      </button>

      <button
        type="button"
        onClick={exportFilteredInventoryToExcel}
        style={tone.primaryStrong}
        className="h-12 px-5 rounded-[1.3rem] shadow-md flex items-center gap-2.5 transition-all font-black whitespace-nowrap"
      >
        <FileSpreadsheet size={18} strokeWidth={2.5} />
        تصدير النتائج
      </button>

      <button
        type="button"
        onClick={downloadTemplate}
        className="w-12 h-12 app-card border rounded-[1.3rem] app-text-muted transition-all shadow-sm group relative flex items-center justify-center"
        style={tone.surface}
      >
        <FileSpreadsheet
          size={20}
          strokeWidth={2.5}
          className="group-hover:scale-110 transition-transform"
        />
        <span className="absolute -top-12 left-1/2 -translate-x-1/2 bg-black/85 text-white text-[10px] font-black py-2 px-4 rounded-xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap">
          تحميل القالب
        </span>
      </button>

      <label
        className="w-12 h-12 app-card border rounded-[1.3rem] app-text-muted transition-all cursor-pointer flex items-center justify-center shadow-sm group relative"
        style={tone.surface}
      >
        <Download
          size={20}
          strokeWidth={2.5}
          className="group-hover:scale-110 transition-transform"
        />
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleCSVImport}
          className="hidden"
          disabled={importing}
        />
        <span className="absolute -top-12 left-1/2 -translate-x-1/2 bg-black/85 text-white text-[10px] font-black py-2 px-4 rounded-xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap">
          استيراد ملف
        </span>
      </label>

      <button
        type="button"
        onClick={handleAdd}
        style={tone.primaryStrong}
        className="h-12 px-6 rounded-[1.3rem] shadow-lg flex items-center gap-2.5 transition-all active:scale-95 whitespace-nowrap group font-black"
      >
        <Plus
          size={20}
          strokeWidth={3}
          className="group-hover:rotate-90 transition-transform duration-300"
        />
        إضافة منتج
      </button>
    </div>
  </div>

  <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
    <div className="flex items-center gap-2.5 flex-wrap">
      <button
        type="button"
        onClick={() => setStockFilter('all')}
        style={stockFilter === 'all' ? tone.primaryStrong : tone.surface}
        className={`px-4 h-10 rounded-[1rem] border font-black transition-all text-sm ${
          stockFilter === 'all' ? 'shadow-md text-white' : 'app-text'
        }`}
      >
        الكل
      </button>

      <button
        type="button"
        onClick={() => setStockFilter('low')}
        style={stockFilter === 'low' ? tone.dangerSoft : tone.surface}
        className="px-4 h-10 rounded-[1rem] border font-black transition-all app-text text-sm"
      >
        منخفض المخزون
      </button>

      <button
        type="button"
        onClick={() => setStockFilter('expired')}
        style={stockFilter === 'expired' ? tone.dangerSoft : tone.surface}
        className="px-4 h-10 rounded-[1rem] border font-black transition-all app-text text-sm"
      >
        منتهي الصلاحية
      </button>

      <button
        type="button"
        onClick={() => setStockFilter('noImage')}
        style={stockFilter === 'noImage' ? tone.infoSoft : tone.surface}
        className="px-4 h-10 rounded-[1rem] border font-black transition-all app-text text-sm"
      >
        بدون صورة
      </button>
    </div>

    <div className="relative min-w-[210px] max-w-[240px]">
      <select
        value={sortBy}
        onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
        style={tone.surface}
        className="w-full app-card app-text border rounded-[1rem] h-10 px-4 focus:ring-4 outline-none transition-all font-black appearance-none cursor-pointer text-sm"
      >
        <option value="name">ترتيب حسب الاسم</option>
        <option value="stockAsc">الأقل كمية</option>
        <option value="stockDesc">الأعلى كمية</option>
        <option value="expirySoon">الأقرب انتهاء</option>
        <option value="priceDesc">الأعلى سعرًا</option>
      </select>
    </div>
  </div>

  <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
    <div
      className="app-card rounded-[1.5rem] border px-4 py-3 shadow-sm"
      style={tone.surface}
    >
      <div className="text-[10px] font-black tracking-widest app-text-muted mb-1.5">
        النتائج الحالية
      </div>
      <div className="text-2xl font-black app-text leading-none">
        {totalProducts.toLocaleString()}
      </div>
    </div>

    <div
      className="app-card rounded-[1.5rem] border px-4 py-3 shadow-sm"
      style={tone.surface}
    >
      <div className="text-[10px] font-black tracking-widest app-text-muted mb-1.5">
        منخفض المخزون
      </div>
      <div
        className="text-2xl font-black leading-none"
        style={{ color: 'rgb(244, 63, 94)' }}
      >
        {lowStockProducts.toLocaleString()}
      </div>
    </div>

    <div
      className="app-card rounded-[1.5rem] border px-4 py-3 shadow-sm"
      style={tone.surface}
    >
      <div className="text-[10px] font-black tracking-widest app-text-muted mb-1.5">
        منتهي الصلاحية
      </div>
      <div
        className="text-2xl font-black leading-none"
        style={{ color: 'rgb(244, 63, 94)' }}
      >
        {expiredProducts.toLocaleString()}
      </div>
    </div>

    <div
      className="app-card rounded-[1.5rem] border px-4 py-3 shadow-sm"
      style={tone.surface}
    >
      <div className="text-[10px] font-black tracking-widest app-text-muted mb-1.5">
        بدون صورة
      </div>
      <div
        className="text-2xl font-black leading-none"
        style={{ color: 'var(--theme-primary)' }}
      >
        {noImageProducts.toLocaleString()}
      </div>
    </div>
  </div>
</div>
      {viewMode === 'table' ? (
        <div
          className="app-card rounded-[2.5rem] border shadow-sm overflow-hidden overflow-x-auto"
          style={tone.surface}
        >
          <table className="w-full text-right border-collapse">
            <thead>
              <tr
                className="text-[10px] uppercase tracking-[0.2em] font-black border-b"
                style={{
                  background: 'var(--muted-bg)',
                  color: 'var(--text-muted, inherit)',
                  borderColor: 'var(--border-color)'
                }}
              >
                <th className="px-10 py-8">المنتج</th>
                <th className="px-10 py-8">التصنيف</th>
                <th className="px-10 py-8">سعر الشراء</th>
                <th className="px-10 py-8">سعر البيع</th>
                <th className="px-10 py-8">المخزون</th>
                <th className="px-10 py-8">الحالة</th>
                <th className="px-10 py-8 text-left">الإجراءات</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-10 py-32 text-center">
                    <div className="flex flex-col items-center gap-4 app-text-muted">
                      <div
                        className="w-12 h-12 border-4 rounded-full animate-spin"
                        style={{
                          borderColor: 'var(--theme-primary)',
                          borderTopColor: 'transparent'
                        }}
                      />
                      <p className="text-[10px] font-black uppercase tracking-widest">
                        جاري التحميل...
                      </p>
                    </div>
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-10 py-32 text-center">
                    <div className="flex flex-col items-center gap-4 app-text-muted opacity-60">
                      <Package size={80} strokeWidth={1} />
                      <p className="text-[10px] font-black uppercase tracking-widest">
                        لا توجد منتجات مطابقة للبحث
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => (
                  <tr
                    key={p.id}
                    className="transition-all duration-300 group"
                    style={{ borderBottom: '1px solid var(--border-color)' }}
                  >
                    <td className="px-10 py-6">
                      <div className="flex items-center gap-5">
                        <div
                          className="w-16 h-16 app-card rounded-[1.5rem] flex items-center justify-center overflow-hidden border transition-all duration-500 shadow-sm group-hover:shadow-md"
                          style={tone.surface}
                        >
                          {p.image_url ? (
                            <img
                              src={formatImageUrl(p.image_url)}
                              alt={p.name}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <Package size={28} strokeWidth={1.5} className="app-text-muted opacity-30" />
                          )}
                        </div>

                        <div>
                          <div className="font-black app-text text-base mb-1 transition-colors">
                            {p.name}
                          </div>
                          <div className="text-[10px] font-black app-text-muted uppercase tracking-widest">
                            {p.barcode}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-10 py-6">
                      <span
                        className="px-4 py-1.5 text-[9px] font-black rounded-xl uppercase tracking-widest border"
                        style={tone.neutral}
                      >
                        {p.category_name || 'بدون تصنيف'}
                      </span>
                    </td>

                    <td className="px-10 py-6">
                      <div className="text-lg font-bold app-text">{formatMoney(p.purchase_price)}</div>
                      {showUsd && (
                        <div className="text-[10px] font-black app-text-muted tracking-widest">
                          {formatMoney(p.purchase_price, 'USD')}
                        </div>
                      )}
                    </td>

                    <td className="px-10 py-6">
                      <div className="text-lg font-black tracking-tight" style={{ color: 'var(--theme-primary)' }}>
                        {formatMoney(p.sale_price)}
                      </div>
                      {showUsd && (
                        <div
                          className="text-[10px] font-black tracking-widest"
                          style={{ color: 'var(--theme-primary)', opacity: 0.7 }}
                        >
                          {formatMoney(p.sale_price, 'USD')}
                        </div>
                      )}
                    </td>

                    <td className="px-10 py-6">
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-base font-black ${
                            p.stock_quantity <= p.min_stock_level ? '' : 'app-text'
                          }`}
                          style={
                            p.stock_quantity <= p.min_stock_level
                              ? { color: 'rgb(244, 63, 94)' }
                              : undefined
                          }
                        >
                          {p.stock_quantity.toLocaleString()}
                        </span>
                        <span className="text-[10px] font-black app-text-muted uppercase tracking-widest">
                          {p.unit}
                        </span>
                      </div>
                    </td>

                    <td className="px-10 py-6">
                      {p.stock_quantity <= p.min_stock_level ? (
                        <span
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border"
                          style={tone.dangerSoft}
                        >
                          <AlertTriangle size={14} strokeWidth={3} />
                          منخفض
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border"
                          style={tone.successSoft}
                        >
                          متوفر
                        </span>
                      )}
                    </td>

                    <td className="px-10 py-6 text-left">
                      <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-4 group-hover:translate-x-0">
                        <button
                          type="button"
                          onClick={() => handleEdit(p)}
                          className="w-11 h-11 flex items-center justify-center rounded-xl transition-all border shadow-sm"
                          style={tone.infoSoft}
                        >
                          <Edit2 size={18} strokeWidth={2.5} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(p.id)}
                          className="w-11 h-11 flex items-center justify-center rounded-xl transition-all border shadow-sm"
                          style={tone.dangerSoft}
                        >
                          <Trash2 size={18} strokeWidth={2.5} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
          {loading ? (
            Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="app-card rounded-[3rem] p-8 border animate-pulse space-y-8"
                style={tone.surface}
              >
                <div
                  className="aspect-square rounded-[2.5rem]"
                  style={{ background: 'var(--muted-bg)' }}
                />
                <div className="space-y-4">
                  <div
                    className="h-5 rounded-full w-3/4"
                    style={{ background: 'var(--muted-bg)' }}
                  />
                  <div
                    className="h-4 rounded-full w-1/2"
                    style={{ background: 'var(--muted-bg)' }}
                  />
                </div>
              </div>
            ))
          ) : filteredProducts.length === 0 ? (
            <div className="col-span-full py-32 text-center">
              <div className="flex flex-col items-center gap-4 app-text-muted opacity-60">
                <Package size={100} strokeWidth={1} />
                <p className="text-[10px] font-black uppercase tracking-widest">
                  لا توجد منتجات مطابقة للبحث
                </p>
              </div>
            </div>
          ) : (
            filteredProducts.map((p) => (
             <motion.div
  layout
  key={p.id}
  initial={{ opacity: 0, y: 14 }}
  animate={{ opacity: 1, y: 0 }}
  className="app-card rounded-[1.6rem] border shadow-sm hover:shadow-md transition-all duration-300 group overflow-hidden flex flex-col relative"
  style={tone.surface}
>
  <div className="px-3 pt-2.5 pb-2">
    <div className="flex justify-between items-start gap-2">
      <span
        className="px-2.5 py-1 rounded-[0.9rem] text-[10px] font-black border whitespace-nowrap"
        style={tone.neutral}
      >
        {p.category_name || 'بدون تصنيف'}
      </span>

      {isExpired(p.expiry_date) ? (
        <span
          className="px-2.5 py-1 rounded-[0.9rem] text-[10px] font-black shadow-sm flex items-center gap-1 border whitespace-nowrap"
          style={tone.dangerSoft}
        >
          <AlertTriangle size={13} strokeWidth={3} />
          منتهي
        </span>
      ) : p.stock_quantity <= p.min_stock_level ? (
        <span
          className="px-2.5 py-1 rounded-[0.9rem] text-[10px] font-black shadow-sm flex items-center gap-1 border whitespace-nowrap"
          style={tone.dangerSoft}
        >
          <AlertTriangle size={13} strokeWidth={3} />
          منخفض
        </span>
      ) : (
        <span
          className="px-2.5 py-1 rounded-[0.9rem] text-[10px] font-black shadow-sm border whitespace-nowrap"
          style={tone.successSoft}
        >
          {p.stock_quantity.toLocaleString()} {p.unit}
        </span>
      )}
    </div>
  </div>

  <div
    className="relative h-24 overflow-hidden mx-3 rounded-[1.2rem]"
    style={{ background: 'var(--muted-bg)' }}
  >
    {p.image_url ? (
      <img
        src={formatImageUrl(p.image_url)}
        alt={p.name}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
        referrerPolicy="no-referrer"
      />
    ) : (
      <div className="w-full h-full flex items-center justify-center app-text-muted opacity-30">
        <Package size={58} strokeWidth={1.2} />
      </div>
    )}

    <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-3">
      <button
        type="button"
        onClick={() => handleEdit(p)}
        className="w-10 h-10 app-card rounded-[0.9rem] flex items-center justify-center hover:scale-105 transition-all shadow-md active:scale-95 border"
        style={tone.infoSoft}
      >
        <Edit2 size={17} strokeWidth={2.5} />
      </button>
      <button
        type="button"
        onClick={() => handleDelete(p.id)}
        className="w-10 h-10 app-card rounded-[0.9rem] flex items-center justify-center hover:scale-105 transition-all shadow-md active:scale-95 border"
        style={tone.dangerSoft}
      >
        <Trash2 size={17} strokeWidth={2.5} />
      </button>
    </div>
  </div>

  <div className="px-3 pt-2.5 pb-3 flex flex-col gap-2.5">
    <div className="min-w-0">
      <h2 className="font-black app-text text-[1.1rem] leading-tight line-clamp-2 mb-1">
        {p.name}
      </h2>
      <p className="text-[10px] font-black app-text-muted tracking-[0.18em] truncate">
        {p.barcode}
      </p>
    </div>

    <div
      className="grid grid-cols-2 gap-3 pt-3"
      style={{ borderTop: '1px solid var(--border-color)' }}
    >
      <div className="min-w-0">
        <p className="text-[9px] app-text-muted font-black uppercase tracking-widest mb-1">
          الشراء
        </p>
        <p className="text-[0.95rem] font-bold app-text truncate">
          {formatMoney(p.purchase_price)}
        </p>
      </div>

      <div className="min-w-0 text-left">
        <p
          className="text-[9px] font-black uppercase tracking-widest mb-1"
          style={{ color: 'var(--theme-primary)', opacity: 0.8 }}
        >
          البيع
        </p>
        <p
          className="text-[1.15rem] font-black tracking-tight truncate"
          style={{ color: 'var(--theme-primary)' }}
        >
          {formatMoney(p.sale_price)}
        </p>
      </div>
    </div>

    {p.expiry_date && (
      <div
        className="flex items-center justify-between text-[11px] px-3 py-2 rounded-[1rem] border"
        style={tone.neutral}
      >
        <span className="app-text-muted font-black flex items-center gap-1.5 tracking-widest">
          <Calendar size={13} strokeWidth={2.5} className="opacity-60" />
          الصلاحية
        </span>
        <span
          className="font-black"
          style={
            isExpired(p.expiry_date)
              ? { color: 'rgb(244, 63, 94)' }
              : { color: 'inherit' }
          }
        >
          {p.expiry_date}
        </span>
      </div>
    )}
  </div>
</motion.div>
            ))
          )}
        </div>
      )}

      <AnimatePresence>
        {showInventoryPreview && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowInventoryPreview(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            />

            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.98 }}
              transition={{ duration: 0.25 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
            >
              <div
                className="w-full max-w-7xl max-h-[90vh] app-card rounded-[2.5rem] border shadow-2xl overflow-hidden flex flex-col"
                style={tone.surface}
              >
                <div
                  className="px-6 sm:px-8 py-6 border-b"
                  style={{
                    background: 'var(--muted-bg)',
                    borderColor: 'var(--border-color)'
                  }}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-black app-text">عرض كل المخزون</h2>
                      <p className="text-sm app-text-muted font-bold mt-2">
                       عدد العناصر المعروضة: {products.length.toLocaleString()} • إجمالي القطع:{' '}
{products.reduce((sum, p) => sum + Number(p.stock_quantity || 0), 0).toLocaleString()} • منخفض المخزون:{' '}
{products.filter((p) => Number(p.stock_quantity || 0) <= Number(p.min_stock_level || 0)).length.toLocaleString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                      

                      <button
                        type="button"
                        onClick={() => setShowInventoryPreview(false)}
                        className="w-12 h-12 rounded-[1rem] border app-text-muted hover:opacity-80 transition-all flex items-center justify-center"
                        style={tone.surface}
                      >
                        <X size={20} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                </div>

                <div
                  className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-6 border-b"
                  style={{
                    background: 'var(--muted-bg)',
                    borderColor: 'var(--border-color)'
                  }}
                >
                  <div className="app-card rounded-[1.5rem] p-5 border shadow-sm" style={tone.surface}>
                    <div className="app-text-muted text-sm font-black mb-2">إجمالي المنتجات</div>
                    <div className="text-3xl font-black app-text">{totalProducts.toLocaleString()}</div>
                  </div>

                  <div className="app-card rounded-[1.5rem] p-5 border shadow-sm" style={tone.surface}>
                    <div className="app-text-muted text-sm font-black mb-2">إجمالي الكمية</div>
                    <div className="text-3xl font-black" style={{ color: 'var(--theme-primary)' }}>
                      {totalStockQuantity.toLocaleString()}
                    </div>
                  </div>

                  <div className="app-card rounded-[1.5rem] p-5 border shadow-sm" style={tone.surface}>
                    <div className="app-text-muted text-sm font-black mb-2">منخفض المخزون</div>
                    <div className="text-3xl font-black" style={{ color: 'rgb(244, 63, 94)' }}>
                      {lowStockProducts.toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="overflow-auto flex-1 app-card">
                  <table className="w-full text-right border-collapse min-w-[1100px]">
                    <thead
                      className="sticky top-0 z-10"
                      style={{ background: 'var(--muted-bg)' }}
                    >
                      <tr
                        className="border-b text-[11px] uppercase tracking-widest font-black app-text-muted"
                        style={{ borderColor: 'var(--border-color)' }}
                      >
                        <th className="px-6 py-5">المنتج</th>
                        <th className="px-6 py-5">الباركود</th>
                        <th className="px-6 py-5">التصنيف</th>
                        <th className="px-6 py-5">الكمية</th>
                        <th className="px-6 py-5">الوحدة</th>
                        <th className="px-6 py-5">سعر الشراء</th>
                        <th className="px-6 py-5">سعر البيع</th>
                        <th className="px-6 py-5">الصلاحية</th>
                        <th className="px-6 py-5">الحالة</th>
                      </tr>
                    </thead>

                    <tbody>
                      {products.map((p) => (
                        <tr
                          key={p.id}
                          className="transition-all"
                          style={{ borderBottom: '1px solid var(--border-color)' }}
                        >
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-4">
                              <div
                                className="w-14 h-14 rounded-[1.2rem] overflow-hidden border app-card flex items-center justify-center"
                                style={tone.surface}
                              >
                                {p.image_url ? (
                                  <img
                                    src={formatImageUrl(p.image_url)}
                                    alt={p.name}
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <Package size={24} className="app-text-muted opacity-30" />
                                )}
                              </div>
                              <div>
                                <div className="font-black app-text text-base">{p.name}</div>
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-5 app-text-muted font-bold">{p.barcode}</td>

                          <td className="px-6 py-5">
                            <span
                              className="px-3 py-1.5 rounded-xl text-xs font-black border"
                              style={tone.neutral}
                            >
                              {p.category_name || 'بدون تصنيف'}
                            </span>
                          </td>

                          <td className="px-6 py-5">
                            <span
                              className="font-black text-lg"
                              style={
                                p.stock_quantity <= p.min_stock_level
                                  ? { color: 'rgb(244, 63, 94)' }
                                  : { color: 'inherit' }
                              }
                            >
                              {p.stock_quantity.toLocaleString()}
                            </span>
                          </td>

                          <td className="px-6 py-5 app-text-muted font-bold">{p.unit}</td>
                          <td className="px-6 py-5 font-bold app-text">{formatMoney(p.purchase_price)}</td>
                          <td
                            className="px-6 py-5 font-black"
                            style={{ color: 'var(--theme-primary)' }}
                          >
                            {formatMoney(p.sale_price)}
                          </td>
                          <td className="px-6 py-5 app-text-muted font-bold">{p.expiry_date || '-'}</td>

                          <td className="px-6 py-5">
                           {isExpired(p.expiry_date) ? (
  <span
    className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border"
    style={tone.dangerSoft}
  >
    <AlertTriangle size={14} strokeWidth={3} />
    منتهي
  </span>
) : p.stock_quantity <= p.min_stock_level ? (
  <span
    className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border"
    style={tone.dangerSoft}
  >
    <AlertTriangle size={14} strokeWidth={3} />
    منخفض
  </span>
) : (
  <span
    className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border"
    style={tone.successSoft}
  >
    متوفر
  </span>
)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showForm && (
          <ProductForm
            product={editingProduct}
            categories={categories}
            onClose={() => {
              setShowForm(false);
              setEditingProduct(null);
            }}
            onSave={async () => {
              setShowForm(false);
              setEditingProduct(null);

              try {
                await fetchData();
              } catch (error) {
                console.error('onSave fetchData error:', error);
                hardRefreshApp();
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Inventory;