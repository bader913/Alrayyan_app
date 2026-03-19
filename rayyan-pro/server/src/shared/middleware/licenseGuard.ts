import type { FastifyRequest, FastifyReply } from 'fastify';
import { checkLicenseStatus } from '../../modules/license/license.service.js';

// Routes always allowed regardless of license state
const WHITELIST = [
  '/health',
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/license/status',
  '/api/license/machine-id',
  '/api/license/activate',
];

// Safe read-only HTTP methods
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export async function licenseGuard(
  request: FastifyRequest,
  reply:   FastifyReply
): Promise<void> {
  const url = request.url.split('?')[0];

  // 1 — Always allow whitelisted routes
  if (WHITELIST.some((w) => url === w || url.startsWith(w))) return;

  // 2 — Static assets / non-API
  if (!url.startsWith('/api/')) return;

  const status = await checkLicenseStatus();

  // 3 — Active license → allow everything
  if (status.active) return;

  // 4 — EXPIRED license → allow GET (read-only), block all writes
  if (status.expired) {
    if (READ_METHODS.has(request.method)) return;

    return reply.status(402).send({
      success:    false,
      code:       'LICENSE_EXPIRED_READONLY',
      message:    'انتهت صلاحية الترخيص — وضع القراءة فقط، لا يمكن إجراء أي عملية كتابة',
      machine_id: status.machine_id,
      license:    status.license ?? null,
    });
  }

  // 5 — No license or fingerprint mismatch → block everything
  let reason = 'لا يوجد ترخيص مفعّل';
  if (status.fingerprint_mismatch) reason = 'الترخيص مرتبط بجهاز آخر';

  return reply.status(402).send({
    success:    false,
    code:       'LICENSE_REQUIRED',
    message:    reason,
    machine_id: status.machine_id,
    license:    status.license ?? null,
  });
}
