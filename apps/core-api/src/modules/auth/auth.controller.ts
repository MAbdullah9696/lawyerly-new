/** HTTP layer for auth — thin handlers that delegate to the service. */
import type { Request, Response } from "express";
import * as svc from "./auth.service.js";
import { AppError } from "../../middleware/error.js";

function meta(req: Request): svc.ReqMeta {
  const fwd = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim();
  return { ip: fwd || req.ip || "0.0.0.0", userAgent: req.headers["user-agent"] || "unknown" };
}

// ---- Registration -----------------------------------------------------------
export async function registerUser(req: Request, res: Response) {
  const out = await svc.registerUser(req.body);
  res.status(201).json({
    message: "Account created. We've emailed you a 6-digit verification code.",
    ...out,
    nextStep: "verify_email",
  });
}

export async function verifyEmail(req: Request, res: Response) {
  const result = await svc.verifyEmail(req.body.email, req.body.code, meta(req));
  res.json(result);
}

export async function resendOtp(req: Request, res: Response) {
  const out = await svc.resendOtp(req.body.email);
  res.json({ message: "If the account needs verification, a new code has been sent.", ...out });
}

export async function registerLawyer(req: Request, res: Response) {
  const result = await svc.registerLawyer(req.body);
  res.status(201).json({
    message: "Application received. We'll review it within 48 hours.",
    ...result,
  });
}

// ---- Login ------------------------------------------------------------------
export async function login(req: Request, res: Response) {
  const outcome = await svc.login(req.body, meta(req));
  switch (outcome.kind) {
    case "tokens":
      return res.json(outcome.result);
    case "2fa":
      return res.json({ twoFactorRequired: true, twoFactorToken: outcome.twoFactorToken });
    case "captcha_required":
      return res
        .status(400)
        .json({ error: { code: "captcha_required", message: "Please complete the CAPTCHA." } });
    case "locked":
      return res.status(423).json({
        error: {
          code: "account_locked",
          message: `Too many failed attempts. Try again in ${outcome.minutes} minutes.`,
        },
      });
  }
}

export async function loginTwoFactor(req: Request, res: Response) {
  const result = await svc.loginTwoFactor(req.body, meta(req));
  res.json(result);
}

// ---- Tokens / sessions ------------------------------------------------------
export async function refresh(req: Request, res: Response) {
  const tokens = await svc.refresh(req.body.refreshToken, meta(req));
  res.json(tokens);
}

export async function logout(req: Request, res: Response) {
  if (!req.auth) throw new AppError(401, "unauthorized", "Authentication required.");
  await svc.logout(req.auth.sessionId);
  res.json({ message: "Logged out." });
}

export async function listSessions(req: Request, res: Response) {
  const sessions = await svc.listSessions(req.auth!.userId, req.auth!.sessionId);
  res.json({ sessions });
}

export async function revokeSession(req: Request, res: Response) {
  await svc.revokeSession(req.auth!.userId, req.params.id);
  res.json({ message: "Device logged out." });
}

export async function logoutOthers(req: Request, res: Response) {
  await svc.logoutOtherSessions(req.auth!.userId, req.auth!.sessionId);
  res.json({ message: "All other devices have been logged out." });
}

// ---- Password ---------------------------------------------------------------
export async function forgotPassword(req: Request, res: Response) {
  await svc.forgotPassword(req.body.email);
  res.json({ message: "If this email is registered, you will receive a reset link shortly." });
}

export async function resetPassword(req: Request, res: Response) {
  await svc.resetPassword(req.body.token, req.body.newPassword);
  res.json({ message: "Password changed successfully. Please log in." });
}

export async function changePassword(req: Request, res: Response) {
  await svc.changePassword(
    req.auth!.userId,
    req.body.currentPassword,
    req.body.newPassword,
    req.auth!.sessionId,
  );
  res.json({ message: "Password updated. Other devices have been logged out." });
}

// ---- 2FA --------------------------------------------------------------------
export async function setup2fa(req: Request, res: Response) {
  const out = await svc.setupTwoFactor(req.auth!.userId);
  res.json(out);
}

export async function enable2fa(req: Request, res: Response) {
  const out = await svc.enableTwoFactor(req.auth!.userId, req.body.code);
  res.json({ message: "Two-factor authentication enabled. Save these backup codes.", ...out });
}

export async function disable2fa(req: Request, res: Response) {
  await svc.disableTwoFactor(req.auth!.userId, req.body.password);
  res.json({ message: "Two-factor authentication disabled." });
}

// ---- Me ---------------------------------------------------------------------
export async function me(req: Request, res: Response) {
  const user = await svc.getMe(req.auth!.userId);
  res.json({ user });
}
