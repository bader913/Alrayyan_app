import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as XLSX from 'xlsx';
import { ProductsService } from './products.service.js';
import { requireRole, ROLES } from '../../shared/middleware/requireRole.js';
import { pool, dbAll } from '../../shared/db/pool.js';
import { auditLog } from '../../shared/utils/auditLog.js';
import { recordStockMovement } from '../../shared/services/stockMovements.service.js';

const createProductSchema = z.object({
  barcode:          z.string().max(100).nullable().optional(),
  name:             z.string().min(2, 'اسم المنتج حرفان على الأقل').max(300),
  category_id:      z.number().int().positive().nullable().optional(),
  unit:             z.string().min(1).max(20).default('قطعة'),
  is_weighted:      z.boolean().default(false),
  purchase_price:   z.number().min(0, 'سعر الشراء لا يمكن أن يكون سالباً'),
  retail_price:     z.number().min(0, 'سعر البيع لا يمكن أن يكون سالباً'),
  wholesale_price:  z.number().min(0).nullable().optional(),
  wholesale_min_qty:z.number().min(0).default(1),
  initial_stock:    z.number().min(0).default(0),
  min_stock_level:  z.number().min(0).default(5),
  expiry_date:      z.string().nullable().optional(),
  image_url:        z.string().url().nullable().optional(),
  supplier_id:      z.number().int().positive().nullable().optional(),
  notes:            z.string().max(1000).nullable().optional(),
});

const updateProductSchema = createProductSchema
  .omit({ initial_stock: true })
  .partial();

const adjustStockSchema = z.object({
  new_quantity: z.number().min(0, 'الكمية لا يمكن أن تكون سالبة'),
  note:         z.string().max(500).optional(),
});

export async function productsRoutes(fastify: FastifyInstance) {
  const svc = new ProductsService();

  // ─── List products (all roles) ──────────────────────────────────────────
  fastify.get(
    '/api/products',
    { onRequest: [fastify.authenticate] },
    async (request) => {
      const q = request.query as Record<string, string>;
      const result = await svc.listProducts({
        q:           q.q,
        category_id: q.category_id,
        supplier_id: q.supplier_id,
        is_active:   (q.is_active ?? 'true') as 'true' | 'false' | 'all',
        low_stock:   q.low_stock === 'true',
        page:        q.page  ? parseInt(q.page,  10) : 1,
        limit:       q.limit ? parseInt(q.limit, 10) : 20,
      });
      return { success: true, ...result };
    }
  );

  // ─── Get by barcode — returns array (barcode NOT unique) ─────────────────
  // NOTE: این route باید قبل از /:id باشد
  fastify.get(
    '/api/products/barcode/:barcode',
    { onRequest: [fastify.authenticate] },
    async (request) => {
      const { barcode } = request.params as { barcode: string };
      const products = await svc.getProductsByBarcode(barcode);
      return { success: true, products };
    }
  );

  // ─── Export Excel template ───────────────────────────────────────────────
  fastify.get(
    '/api/products/export-template',
    { onRequest: [fastify.authenticate] },
    async (_request, reply) => {
      const categories = await dbAll<{ name: string }>('SELECT name FROM categories ORDER BY name ASC');
      const suppliers  = await dbAll<{ name: string }>('SELECT name FROM suppliers  ORDER BY name ASC');

      const catNames = categories.map((c) => c.name).join(' | ');
      const supNames = suppliers.map((s) => s.name).join(' | ');

      const header = [
        'اسم المنتج *',
        'الباركود',
        'الفئة',
        'المورد',
        'وحدة القياس',
        'سعر الشراء USD *',
        'سعر البيع تجزئة USD *',
        'سعر البيع جملة USD',
        'حد الجملة (كمية)',
        'الكمية المبدئية',
        'الحد الأدنى للمخزون',
        'تاريخ الانتهاء (YYYY-MM-DD)',
        'ملاحظات',
      ];

      const guide = [
        'مثال: زيت زيتون',
        'مثال: 6281234567890',
        catNames || 'أضف فئات أولاً',
        supNames || 'أضف موردين أولاً',
        'قطعة | كغ | لتر | علبة | كرتون | حزمة | متر | دزينة',
        '5.50',
        '8.00',
        '7.00',
        '10',
        '100',
        '5',
        '2025-12-31',
        'أي ملاحظات اضافية',
      ];

      const ws = XLSX.utils.aoa_to_sheet([header, guide]);

      // Column widths
      ws['!cols'] = [
        { wch: 25 }, { wch: 20 }, { wch: 20 }, { wch: 20 },
        { wch: 18 }, { wch: 20 }, { wch: 22 }, { wch: 22 },
        { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 24 }, { wch: 20 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'المنتجات');

      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      reply.header('Content-Disposition', 'attachment; filename="products_template.xlsx"');
      return reply.send(buf);
    }
  );

  // ─── Import products from Excel ──────────────────────────────────────────
  fastify.post(
    '/api/products/import',
    { onRequest: [fastify.authenticate, requireRole(ROLES.STOCK_TEAM)] },
    async (request, reply) => {
      const data = await request.file();
      if (!data) return reply.status(400).send({ success: false, message: 'لم يتم إرسال ملف' });

      const buf = await data.toBuffer();
      const wb  = XLSX.read(buf, { type: 'buffer' });
      const ws  = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { header: 1, defval: '' }) as string[][];

      if (rows.length < 2) {
        return reply.status(400).send({ success: false, message: 'الملف فارغ أو لا يحتوي على بيانات' });
      }

      // Load category + supplier maps
      const cats = await dbAll<{ id: number; name: string }>('SELECT id, name FROM categories');
      const sups = await dbAll<{ id: number; name: string }>('SELECT id, name FROM suppliers');
      const catMap = new Map(cats.map((c) => [c.name.trim().toLowerCase(), c.id]));
      const supMap = new Map(sups.map((s) => [s.name.trim().toLowerCase(), s.id]));

      let created = 0;
      const errors: string[] = [];

      // Skip row 0 (header) and row 1 (guide)
      const dataRows = rows.slice(2);

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const rowNum = i + 3;

        const name          = String(row[0] ?? '').trim();
        const barcode       = String(row[1] ?? '').trim() || null;
        const catName       = String(row[2] ?? '').trim();
        const supName       = String(row[3] ?? '').trim();
        const unit          = String(row[4] ?? '').trim() || 'قطعة';
        const purchasePrice = parseFloat(String(row[5] ?? '')) || 0;
        const retailPrice   = parseFloat(String(row[6] ?? '')) || 0;
        const wholesalePrice= parseFloat(String(row[7] ?? '')) || null;
        const wholesaleMinQ = parseFloat(String(row[8] ?? '')) || 1;
        const initialStock  = parseFloat(String(row[9] ?? '')) || 0;
        const minStockLevel = parseFloat(String(row[10] ?? '')) || 5;
        const expiryDate    = String(row[11] ?? '').trim() || null;
        const notes         = String(row[12] ?? '').trim() || null;

        if (!name || name.length < 2) {
          if (name) errors.push(`السطر ${rowNum}: اسم المنتج مطلوب (حرفان على الأقل)`);
          continue;
        }
        if (purchasePrice < 0 || retailPrice < 0) {
          errors.push(`السطر ${rowNum} (${name}): الأسعار لا يمكن أن تكون سالبة`);
          continue;
        }

        const categoryId = catName ? (catMap.get(catName.toLowerCase()) ?? null) : null;
        const supplierId  = supName ? (supMap.get(supName.toLowerCase()) ?? null) : null;

        try {
          const client = await pool.connect();
          try {
            await client.query('BEGIN');

            const res = await client.query<{ id: number }>(
              `INSERT INTO products
                (barcode, name, category_id, supplier_id, unit, is_weighted,
                 purchase_price, retail_price, wholesale_price, wholesale_min_qty,
                 stock_quantity, min_stock_level, expiry_date, notes, is_active, created_by)
               VALUES ($1,$2,$3,$4,$5,false,$6,$7,$8,$9,$10,$11,$12,$13,true,$14)
               RETURNING id`,
              [
                barcode, name, categoryId, supplierId, unit,
                purchasePrice, retailPrice,
                wholesalePrice && wholesalePrice > 0 ? wholesalePrice : null,
                wholesaleMinQ, initialStock, minStockLevel,
                expiryDate || null, notes, request.user.id,
              ]
            );

            const productId = res.rows[0].id;

            if (initialStock > 0) {
              await recordStockMovement(client, {
                product_id:      productId,
                movement_type:   'adjustment',
                quantity_change: initialStock,
                note:            'استيراد من Excel',
                created_by:      request.user.id,
              });
            }

            await client.query('COMMIT');
            created++;
          } catch (err) {
            await client.query('ROLLBACK');
            errors.push(`السطر ${rowNum} (${name}): ${err instanceof Error ? err.message : 'خطأ غير معروف'}`);
          } finally {
            client.release();
          }
        } catch {
          errors.push(`السطر ${rowNum} (${name}): فشل الاتصال بقاعدة البيانات`);
        }
      }

      return {
        success: true,
        created,
        errors,
        message: `تم استيراد ${created} منتج${created !== 1 ? 'اً' : ''}${errors.length ? ` مع ${errors.length} خطأ` : ' بنجاح'}`,
      };
    }
  );

  // ─── Get single product ──────────────────────────────────────────────────
  fastify.get(
    '/api/products/:id',
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const product = await svc.getProductById(parseInt(id, 10));
      if (!product) return reply.status(404).send({ success: false, message: 'المنتج غير موجود' });
      return { success: true, product };
    }
  );

  // ─── Create product ──────────────────────────────────────────────────────
  fastify.post(
    '/api/products',
    { onRequest: [fastify.authenticate, requireRole(ROLES.STOCK_TEAM)] },
    async (request, reply) => {
      const data = createProductSchema.parse(request.body);
      const product = await svc.createProduct({
        ...data,
        created_by: request.user.id,
      });
      auditLog({
        userId:     request.user.id,
        action:     'create',
        entityType: 'product',
        entityId:   Number(product.id),
        newData:    { name: product.name, barcode: product.barcode },
        ipAddress:  request.ip,
      }).catch(() => {});
      return reply.status(201).send({ success: true, product });
    }
  );

  // ─── Update product ──────────────────────────────────────────────────────
  fastify.put(
    '/api/products/:id',
    { onRequest: [fastify.authenticate, requireRole(ROLES.STOCK_TEAM)] },
    async (request) => {
      const { id } = request.params as { id: string };
      const data = updateProductSchema.parse(request.body);
      const product = await svc.updateProduct(parseInt(id, 10), data);
      return { success: true, product };
    }
  );

  // ─── Toggle active (archive/restore) ────────────────────────────────────
  fastify.patch(
    '/api/products/:id/active',
    { onRequest: [fastify.authenticate, requireRole(ROLES.ADMIN_MANAGER)] },
    async (request) => {
      const { id } = request.params as { id: string };
      const product = await svc.toggleActive(parseInt(id, 10));
      auditLog({
        userId:     request.user.id,
        action:     product.is_active ? 'activate' : 'deactivate',
        entityType: 'product',
        entityId:   parseInt(id, 10),
        newData:    { is_active: product.is_active, name: product.name },
        ipAddress:  request.ip,
      }).catch(() => {});
      return { success: true, product };
    }
  );

  // ─── Manual stock adjustment ─────────────────────────────────────────────
  fastify.patch(
    '/api/products/:id/stock',
    { onRequest: [fastify.authenticate, requireRole(ROLES.STOCK_TEAM)] },
    async (request) => {
      const { id } = request.params as { id: string };
      const { new_quantity, note } = adjustStockSchema.parse(request.body);
      const product = await svc.adjustStock(parseInt(id, 10), {
        new_quantity,
        note,
        created_by: request.user.id,
      });
      return { success: true, product };
    }
  );

  // ─── Stock movement history ──────────────────────────────────────────────
  fastify.get(
    '/api/products/:id/movements',
    { onRequest: [fastify.authenticate, requireRole(ROLES.ADMIN_MANAGER)] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const product = await svc.getProductById(parseInt(id, 10));
      if (!product) return reply.status(404).send({ success: false, message: 'المنتج غير موجود' });

      const movements = await pool.query(
        `SELECT m.*, u.full_name AS created_by_name
         FROM product_stock_movements m
         LEFT JOIN users u ON u.id = m.created_by
         WHERE m.product_id = $1
         ORDER BY m.created_at DESC
         LIMIT 100`,
        [id]
      );

      return { success: true, movements: movements.rows };
    }
  );
}
