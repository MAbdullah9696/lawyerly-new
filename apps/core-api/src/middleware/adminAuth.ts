/**
 * Admin authentication + RBAC (§12). Separate from the user auth system —
 * admins live in admin_accounts. Enforces single-session + 30-min inactivity.
 */
import type { NextFunction, Request, Response } from "express";
import type { AdminRole } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { verifyAdminToken } from "../lib/jwt.js";
import { env } from "../config/env.js";
import { AppError } from "./error.js";

export interface AdminContext {
  id: string;
  username: string;
  role: AdminRole;
  sessionId: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      admin?: AdminContext;
    }
  }
}

export async function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw new AppError(401, "unauthorized", "Admin authentication required.");
    let claims;
    try {
      claims = verifyAdminToken(header.slice(7).trim());
    } catch {
      throw new AppError(401, "invalid_token", "Your admin session is invalid. Please log in again.");
    }

    const session = await prisma.adminSession.findUnique({ where: { id: claims.sid } });
    if (!session || session.adminId !== claims.sub) {
      throw new AppError(401, "session_revoked", "Your admin session is no longer valid. Please log in again.");
    }

    // 30-minute inactivity window (§12.1).
    const idleMs = Date.now() - session.lastActiveAt.getTime();
    if (idleMs > env.ADMIN_SESSION_TIMEOUT_MIN * 60_000) {
      await prisma.adminSession.delete({ where: { id: session.id } });
      throw new AppError(401, "session_expired", "Your admin session timed out due to inactivity. Please log in again.");
    }

    const admin = await prisma.adminAccount.findUnique({ where: { id: claims.sub } });
    if (!admin || !admin.isActive) throw new AppError(401, "account_disabled", "This admin account is not active.");

    await prisma.adminSession.update({ where: { id: session.id }, data: { lastActiveAt: new Date() } });
    req.admin = { id: admin.id, username: admin.username, role: admin.role, sessionId: session.id };
    next();
  } catch (err) {
    next(err);
  }
}

/** Restrict to specific admin sub-roles (analysts are read-only — excluded from writes). */
export function requireAdminRole(...roles: AdminRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.admin) return next(new AppError(401, "unauthorized", "Admin authentication required."));
    if (!roles.includes(req.admin.role)) {
      return next(new AppError(403, "forbidden", "Your admin role does not permit this action."));
    }
    next();
  };
}
