import type { FastifyInstance } from 'fastify';
import {
  checkLicenseStatus,
  activateLicense,
  getMachineFingerprint,
  initLicenseTable,
  invalidateLicenseCache,
} from './license.service.js';
import { dbAll, dbRun } from '../../shared/db/pool.js';
import { requireRole, ROLES } from '../../shared/middleware/requireRole.js';

export async function licenseRoutes(fastify: FastifyInstance) {
  await initLicenseTable();

  // ── GET /api/license/status (public — no auth) ─────────────────────────
  fastify.get('/api/license/status', async () => {
    const status = await checkLicenseStatus();
    return { success: true, ...status };
  });

  // ── GET /api/license/machine-id (public) ──────────────────────────────
  fastify.get('/api/license/machine-id', async () => {
    return { success: true, machine_id: getMachineFingerprint() };
  });

  // ── POST /api/license/activate (public — needed before login) ──────────
  fastify.post('/api/license/activate', async (request, reply) => {
    const { license_key, bind_to_machine = true } =
      request.body as { license_key: string; bind_to_machine?: boolean };

    if (!license_key || typeof license_key !== 'string') {
      return reply.status(400).send({ success: false, message: 'مفتاح الترخيص مطلوب' });
    }

    const result = await activateLicense(license_key, bind_to_machine);
    if (!result.success) {
      return reply.status(400).send({ success: false, message: result.message });
    }
    return { success: true, message: result.message, license: result.license };
  });

  // ── GET /api/license/info (admin only) ────────────────────────────────
  fastify.get(
    '/api/license/info',
    { onRequest: [fastify.authenticate, requireRole(ROLES.ADMIN_ONLY)] },
    async () => {
      const status = await checkLicenseStatus();
      const history = await dbAll<{
        id: number;
        license_type: string;
        customer_name: string;
        issued_at: Date;
        expires_at: Date | null;
        activated_at: Date;
        is_active: boolean;
        machine_fingerprint: string | null;
      }>(`
        SELECT id, license_type, customer_name, issued_at, expires_at,
               activated_at, is_active, machine_fingerprint
        FROM system_license
        ORDER BY activated_at DESC
        LIMIT 20
      `);
      return { success: true, status, history };
    }
  );

  // ── DELETE /api/license (admin only) ──────────────────────────────────
  fastify.delete(
    '/api/license',
    { onRequest: [fastify.authenticate, requireRole(ROLES.ADMIN_ONLY)] },
    async () => {
      await dbRun(`UPDATE system_license SET is_active = FALSE`);
      invalidateLicenseCache();
      return { success: true, message: 'تم إلغاء تفعيل الترخيص' };
    }
  );
}
