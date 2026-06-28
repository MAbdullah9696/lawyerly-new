/**
 * Authentication + RBAC middleware.
 *  - requireAuth: verifies the access token, confirms the session still exists,
 *    and attaches the user context to the request.
 *  - requireRole: gates a route to one or more roles (verified server-side, §11).
 */
import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { verifyAccessToken } from "../lib/jwt.js";
import { AppError } from "./error.js";

export interface AuthContext {
  userId: string;
  role: UserRole;
  sessionId: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new AppError(401, "unauthorized", "Authentication required.");
    }
    const token = header.slice("Bearer ".length).trim();
    let claims;
    try {
      claims = verifyAccessToken(token);
    } catch {
      throw new AppError(401, "invalid_token", "Your session has expired. Please log in again.");
    }

    // Session must still be active (supports remote logout / session revocation).
    const session = await prisma.session.findUnique({ where: { id: claims.sid } });
    if (!session || session.userId !== claims.sub) {
      throw new AppError(401, "session_revoked", "Your session is no longer valid. Please log in again.");
    }

    // Touch last-active for the inactivity model (§11).
    await prisma.session.update({
      where: { id: session.id },
      data: { lastActiveAt: new Date() },
    });

    req.auth = { userId: claims.sub, role: claims.role, sessionId: claims.sid };
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(new AppError(401, "unauthorized", "Authentication required."));
    if (!roles.includes(req.auth.role)) {
      return next(new AppError(403, "forbidden", "You do not have permission to access this resource."));
    }
    next();
  };
}
