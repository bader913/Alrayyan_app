import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { dbAll, dbGet, dbRun } from '../../shared/db/pool.js';
import { requireRole, ROLES } from '../../shared/middleware/requireRole.js';

const supplierSchema = z.object({
  name:    z.string().min(2, 'اسم المورد حرفان على الأقل').max(200),
  phone:   z.string().max(30).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  notes:   z.string().max(1000).nullable().optional(),
});

export async function suppliersRoutes(fastify: FastifyInstance) {
  // GET /api/suppliers
  fastify.get(
    '/api/suppliers',
    { onRequest: [fastify.authenticate, requireRole(ROLES.STOCK_TEAM)] },
    async (request) => {
      const { q } = request.query as { q?: string };

      let sql = `SELECT id, name, phone, address, balance, notes, created_at FROM suppliers`;
      const values: unknown[] = [];

      if (q) {
        sql += ` WHERE name ILIKE $1 OR phone ILIKE $1`;
        values.push(`%${q}%`);
      }

      sql += ` ORDER BY name ASC`;

      const suppliers = await dbAll(sql, values);
      return { success: true, suppliers };
    }
  );

  // GET /api/suppliers/:id
  fastify.get(
    '/api/suppliers/:id',
    { onRequest: [fastify.authenticate, requireRole(ROLES.STOCK_TEAM)] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const supplier = await dbGet(
        'SELECT id, name, phone, address, balance, notes, created_at FROM suppliers WHERE id = $1',
        [id]
      );
      if (!supplier) return reply.status(404).send({ success: false, message: 'المورد غير موجود' });
      return { success: true, supplier };
    }
  );

  // POST /api/suppliers
  fastify.post(
    '/api/suppliers',
    { onRequest: [fastify.authenticate, requireRole(ROLES.ADMIN_MANAGER)] },
    async (request, reply) => {
      const data = supplierSchema.parse(request.body);
      const result = await dbRun(
        `INSERT INTO suppliers (name, phone, address, notes, created_by)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, name, phone, address, balance, notes`,
        [data.name, data.phone ?? null, data.address ?? null, data.notes ?? null, request.user.id]
      );
      return reply.status(201).send({ success: true, supplier: result.rows[0] });
    }
  );

  // PUT /api/suppliers/:id
  fastify.put(
    '/api/suppliers/:id',
    { onRequest: [fastify.authenticate, requireRole(ROLES.ADMIN_MANAGER)] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const data = supplierSchema.parse(request.body);

      const existing = await dbGet('SELECT id FROM suppliers WHERE id = $1', [id]);
      if (!existing) return reply.status(404).send({ success: false, message: 'المورد غير موجود' });

      await dbRun(
        `UPDATE suppliers SET name=$1, phone=$2, address=$3, notes=$4, updated_at=NOW() WHERE id=$5`,
        [data.name, data.phone ?? null, data.address ?? null, data.notes ?? null, id]
      );

      const updated = await dbGet(
        'SELECT id, name, phone, address, balance, notes FROM suppliers WHERE id = $1', [id]
      );
      return { success: true, supplier: updated };
    }
  );
}
