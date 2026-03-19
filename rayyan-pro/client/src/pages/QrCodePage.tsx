import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { QrCode, Printer, Copy, Wifi, MessageSquare, Link, Download } from 'lucide-react';

type QrType = 'text' | 'url' | 'wifi';

const WIFI_SECURITY = ['WPA', 'WEP', 'nopass'];

export default function QrCodePage() {
  const [qrType,    setQrType]    = useState<QrType>('text');
  const [textVal,   setTextVal]   = useState('');
  const [urlVal,    setUrlVal]    = useState('https://');
  const [wifiSsid,  setWifiSsid]  = useState('');
  const [wifiPass,  setWifiPass]  = useState('');
  const [wifiSec,   setWifiSec]   = useState('WPA');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copies,    setCopies]    = useState(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const getContent = (): string => {
    if (qrType === 'text') return textVal;
    if (qrType === 'url')  return urlVal;
    if (qrType === 'wifi') {
      const pass = wifiSec === 'nopass' ? '' : wifiPass;
      return `WIFI:T:${wifiSec};S:${wifiSsid};P:${pass};;`;
    }
    return '';
  };

  useEffect(() => {
    const content = getContent();
    if (!content || content === 'https://') { setQrDataUrl(null); return; }
    QRCode.toDataURL(content, {
      width: 400, margin: 2,
      color: { dark: '#1e293b', light: '#ffffff' },
      errorCorrectionLevel: 'H',
    }).then(setQrDataUrl).catch(() => setQrDataUrl(null));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrType, textVal, urlVal, wifiSsid, wifiPass, wifiSec]);

  const handlePrint = () => {
    if (!qrDataUrl) return;
    const items = Array.from({ length: copies }).map(() =>
      `<div class="qr-item"><img src="${qrDataUrl}" /><p class="label">${getContent()}</p></div>`
    ).join('');
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>طباعة QR كود</title>
      <style>
        body { margin: 0; font-family: sans-serif; direction: rtl; }
        .grid { display: flex; flex-wrap: wrap; gap: 16px; padding: 16px; }
        .qr-item { display: flex; flex-direction: column; align-items: center; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; }
        .qr-item img { width: 180px; height: 180px; }
        .label { font-size: 10px; max-width: 180px; text-align: center; word-break: break-all; margin-top: 6px; color: #475569; }
        @media print { @page { margin: 1cm; } }
      </style></head>
      <body><div class="grid">${items}</div>
      <script>window.onload=()=>{ window.print(); window.close(); }<\/script>
      </body></html>`);
    win.document.close();
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = 'qrcode.png';
    a.click();
  };

  const TYPE_TABS: { id: QrType; icon: React.ElementType; label: string }[] = [
    { id: 'text', icon: MessageSquare, label: 'نص عادي' },
    { id: 'url',  icon: Link,          label: 'رابط URL' },
    { id: 'wifi', icon: Wifi,          label: 'شبكة WiFi' },
  ];

  return (
    <div className="p-6 max-w-3xl mx-auto" dir="rtl">
      <div className="mb-6">
        <h1 className="text-2xl font-black mb-1" style={{ color: 'var(--text-heading)' }}>
          منشئ QR كود
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          توليد رموز QR للنصوص والروابط وشبكات WiFi مع إمكانية الطباعة
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Settings */}
        <div className="flex flex-col gap-4">
          {/* Type selector */}
          <div
            className="rounded-2xl p-4"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <div className="text-xs font-black mb-3" style={{ color: 'var(--text-muted)' }}>
              نوع QR الكود
            </div>
            <div className="grid grid-cols-3 gap-2">
              {TYPE_TABS.map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  onClick={() => setQrType(id)}
                  className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-xs font-black transition-colors"
                  style={qrType === id
                    ? { background: 'var(--primary)', color: '#fff' }
                    : { background: 'var(--bg-muted)', color: 'var(--text-secondary)' }}
                >
                  <Icon size={18} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Input fields */}
          <div
            className="rounded-2xl p-4 flex flex-col gap-3"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            {qrType === 'text' && (
              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  النص
                </label>
                <textarea
                  rows={4}
                  value={textVal}
                  onChange={(e) => setTextVal(e.target.value)}
                  placeholder="اكتب النص هنا..."
                  className="w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none resize-none"
                  style={{
                    background: 'var(--bg-muted)',
                    borderColor: 'var(--border)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
            )}

            {qrType === 'url' && (
              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  الرابط
                </label>
                <input
                  type="url"
                  value={urlVal}
                  onChange={(e) => setUrlVal(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none"
                  style={{
                    background: 'var(--bg-muted)',
                    borderColor: 'var(--border)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
            )}

            {qrType === 'wifi' && (
              <>
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    اسم الشبكة (SSID)
                  </label>
                  <input
                    type="text"
                    value={wifiSsid}
                    onChange={(e) => setWifiSsid(e.target.value)}
                    placeholder="MyWiFiNetwork"
                    className="w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none"
                    style={{
                      background: 'var(--bg-muted)',
                      borderColor: 'var(--border)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    نوع الحماية
                  </label>
                  <select
                    value={wifiSec}
                    onChange={(e) => setWifiSec(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none"
                    style={{
                      background: 'var(--bg-muted)',
                      borderColor: 'var(--border)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {WIFI_SECURITY.map((s) => (
                      <option key={s} value={s}>{s === 'nopass' ? 'بدون كلمة مرور' : s}</option>
                    ))}
                  </select>
                </div>
                {wifiSec !== 'nopass' && (
                  <div>
                    <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      كلمة المرور
                    </label>
                    <input
                      type="text"
                      value={wifiPass}
                      onChange={(e) => setWifiPass(e.target.value)}
                      placeholder="كلمة مرور الشبكة"
                      className="w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none"
                      style={{
                        background: 'var(--bg-muted)',
                        borderColor: 'var(--border)',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </div>
                )}
              </>
            )}
          </div>

          {/* Print copies */}
          <div
            className="rounded-2xl p-4 flex items-center gap-4"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <span className="text-sm font-bold flex-1" style={{ color: 'var(--text-secondary)' }}>
              عدد النسخ للطباعة
            </span>
            <div className="flex items-center gap-2">
              <button onClick={() => setCopies((c) => Math.max(1, c - 1))}
                className="w-8 h-8 rounded-lg font-black text-lg flex items-center justify-center"
                style={{ background: 'var(--bg-muted)', color: 'var(--text-primary)' }}>−</button>
              <span className="w-8 text-center font-black tabular-nums" style={{ color: 'var(--text-primary)' }}>
                {copies}
              </span>
              <button onClick={() => setCopies((c) => Math.min(50, c + 1))}
                className="w-8 h-8 rounded-lg font-black text-lg flex items-center justify-center"
                style={{ background: 'var(--bg-muted)', color: 'var(--text-primary)' }}>+</button>
            </div>
          </div>
        </div>

        {/* Right: Preview + Actions */}
        <div className="flex flex-col gap-4">
          <div
            className="rounded-2xl p-6 flex flex-col items-center gap-4"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <div className="text-xs font-black" style={{ color: 'var(--text-muted)' }}>معاينة</div>
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="QR Code"
                className="rounded-xl shadow-sm"
                style={{ width: 220, height: 220 }}
              />
            ) : (
              <div
                className="flex flex-col items-center justify-center gap-3 rounded-xl"
                style={{ width: 220, height: 220, background: 'var(--bg-muted)', color: 'var(--text-muted)' }}
              >
                <QrCode size={48} />
                <span className="text-xs">أدخل المحتوى للمعاينة</span>
              </div>
            )}
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handlePrint}
              disabled={!qrDataUrl}
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black text-white disabled:opacity-40 transition-opacity hover:opacity-90"
              style={{ background: 'var(--primary)' }}
            >
              <Printer size={16} />
              طباعة {copies > 1 ? `(${copies})` : ''}
            </button>
            <button
              onClick={handleDownload}
              disabled={!qrDataUrl}
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black disabled:opacity-40 transition-colors"
              style={{
                background: 'var(--bg-muted)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
              }}
            >
              <Download size={16} />
              تنزيل PNG
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
