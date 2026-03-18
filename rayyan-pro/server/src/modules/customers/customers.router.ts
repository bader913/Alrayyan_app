import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { dbAll, dbGet, dbRun } from '../../shared/db/pool.js';
import { requireRole, ROLES } from '../../shared/middleware/requireRole.js';

const customerSchema = z.object({
  name:          z.string().min(2, 'اسم العميل حرفان على الأقل').max(200),
  phone:         z.string().max(30).nullable().optional(),
  address:       z.string().max(500).nullable().optional(),
  customer_type: z.enum(['retail', 'wholesale']).default('retail'),
  credit_limit:  z.number().min(0).default(0),
  notes:         z.string().max(1000).nullable().optional(),
});

export async function customersRoutes(fastify: FastifyInstance) {
  // GET /api/customers — بحث بالاسم أو الهاتف
  fastify.get(
    '/api/customers',
    { onRequest: [fastify.authenticate] },
    async (request) => {
      const { q, type, limit = '30' } = request.query as Record<string, string>;

      const conditions: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      if (q?.trim()) {
        conditions.push(`(name ILIKE $${idx} OR phone ILIKE $${idx})`);
        values.push(`%${q.trim()}%`);
        idx++;
      }
      if (type) {
        conditions.push(`customer_type = $${idx++}`);
        values.push(type);
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const lim   = Math.min(parseInt(limit, 10) || 30, 100);

      const customers = await dbAll(
        `SELECT id, name, phone, address, customer_type, credit_limit, balance, notes, created_at
         FROM customers ${where}
         ORDER BY name ASC LIMIT ${lim}`,
        values
      );

      return { success: true, customers };
    }
  );

  // GET /api/customers/:id
  fastify.get(
    '/api/customers/:id',
    { onRequest: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const customer = await dbGet(
        `SELECT id, name, phone, address, customer_type, credit_limit, balance, notes, created_at
         FROM customers WHERE id = $1`,
        [id]
      );
      if (!customer) return reply.status(404).send({ success: false, message: 'العميل غير موجود' });
      return { success: true, customer };
    }
  );

  // POST /api/customers — الكاشير يمكنه إنشاء عميل من POS
  fastify.post(
    '/api/customers',
    { onRequest: [fastify.authenticate, requireRole(ROLES.CASHIER_UP)] },
    async (request, reply) => {
      const data = customerSchema.parse(request.body);
      const result = await dbRun(
        `INSERT INTO customers (name, phone, address, customer_type, credit_limit, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, name, phone, customer_type, credit_limit, balance`,
        [
          data.name, data.phone ?? null, data.address ?? null,
          data.customer_type, data.credit_limit, data.notes ?? null, request.user.id,
        ]
      );
      return reply.status(201).send({ success: true, customer: result.rows[0] });
    }
  );

  // PUT /api/customers/:id
  fastify.put(
    '/api/customers/:id',
    { onRequest: [fastify.authenticate, requireRole(ROLES.ADMIN_MANAGER)] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const existing = await dbGet('SELECT id FROM customers WHERE id = $1', [id]);
      if (!existing) return reply.status(404).send({ success: false, message: 'العميل غير موجود' });

      const data = customerSchema.parse(request.body);
      await dbRun(
        `UPDATE customers SET name=$1, phone=$2, address=$3, customer_type=$4,
         credit_limit=$5, notes=$6, updated_at=NOW() WHERE id=$7`,
        [data.name, data.phone ?? null, data.address ?? null, data.customer_type,
         data.credit_limit, data.notes ?? null, id]
      );

      const updated = await dbGet(
        'SELECT id, name, phone, customer_type, credit_limit, balance FROM customers WHERE id = $1', [id]
      );
      return { success: true, customer: updated };
    }
  );
}
