import type { FastifyInstance } from 'fastify';
import { dbGet, dbAll } from '../../shared/db/pool.js';
import { requireRole, ROLES } from '../../shared/middleware/requireRole.js';

export async function dashboardRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/api/dashboard/stats',
    { onRequest: [fastify.authenticate, requireRole(ROLES.ADMIN_MANAGER)] },
    async () => {
      const [
        salesToday,
        salesWeek,
        salesMonth,
        purchasesMonth,
        customerDebt,
        supplierBalance,
        topProducts,
        lowStock,
        recentSales,
        cashFlowMonth,
      ] = await Promise.all([
        // مبيعات اليوم
        dbGet<{ count: string; total: string }>(`
          SELECT COUNT(*) AS count, COALESCE(SUM(total_amount),0) AS total
          FROM sales
          WHERE created_at >= CURRENT_DATE
        `),
        // مبيعات الأسبوع
        dbGet<{ count: string; total: string }>(`
          SELECT COUNT(*) AS count, COALESCE(SUM(total_amount),0) AS total
          FROM sales
          WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
        `),
        // مبيعات الشهر
        dbGet<{ count: string; total: string }>(`
          SELECT COUNT(*) AS count, COALESCE(SUM(total_amount),0) AS total
          FROM sales
          WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())
        `),
        // مشتريات الشهر
        dbGet<{ count: string; total: string }>(`
          SELECT COUNT(*) AS count, COALESCE(SUM(total_amount),0) AS total
          FROM purchases
          WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())
        `),
        // إجمالي ديون العملاء
        dbGet<{ total: string }>(`SELECT COALESCE(SUM(balance),0) AS total FROM customers WHERE balance > 0`),
        // إجمالي أرصدة الموردين
        dbGet<{ total: string }>(`SELECT COALESCE(SUM(balance),0) AS total FROM suppliers WHERE balance > 0`),
        // أكثر المنتجات مبيعاً (الشهر)
        dbAll<{ product_name: string; total_qty: string; total_revenue: string }>(`
          SELECT p.name AS product_name,
                 SUM(si.quantity) AS total_qty,
                 SUM(si.total_price) AS total_revenue
          FROM sale_items si
          JOIN products p ON p.id = si.product_id
          JOIN sales s ON s.id = si.sale_id
          WHERE DATE_TRUNC('month', s.created_at) = DATE_TRUNC('month', NOW())
          GROUP BY p.id, p.name
          ORDER BY total_qty DESC
          LIMIT 5
        `),
        // منتجات قاربت على النفاد
        dbAll<{ id: number; name: string; stock_quantity: string; min_stock_level: string }>(`
          SELECT id, name, stock_quantity, min_stock_level
          FROM products
          WHERE is_active = true AND stock_quantity <= min_stock_level
          ORDER BY stock_quantity ASC
          LIMIT 10
        `),
        // آخر 5 مبيعات
        dbAll<{ id: number; invoice_number: string; total_amount: string; created_at: string; customer_name: string | null }>(`
          SELECT s.id, s.invoice_number, s.total_amount, s.created_at,
                 c.name AS customer_name
          FROM sales s
          LEFT JOIN customers c ON c.id = s.customer_id
          ORDER BY s.created_at DESC
          LIMIT 5
        `),
        // التدفق النقدي للشهر (مبيعات - مشتريات)
        dbGet<{ sales_total: string; purchases_total: string }>(`
          SELECT
            COALESCE((SELECT SUM(paid_amount) FROM sales
              WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())), 0) AS sales_total,
            COALESCE((SELECT SUM(paid_amount) FROM purchases
              WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())), 0) AS purchases_total
        `),
      ]);

      return {
        success: true,
        stats: {
          sales: {
            today:  { count: parseInt(salesToday?.count ?? '0'), total: parseFloat(salesToday?.total ?? '0') },
            week:   { count: parseInt(salesWeek?.count   ?? '0'), total: parseFloat(salesWeek?.total   ?? '0') },
            month:  { count: parseInt(salesMonth?.count  ?? '0'), total: parseFloat(salesMonth?.total  ?? '0') },
          },
          purchases: {
            month: { count: parseInt(purchasesMonth?.count ?? '0'), total: parseFloat(purchasesMonth?.total ?? '0') },
          },
          receivables: {
            customerDebt:    parseFloat(customerDebt?.total    ?? '0'),
            supplierBalance: parseFloat(supplierBalance?.total ?? '0'),
          },
          cashFlow: {
            salesCash:     parseFloat(cashFlowMonth?.sales_total     ?? '0'),
            purchasesCash: parseFloat(cashFlowMonth?.purchases_total ?? '0'),
            net:           parseFloat(cashFlowMonth?.sales_total ?? '0') - parseFloat(cashFlowMonth?.purchases_total ?? '0'),
          },
          topProducts:  topProducts  ?? [],
          lowStock:     lowStock     ?? [],
          recentSales:  recentSales  ?? [],
        },
      };
    }
  );
}
