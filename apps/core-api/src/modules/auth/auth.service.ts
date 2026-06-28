/**
 * Auth service — all §7 flows. Pure logic; HTTP concerns live in the controller.
 */
import type { User } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../middleware/error.js";
import { env } from "../../config/env.js";
import {
  hashPassword,
  verifyPassword,
  isPasswordPwned,
} from "../../lib/password.js";
import {
  sha256,
  randomNumericCode,
  randomToken,
  encryptField,
  decryptField,
} from "../../lib/crypto.js";
import {
  signAccessToken,
  signRefreshToken,
  signTwoFactorToken,
  verifyRefreshToken,
  verifyTwoFactorToken,
} from "../../lib/jwt.js";
import {
  generateTotpSecret,
  buildOtpAuthUrl,
  buildQrDataUrl,
  verifyTotp,
  generateBackupCodes,
} from "../../lib/totp.js";
import { sendEmail } from "../../lib/mailer.js";
import {
  otpEmail, emailVerifiedEmail, passwordResetEmail, passwordChangedEmail,
  newDeviceLoginEmail, lawyerApplicationReceivedEmail, adminNewApplicationEmail,
} from "../../lib/emailTemplates.js";

// ---- Constants (CLAUDE.md §7 / §11) ----------------------------------------
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
const OTP_MAX_ATTEMPTS = 5;
const RESET_TTL_MS = 15 * 60 * 1000; // 15 minutes
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const LOGIN_LOCK_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOGIN_CAPTCHA_AFTER = 3;
const LOGIN_LOCK_AFTER = 5;

export interface ReqMeta {
  ip: string;
  userAgent: string;
}

interface TokenBundle {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
}

interface LoginResult {
  accessToken: string;
  refreshToken: string;
  redirectTo: string;
  user: PublicUser;
}

export interface PublicUser {
  id: string;
  role: User["role"];
  fullName: string;
  email: string;
  status: User["status"];
  emailVerified: boolean;
  twoFactorEnabled: boolean;
}

function toPublicUser(u: User): PublicUser {
  return {
    id: u.id,
    role: u.role,
    fullName: u.fullName,
    email: u.email,
    status: u.status,
    emailVerified: u.emailVerified,
    twoFactorEnabled: u.twoFactorEnabled,
  };
}

function parseBrowser(ua: string): string {
  if (/edg/i.test(ua)) return "Edge";
  if (/chrome|crios/i.test(ua)) return "Chrome";
  if (/firefox|fxios/i.test(ua)) return "Firefox";
  if (/safari/i.test(ua)) return "Safari";
  return "Unknown browser";
}

async function redirectFor(user: User): Promise<string> {
  switch (user.role) {
    case "citizen":
      return "/user/dashboard";
    case "admin":
      return "/admin/dashboard";
    case "lawyer": {
      const profile = await prisma.lawyerProfile.findUnique({
        where: { userId: user.id },
        select: { verificationStatus: true },
      });
      return profile?.verificationStatus === "verified"
        ? "/lawyer/dashboard"
        : "/lawyer/pending";
    }
  }
}

// ============================================================================
// Session + token issuance
// ============================================================================

async function issueTokens(user: User, sessionId: string): Promise<TokenBundle> {
  // Create the refresh-token record first so its id can be embedded as `jti`.
  const record = await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: "",
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    },
  });
  const refreshToken = signRefreshToken({ sub: user.id, jti: record.id, sid: sessionId });
  await prisma.refreshToken.update({
    where: { id: record.id },
    data: { tokenHash: sha256(refreshToken) },
  });
  const accessToken = signAccessToken({ sub: user.id, role: user.role, sid: sessionId });
  return { accessToken, refreshToken, sessionId };
}

/** Enforce the max-3-concurrent-sessions rule by evicting the oldest (§11). */
async function enforceSessionCap(userId: string): Promise<void> {
  const sessions = await prisma.session.findMany({
    where: { userId },
    orderBy: { lastActiveAt: "asc" },
  });
  const overflow = sessions.length - (env.MAX_CONCURRENT_SESSIONS - 1);
  if (overflow > 0) {
    const evict = sessions.slice(0, overflow);
    const ids = evict.map((s) => s.id);
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await prisma.session.deleteMany({ where: { id: { in: ids } } });
  }
}

async function finalizeLogin(user: User, meta: ReqMeta): Promise<LoginResult> {
  await enforceSessionCap(user.id);

  // New-device detection (§7.3): no prior session with this browser+IP.
  const browser = parseBrowser(meta.userAgent);
  const known = await prisma.session.findFirst({
    where: { userId: user.id, browser, ip: meta.ip },
  });

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      device: meta.userAgent.slice(0, 200),
      browser,
      ip: meta.ip,
    },
  });

  if (!known) {
    const t = newDeviceLoginEmail(user.fullName, meta.ip, browser);
    sendEmail({ to: user.email, ...t }).catch(() => {});
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await prisma.loginAttempt.create({ data: { email: user.email, ip: meta.ip, successful: true } });

  const tokens = await issueTokens(user, session.id);
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    redirectTo: await redirectFor(user),
    user: toPublicUser(user),
  };
}

// ============================================================================
// 7.1 — User (citizen) registration
// ============================================================================

async function createAndSendOtp(userId: string, email: string): Promise<void> {
  const code = randomNumericCode(6);
  await prisma.emailOtp.create({
    data: {
      userId,
      codeHash: sha256(code),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true } });
  const t = otpEmail(user?.fullName ?? "there", code);
  // Non-fatal: OTP is in DB regardless; email failure must not block registration.
  sendEmail({ to: email, ...t }).catch((e: unknown) =>
    console.warn("[mailer] OTP email failed (check SMTP config):", e instanceof Error ? e.message : e),
  );
}

export async function registerUser(input: {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
}): Promise<{ userId: string; email: string }> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AppError(409, "email_taken", "This email is already registered.");
  }
  const user = await prisma.user.create({
    data: {
      role: "citizen",
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      passwordHash: await hashPassword(input.password),
      status: "pending",
      emailVerified: false,
    },
  });
  await createAndSendOtp(user.id, user.email);
  return { userId: user.id, email: user.email };
}

export async function verifyEmail(
  email: string,
  code: string,
  meta: ReqMeta,
): Promise<LoginResult> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new AppError(400, "invalid_otp", "Incorrect code. Please request a new one.");
  if (user.emailVerified) throw new AppError(409, "already_verified", "This email is already verified.");

  const otp = await prisma.emailOtp.findFirst({
    where: { userId: user.id, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) throw new AppError(400, "otp_missing", "No active code. Please request a new one.");

  if (otp.expiresAt.getTime() < Date.now()) {
    await prisma.emailOtp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
    throw new AppError(400, "otp_expired", "This code has expired. Please request a new one.");
  }

  if (otp.codeHash !== sha256(code)) {
    const attempts = otp.attempts + 1;
    if (attempts >= OTP_MAX_ATTEMPTS) {
      await prisma.emailOtp.update({
        where: { id: otp.id },
        data: { attempts, consumedAt: new Date() },
      });
      throw new AppError(400, "otp_locked", "Too many incorrect attempts. Please request a new code.");
    }
    await prisma.emailOtp.update({ where: { id: otp.id }, data: { attempts } });
    const remaining = OTP_MAX_ATTEMPTS - attempts;
    throw new AppError(400, "invalid_otp", `Incorrect code. ${remaining} attempts remaining.`);
  }

  // Success: consume code, verify + activate, auto-login.
  await prisma.emailOtp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
  const verified = await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true, status: "active" },
  });
  const welcomeT = emailVerifiedEmail(verified.fullName);
  await sendEmail({ to: verified.email, ...welcomeT }).catch(() => {});
  return finalizeLogin(verified, meta);
}

export async function resendOtp(email: string): Promise<{ resendAvailableInSeconds: number }> {
  const user = await prisma.user.findUnique({ where: { email } });
  // Do not reveal whether the email exists.
  if (!user || user.emailVerified) return { resendAvailableInSeconds: 60 };

  const last = await prisma.emailOtp.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  if (last && Date.now() - last.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
    const wait = Math.ceil(
      (OTP_RESEND_COOLDOWN_MS - (Date.now() - last.createdAt.getTime())) / 1000,
    );
    throw new AppError(429, "otp_cooldown", `Please wait ${wait}s before requesting a new code.`);
  }
  // Invalidate prior outstanding codes, then issue a fresh one.
  await prisma.emailOtp.updateMany({
    where: { userId: user.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  await createAndSendOtp(user.id, user.email);
  return { resendAvailableInSeconds: 60 };
}

// ============================================================================
// 7.2 — Lawyer registration (3 steps → Pending Verification)
// ============================================================================

export async function registerLawyer(input: {
  fullLegalName: string;
  cnic: string;
  email: string;
  phone: string;
  password: string;
  barCouncilNumber: string;
  province: User["province"];
  city: string;
  yearsExperienceBand: string;
  practiceAreas: string[];
  languages: string[];
  consultationFeePkr: number;
  bio: string;
  documents: { docType: string; fileUrl: string }[];
}): Promise<LoginResult> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new AppError(409, "email_taken", "This email is already registered.");

  const digits = input.cnic.replace(/\D/g, "");

  const user = await prisma.user.create({
    data: {
      role: "lawyer",
      fullName: input.fullLegalName,
      email: input.email,
      phone: input.phone,
      passwordHash: await hashPassword(input.password),
      // No OTP step for lawyers (§7.2); admin verification gates access instead.
      emailVerified: true,
      status: "pending",
      province: input.province ?? undefined,
      lawyerProfile: {
        create: {
          fullLegalName: input.fullLegalName,
          cnicEncrypted: encryptField(digits),
          cnicLast4: digits.slice(-4),
          barCouncilNumber: input.barCouncilNumber,
          province: input.province!,
          city: input.city,
          yearsExperienceBand: input.yearsExperienceBand as never,
          practiceAreas: input.practiceAreas,
          languages: input.languages,
          consultationFeePkr: input.consultationFeePkr,
          bio: input.bio,
          verificationStatus: "pending",
          documents: {
            create: input.documents.map((d) => ({
              docType: d.docType as never,
              fileUrl: d.fileUrl,
              status: "submitted",
            })),
          },
        },
      },
    },
  });

  const appT = lawyerApplicationReceivedEmail(user.fullName);
  sendEmail({ to: user.email, ...appT }).catch((e: unknown) =>
    console.warn("[mailer] Lawyer application email failed (check SMTP config):", e instanceof Error ? e.message : e),
  );

  // Notify admin of new application (§13).
  if (env.ADMIN_ALERT_EMAIL) {
    const adminT = adminNewApplicationEmail(1);
    await sendEmail({ to: env.ADMIN_ALERT_EMAIL, ...adminT }).catch(() => {});
  }

  // Auto-login straight to the pending screen (meta omitted for new-device email).
  return finalizeLogin(user, { ip: "0.0.0.0", userAgent: "registration" });
}

// ============================================================================
// 7.3 — Login (+ lockout / CAPTCHA / 2FA)
// ============================================================================

async function countRecentFailures(email: string): Promise<number> {
  return prisma.loginAttempt.count({
    where: {
      email,
      successful: false,
      createdAt: { gte: new Date(Date.now() - LOGIN_LOCK_WINDOW_MS) },
    },
  });
}

async function verifyCaptcha(token?: string): Promise<boolean> {
  if (!env.RECAPTCHA_SECRET_KEY) {
    // No key configured (dev): accept the literal dev token only.
    return token === "dev-captcha";
  }
  if (!token) return false;
  try {
    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: env.RECAPTCHA_SECRET_KEY, response: token }),
    });
    const data = (await res.json()) as { success?: boolean };
    return Boolean(data.success);
  } catch {
    return false;
  }
}

export type LoginOutcome =
  | { kind: "tokens"; result: LoginResult }
  | { kind: "2fa"; twoFactorToken: string }
  | { kind: "captcha_required" }
  | { kind: "locked"; minutes: number };

export async function login(
  input: { email: string; password: string; captchaToken?: string },
  meta: ReqMeta,
): Promise<LoginOutcome> {
  const failures = await countRecentFailures(input.email);
  if (failures >= LOGIN_LOCK_AFTER) {
    return { kind: "locked", minutes: 15 };
  }
  if (failures >= LOGIN_CAPTCHA_AFTER) {
    const ok = await verifyCaptcha(input.captchaToken);
    if (!ok) return { kind: "captcha_required" };
  }

  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const passwordOk = user ? await verifyPassword(input.password, user.passwordHash) : false;

  if (!user || !passwordOk) {
    await prisma.loginAttempt.create({
      data: { email: input.email, ip: meta.ip, successful: false },
    });
    // Generic message — never reveal which field was wrong (§7.3).
    throw new AppError(401, "invalid_credentials", "Incorrect email or password.");
  }

  if (user.status === "suspended" || user.status === "banned") {
    throw new AppError(403, "account_blocked", "Your account is not active. Please contact support.");
  }
  if (user.role === "citizen" && !user.emailVerified) {
    throw new AppError(403, "email_not_verified", "Please verify your email before logging in.");
  }

  // Clear the failure streak on a correct password.
  await prisma.loginAttempt.deleteMany({ where: { email: input.email, successful: false } });

  if (user.twoFactorEnabled) {
    return { kind: "2fa", twoFactorToken: signTwoFactorToken(user.id) };
  }
  return { kind: "tokens", result: await finalizeLogin(user, meta) };
}

export async function loginTwoFactor(
  input: { twoFactorToken: string; code?: string; backupCode?: string },
  meta: ReqMeta,
): Promise<LoginResult> {
  let sub: string;
  try {
    sub = verifyTwoFactorToken(input.twoFactorToken).sub;
  } catch {
    throw new AppError(401, "twofa_expired", "Your 2FA session expired. Please log in again.");
  }
  const user = await prisma.user.findUnique({ where: { id: sub } });
  if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
    throw new AppError(401, "twofa_invalid", "Two-factor authentication is not available for this account.");
  }

  let verified = false;
  if (input.code) {
    verified = verifyTotp(input.code, decryptField(user.twoFactorSecret));
  } else if (input.backupCode) {
    const hash = sha256(input.backupCode.toUpperCase());
    const backup = await prisma.twoFactorBackupCode.findFirst({
      where: { userId: user.id, codeHash: hash, usedAt: null },
    });
    if (backup) {
      await prisma.twoFactorBackupCode.update({
        where: { id: backup.id },
        data: { usedAt: new Date() },
      });
      verified = true;
    }
  }
  if (!verified) throw new AppError(401, "twofa_failed", "Invalid 2FA code.");

  return finalizeLogin(user, meta);
}

// ============================================================================
// Token refresh / logout / sessions
// ============================================================================

export async function refresh(
  refreshToken: string,
  meta: ReqMeta,
): Promise<{ accessToken: string; refreshToken: string }> {
  let claims;
  try {
    claims = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError(401, "invalid_refresh", "Invalid or expired refresh token.");
  }

  const record = await prisma.refreshToken.findUnique({ where: { id: claims.jti } });
  if (!record || record.userId !== claims.sub) {
    throw new AppError(401, "invalid_refresh", "Invalid refresh token.");
  }

  // Reuse detection: a revoked token presented again => compromise. Nuke all.
  if (record.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await prisma.session.deleteMany({ where: { userId: record.userId } });
    throw new AppError(401, "refresh_reuse", "Session reuse detected. Please log in again.");
  }

  if (record.tokenHash !== sha256(refreshToken) || record.expiresAt.getTime() < Date.now()) {
    throw new AppError(401, "invalid_refresh", "Invalid or expired refresh token.");
  }

  const session = await prisma.session.findUnique({ where: { id: claims.sid } });
  if (!session) throw new AppError(401, "session_revoked", "Your session is no longer valid.");

  const user = await prisma.user.findUnique({ where: { id: record.userId } });
  if (!user) throw new AppError(401, "invalid_refresh", "Invalid refresh token.");

  // Rotate.
  await prisma.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });
  const next = await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: "",
      rotatedFrom: record.id,
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    },
  });
  const newRefresh = signRefreshToken({ sub: user.id, jti: next.id, sid: session.id });
  await prisma.refreshToken.update({ where: { id: next.id }, data: { tokenHash: sha256(newRefresh) } });
  await prisma.session.update({
    where: { id: session.id },
    data: { lastActiveAt: new Date(), ip: meta.ip },
  });
  const accessToken = signAccessToken({ sub: user.id, role: user.role, sid: session.id });
  return { accessToken, refreshToken: newRefresh };
}

export async function logout(sessionId: string): Promise<void> {
  // Revoke refresh tokens tied to this session's user and drop the session.
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (session) {
    await prisma.refreshToken.updateMany({
      where: { userId: session.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await prisma.session.delete({ where: { id: sessionId } });
  }
}

export async function listSessions(userId: string, currentSessionId: string) {
  const sessions = await prisma.session.findMany({
    where: { userId },
    orderBy: { lastActiveAt: "desc" },
  });
  return sessions.map((s) => ({
    id: s.id,
    device: s.device,
    browser: s.browser,
    ip: s.ip,
    city: s.city,
    lastActiveAt: s.lastActiveAt,
    current: s.id === currentSessionId,
  }));
}

export async function revokeSession(userId: string, sessionId: string): Promise<void> {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== userId) {
    throw new AppError(404, "not_found", "Session not found.");
  }
  await prisma.session.delete({ where: { id: sessionId } });
}

export async function logoutOtherSessions(userId: string, currentSessionId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId, id: { not: currentSessionId } } });
  await prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}

// ============================================================================
// 7.4 — Forgot / reset / change password
// ============================================================================

export async function forgotPassword(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return; // generic response handled by controller (anti-enumeration)

  const token = randomToken(32);
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + RESET_TTL_MS),
    },
  });
  const link = `${env.WEB_ORIGIN}/reset-password/${token}`;
  const resetT = passwordResetEmail(user.fullName, link);
  await sendEmail({ to: user.email, ...resetT }).catch((e: unknown) =>
    console.warn("[mailer] Password reset email failed (check SMTP config):", e instanceof Error ? e.message : e),
  );
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const record = await prisma.passwordResetToken.findFirst({
    where: { tokenHash: sha256(token) },
  });
  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    throw new AppError(400, "reset_invalid", "This link has expired. Request a new one.");
  }
  const user = await prisma.user.findUnique({ where: { id: record.userId } });
  if (!user) throw new AppError(400, "reset_invalid", "This link has expired. Request a new one.");

  if (await verifyPassword(newPassword, user.passwordHash)) {
    throw new AppError(400, "password_reused", "New password must be different from the previous one.");
  }
  if (await isPasswordPwned(newPassword)) {
    throw new AppError(400, "password_pwned", "This password has appeared in a data breach. Choose another.");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(newPassword) },
  });
  await prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
  // Invalidate all sessions + refresh tokens (§7.4).
  await prisma.session.deleteMany({ where: { userId: user.id } });
  await prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  currentSessionId: string,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, "not_found", "User not found.");
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new AppError(400, "wrong_password", "Your current password is incorrect.");
  }
  if (currentPassword === newPassword) {
    throw new AppError(400, "password_reused", "New password must be different from the current one.");
  }
  if (await isPasswordPwned(newPassword)) {
    throw new AppError(400, "password_pwned", "This password has appeared in a data breach. Choose another.");
  }
  const changedUser = await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(newPassword) } });
  const pwT = passwordChangedEmail(changedUser.fullName);
  await sendEmail({ to: changedUser.email, ...pwT }).catch(() => {});
  // Log out other devices, keep the current session.
  await logoutOtherSessions(userId, currentSessionId);
}

// ============================================================================
// 2FA management (§8.9)
// ============================================================================

export async function setupTwoFactor(userId: string): Promise<{ secret: string; otpauthUrl: string; qrDataUrl: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, "not_found", "User not found.");
  const secret = generateTotpSecret();
  // Persist the (encrypted) secret but keep 2FA disabled until confirmed.
  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorSecret: encryptField(secret), twoFactorEnabled: false },
  });
  const otpauthUrl = buildOtpAuthUrl(user.email, secret);
  return { secret, otpauthUrl, qrDataUrl: await buildQrDataUrl(otpauthUrl) };
}

export async function enableTwoFactor(userId: string, code: string): Promise<{ backupCodes: string[] }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.twoFactorSecret) {
    throw new AppError(400, "twofa_not_setup", "Start 2FA setup first.");
  }
  if (!verifyTotp(code, decryptField(user.twoFactorSecret))) {
    throw new AppError(400, "twofa_failed", "Incorrect code. Please try again.");
  }
  const { codes, hashes } = generateBackupCodes(8);
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: true } }),
    prisma.twoFactorBackupCode.deleteMany({ where: { userId } }),
    prisma.twoFactorBackupCode.createMany({
      data: hashes.map((h) => ({ userId, codeHash: h })),
    }),
  ]);
  return { backupCodes: codes };
}

export async function disableTwoFactor(userId: string, password: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, "not_found", "User not found.");
  if (!(await verifyPassword(password, user.passwordHash))) {
    throw new AppError(400, "wrong_password", "Your password is incorrect.");
  }
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    }),
    prisma.twoFactorBackupCode.deleteMany({ where: { userId } }),
  ]);
}

export async function getMe(userId: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, "not_found", "User not found.");
  return toPublicUser(user);
}
