import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool } from '../../shared/db/pool.js';
import { requireRole, ROLES } from '../../shared/middleware/requireRole.js';
import { withTransaction } from '../../shared/db/pool.js';
import type { PoolClient } from 'pg';

// ─── Password Verification ────────────────────────────────────────────────────
const verifySchema = z.object({
  password: z.string().min(1, 'كلمة المرور مطلوبة'),
});

async function verifyCurrentUser(request: { user: { id: number } }, password: string) {
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

// ─── Default Settings ─────────────────────────────────────────────────────────
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

// ─── Helper: dynamic INSERT preserving IDs ───────────────────────────────────
async function insertRows(client: PoolClient, table: string, rows: Record<string, unknown>[]) {
  if (!rows || rows.length === 0) return;
  for (const row of rows) {
    const cols   = Object.keys(row);
    const vals   = Object.values(row);
    const ph     = vals.map((_, i) => `$${i + 1}`).join(', ');
    await client.query(
      `INSERT INTO ${table} (${cols.map(c => `"${c}"`).join(', ')})
       VALUES (${ph})
       ON CONFLICT DO NOTHING`,
      vals
    );
  }
}

// Reset sequence for a table's id column after bulk insert
async function resetSeq(client: PoolClient, table: string) {
  await client.query(`
    SELECT setval(
      pg_get_serial_sequence('${table}', 'id'),
      COALESCE((SELECT MAX(id) FROM "${table}"), 0) + 1,
      false
    )
  `);
}

// ─── Clear all business data (shared helper) ──────────────────────────────────
async function clearAllData(client: PoolClient) {
  await client.query('DELETE FROM sales_return_items');
  await client.query('DELETE FROM sales_returns');
  await client.query('DELETE FROM sale_items');
  await client.query('DELETE FROM sales');
  await client.query('DELETE FROM purchase_items');
  await client.query('DELETE FROM purchases');
  await client.query('DELETE FROM customer_account_transactions');
  await client.query('DELETE FROM supplier_account_transactions');
  await client.query('DELETE FROM product_stock_movements');
  await client.query('UPDATE invoice_sequences SET last_number = 0');
  await client.query('DELETE FROM audit_logs');
}

// ─── Routes ───────────────────────────────────────────────────────────────────
export async function adminRoutes(fastify: FastifyInstance) {

  // ── POST /api/admin/backup ─────────────────────────────────────────────────
  fastify.post(
    '/api/admin/backup',
    { onRequest: [fastify.authenticate, requireRole(ROLES.ADMIN_ONLY)] },
    async (request, reply) => {
      const body = verifySchema.parse(request.body);
      await verifyCurrentUser(request as never, body.password);

      const client = await pool.connect();
      try {
        const [
          settings, categories, suppliers, products,
          customers, users,
          sales, saleItems,
          purchases, purchaseItems,
          salesReturns, returnItems,
          custTx, supTx,
          stockMoves, sequences,
        ] = await Promise.all([
          client.query('SELECT * FROM settings ORDER BY key'),
          client.query('SELECT * FROM categories ORDER BY id'),
          client.query('SELECT * FROM suppliers ORDER BY id'),
          client.query('SELECT * FROM products ORDER BY id'),
          client.query('SELECT * FROM customers ORDER BY id'),
          // users بدون كلمة المرور (لأمان)
          client.query('SELECT id, username, full_name, role, is_active, created_at FROM users ORDER BY id'),
          client.query('SELECT * FROM sales ORDER BY id'),
          client.query('SELECT * FROM sale_items ORDER BY id'),
          client.query('SELECT * FROM purchases ORDER BY id'),
          client.query('SELECT * FROM purchase_items ORDER BY id'),
          client.query('SELECT * FROM sales_returns ORDER BY id'),
          client.query('SELECT * FROM sales_return_items ORDER BY id'),
          client.query('SELECT * FROM customer_account_transactions ORDER BY id'),
          client.query('SELECT * FROM supplier_account_transactions ORDER BY id'),
          client.query('SELECT * FROM product_stock_movements ORDER BY id'),
          client.query('SELECT * FROM invoice_sequences ORDER BY prefix'),
        ]);

        const backup = {
          version:    '1.0',
          created_at: new Date().toISOString(),
          data: {
            settings:                       settings.rows,
            categories:                     categories.rows,
            suppliers:                      suppliers.rows,
            products:                       products.rows,
            customers:                      customers.rows,
            users:                          users.rows,
            sales:                          sales.rows,
            sale_items:                     saleItems.rows,
            purchases:                      purchases.rows,
            purchase_items:                 purchaseItems.rows,
            sales_returns:                  salesReturns.rows,
            sales_return_items:             returnItems.rows,
            customer_account_transactions:  custTx.rows,
            supplier_account_transactions:  supTx.rows,
            product_stock_movements:        stockMoves.rows,
            invoice_sequences:              sequences.rows,
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

  // ── POST /api/admin/import — استيراد نسخة احتياطية ──────────────────────
  fastify.post(
    '/api/admin/import',
    {
      onRequest:  [fastify.authenticate, requireRole(ROLES.ADMIN_ONLY)],
      bodyLimit:  52_428_800, // 50 MB
    },
    async (request, reply) => {
      const { password, backup } = request.body as { password: string; backup: Record<string, unknown> };
      if (!password) throw Object.assign(new Error('كلمة المرور مطلوبة'), { statusCode: 400 });
      if (!backup || !backup.data) throw Object.assign(new Error('ملف النسخة غير صحيح'), { statusCode: 400 });

      await verifyCurrentUser(request as never, password);

      const d = backup.data as Record<string, Record<string, unknown>[]>;

      await withTransaction(async (client) => {
        // 1 — مسح كل البيانات التجارية أولاً
        await clearAllData(client);

        // 2 — مسح البيانات الرئيسية (بالترتيب الصحيح)
        await client.query('DELETE FROM product_stock_movements');
        await client.query('DELETE FROM sale_items');
        await client.query('DELETE FROM purchase_items');
        await client.query('DELETE FROM sales_return_items');
        await client.query('DELETE FROM sales');
        await client.query('DELETE FROM purchases');
        await client.query('DELETE FROM sales_returns');
        await client.query('DELETE FROM products');
        await client.query('DELETE FROM categories');
        await client.query('DELETE FROM suppliers');
        await client.query('DELETE FROM customers');

        // 3 — استيراد البيانات الرئيسية بالترتيب (مراعاة المفاتيح الخارجية)
        await insertRows(client, 'categories',    d.categories    ?? []);
        await insertRows(client, 'suppliers',     d.suppliers     ?? []);
        await insertRows(client, 'products',      d.products      ?? []);
        await insertRows(client, 'customers',     d.customers     ?? []);

        // 4 — استيراد المعاملات
        await insertRows(client, 'sales',                          d.sales                          ?? []);
        await insertRows(client, 'sale_items',                     d.sale_items                     ?? []);
        await insertRows(client, 'purchases',                      d.purchases                      ?? []);
        await insertRows(client, 'purchase_items',                 d.purchase_items                 ?? []);
        await insertRows(client, 'sales_returns',                  d.sales_returns                  ?? []);
        await insertRows(client, 'sales_return_items',             d.sales_return_items             ?? []);
        await insertRows(client, 'customer_account_transactions',  d.customer_account_transactions  ?? []);
        await insertRows(client, 'supplier_account_transactions',  d.supplier_account_transactions  ?? []);
        await insertRows(client, 'product_stock_movements',        d.product_stock_movements        ?? []);

        // 5 — استيراد الإعدادات (upsert)
        for (const row of (d.settings ?? []) as { key: string; value: string }[]) {
          await client.query(
            `INSERT INTO settings (key, value, updated_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
            [row.key, row.value]
          );
        }

        // 6 — استيراد تسلسلات الفواتير (upsert)
        for (const row of (d.invoice_sequences ?? []) as { prefix: string; last_number: number }[]) {
          await client.query(
            `INSERT INTO invoice_sequences (prefix, last_number)
             VALUES ($1, $2)
             ON CONFLICT (prefix) DO UPDATE SET last_number = $2`,
            [row.prefix, row.last_number]
          );
        }

        // 7 — إعادة ضبط التسلسلات التلقائية (sequences) في PostgreSQL
        const seqTables = [
          'categories', 'suppliers', 'products', 'customers',
          'sales', 'sale_items', 'purchases', 'purchase_items',
          'sales_returns', 'sales_return_items',
          'customer_account_transactions', 'supplier_account_transactions',
          'product_stock_movements',
        ];
        for (const t of seqTables) {
          await resetSeq(client, t);
        }
      });

      return reply.status(200).send({
        success: true,
        message: 'تمت استعادة النسخة الاحتياطية بنجاح',
        counts: {
          categories:   (d.categories   ?? []).length,
          products:     (d.products     ?? []).length,
          customers:    (d.customers    ?? []).length,
          sales:        (d.sales        ?? []).length,
          purchases:    (d.purchases    ?? []).length,
        },
      });
    }
  );

  // ── POST /api/admin/clear ──────────────────────────────────────────────────
  fastify.post(
    '/api/admin/clear',
    { onRequest: [fastify.authenticate, requireRole(ROLES.ADMIN_ONLY)] },
    async (request, reply) => {
      const body = verifySchema.parse(request.body);
      await verifyCurrentUser(request as never, body.password);

      await withTransaction(async (client) => {
        await clearAllData(client);
        await client.query('UPDATE customers SET balance = 0, updated_at = NOW()');
        await client.query('UPDATE suppliers SET balance = 0, updated_at = NOW()');
        await client.query('UPDATE products  SET stock_quantity = 0, updated_at = NOW()');
      });

      return reply.status(200).send({ success: true, message: 'تم مسح جميع البيانات التجارية بنجاح' });
    }
  );

  // ── POST /api/admin/restore-defaults ──────────────────────────────────────
  fastify.post(
    '/api/admin/restore-defaults',
    { onRequest: [fastify.authenticate, requireRole(ROLES.ADMIN_ONLY)] },
    async (request, reply) => {
      const body = verifySchema.parse(request.body);
      await verifyCurrentUser(request as never, body.password);

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
