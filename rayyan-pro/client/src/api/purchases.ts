import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export interface PurchaseItem {
  id:            number;
  product_id:    number;
  product_name:  string;
  barcode:       string;
  unit:          string;
  quantity:      number;
  unit_price:    number;
  total_price:   number;
}

export interface Purchase {
  id:                number;
  invoice_number:    string;
  supplier_name:     string | null;
  supplier_id:       number | null;
  created_by:        string;
  total_amount:      number;
  paid_amount:       number;
  due_amount:        number;
  purchase_currency: string;
  exchange_rate:     number;
  notes:             string | null;
  created_at:        string;
  items?:            PurchaseItem[];
}

export interface PurchaseItemInput {
  product_id: number;
  quantity:   number;
  unit_price: number;
}

export interface CreatePurchasePayload {
  supplier_id?:      number | null;
  items:             PurchaseItemInput[];
  paid_amount:       number;
  purchase_currency: string;
  exchange_rate:     number;
  notes?:            string;
}

export const purchasesApi = {
  list: (params?: Record<string, string | number>) =>
    api.get<{ success: boolean; purchases: Purchase[]; total: number }>('/purchases', { params }),

  getById: (id: number) =>
    api.get<{ success: boolean; purchase: Purchase }>(`/purchases/${id}`),

  create: (payload: CreatePurchasePayload) =>
    api.post<{ success: boolean; purchaseId: number; invoiceNumber: string; totalAmount: number }>('/purchases', payload),

  addPayment: (id: number, amount: number) =>
    api.post<{ success: boolean; message: string }>(`/purchases/${id}/payment`, { amount }),
};
