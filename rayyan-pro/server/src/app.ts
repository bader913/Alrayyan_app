import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { errorHandler } from './shared/middleware/errorHandler.js';
import { authRoutes }       from './modules/auth/auth.router.js';
import { usersRoutes }      from './modules/users/users.router.js';
import { categoriesRoutes } from './modules/categories/categories.router.js';
import { suppliersRoutes }  from './modules/suppliers/suppliers.router.js';
import { productsRoutes }   from './modules/products/products.router.js';
import { customersRoutes }  from './modules/customers/customers.router.js';
import { terminalsRoutes }  from './modules/terminals/terminals.router.js';
import { shiftsRoutes }     from './modules/shifts/shifts.router.js';
import { salesRoutes }         from './modules/sales/sales.router.js';
import { purchasesRoutes }     from './modules/purchases/purchases.router.js';
import { salesReturnsRoutes }  from './modules/salesReturns/salesReturns.router.js';
import { dbAll } from './shared/db/pool.js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    user: {
      id: number;
      username: string;
      full_name: string;
      role: string;
    };
  }
}

import type { FastifyRequest, FastifyReply } from 'fastify';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'development' ? 'info' : 'warn',
    },
  });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  await app.register(jwt, {
    secret: process.env.JWT_ACCESS_SECRET || 'fallback_secret_change_in_production',
  });

  app.decorate(
    'authenticate',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await request.jwtVerify();
      } catch {
        return reply.status(401).send({
          success: false,
          message: 'غير مصرح. يرجى تسجيل الدخول أولاً.',
        });
      }
    }
  );

  app.setErrorHandler(errorHandler);

  // Health check
  app.get('/health', async () => ({
    success: true,
    app: 'Rayyan Pro',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  }));

  // Settings
  app.get('/api/settings/all', { onRequest: [app.authenticate] }, async () => {
    const rows = await dbAll<{ key: string; value: string }>(
      'SELECT key, value FROM settings ORDER BY key ASC'
    );
    const obj = rows.reduce((acc: Record<string, string>, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});
    return { success: true, settings: obj };
  });

  // Modules — Phase 0/1/2
  await app.register(authRoutes);
  await app.register(usersRoutes);
  await app.register(categoriesRoutes);
  await app.register(suppliersRoutes);
  await app.register(productsRoutes);
  // Phase 3 — POS
  await app.register(customersRoutes);
  await app.register(terminalsRoutes);
  await app.register(shiftsRoutes);
  await app.register(salesRoutes);
  // Phase 4 — Purchases & Returns
  await app.register(purchasesRoutes);
  await app.register(salesReturnsRoutes);

  return app;
}
