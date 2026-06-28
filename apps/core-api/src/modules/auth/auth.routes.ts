/** Auth routes (CLAUDE.md §7). Mounted at /api/auth. */
import { Router } from "express";
import * as c from "./auth.controller.js";
import * as s from "./auth.schemas.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const authRouter = Router();

// ---- 7.1 User registration --------------------------------------------------
authRouter.post("/register/user", validate({ body: s.registerUserSchema }), asyncHandler(c.registerUser));
authRouter.post("/register/verify-email", validate({ body: s.verifyEmailSchema }), asyncHandler(c.verifyEmail));
authRouter.post("/register/resend-otp", validate({ body: s.resendOtpSchema }), asyncHandler(c.resendOtp));

// ---- 7.2 Lawyer registration ------------------------------------------------
authRouter.post("/register/lawyer", validate({ body: s.registerLawyerSchema }), asyncHandler(c.registerLawyer));

// ---- 7.3 Login --------------------------------------------------------------
authRouter.post("/login", validate({ body: s.loginSchema }), asyncHandler(c.login));
authRouter.post("/login/2fa", validate({ body: s.loginTwoFactorSchema }), asyncHandler(c.loginTwoFactor));

// ---- Tokens / sessions ------------------------------------------------------
authRouter.post("/refresh", validate({ body: s.refreshSchema }), asyncHandler(c.refresh));
authRouter.post("/logout", requireAuth, asyncHandler(c.logout));
authRouter.get("/sessions", requireAuth, asyncHandler(c.listSessions));
authRouter.delete("/sessions/:id", requireAuth, validate({ params: s.sessionIdParam }), asyncHandler(c.revokeSession));
authRouter.post("/sessions/logout-others", requireAuth, asyncHandler(c.logoutOthers));

// ---- 7.4 Password -----------------------------------------------------------
authRouter.post("/forgot-password", validate({ body: s.forgotPasswordSchema }), asyncHandler(c.forgotPassword));
authRouter.post("/reset-password", validate({ body: s.resetPasswordSchema }), asyncHandler(c.resetPassword));
authRouter.post("/change-password", requireAuth, validate({ body: s.changePasswordSchema }), asyncHandler(c.changePassword));

// ---- 2FA management (§8.9) --------------------------------------------------
authRouter.post("/2fa/setup", requireAuth, asyncHandler(c.setup2fa));
authRouter.post("/2fa/enable", requireAuth, validate({ body: s.enable2faSchema }), asyncHandler(c.enable2fa));
authRouter.post("/2fa/disable", requireAuth, validate({ body: s.disable2faSchema }), asyncHandler(c.disable2fa));

// ---- Current user -----------------------------------------------------------
authRouter.get("/me", requireAuth, asyncHandler(c.me));
