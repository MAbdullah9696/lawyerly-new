/** Admin panel routes (§12). Mounted at /api/admin. */
import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as c from "./admin.controller.js";
import * as s from "./admin.schemas.js";
import { validate } from "../../middleware/validate.js";
import { requireAdmin, requireAdminRole } from "../../middleware/adminAuth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

// Strict per-IP rate limit on the 2FA endpoint (H-4 fix): 5 attempts per minute.
const adminTwoFaLimiter = rateLimit({
  windowMs: 60_000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "rate_limited", message: "Too many 2FA attempts. Please wait a moment." } },
});

export const adminRouter = Router();

// --- Public admin auth (login + mandatory TOTP) ---
adminRouter.post("/auth/login", validate({ body: s.loginSchema }), asyncHandler(c.login));
adminRouter.post("/auth/2fa", adminTwoFaLimiter, validate({ body: s.twofaSchema }), asyncHandler(c.verify2fa));

// --- Everything below requires an authenticated admin session ---
adminRouter.use(requireAdmin);

adminRouter.post("/auth/logout", asyncHandler(c.logout));
adminRouter.get("/auth/me", asyncHandler(c.me));

// Read endpoints — any admin (analysts included)
adminRouter.get("/dashboard", asyncHandler(c.dashboard));
adminRouter.get("/verifications", validate({ query: s.verifTabQuery }), asyncHandler(c.verifications));
adminRouter.get("/verifications/:id", validate({ params: s.idParam }), asyncHandler(c.verification));
adminRouter.get("/users", validate({ query: s.userListQuery }), asyncHandler(c.users));
adminRouter.get("/users/:id", validate({ params: s.idParam }), asyncHandler(c.userDetail));
adminRouter.get("/reports", validate({ query: s.reportListQuery }), asyncHandler(c.reports));
adminRouter.get("/reports/:id", validate({ params: s.idParam }), asyncHandler(c.report));
adminRouter.get("/reviews", validate({ query: s.reviewListQuery }), asyncHandler(c.reviews));
adminRouter.get("/analytics", validate({ query: s.analyticsQuery }), asyncHandler(c.analytics));
adminRouter.get("/audit-log", validate({ query: s.auditQuery }), asyncHandler(c.auditLog));
adminRouter.get("/settings", asyncHandler(c.settings));

// Write endpoints — super_admin + moderator (analysts blocked at RBAC level)
const MOD = requireAdminRole("super_admin", "moderator");
adminRouter.patch("/verifications/:id/approve", MOD, validate({ params: s.idParam }), asyncHandler(c.approve));
adminRouter.patch("/verifications/:id/reject", MOD, validate({ params: s.idParam, body: s.rejectSchema }), asyncHandler(c.reject));
adminRouter.patch("/verifications/:id/documents/:docId", MOD, validate({ params: s.docParams, body: s.docSchema }), asyncHandler(c.verifyDoc));
adminRouter.post("/users/:id/suspend", MOD, validate({ params: s.idParam, body: s.suspendSchema }), asyncHandler(c.suspend));
adminRouter.post("/users/:id/ban", MOD, validate({ params: s.idParam, body: s.banSchema }), asyncHandler(c.ban));
adminRouter.post("/users/:id/lift-suspension", MOD, validate({ params: s.idParam }), asyncHandler(c.lift));
adminRouter.post("/users/:id/reset-password", MOD, validate({ params: s.idParam }), asyncHandler(c.resetPassword));
adminRouter.post("/reports/:id/resolve", MOD, validate({ params: s.idParam, body: s.resolveSchema }), asyncHandler(c.resolveReport));
adminRouter.post("/reviews/:id/approve-flag", MOD, validate({ params: s.idParam }), asyncHandler(c.approveFlag));
adminRouter.post("/reviews/:id/remove", MOD, validate({ params: s.idParam, body: s.removeReviewSchema }), asyncHandler(c.removeReview));

// Super-admin only — system config + admin account management
const SUPER = requireAdminRole("super_admin");
adminRouter.patch("/settings", SUPER, validate({ body: s.settingsSchema }), asyncHandler(c.updateSettings));
adminRouter.post("/accounts", SUPER, validate({ body: s.createAdminSchema }), asyncHandler(c.createAccount));
adminRouter.patch("/accounts/:id", SUPER, validate({ params: s.idParam, body: s.updateAdminSchema }), asyncHandler(c.updateAccount));
