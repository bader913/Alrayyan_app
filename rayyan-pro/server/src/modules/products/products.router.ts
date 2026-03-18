import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ProductsService } from './products.service.js';
import { requireRole, ROLES } from '../../shared/middleware/requireRole.js';
import { pool } from '../../shared/db/pool.js';
import { auditLog } from '../../shared/utils/auditLog.js';

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
