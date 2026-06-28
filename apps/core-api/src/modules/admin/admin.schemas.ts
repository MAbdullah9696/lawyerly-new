import { z } from "zod";
import { AdminRole } from "@prisma/client";

// Auth
export const loginSchema = z.object({ username: z.string().trim().min(1), password: z.string().min(1) });
export const twofaSchema = z.object({ twoFactorToken: z.string().min(1), code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code.") });

// Common
export const idParam = z.object({ id: z.string().uuid() });

// Verifications
export const verifTabQuery = z.object({ tab: z.enum(["pending", "approved", "rejected", "resubmitted"]).default("pending") });
export const rejectSchema = z.object({ reason: z.string().trim().min(50, "Reason must be at least 50 characters."), allowResubmission: z.boolean().default(true) });
export const docParams = z.object({ id: z.string().uuid(), docId: z.string().uuid() });
export const docSchema = z.object({ status: z.enum(["verified", "issue_found"]), issueNote: z.string().trim().max(500).optional() });

// Users
export const userListQuery = z.object({
  q: z.string().trim().optional(), role: z.enum(["all", "citizen", "lawyer"]).optional(),
  status: z.enum(["all", "active", "suspended", "banned", "pending"]).optional(),
  from: z.string().optional(), to: z.string().optional(),
});
export const suspendSchema = z.object({ days: z.number().int().min(1).max(365).nullable().default(7), reason: z.string().trim().min(1, "A reason is required.") });
export const banSchema = z.object({ confirmEmail: z.string().trim() });

// Reports
export const reportListQuery = z.object({ status: z.enum(["all", "open", "resolved"]).optional(), priority: z.enum(["all", "high", "medium", "low"]).optional(), type: z.enum(["all", "conversation", "profile", "review"]).optional() });
export const resolveSchema = z.object({
  action: z.enum(["dismiss", "warn", "suspend", "ban", "remove_content"]),
  resolutionNote: z.string().trim().min(20, "Resolution note must be at least 20 characters."),
  reviewId: z.string().uuid().optional(),
  days: z.number().int().min(1).max(365).optional(),
});

// Reviews
export const reviewListQuery = z.object({ flagged: z.enum(["true", "false"]).optional(), q: z.string().trim().optional() });
export const removeReviewSchema = z.object({ reason: z.string().trim().min(1, "A reason is required.") });

// Analytics & audit
export const analyticsQuery = z.object({ from: z.string().optional(), to: z.string().optional() });
export const auditQuery = z.object({ q: z.string().trim().optional(), from: z.string().optional(), to: z.string().optional(), page: z.coerce.number().int().min(1).default(1) });

// Settings & accounts
export const settingsSchema = z.object({
  chatbotDisclaimerText: z.string().trim().min(1).optional(),
  platformFeePercent: z.number().min(0).max(100).optional(),
  maintenanceMode: z.boolean().optional(),
  emailTemplates: z.record(z.string(), z.string()).optional(),
  practiceAreas: z.array(z.object({ name: z.string().trim().min(1), enabled: z.boolean() })).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: "Nothing to update." });
export const createAdminSchema = z.object({ username: z.string().trim().min(3).max(40), password: z.string().min(8), role: z.nativeEnum(AdminRole) });
export const updateAdminSchema = z.object({ role: z.nativeEnum(AdminRole).optional(), isActive: z.boolean().optional() }).refine((d) => Object.keys(d).length > 0, { message: "Nothing to update." });
