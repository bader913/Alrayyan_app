import type { FastifyRequest, FastifyReply } from 'fastify';
import { checkLicenseStatus } from '../../modules/license/license.service.js';

// Routes that are always allowed even without a valid license
const WHITELIST = [
  '/health',
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/license/status',
  '/api/license/machine-id',
  '/api/license/activate',
];

export async function licenseGuard(
  request: FastifyRequest,
  reply:   FastifyReply
): Promise<void> {
  const url = request.url.split('?')[0];

  // Allow whitelisted routes
  if (WHITELIST.some((w) => url === w || url.startsWith(w))) return;

  // Allow static assets in production
  if (!url.startsWith('/api/')) return;

  const status = await checkLicenseStatus();

  if (status.active) return;

  let reason = 'لا يوجد ترخيص مفعّل';
  if (status.expired)            reason = 'انتهت صلاحية الترخيص';
  if (status.fingerprint_mismatch) reason = 'الترخيص مرتبط بجهاز آخر';

  return reply.status(402).send({
    success:    false,
    code:       'LICENSE_REQUIRED',
    message:    reason,
    machine_id: status.machine_id,
    license:    status.license ?? null,
  });
}
