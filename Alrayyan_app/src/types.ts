export interface User {
  is_protected_admin?: number;
  id: number;
  username: string;
  full_name: string;
  role: 'admin' | 'cashier' | 'warehouse';
  avatar_url?: string | null;
  created_at?: string;
}

export interface Category {
  id: number;
  name: string;
}

export interface Product {
  id: number;
  barcode: string;
  name: string;
  category_id: number;
  category_name?: string;
  unit: string;
  purchase_price: number;
  sale_price: number;
  stock_quantity: number;
  min_stock_level: number;
  expiry_date?: string;
  image_url?: string;
  supplier_id?: number;
  supplier_name?: string;
  notes?: string;
}

export interface Supplier {
  id: number;
  name: string;
  phone: string;
  address: string;
  balance: number;
}

export interface Customer {
  id: number;
  name: string;
  phone: string;
  address: string;
  balance: number;
}

export interface Sale {
  id: number;
  customer_id?: number;
  customer_name?: string;
  total_amount: number;
  discount: number;
  paid_amount: number;
  payment_method: 'cash' | 'card' | 'credit';
  user_id: number;
  user_name?: string;
  created_at: string;
}

export interface SaleItem {
  id: number;
  sale_id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface Expense {
  id: number;
  description: string;
  amount: number;
  category: string;
  created_at: string;
  user_id: number;
}
export interface Purchase {
  id: number;
  supplier_id?: number;
  supplier_name?: string;
  total_amount: number;
  paid_amount: number;
  user_id: number;
  user_name?: string;
  created_at: string;
}

export interface PurchaseItem {
  id: number;
  purchase_id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface AccountTransaction {
  id: number;
  transaction_type: 'sale' | 'purchase' | 'payment' | 'adjustment';
  reference_id?: number | null;
  reference_type?: string | null;
  debit_amount: number;
  credit_amount: number;
  balance_after: number;
  amount_original?: number | null;
  currency_code?: 'USD' | 'TRY' | 'SAR' | 'AED' | 'SYP' | null;
  exchange_rate?: number | null;
  note?: string | null;
  created_at: string;
  user_name?: string;
}



interface Window {
  electronAPI?: {
    openExternalLink?: (url: string) => Promise<boolean>;
  };
}