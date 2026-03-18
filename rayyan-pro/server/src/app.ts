import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
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
import { dashboardRoutes }     from './modules/dashboard/dashboard.router.js';
import { reportsRoutes }       from './modules/reports/reports.router.js';
import { auditLogsRoutes }     from './modules/auditLogs/auditLogs.router.js';
import { settingsRoutes }      from './modules/settings/settings.router.js';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: {
      id:        number;
      username:  string;
      full_name: string;
      role:      string;
    };
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

import type { FastifyRequest, FastifyReply } from 'fastify';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IS_PROD    = process.env.NODE_ENV === 'production';
const CLIENT_DIR = join(__dirname, '../../client/dist');

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
  // Phase 5/6 — Accounts + Dashboard + Reports
  await app.register(dashboardRoutes);
  await app.register(reportsRoutes);
  // Phase 7 — Audit Log + Settings
  await app.register(auditLogsRoutes);
  await app.register(settingsRoutes);

  // Production: serve compiled React client from client/dist
  if (IS_PROD && existsSync(CLIENT_DIR)) {
    await app.register(fastifyStatic, {
      root:   CLIENT_DIR,
      prefix: '/',
      decorateReply: false,
    });
    // SPA fallback — all non-API routes return index.html
    app.setNotFoundHandler((_req, reply) => {
      reply.sendFile('index.html');
    });
  }

  return app;
}
