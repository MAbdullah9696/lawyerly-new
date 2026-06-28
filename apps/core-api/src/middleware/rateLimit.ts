/**
 * Rate limiting (§11): 60 req/min per IP for public/unauthenticated traffic,
 * 300 req/min for authenticated traffic. Auth endpoints use the public limiter.
 */
import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";

export const publicLimiter = rateLimit({
  windowMs: 60_000,
  limit: env.RATE_LIMIT_PUBLIC_PER_MIN,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "rate_limited", message: "Too many requests. Please slow down." } },
});

export const authedLimiter = rateLimit({
  windowMs: 60_000,
  limit: env.RATE_LIMIT_AUTH_PER_MIN,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "rate_limited", message: "Too many requests. Please slow down." } },
});
