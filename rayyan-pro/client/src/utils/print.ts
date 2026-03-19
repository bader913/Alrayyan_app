import type { Sale } from '../api/pos.ts';

const fmtNum = (n: string | number) =>
  parseFloat(String(n)).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

const PAYMENT_LABELS: Record<string, string> = {
  cash:   'نقداً',
  card:   'شام كاش',
  credit: 'آجل',
  mixed:  'مختلط',
};

export interface PrintCurrency {
  symbol: string;
  rate:   number;
}

export function printInvoice(
  sale: Sale,
  storeName = 'ريان برو',
  currency: PrintCurrency = { symbol: 'ل.س', rate: 1 },
) {
  const { symbol, rate } = currency;

  // Convert a USD amount to display currency and format it
  const fmtC = (usd: string | number): string =>
    `${fmtNum(parseFloat(String(usd)) * rate)} ${symbol}`;

  const due    = parseFloat(sale.total_amount) - parseFloat(sale.paid_amount);
  const change = parseFloat(sale.paid_amount)  - parseFloat(sale.total_amount);

  const itemRows = sale.items
    .map((item) => {
      const qty  = parseFloat(item.quantity);
      const unit = item.is_weighted ? `${qty.toFixed(3)} كغ` : `${qty} ${item.unit}`;
      const disc = parseFloat(item.discount) > 0
        ? `<span style="color:#ef4444;font-size:11px;"> (-${fmtC(item.discount)})</span>`
        : '';
      return `
        <tr>
          <td style="padding:6px 4px;border-bottom:1px dotted #e2e8f0;font-size:13px;">
            ${item.product_name}
            ${item.price_type === 'wholesale' ? '<span style="font-size:10px;color:#0891b2;"> (جملة)</span>' : ''}
            ${item.price_type === 'custom'    ? '<span style="font-size:10px;color:#7c3aed;"> (مخصص)</span>' : ''}
          </td>
          <td style="padding:6px 4px;border-bottom:1px dotted #e2e8f0;text-align:center;font-size:12px;">${unit}</td>
          <td style="padding:6px 4px;border-bottom:1px dotted #e2e8f0;text-align:center;font-size:12px;">${fmtC(item.unit_price)}</td>
          <td style="padding:6px 4px;border-bottom:1px dotted #e2e8f0;text-align:left;font-size:13px;font-weight:700;">
            ${fmtC(item.total_price)}${disc}
          </td>
        </tr>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8"/>
<title>فاتورة ${sale.invoice_number}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',Tahoma,Arial,sans-serif; font-size:13px; color:#1e293b; }
  .page { max-width:340px; margin:0 auto; padding:16px; }
  h1 { font-size:18px; font-weight:900; color:#059669; text-align:center; }
  .sub { text-align:center; font-size:11px; color:#64748b; margin-bottom:12px; }
  .divider { border:none; border-top:2px dashed #e2e8f0; margin:10px 0; }
  table { width:100%; border-collapse:collapse; }
  th { font-size:11px; color:#64748b; font-weight:700; padding:4px; border-bottom:2px solid #e2e8f0; }
  .totals td { padding:4px 4px; font-size:13px; }
  .totals .big { font-size:16px; font-weight:900; color:#059669; }
  .footer { text-align:center; font-size:11px; color:#94a3b8; margin-top:14px; }
  @media print {
    @page { margin:6mm; }
    body { print-color-adjust:exact; -webkit-print-color-adjust:exact; }
  }
</style>
</head>
<body>
<div class="page">
  <h1>${storeName}</h1>
  <div class="sub">فاتورة بيع · ${sale.terminal_name ?? ''}</div>
  <hr class="divider"/>

  <table style="margin-bottom:4px;">
    <tr>
      <td style="font-size:11px;color:#64748b;">رقم الفاتورة</td>
      <td style="font-weight:700;text-align:left;">${sale.invoice_number}</td>
    </tr>
    <tr>
      <td style="font-size:11px;color:#64748b;">التاريخ</td>
      <td style="text-align:left;font-size:12px;">
        ${new Date(sale.created_at).toLocaleString('en-US')}
      </td>
    </tr>
    <tr>
      <td style="font-size:11px;color:#64748b;">الكاشير</td>
      <td style="text-align:left;font-size:12px;">${sale.cashier_name}</td>
    </tr>
    ${sale.customer_name ? `
    <tr>
      <td style="font-size:11px;color:#64748b;">العميل</td>
      <td style="text-align:left;font-size:12px;">${sale.customer_name}</td>
    </tr>` : ''}
    <tr>
      <td style="font-size:11px;color:#64748b;">نوع البيع</td>
      <td style="text-align:left;font-size:12px;">${sale.sale_type === 'wholesale' ? 'جملة' : 'مفرق'}</td>
    </tr>
  </table>

  <hr class="divider"/>

  <table>
    <thead>
      <tr>
        <th style="text-align:right;">المنتج</th>
        <th style="text-align:center;">الكمية</th>
        <th style="text-align:center;">السعر</th>
        <th style="text-align:left;">المجموع</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <hr class="divider"/>

  <table class="totals">
    <tr>
      <td>المجموع الفرعي</td>
      <td style="text-align:left;">${fmtC(sale.subtotal)}</td>
    </tr>
    ${parseFloat(sale.discount) > 0 ? `
    <tr>
      <td style="color:#ef4444;">الخصم</td>
      <td style="text-align:left;color:#ef4444;">- ${fmtC(sale.discount)}</td>
    </tr>` : ''}
    <tr>
      <td class="big">الإجمالي</td>
      <td class="big" style="text-align:left;">${fmtC(sale.total_amount)}</td>
    </tr>
    <tr>
      <td style="color:#64748b;">طريقة الدفع</td>
      <td style="text-align:left;font-weight:700;">${PAYMENT_LABELS[sale.payment_method] ?? sale.payment_method}</td>
    </tr>
    ${parseFloat(sale.paid_amount) > 0 ? `
    <tr>
      <td>المدفوع</td>
      <td style="text-align:left;">${fmtC(sale.paid_amount)}</td>
    </tr>` : ''}
    ${change > 0 ? `
    <tr>
      <td style="color:#059669;">الباقي للعميل</td>
      <td style="text-align:left;color:#059669;font-weight:700;">${fmtC(change)}</td>
    </tr>` : ''}
    ${due > 0.001 ? `
    <tr>
      <td style="color:#ef4444;">المتبقي (آجل)</td>
      <td style="text-align:left;color:#ef4444;font-weight:700;">${fmtC(due)}</td>
    </tr>` : ''}
  </table>

  <hr class="divider"/>
  <div class="footer">شكراً لزيارتكم · ${storeName}</div>
</div>
<script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); };</script>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=400,height=600');
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}
