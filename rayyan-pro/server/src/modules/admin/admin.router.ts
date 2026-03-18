import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool, dbAll } from '../../shared/db/pool.js';
import { requireRole, ROLES } from '../../shared/middleware/requireRole.js';
import { withTransaction } from '../../shared/db/pool.js';

const verifySchema = z.object({
  password: z.string().min(1, 'كلمة المرور مطلوبة'),
});

async function verifyCurrentUser(fastify: FastifyInstance, request: { user: { id: number } }, password: string) {
  const client = await pool.connect();
  try {
    const res = await client.query<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE id = $1', [request.user.id]
    );
    if (!res.rows[0]) throw Object.assign(new Error('المستخدم غير موجود'), { statusCode: 404 });
    const ok = await bcrypt.compare(password, res.rows[0].password_hash);
    if (!ok) throw Object.assign(new Error('كلمة المرور غير صحيحة'), { statusCode: 401 });
  } finally {
    client.release();
  }
}

const DEFAULT_SETTINGS: Record<string, string> = {
  shop_name:           'ريان برو',
  shop_phone:          '',
  shop_address:        '',
  receipt_footer:      'شكراً لزيارتكم',
  currency:            'USD',
  usd_to_syp:          '1',
  usd_to_try:          '1',
  usd_to_sar:          '1',
  usd_to_aed:          '1',
  low_stock_threshold: '5',
  enable_shifts:       'false',
  show_usd:            'true',
  theme_color:         '#059669',
  theme_mode:          'dark',
};

export async function adminRoutes(fastify: FastifyInstance) {

  // ─── POST /api/admin/backup ───────────────────────────────────────────────
  fastify.post(
    '/api/admin/backup',
    { onRequest: [fastify.authenticate, requireRole(ROLES.ADMIN_ONLY)] },
    async (request, reply) => {
      const body  = verifySchema.parse(request.body);
      await verifyCurrentUser(fastify, request as never, body.password);

      const client = await pool.connect();
      try {
        const [
          settings, categories, suppliers, products,
          customers, users,
          sales, saleItems,
          purchases, purchaseItems,
          salesReturns, returnItems,
          custTx, supTx,
          stockMovements, sequences,
        ] = await Promise.all([
          client.query('SELECT * FROM settings ORDER BY key'),
          client.query('SELECT * FROM categories ORDER BY id'),
          client.query('SELECT * FROM suppliers ORDER BY id'),
          client.query('SELECT * FROM products ORDER BY id'),
          client.query('SELECT * FROM customers ORDER BY id'),
          client.query('SELECT id, username, full_name, role, is_active, created_at FROM users ORDER BY id'),
          client.query('SELECT * FROM sales ORDER BY id'),
          client.query('SELECT * FROM sale_items ORDER BY id'),
          client.query('SELECT * FROM purchases ORDER BY id'),
          client.query('SELECT * FROM purchase_items ORDER BY id'),
          client.query('SELECT * FROM sales_returns ORDER BY id'),
          client.query('SELECT * FROM return_items ORDER BY id'),
          client.query('SELECT * FROM customer_account_transactions ORDER BY id'),
          client.query('SELECT * FROM supplier_account_transactions ORDER BY id'),
          client.query('SELECT * FROM stock_movements ORDER BY id'),
          client.query('SELECT * FROM invoice_sequences ORDER BY prefix'),
        ]);

        const backup = {
          version:    '1.0',
          created_at: new Date().toISOString(),
          data: {
            settings:                        settings.rows,
            categories:                      categories.rows,
            suppliers:                       suppliers.rows,
            products:                        products.rows,
            customers:                       customers.rows,
            users:                           users.rows,
            sales:                           sales.rows,
            sale_items:                      saleItems.rows,
            purchases:                       purchases.rows,
            purchase_items:                  purchaseItems.rows,
            sales_returns:                   salesReturns.rows,
            return_items:                    returnItems.rows,
            customer_account_transactions:   custTx.rows,
            supplier_account_transactions:   supTx.rows,
            stock_movements:                 stockMovements.rows,
            invoice_sequences:               sequences.rows,
          },
        };

        const json     = JSON.stringify(backup, null, 2);
        const date     = new Date().toISOString().slice(0, 10);
        const filename = `rayyan-backup-${date}.json`;

        reply.header('Content-Type', 'application/json');
        reply.header('Content-Disposition', `attachment; filename="${filename}"`);
        return reply.send(json);
      } finally {
        client.release();
      }
    }
  );

  // ─── POST /api/admin/clear ────────────────────────────────────────────────
  fastify.post(
    '/api/admin/clear',
    { onRequest: [fastify.authenticate, requireRole(ROLES.ADMIN_ONLY)] },
    async (request, reply) => {
      const body = verifySchema.parse(request.body);
      await verifyCurrentUser(fastify, request as never, body.password);

      await withTransaction(async (client) => {
        // مسح جميع البيانات التجارية بالترتيب الصحيح (مراعاة العلاقات)
        await client.query('DELETE FROM return_items');
        await client.query('DELETE FROM sales_returns');
        await client.query('DELETE FROM sale_items');
        await client.query('DELETE FROM sales');
        await client.query('DELETE FROM purchase_items');
        await client.query('DELETE FROM purchases');
        await client.query('DELETE FROM customer_account_transactions');
        await client.query('DELETE FROM supplier_account_transactions');
        await client.query('DELETE FROM stock_movements');
        await client.query('UPDATE customers SET balance = 0, updated_at = NOW()');
        await client.query('UPDATE suppliers SET balance = 0, updated_at = NOW()');
        await client.query('UPDATE products SET stock_quantity = 0, updated_at = NOW()');
        await client.query('UPDATE invoice_sequences SET last_number = 0');
        await client.query('DELETE FROM audit_logs');
      });

      return reply.status(200).send({ success: true, message: 'تم مسح جميع البيانات التجارية بنجاح' });
    }
  );

  // ─── POST /api/admin/restore-defaults ────────────────────────────────────
  fastify.post(
    '/api/admin/restore-defaults',
    { onRequest: [fastify.authenticate, requireRole(ROLES.ADMIN_ONLY)] },
    async (request, reply) => {
      const body = verifySchema.parse(request.body);
      await verifyCurrentUser(fastify, request as never, body.password);

      const client = await pool.connect();
      try {
        for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
          await client.query(
            `INSERT INTO settings (key, value, updated_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
            [key, value]
          );
        }
      } finally {
        client.release();
      }

      return reply.status(200).send({ success: true, message: 'تمت استعادة الإعدادات الافتراضية' });
    }
  );
}
