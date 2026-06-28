/**
 * JWT helpers. Access tokens: 15-min (§11). Refresh tokens: 30-day, rotated on
 * each use. A short-lived "2fa" token bridges the password step and the TOTP
 * step during login (§7.3).
 */
import jwt from "jsonwebtoken";
import type { UserRole, AdminRole } from "@prisma/client";
import { env } from "../config/env.js";

export interface AccessClaims {
  sub: string; // user id
  role: UserRole;
  sid: string; // session id
  typ: "access";
}

export interface RefreshClaims {
  sub: string;
  jti: string; // refresh token record id
  sid: string;
  typ: "refresh";
}

export interface TwoFactorClaims {
  sub: string;
  typ: "2fa";
}

// Admin tokens (§12). The 12h TTL is a ceiling; the real control is the
// admin_session 30-min inactivity window enforced server-side.
export interface AdminClaims {
  sub: string; // admin account id
  role: AdminRole;
  sid: string; // admin session id
  typ: "admin";
}
export interface AdminTwoFactorClaims {
  sub: string;
  typ: "admin_2fa";
}

export function signAdminToken(claims: Omit<AdminClaims, "typ">): string {
  return jwt.sign({ ...claims, typ: "admin" }, env.JWT_ACCESS_SECRET, { expiresIn: "12h" } as jwt.SignOptions);
}
export function verifyAdminToken(token: string): AdminClaims {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as AdminClaims;
  if (decoded.typ !== "admin") throw new Error("Wrong token type");
  return decoded;
}
export function signAdminTwoFactorToken(sub: string): string {
  return jwt.sign({ sub, typ: "admin_2fa" }, env.JWT_ACCESS_SECRET, { expiresIn: "5m" } as jwt.SignOptions);
}
export function verifyAdminTwoFactorToken(token: string): AdminTwoFactorClaims {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as AdminTwoFactorClaims;
  if (decoded.typ !== "admin_2fa") throw new Error("Wrong token type");
  return decoded;
}

export function signAccessToken(claims: Omit<AccessClaims, "typ">): string {
  return jwt.sign({ ...claims, typ: "access" }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL,
  } as jwt.SignOptions);
}

export function signRefreshToken(claims: Omit<RefreshClaims, "typ">): string {
  return jwt.sign({ ...claims, typ: "refresh" }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_TTL,
  } as jwt.SignOptions);
}

export function signTwoFactorToken(sub: string): string {
  return jwt.sign({ sub, typ: "2fa" }, env.JWT_ACCESS_SECRET, {
    expiresIn: "5m",
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessClaims {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessClaims;
  if (decoded.typ !== "access") throw new Error("Wrong token type");
  return decoded;
}

export function verifyRefreshToken(token: string): RefreshClaims {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshClaims;
  if (decoded.typ !== "refresh") throw new Error("Wrong token type");
  return decoded;
}

export function verifyTwoFactorToken(token: string): TwoFactorClaims {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as TwoFactorClaims;
  if (decoded.typ !== "2fa") throw new Error("Wrong token type");
  return decoded;
}
