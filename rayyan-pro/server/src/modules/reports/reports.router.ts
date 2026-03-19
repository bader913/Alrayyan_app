import type { FastifyInstance } from 'fastify';
import { dbAll, dbGet } from '../../shared/db/pool.js';
import { requireRole, ROLES } from '../../shared/middleware/requireRole.js';

// حالة الدفع المستنتجة من paid_amount vs total_amount
const PAYMENT_STATUS_EXPR = `
  CASE
    WHEN paid_amount >= total_amount THEN 'paid'
    WHEN paid_amount > 0             THEN 'partial'
    ELSE 'unpaid'
  END`;

export async function reportsRoutes(fastify: FastifyInstance) {

  // ──────────────────────────────────────────────────────
  // تقرير المبيعات
  // ──────────────────────────────────────────────────────
  fastify.get(
    '/api/reports/sales',
    { onRequest: [fastify.authenticate, requireRole(ROLES.ADMIN_MANAGER)] },
    async (request) => {
      const q = request.query as Record<string, string>;
      const from  = q.from  || new Date(new Date().setDate(1)).toISOString().split('T')[0];
      const to    = q.to    || new Date().toISOString().split('T')[0];
      const limit = Math.min(parseInt(q.limit || '200'), 500);
      const page  = Math.max(1, parseInt(q.page  || '1'));
      const offset = (page - 1) * limit;

      const conditions = [`s.created_at::date BETWEEN $1 AND $2`];
      const params: unknown[] = [from, to];
      let idx = 3;

      if (q.customer_id) { conditions.push(`s.customer_id = $${idx++}`); params.push(q.customer_id); }

      const where = conditions.join(' AND ');

      const [countRow, rows, summary] = await Promise.all([
        dbGet<{ total: string }>(`SELECT COUNT(*) AS total FROM sales s WHERE ${where}`, params),
        dbAll(`
          SELECT s.id, s.invoice_number, s.total_amount, s.discount AS discount_amount,
                 s.paid_amount, s.payment_method, s.created_at, s.customer_id,
                 ${PAYMENT_STATUS_EXPR} AS payment_status,
                 c.name AS customer_name, u.full_name AS cashier_name
          FROM sales s
          LEFT JOIN customers c ON c.id = s.customer_id
          LEFT JOIN users u ON u.id = s.user_id
          WHERE ${where}
          ORDER BY s.created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `, params),
        dbGet<{ total_revenue: string; total_paid: string; total_discount: string; invoice_count: string }>(`
          SELECT COALESCE(SUM(total_amount),0)  AS total_revenue,
                 COALESCE(SUM(paid_amount),0)   AS total_paid,
                 COALESCE(SUM(discount),0)      AS total_discount,
                 COUNT(*) AS invoice_count
          FROM sales s WHERE ${where}
        `, params),
      ]);

      return {
        success: true,
        data: rows,
        summary: {
          totalRevenue:  parseFloat(summary?.total_revenue  ?? '0'),
          totalPaid:     parseFloat(summary?.total_paid     ?? '0'),
          totalDiscount: parseFloat(summary?.total_discount ?? '0'),
          invoiceCount:  parseInt(summary?.invoice_count    ?? '0'),
        },
        total: parseInt(countRow?.total ?? '0'),
        page, limit,
      };
    }
  );

  // ──────────────────────────────────────────────────────
  // تقرير المشتريات
  // ──────────────────────────────────────────────────────
  fastify.get(
    '/api/reports/purchases',
    { onRequest: [fastify.authenticate, requireRole(ROLES.STOCK_TEAM)] },
    async (request) => {
      const q = request.query as Record<string, string>;
      const from  = q.from  || new Date(new Date().setDate(1)).toISOString().split('T')[0];
      const to    = q.to    || new Date().toISOString().split('T')[0];
      const limit = Math.min(parseInt(q.limit || '200'), 500);
      const page  = Math.max(1, parseInt(q.page || '1'));
      const offset = (page - 1) * limit;

      const conditions = [`p.created_at::date BETWEEN $1 AND $2`];
      const params: unknown[] = [from, to];
      let idx = 3;

      if (q.supplier_id) { conditions.push(`p.supplier_id = $${idx++}`); params.push(q.supplier_id); }

      const where = conditions.join(' AND ');

      const [countRow, rows, summary] = await Promise.all([
        dbGet<{ total: string }>(`SELECT COUNT(*) AS total FROM purchases p WHERE ${where}`, params),
        dbAll(`
          SELECT p.id, p.invoice_number, p.total_amount, p.paid_amount,
                 p.created_at, p.supplier_id,
                 ${PAYMENT_STATUS_EXPR.replace(/paid_amount/g, 'p.paid_amount').replace(/total_amount/g, 'p.total_amount')} AS payment_status,
                 s.name AS supplier_name, u.full_name AS created_by_name
          FROM purchases p
          LEFT JOIN suppliers s ON s.id = p.supplier_id
          LEFT JOIN users u ON u.id = p.user_id
          WHERE ${where}
          ORDER BY p.created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `, params),
        dbGet<{ total_amount: string; total_paid: string; count: string }>(`
          SELECT COALESCE(SUM(total_amount),0) AS total_amount,
                 COALESCE(SUM(paid_amount),0)  AS total_paid,
                 COUNT(*) AS count
          FROM purchases p WHERE ${where}
        `, params),
      ]);

      return {
        success: true,
        data: rows,
        summary: {
          totalAmount: parseFloat(summary?.total_amount ?? '0'),
          totalPaid:   parseFloat(summary?.total_paid   ?? '0'),
          totalDebt:   parseFloat(summary?.total_amount ?? '0') - parseFloat(summary?.total_paid ?? '0'),
          count:       parseInt(summary?.count          ?? '0'),
        },
        total: parseInt(countRow?.total ?? '0'),
        page, limit,
      };
    }
  );

  // ──────────────────────────────────────────────────────
  // تقرير المخزون الحالي
  // ──────────────────────────────────────────────────────
  fastify.get(
    '/api/reports/stock',
    { onRequest: [fastify.authenticate, requireRole(ROLES.STOCK_TEAM)] },
    async (request) => {
      const { q, category_id, low_stock } = request.query as Record<string, string>;

      const conditions: string[] = ['p.is_active = true'];
      const params: unknown[] = [];
      let idx = 1;

      if (q) {
        conditions.push(`(p.name ILIKE $${idx} OR p.barcode ILIKE $${idx})`);
        params.push(`%${q}%`); idx++;
      }
      if (category_id) {
        conditions.push(`p.category_id = $${idx++}`);
        params.push(category_id);
      }
      if (low_stock === 'true') {
        conditions.push(`p.stock_quantity <= p.min_stock_level`);
      }

      const where = conditions.join(' AND ');

      const [rows, summary] = await Promise.all([
        dbAll(`
          SELECT p.id, p.barcode AS sku, p.name, p.stock_quantity, p.min_stock_level,
                 p.wholesale_price, p.retail_price, p.purchase_price AS cost_price,
                 c.name AS category_name
          FROM products p
          LEFT JOIN categories c ON c.id = p.category_id
          WHERE ${where}
          ORDER BY p.name ASC
        `, params),
        dbGet<{ total_products: string; total_stock_value: string; low_stock_count: string }>(`
          SELECT COUNT(*) AS total_products,
                 COALESCE(SUM(p.stock_quantity * p.purchase_price),0) AS total_stock_value,
                 SUM(CASE WHEN p.stock_quantity <= p.min_stock_level THEN 1 ELSE 0 END) AS low_stock_count
          FROM products p WHERE ${where}
        `, params),
      ]);

      return {
        success: true,
        data: rows,
        summary: {
          totalProducts:   parseInt(summary?.total_products   ?? '0'),
          totalStockValue: parseFloat(summary?.total_stock_value ?? '0'),
          lowStockCount:   parseInt(summary?.low_stock_count   ?? '0'),
        },
      };
    }
  );

  // ──────────────────────────────────────────────────────
  // تقرير الربح/الخسارة (مبيعات - تكلفة)
  // ──────────────────────────────────────────────────────
  fastify.get(
    '/api/reports/profit',
    { onRequest: [fastify.authenticate, requireRole(ROLES.ADMIN_MANAGER)] },
    async (request) => {
      const q = request.query as Record<string, string>;
      const from = q.from || new Date(new Date().setDate(1)).toISOString().split('T')[0];
      const to   = q.to   || new Date().toISOString().split('T')[0];

      const [rows, expensesRow] = await Promise.all([
        dbAll(`
          SELECT
            p.id, p.name AS product_name, p.barcode AS sku,
            SUM(si.quantity)                              AS total_sold,
            SUM(si.total_price)                           AS total_revenue,
            SUM(si.quantity * p.purchase_price)           AS total_cost,
            SUM(si.total_price) - SUM(si.quantity * p.purchase_price) AS gross_profit
          FROM sale_items si
          JOIN products p ON p.id = si.product_id
          JOIN sales s ON s.id = si.sale_id
          WHERE s.created_at::date BETWEEN $1 AND $2
          GROUP BY p.id, p.name, p.barcode
          ORDER BY gross_profit DESC
        `, [from, to]),
        dbGet<{ total: string }>(`
          SELECT COALESCE(SUM(amount_usd), 0) AS total
          FROM expenses
          WHERE expense_date BETWEEN $1 AND $2
        `, [from, to]),
      ]);

      const totalRevenue  = rows.reduce((s, r) => s + parseFloat(String((r as { total_revenue: string }).total_revenue ?? '0')), 0);
      const totalCost     = rows.reduce((s, r) => s + parseFloat(String((r as { total_cost: string }).total_cost ?? '0')), 0);
      const grossProfit   = totalRevenue - totalCost;
      const totalExpenses = parseFloat(expensesRow?.total ?? '0');
      const netProfit     = grossProfit - totalExpenses;
      const margin        = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

      return {
        success: true,
        data: rows,
        summary: {
          totalRevenue,
          totalCost,
          grossProfit,
          totalExpenses,
          netProfit,
          margin: parseFloat(margin.toFixed(2)),
        },
        from, to,
      };
    }
  );
}
