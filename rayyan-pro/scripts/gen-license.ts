#!/usr/bin/env node
/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  Rayyan Pro — License Key Generator
 *  استخدام:
 *    npx tsx scripts/gen-license.ts [options]
 *
 *  خيارات:
 *    --type    <trial|monthly|quarterly|semi|annual|biennial|lifetime>
 *    --customer <اسم العميل>
 *    --fingerprint <machine_id>  (اختياري - لربط بجهاز محدد)
 *    --issued  <YYYY-MM-DD>      (اختياري - افتراضي: اليوم)
 *    --list                      (عرض جميع أنواع الترخيص)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import 'dotenv/config';
import { createHmac } from 'crypto';

// ─── Config ────────────────────────────────────────────────────────────────
const SECRET = process.env.LICENSE_SECRET ??
  'ba5ec51c599790339eb9599a19552bb8ea27a56bd16616b0a512617fbb7a72f6e05cca08e0348b4c';

const DURATIONS: Record<string, number | null> = {
  trial:     7,
  monthly:   30,
  quarterly: 90,
  semi:      180,
  annual:    365,
  biennial:  730,
  lifetime:  null,
};

const LABELS: Record<string, string> = {
  trial:     'تجريبي (7 أيام)',
  monthly:   'شهري (30 يوم)',
  quarterly: 'ربع سنوي (90 يوم)',
  semi:      'نصف سنوي (180 يوم)',
  annual:    'سنوي (365 يوم)',
  biennial:  'سنتين (730 يوم)',
  lifetime:  'مدى الحياة',
};

// ─── Parse CLI args ────────────────────────────────────────────────────────
const args: Record<string, string> = {};
let isList = false;

for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg === '--list') { isList = true; continue; }
  if (arg.startsWith('--')) {
    const key = arg.slice(2);
    args[key] = process.argv[i + 1] ?? '';
    i++;
  }
}

// ─── List mode ────────────────────────────────────────────────────────────
if (isList) {
  console.log('\n═══════════════════════════════════════════');
  console.log('  Rayyan Pro — أنواع التراخيص المتاحة');
  console.log('═══════════════════════════════════════════\n');
  for (const [type, label] of Object.entries(LABELS)) {
    const days = DURATIONS[type];
    console.log(`  ${type.padEnd(12)} ${label}`);
    if (days) console.log(`              ${days} يوم`);
  }
  console.log('\n');
  process.exit(0);
}

// ─── Generate mode ────────────────────────────────────────────────────────
const type        = args['type']        ?? '';
const customer    = args['customer']    ?? '';
const fingerprint = args['fingerprint'] ?? null;
const issuedArg   = args['issued']      ?? '';

if (!type || !DURATIONS[type]) {
  console.error('\n❌ نوع الترخيص مطلوب. الأنواع المتاحة:');
  Object.keys(DURATIONS).forEach(t => console.error(`   --type ${t}`));
  console.error('\n');
  process.exit(1);
}

if (!customer) {
  console.error('\n❌ اسم العميل مطلوب: --customer "اسم العميل"\n');
  process.exit(1);
}

// ─── Build payload ────────────────────────────────────────────────────────
const issuedDate = issuedArg ? new Date(issuedArg) : new Date();
const days       = DURATIONS[type];
let expiryDate: Date | null = null;

if (days !== null) {
  expiryDate = new Date(issuedDate);
  expiryDate.setDate(expiryDate.getDate() + days);
}

const payload = {
  v: 1,
  t: type,
  c: customer,
  i: issuedDate.toISOString().slice(0, 10),
  e: expiryDate?.toISOString().slice(0, 10) ?? null,
  f: fingerprint || null,
};

const json = JSON.stringify(payload);
const b64  = Buffer.from(json).toString('base64url');
const sig  = createHmac('sha256', SECRET).update(b64).digest('hex').slice(0, 40);
const key  = `RP-${b64}.${sig}`;

// ─── Output ───────────────────────────────────────────────────────────────
console.log('\n');
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║          Rayyan Pro — مفتاح ترخيص جديد                      ║');
console.log('╠══════════════════════════════════════════════════════════════╣');
console.log(`║  العميل   : ${customer.padEnd(50)}║`);
console.log(`║  النوع    : ${LABELS[type].padEnd(50)}║`);
console.log(`║  الإصدار  : ${issuedDate.toISOString().slice(0, 10).padEnd(50)}║`);
console.log(`║  الانتهاء : ${(expiryDate?.toISOString().slice(0, 10) ?? 'مدى الحياة').padEnd(50)}║`);
console.log(`║  الجهاز   : ${(fingerprint ?? 'غير مقيّد (أي جهاز)').padEnd(50)}║`);
console.log('╠══════════════════════════════════════════════════════════════╣');
console.log('║  مفتاح الترخيص:                                              ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log('\n' + key + '\n');

if (key.length > 60) {
  console.log('(المفتاح أعلاه — انسخه كاملاً وأعطه للعميل)\n');
}
