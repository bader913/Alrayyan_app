import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { errorHandler } from './shared/middleware/errorHandler.js';
import { authRoutes } from './modules/auth/auth.router.js';
import { usersRoutes } from './modules/users/users.router.js';
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

  // Modules
  await app.register(authRoutes);
  await app.register(usersRoutes);

  return app;
}
