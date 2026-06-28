/**
 * Admin authentication (§12.1). Password → mandatory TOTP → single session.
 * Failed logins email an immediate alert. No SMS, no 2FA-disable for admins.
 */
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../middleware/error.js";
import { env } from "../../config/env.js";
import { verifyPassword } from "../../lib/password.js";
import { decryptField, sha256 } from "../../lib/crypto.js";
import { verifyTotp } from "../../lib/totp.js";
import { sendEmail } from "../../lib/mailer.js";
import { adminFailedLoginEmail } from "../../lib/emailTemplates.js";
import { writeAudit } from "../../lib/audit.js";
import { signAdminToken, signAdminTwoFactorToken, verifyAdminTwoFactorToken } from "../../lib/jwt.js";

// ── Login lockout (M-4 fix) ──────────────────────────────────────────────────
// Reuses the LoginAttempt table with admin username stored in the email field.
const ADMIN_LOCK_AFTER = 3;
const ADMIN_LOCK_WINDOW_MS = 30 * 60 * 1000; // 30-minute lockout window

async function countAdminLoginFailures(username: string): Promise<number> {
  return prisma.loginAttempt.count({
    where: { email: username, successful: false, createdAt: { gte: new Date(Date.now() - ADMIN_LOCK_WINDOW_MS) } },
  });
}

// ── 2FA failure tracking (H-4 fix) ──────────────────────────────────────────
// In-memory Map: adminId → { count, blockedUntil }. Resets on successful login.
const totpFailures = new Map<string, { count: number; blockedUntil: number }>();

function assertNotTotpBlocked(adminId: string): void {
  const e = totpFailures.get(adminId);
  if (e && Date.now() < e.blockedUntil) {
    const mins = Math.ceil((e.blockedUntil - Date.now()) / 60_000);
    throw new AppError(429, "twofa_blocked", `Too many failed 2FA attempts. Try again in ${mins} minute(s).`);
  }
}

function recordTotpFailure(adminId: string): void {
  const e = totpFailures.get(adminId) ?? { count: 0, blockedUntil: 0 };
  e.count += 1;
  if (e.count >= 3) {
    e.blockedUntil = Date.now() + 30 * 60_000;
    e.count = 0;
  }
  totpFailures.set(adminId, e);
}

// ────────────────────────────────────────────────────────────────────────────

async function alertFailedLogin(username: string, ip: string) {
  if (!env.ADMIN_ALERT_EMAIL) return;
  const t = adminFailedLoginEmail(username, ip);
  sendEmail({ to: env.ADMIN_ALERT_EMAIL, ...t }).catch(() => {});
}

export async function adminLogin(username: string, password: string, ip: string) {
  // Lockout check before touching bcrypt (M-4 fix).
  const failures = await countAdminLoginFailures(username);
  if (failures >= ADMIN_LOCK_AFTER) {
    throw new AppError(429, "account_locked", "Account temporarily locked due to multiple failed attempts. Try again in 30 minutes.");
  }

  const admin = await prisma.adminAccount.findUnique({ where: { username } });
  const ok = admin ? await verifyPassword(password, admin.passwordHash) : false;
  if (!admin || !ok || !admin.isActive) {
    // Record failure + alert (§12.1).
    await prisma.loginAttempt.create({ data: { email: username, ip, successful: false } });
    await alertFailedLogin(username, ip);
    throw new AppError(401, "invalid_credentials", "Incorrect username or password.");
  }

  // Clear failure streak on correct password.
  await prisma.loginAttempt.deleteMany({ where: { email: username, successful: false } });

  // Always require TOTP next (mandatory for admins).
  return { twoFactorRequired: true, twoFactorToken: signAdminTwoFactorToken(admin.id) };
}

export async function adminVerify2fa(twoFactorToken: string, code: string, ip: string) {
  let adminId: string;
  try {
    adminId = verifyAdminTwoFactorToken(twoFactorToken).sub;
  } catch {
    throw new AppError(401, "twofa_expired", "Your login session expired. Please log in again.");
  }

  // Block if too many TOTP failures for this admin (H-4 fix).
  assertNotTotpBlocked(adminId);

  const admin = await prisma.adminAccount.findUnique({ where: { id: adminId } });
  if (!admin || !admin.isActive) throw new AppError(401, "twofa_invalid", "Admin account unavailable.");
  if (!verifyTotp(code, decryptField(admin.twoFactorSecret))) {
    recordTotpFailure(adminId);
    await alertFailedLogin(admin.username, ip);
    throw new AppError(401, "twofa_failed", "Invalid authentication code.");
  }

  // Clear TOTP failure counter on success.
  totpFailures.delete(adminId);

  // Single session: evict any existing sessions (no concurrent logins, §12.1).
  await prisma.adminSession.deleteMany({ where: { adminId: admin.id } });
  const session = await prisma.adminSession.create({ data: { adminId: admin.id, tokenHash: "", ip } });
  const token = signAdminToken({ sub: admin.id, role: admin.role, sid: session.id });
  await prisma.adminSession.update({ where: { id: session.id }, data: { tokenHash: sha256(token) } });
  await prisma.adminAccount.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
  await writeAudit(admin.username, "admin_login", admin.id, { ip });

  return { token, admin: { id: admin.id, username: admin.username, role: admin.role } };
}

export async function adminLogout(sessionId: string, username: string) {
  await prisma.adminSession.deleteMany({ where: { id: sessionId } });
  await writeAudit(username, "admin_logout", null);
  return { ok: true };
}

export async function adminMe(adminId: string) {
  const admin = await prisma.adminAccount.findUnique({ where: { id: adminId } });
  if (!admin) throw new AppError(404, "not_found", "Admin not found.");
  return { id: admin.id, username: admin.username, role: admin.role };
}
