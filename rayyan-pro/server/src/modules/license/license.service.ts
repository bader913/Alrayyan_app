import { createHmac, createHash, timingSafeEqual } from 'crypto';
import { networkInterfaces, hostname, cpus } from 'os';
import { dbGet, dbAll, dbRun } from '../../shared/db/pool.js';

// ─── Secret Key ────────────────────────────────────────────────────────────
// NEVER expose this. Store in LICENSE_SECRET environment variable.
export const LICENSE_SECRET =
  process.env.LICENSE_SECRET ??
  'ba5ec51c599790339eb9599a19552bb8ea27a56bd16616b0a512617fbb7a72f6e05cca08e0348b4c';

// ─── Types ─────────────────────────────────────────────────────────────────
export type LicenseType =
  | 'trial'      // 7 days
  | 'monthly'    // 30 days
  | 'quarterly'  // 90 days
  | 'semi'       // 180 days
  | 'annual'     // 365 days
  | 'biennial'   // 730 days
  | 'lifetime';  // no expiry

export const LICENSE_DURATIONS: Record<LicenseType, number | null> = {
  trial:     7,
  monthly:   30,
  quarterly: 90,
  semi:      180,
  annual:    365,
  biennial:  730,
  lifetime:  null,
};

export const LICENSE_LABELS: Record<LicenseType, string> = {
  trial:     'تجريبي (7 أيام)',
  monthly:   'شهري (30 يوم)',
  quarterly: 'ربع سنوي (90 يوم)',
  semi:      'نصف سنوي (180 يوم)',
  annual:    'سنوي (365 يوم)',
  biennial:  'سنتين (730 يوم)',
  lifetime:  'مدى الحياة',
};

export interface LicensePayload {
  v: 1;
  t: LicenseType;
  c: string;       // customer name
  i: string;       // issued date ISO
  e: string | null;// expiry date ISO (null = lifetime)
  f: string | null;// machine fingerprint (null = unbound)
}

export interface LicenseStatus {
  active:      boolean;
  expired:     boolean;
  fingerprint_mismatch: boolean;
  license?:    ActiveLicense;
  machine_id:  string;
}

export interface ActiveLicense {
  type:          LicenseType;
  type_label:    string;
  customer_name: string;
  issued_at:     string;
  expires_at:    string | null;
  days_remaining: number | null;
  machine_bound: boolean;
}

// ─── In-memory cache (5-minute TTL) ────────────────────────────────────────
let cachedStatus: LicenseStatus | null = null;
let cacheExpiry  = 0;

export function invalidateLicenseCache() {
  cachedStatus = null;
  cacheExpiry  = 0;
}

// ─── Machine Fingerprint ───────────────────────────────────────────────────
export function getMachineFingerprint(): string {
  try {
    const nets  = networkInterfaces();
    const macs  = Object.values(nets)
      .flat()
      .filter((n): n is NonNullable<typeof n> =>
        !!n && !n.internal && n.mac !== '00:00:00:00:00:00'
      )
      .map((n) => n.mac)
      .sort();

    const cpu   = cpus()[0]?.model ?? 'unknown';
    const host  = hostname();
    const raw   = [host, macs.join(','), cpu].join('||');

    return createHash('sha256').update(raw).digest('hex').slice(0, 16);
  } catch {
    return createHash('sha256').update(hostname()).digest('hex').slice(0, 16);
  }
}

// ─── Key Generation ────────────────────────────────────────────────────────
export function generateLicenseKey(payload: LicensePayload): string {
  const json = JSON.stringify(payload);
  const b64  = Buffer.from(json).toString('base64url');
  const sig  = createHmac('sha256', LICENSE_SECRET).update(b64).digest('hex').slice(0, 40);
  return `RP-${b64}.${sig}`;
}

// ─── Key Verification ──────────────────────────────────────────────────────
export function parseLicenseKey(key: string): LicensePayload | null {
  try {
    const trimmed = key.trim().replace(/\s+/g, '');
    if (!trimmed.startsWith('RP-')) return null;

    const rest   = trimmed.slice(3);
    const dotIdx = rest.lastIndexOf('.');
    if (dotIdx === -1) return null;

    const b64 = rest.slice(0, dotIdx);
    const sig = rest.slice(dotIdx + 1);

    const expectedSig = createHmac('sha256', LICENSE_SECRET).update(b64).digest('hex').slice(0, 40);

    // Constant-time compare to prevent timing attacks
    const sigBuf      = Buffer.from(sig.padEnd(40, '0'));
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

    const payload = JSON.parse(Buffer.from(b64, 'base64url').toString()) as LicensePayload;
    if (payload.v !== 1) return null;
    return payload;
  } catch {
    return null;
  }
}

// ─── DB table init ─────────────────────────────────────────────────────────
export async function initLicenseTable(): Promise<void> {
  await dbRun(`
    CREATE TABLE IF NOT EXISTS system_license (
      id                SERIAL PRIMARY KEY,
      license_key       TEXT        NOT NULL UNIQUE,
      license_type      VARCHAR(20) NOT NULL,
      customer_name     VARCHAR(200) NOT NULL,
      machine_fingerprint VARCHAR(64),
      issued_at         TIMESTAMPTZ NOT NULL,
      expires_at        TIMESTAMPTZ,
      activated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      is_active         BOOLEAN     NOT NULL DEFAULT TRUE,
      notes             TEXT
    )
  `);
}

// ─── Status Check ──────────────────────────────────────────────────────────
export async function checkLicenseStatus(): Promise<LicenseStatus> {
  const now = Date.now();
  if (cachedStatus && now < cacheExpiry) return cachedStatus;

  const machine_id = getMachineFingerprint();

  try {
    const row = await dbGet<{
      license_key:         string;
      license_type:        LicenseType;
      customer_name:       string;
      machine_fingerprint: string | null;
      issued_at:           Date;
      expires_at:          Date | null;
    }>(
      `SELECT license_key, license_type, customer_name, machine_fingerprint,
              issued_at, expires_at
       FROM system_license
       WHERE is_active = TRUE
       ORDER BY activated_at DESC
       LIMIT 1`
    );

    if (!row) {
      cachedStatus = { active: false, expired: false, fingerprint_mismatch: false, machine_id };
      cacheExpiry  = now + 2 * 60 * 1000; // 2 min cache for no-license state
      return cachedStatus;
    }

    // Verify the stored key hasn't been tampered with
    const payload = parseLicenseKey(row.license_key);
    if (!payload) {
      cachedStatus = { active: false, expired: false, fingerprint_mismatch: false, machine_id };
      cacheExpiry  = now + 2 * 60 * 1000;
      return cachedStatus;
    }

    // Check expiry
    const expired = row.expires_at ? new Date() > row.expires_at : false;

    // Check fingerprint
    const fp_mismatch = row.machine_fingerprint
      ? row.machine_fingerprint !== machine_id
      : false;

    const days_remaining = row.expires_at
      ? Math.max(0, Math.ceil((row.expires_at.getTime() - Date.now()) / 86400000))
      : null;

    const license: ActiveLicense = {
      type:           row.license_type,
      type_label:     LICENSE_LABELS[row.license_type] ?? row.license_type,
      customer_name:  row.customer_name,
      issued_at:      row.issued_at.toISOString(),
      expires_at:     row.expires_at?.toISOString() ?? null,
      days_remaining,
      machine_bound:  !!row.machine_fingerprint,
    };

    const active = !expired && !fp_mismatch;

    cachedStatus = { active, expired, fingerprint_mismatch: fp_mismatch, license, machine_id };
    cacheExpiry  = now + 5 * 60 * 1000; // 5-min cache
    return cachedStatus;

  } catch {
    cachedStatus = { active: false, expired: false, fingerprint_mismatch: false, machine_id };
    cacheExpiry  = now + 60 * 1000;
    return cachedStatus;
  }
}

// ─── Activate License ──────────────────────────────────────────────────────
export async function activateLicense(
  licenseKey: string,
  bindToMachine: boolean
): Promise<{ success: boolean; message: string; license?: ActiveLicense }> {
  const machine_id = getMachineFingerprint();
  const payload    = parseLicenseKey(licenseKey);

  if (!payload) {
    return { success: false, message: 'مفتاح الترخيص غير صالح أو مزوّر' };
  }

  // Validate expiry at activation time
  if (payload.e) {
    const expiry = new Date(payload.e);
    if (expiry < new Date()) {
      return { success: false, message: 'مفتاح الترخيص منتهي الصلاحية' };
    }
  }

  // Validate fingerprint binding
  if (payload.f && payload.f !== machine_id) {
    return { success: false, message: 'هذا المفتاح مرتبط بجهاز آخر. معرّف الجهاز الحالي: ' + machine_id };
  }

  const trimmed = licenseKey.trim().replace(/\s+/g, '');

  // Deactivate existing licenses
  await dbRun(`UPDATE system_license SET is_active = FALSE`);

  // Insert new license
  await dbRun(
    `INSERT INTO system_license
       (license_key, license_type, customer_name, machine_fingerprint,
        issued_at, expires_at, activated_at, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), TRUE)
     ON CONFLICT (license_key) DO UPDATE
       SET is_active = TRUE, activated_at = NOW()`,
    [
      trimmed,
      payload.t,
      payload.c,
      bindToMachine ? machine_id : (payload.f ?? null),
      new Date(payload.i),
      payload.e ? new Date(payload.e) : null,
    ]
  );

  invalidateLicenseCache();
  const status = await checkLicenseStatus();

  return {
    success: true,
    message: 'تم تفعيل الترخيص بنجاح',
    license: status.license,
  };
}
