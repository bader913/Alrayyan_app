import { apiClient } from './client.ts';

export interface DashboardStats {
  sales: {
    today:  { count: number; total: number };
    week:   { count: number; total: number };
    month:  { count: number; total: number };
  };
  purchases: {
    month: { count: number; total: number };
  };
  receivables: {
    customerDebt:    number;
    supplierBalance: number;
  };
  cashFlow: {
    salesCash:     number;
    purchasesCash: number;
    net:           number;
  };
  topProducts: Array<{
    product_name: string;
    total_qty:     string;
    total_revenue: string;
  }>;
  lowStock: Array<{
    id:              number;
    name:            string;
    stock_quantity:  string;
    min_stock_level: string;
  }>;
  recentSales: Array<{
    id:             number;
    invoice_number: string;
    total_amount:   string;
    created_at:     string;
    customer_name:  string | null;
  }>;
}

export const dashboardApi = {
  getStats: () =>
    apiClient.get<{ success: boolean; stats: DashboardStats }>('/dashboard/stats'),
};
