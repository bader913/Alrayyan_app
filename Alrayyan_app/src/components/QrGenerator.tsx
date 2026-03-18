import React, { useMemo, useState } from 'react';
import { QrCode, Printer, Copy, RefreshCw } from 'lucide-react';
import { appAlert } from '../utils/appAlert';

type QrType = 'wifi' | 'shop_name' | 'whatsapp' | 'facebook' | 'custom';

const QrGenerator: React.FC = () => {
  const [qrType, setQrType] = useState<QrType>('phone');
  const [wifiName, setWifiName] = useState('');
const [wifiPassword, setWifiPassword] = useState('');
const [wifiSecurity, setWifiSecurity] = useState<'WPA' | 'WEP' | 'nopass'>('WPA');
  const [shopNameValue, setShopNameValue] = useState('');
  const [whatsAppValue, setWhatsAppValue] = useState('');
  const [facebookValue, setFacebookValue] = useState('');
  const [customValue, setCustomValue] = useState('');
  const [labelTitle, setLabelTitle] = useState('');
  const [labelCount, setLabelCount] = useState('1');
  const [qrSize, setQrSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [copied, setCopied] = useState(false);

  const qrConfig = useMemo(() => {
    if (qrSize === 'small') {
      return {
        qrPx: 120,
        labelWidthCm: 5,
        labelHeightCm: 5.5
      };
    }

    if (qrSize === 'large') {
      return {
        qrPx: 220,
        labelWidthCm: 8,
        labelHeightCm: 8.5
      };
    }

    return {
      qrPx: 170,
      labelWidthCm: 6.5,
      labelHeightCm: 7
    };
  }, [qrSize]);

  const safeLabelCount = Math.max(1, Number(labelCount) || 1);

  const normalizedWhatsAppValue = useMemo(() => {
    const raw = whatsAppValue.trim();
    if (!raw) return '';

    const digitsOnly = raw.replace(/[^\d+]/g, '');
    if (!digitsOnly) return '';

    if (digitsOnly.startsWith('+')) {
      return `https://wa.me/${digitsOnly.replace('+', '')}`;
    }

    return `https://wa.me/${digitsOnly}`;
  }, [whatsAppValue]);

  const normalizedFacebookValue = useMemo(() => {
    const raw = facebookValue.trim();
    if (!raw) return '';

    if (/^https?:\/\//i.test(raw)) return raw;
    return `https://${raw}`;
  }, [facebookValue]);

  const finalQrValue = useMemo(() => {
    if (qrType === 'wifi') {
  const ssid = wifiName.trim().replace(/([;,:\\])/g, '\\$1');
  const password = wifiPassword.trim().replace(/([;,:\\])/g, '\\$1');

  if (!ssid) return '';
  if (wifiSecurity === 'nopass') {
    return `WIFI:T:nopass;S:${ssid};;`;
  }

  return `WIFI:T:${wifiSecurity};S:${ssid};P:${password};;`;
}
    if (qrType === 'shop_name') return shopNameValue.trim();
    if (qrType === 'whatsapp') return normalizedWhatsAppValue;
    if (qrType === 'facebook') return normalizedFacebookValue;
    return customValue.trim();
  }, [
    qrType,
    ,
    shopNameValue,
    wifiName,
    wifiPassword,
    wifiSecurity,

    normalizedWhatsAppValue,
    normalizedFacebookValue,
    customValue
  ]);

  const finalTitle = useMemo(() => {
    if (labelTitle.trim()) return labelTitle.trim();

    
    if (qrType === 'shop_name') return 'اسم المحل';
    if (qrType === 'wifi') return 'شبكة Wi-Fi';
    if (qrType === 'whatsapp') return 'واتساب';
    if (qrType === 'facebook') return 'فيسبوك';
    return 'QR مخصص';
  }, [labelTitle, qrType]);

  const previewQrSrc = useMemo(() => {
    if (!finalQrValue) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=${qrConfig.qrPx}x${qrConfig.qrPx}&data=${encodeURIComponent(finalQrValue)}`;
  }, [finalQrValue, qrConfig.qrPx]);

  const resetFields = () => {

    setShopNameValue('');
    setWhatsAppValue('');
    setFacebookValue('');
    setCustomValue('');
    setLabelTitle('');
    setLabelCount('1');
    setQrSize('medium');
    setCopied(false);
        setWifiName('');
setWifiPassword('');
setWifiSecurity('WPA');
  };

  const handleCopyValue = async () => {
    if (!finalQrValue) return;

    try {
      await navigator.clipboard.writeText(finalQrValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  const handlePrint = () => {
    if (!finalQrValue) {
      appAlert('أدخل قيمة صالحة أولًا لإنشاء QR');
      return;
    }

    const labelsHtml = Array.from({ length: safeLabelCount })
      .map(() => {
        return `
          <div class="qr-label">
            <div class="qr-title">${finalTitle}</div>
            <div class="qr-image-wrap">
              <img
                src="https://api.qrserver.com/v1/create-qr-code/?size=${qrConfig.qrPx}x${qrConfig.qrPx}&data=${encodeURIComponent(finalQrValue)}"
                alt="QR Code"
                class="qr-image"
              />
            </div>
            ${qrType !== 'wifi' ? `<div class="qr-value">${finalQrValue}</div>` : ''}
          </div>
        `;
      })
      .join('');

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return;

    printWindow.document.write(`
      <html dir="rtl">
        <head>
          <title>طباعة QR</title>
          <style>
            * {
              box-sizing: border-box;
              font-family: Arial, sans-serif;
            }

            body {
              margin: 0;
              padding: 0.2cm;
              background: #fff;
              color: #000;
            }

            .labels-grid {
              display: grid;
              grid-template-columns: repeat(auto-fill, ${qrConfig.labelWidthCm}cm);
              gap: 0.2cm;
              justify-content: start;
            }

            .qr-label {
              width: ${qrConfig.labelWidthCm}cm;
              height: ${qrConfig.labelHeightCm}cm;
              border: 1px solid #999;
              border-radius: 0.25cm;
              padding: 0.18cm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: space-between;
              text-align: center;
              page-break-inside: avoid;
              break-inside: avoid;
              overflow: hidden;
              background: #fff;
            }

            .qr-title {
              font-size: ${qrSize === 'small' ? '12px' : qrSize === 'large' ? '18px' : '15px'};
              font-weight: 900;
              line-height: 1.2;
              min-height: 0.7cm;
              display: flex;
              align-items: center;
              justify-content: center;
            }

            .qr-image-wrap {
              flex: 1;
              width: 100%;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 0.1cm 0;
            }

            .qr-image {
              width: ${qrSize === 'small' ? '2.5cm' : qrSize === 'large' ? '4.3cm' : '3.4cm'};
              height: ${qrSize === 'small' ? '2.5cm' : qrSize === 'large' ? '4.3cm' : '3.4cm'};
              object-fit: contain;
            }

            .qr-value {
              font-size: ${qrSize === 'small' ? '9px' : qrSize === 'large' ? '12px' : '10px'};
              font-weight: 700;
              line-height: 1.2;
              word-break: break-word;
              direction: ltr;
              width: 100%;
            }

            @page {
              margin: 0.3cm;
            }

            @media print {
              body {
                padding: 0.1cm;
              }
            }
          </style>
        </head>
        <body>
          <div class="labels-grid">
            ${labelsHtml}
          </div>

          <script>
            window.onload = () => {
              setTimeout(() => {
                window.print();
              }, 250);
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      <div
        className="app-card rounded-[2rem] border p-6 lg:p-8"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h2
              className="text-2xl lg:text-3xl font-black flex items-center gap-3"
              style={{ color: 'var(--text-color)' }}
            >
              <QrCode size={28} style={{ color: 'var(--theme-primary)' }} />
              إنشاء أكواد QR
            </h2>
            <p className="text-sm font-bold mt-2" style={{ color: 'var(--text-muted)' }}>
              أنشئ QR سريع لرقم الهاتف أو اسم المحل أو واتساب أو فيسبوك أو أي رابط مخصص
 - الخدمة تتطلب انترنت حصراً            </p>
          </div>

          <button
            type="button"
            onClick={resetFields}
            className="px-5 py-3 rounded-2xl border font-black flex items-center justify-center gap-2 transition-all"
            style={{
              borderColor: 'var(--border-color)',
              color: 'var(--theme-primary)',
              background: 'var(--card-bg)'
            }}
          >
            <RefreshCw size={18} />
            إعادة ضبط
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <div
                className="text-[10px] font-black uppercase tracking-widest mb-2"
                style={{ color: 'var(--text-muted)' }}
              >
                نوع QR
              </div>

              <select
                value={qrType}
                onChange={(e) => setQrType(e.target.value as QrType)}
                className="w-full app-muted border rounded-2xl py-4 px-4 text-sm font-black outline-none transition-all"
                style={{
                  borderColor: 'var(--border-color)',
                  color: 'var(--theme-primary)'
                }}
              >
                
                <option value="shop_name">اسم المحل</option>
                <option value="wifi">شبكة Wi-Fi</option>
                <option value="whatsapp">رابط واتساب</option>
                <option value="facebook">رابط فيسبوك</option>
                <option value="custom"> محفظة حساب شام كاش </option>
              </select>
            </div>

           {qrType === 'wifi' && (
  <div className="space-y-4">
    <div>
      <div
        className="text-[10px] font-black uppercase tracking-widest mb-2"
        style={{ color: 'var(--text-muted)' }}
      >
        اسم شبكة الواي فاي
      </div>
      <input
        type="text"
        value={wifiName}
        onChange={(e) => setWifiName(e.target.value)}
        placeholder="مثال: AlRayyan_WiFi"
        className="w-full app-muted border rounded-2xl py-4 px-4 text-sm font-black outline-none transition-all"
        style={{ borderColor: 'var(--border-color)', color: 'var(--text-color)' }}
      />
    </div>

    <div>
      <div
        className="text-[10px] font-black uppercase tracking-widest mb-2"
        style={{ color: 'var(--text-muted)' }}
      >
        نوع الحماية
      </div>
      <select
        value={wifiSecurity}
        onChange={(e) => setWifiSecurity(e.target.value as 'WPA' | 'WEP' | 'nopass')}
        className="w-full app-muted border rounded-2xl py-4 px-4 text-sm font-black outline-none transition-all"
        style={{
          borderColor: 'var(--border-color)',
          color: 'var(--theme-primary)'
        }}
      >
        <option value="WPA">WPA / WPA2</option>
        <option value="WEP">WEP</option>
        <option value="nopass">بدون كلمة مرور</option>
      </select>
    </div>

    {wifiSecurity !== 'nopass' && (
      <div>
        <div
          className="text-[10px] font-black uppercase tracking-widest mb-2"
          style={{ color: 'var(--text-muted)' }}
        >
          كلمة مرور الواي فاي
        </div>
        <input
          type="text"
          value={wifiPassword}
          onChange={(e) => setWifiPassword(e.target.value)}
          placeholder="أدخل كلمة المرور"
          className="w-full app-muted border rounded-2xl py-4 px-4 text-sm font-black outline-none transition-all"
          style={{ borderColor: 'var(--border-color)', color: 'var(--text-color)' }}
        />
      </div>
    )}
  </div>
)}

            {qrType === 'shop_name' && (
              <div>
                <div
                  className="text-[10px] font-black uppercase tracking-widest mb-2"
                  style={{ color: 'var(--text-muted)' }}
                >
                  اسم المحل
                </div>
                <input
                  type="text"
                  value={shopNameValue}
                  onChange={(e) => setShopNameValue(e.target.value)}
                  placeholder="مثال: سوبر ماركت الريان"
                  className="w-full app-muted border rounded-2xl py-4 px-4 text-sm font-black outline-none transition-all"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-color)' }}
                />
              </div>
            )}

            {qrType === 'whatsapp' && (
              <div>
                <div
                  className="text-[10px] font-black uppercase tracking-widest mb-2"
                  style={{ color: 'var(--text-muted)' }}
                >
                  رقم واتساب
                </div>
                <input
                  type="text"
                  value={whatsAppValue}
                  onChange={(e) => setWhatsAppValue(e.target.value)}
                  placeholder="مثال: +963987654321"
                  className="w-full app-muted border rounded-2xl py-4 px-4 text-sm font-black outline-none transition-all"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-color)' }}
                />
              </div>
            )}

            {qrType === 'facebook' && (
              <div>
                <div
                  className="text-[10px] font-black uppercase tracking-widest mb-2"
                  style={{ color: 'var(--text-muted)' }}
                >
                  رابط فيسبوك
                </div>
                <input
                  type="text"
                  value={facebookValue}
                  onChange={(e) => setFacebookValue(e.target.value)}
                  placeholder="مثال: facebook.com/yourpage أو https://facebook.com/yourpage"
                  className="w-full app-muted border rounded-2xl py-4 px-4 text-sm font-black outline-none transition-all"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-color)' }}
                />
              </div>
            )}

            {qrType === 'custom' && (
              <div>
                <div
                  className="text-[10px] font-black uppercase tracking-widest mb-2"
                  style={{ color: 'var(--text-muted)' }}
                >
                 رابط حساب الشام كاش محفظة 
                </div>
                <textarea
                  value={customValue}
                  onChange={(e) => setCustomValue(e.target.value)}
                  placeholder="أدخل أي نص أو رابط تريد تحويله إلى QR"
                  rows={4}
                  className="w-full app-muted border rounded-2xl py-4 px-4 text-sm font-black outline-none transition-all resize-none"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-color)' }}
                />
              </div>
            )}

            <div>
              <div
                className="text-[10px] font-black uppercase tracking-widest mb-2"
                style={{ color: 'var(--text-muted)' }}
              >
                عنوان الملصق
              </div>
              <input
                type="text"
                value={labelTitle}
                onChange={(e) => setLabelTitle(e.target.value)}
                placeholder="اختياري - مثال: تابعنا على واتساب"
                className="w-full app-muted border rounded-2xl py-4 px-4 text-sm font-black outline-none transition-all"
                style={{ borderColor: 'var(--border-color)', color: 'var(--text-color)' }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div
                  className="text-[10px] font-black uppercase tracking-widest mb-2"
                  style={{ color: 'var(--text-muted)' }}
                >
                  عدد النسخ
                </div>
                <input
                  type="number"
                  min="1"
                  value={labelCount}
                  onChange={(e) => setLabelCount(e.target.value)}
                  className="w-full app-muted border rounded-2xl py-4 px-4 text-sm font-black outline-none transition-all"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-color)' }}
                />
              </div>

              <div>
                <div
                  className="text-[10px] font-black uppercase tracking-widest mb-2"
                  style={{ color: 'var(--text-muted)' }}
                >
                  المقاس
                </div>
                <select
                  value={qrSize}
                  onChange={(e) => setQrSize(e.target.value as 'small' | 'medium' | 'large')}
                  className="w-full app-muted border rounded-2xl py-4 px-4 text-sm font-black outline-none transition-all"
                  style={{
                    borderColor: 'var(--border-color)',
                    color: 'var(--theme-primary)'
                  }}
                >
                  <option value="small">صغير</option>
                  <option value="medium">متوسط</option>
                  <option value="large">كبير</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handlePrint}
                disabled={!finalQrValue}
                className="w-full px-6 py-4 rounded-2xl text-white font-black transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                style={{ background: 'var(--theme-primary)' }}
              >
                <Printer size={20} />
                طباعة QR
              </button>

              <button
                type="button"
                onClick={handleCopyValue}
                disabled={!finalQrValue}
                className="w-full px-6 py-4 rounded-2xl border font-black transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                style={{
                  borderColor: 'var(--border-color)',
                  background: 'var(--card-bg)',
                  color: copied ? '#16a34a' : 'var(--theme-primary)'
                }}
              >
                <Copy size={20} />
                {copied ? 'تم النسخ' : 'نسخ القيمة'}
              </button>
            </div>
          </div>

          <div
            className="app-muted rounded-[2rem] border p-6 min-h-[360px]"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <div
              className="text-[10px] font-black uppercase tracking-widest mb-4"
              style={{ color: 'var(--text-muted)' }}
            >
              معاينة سريعة
            </div>

            {!finalQrValue ? (
              <div
                className="h-full min-h-[260px] flex items-center justify-center text-center font-black"
                style={{ color: 'var(--text-muted)' }}
              >
                اختر النوع وأدخل القيمة لعرض QR
              </div>
            ) : (
              <div className="max-w-md mx-auto bg-white text-black rounded-3xl border border-gray-300 p-6 text-center shadow-sm min-h-[300px] flex flex-col justify-between">
                <div className="text-lg font-black leading-tight">
                  {finalTitle}
                </div>

                <div className="flex justify-center py-4">
                  <img
                    src={previewQrSrc}
                    alt="QR Preview"
                    className="rounded-2xl border border-gray-200"
                    style={{
                      width: qrSize === 'small' ? 140 : qrSize === 'large' ? 240 : 190,
                      height: qrSize === 'small' ? 140 : qrSize === 'large' ? 240 : 190
                    }}
                  />
                </div>

                {qrType !== 'wifi' && (
  <div className="text-sm font-bold break-words" dir="ltr">
    {finalQrValue}
  </div>
)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QrGenerator;