import { apiClient } from './client.ts';

export const reportsApi = {
  sales: (params: { from: string; to: string; customer_id?: number; page?: number }) => {
    const qs = new URLSearchParams({ from: params.from, to: params.to });
    if (params.customer_id) qs.set('customer_id', String(params.customer_id));
    if (params.page) qs.set('page', String(params.page));
    return apiClient.get<{
      success: boolean;
      data: Array<{
        id: number; invoice_number: string; total_amount: string; discount_amount: string;
        paid_amount: string; payment_status: string; payment_method: string;
        created_at: string; customer_name: string | null; cashier_name: string | null;
      }>;
      summary: { totalRevenue: number; totalPaid: number; totalDiscount: number; invoiceCount: number };
      total: number; page: number; limit: number;
    }>(`/reports/sales?${qs}`),
  },

  purchases: (params: { from: string; to: string; supplier_id?: number; page?: number }) => {
    const qs = new URLSearchParams({ from: params.from, to: params.to });
    if (params.supplier_id) qs.set('supplier_id', String(params.supplier_id));
    if (params.page) qs.set('page', String(params.page));
    return apiClient.get<{
      success: boolean;
      data: Array<{
        id: number; invoice_number: string; total_amount: string; paid_amount: string;
        payment_status: string; created_at: string; supplier_name: string | null; created_by_name: string | null;
      }>;
      summary: { totalAmount: number; totalPaid: number; totalDebt: number; count: number };
      total: number; page: number; limit: number;
    }>(`/reports/purchases?${qs}`),
  },

  stock: (params?: { q?: string; category_id?: number; low_stock?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set('q', params.q);
    if (params?.category_id) qs.set('category_id', String(params.category_id));
    if (params?.low_stock) qs.set('low_stock', 'true');
    return apiClient.get<{
      success: boolean;
      data: Array<{
        id: number; sku: string; name: string; stock_quantity: string; min_stock_level: string;
        wholesale_price: string; retail_price: string; cost_price: string; category_name: string | null;
      }>;
      summary: { totalProducts: number; totalStockValue: number; lowStockCount: number };
    }>(`/reports/stock${qs.toString() ? `?${qs}` : ''}`),
  },

  profit: (params: { from: string; to: string }) =>
    apiClient.get<{
      success: boolean;
      data: Array<{
        id: number; product_name: string; sku: string;
        total_sold: string; total_revenue: string; total_cost: string; gross_profit: string;
      }>;
      summary: { totalRevenue: number; totalCost: number; grossProfit: number; margin: number };
      from: string; to: string;
    }>(`/reports/profit?from=${params.from}&to=${params.to}`),
};
