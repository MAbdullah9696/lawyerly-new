/** Zod schemas for every auth request (CLAUDE.md §7). */
import { z } from "zod";
import { Province, LawyerDocType } from "@prisma/client";
import { validatePasswordStrength } from "../../lib/password.js";

const email = z.string().trim().toLowerCase().email("Enter a valid email address.");

const strongPassword = z.string().superRefine((val, ctx) => {
  const msg = validatePasswordStrength(val);
  if (msg) ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg });
});

const phone = z.string().trim().min(7).max(20).optional();

// Years-of-experience: accept the friendly band, store the Prisma enum value.
const experienceBand = z
  .enum(["1-5", "6-10", "11-20", "20+"])
  .transform((v) =>
    ({ "1-5": "BAND_1_5", "6-10": "BAND_6_10", "11-20": "BAND_11_20", "20+": "BAND_20_PLUS" } as const)[v],
  );

// ---- 7.1 User registration --------------------------------------------------
export const registerUserSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120),
    email,
    phone,
    password: strongPassword,
    confirmPassword: z.string(),
    agreeTerms: z.literal(true, {
      errorMap: () => ({ message: "You must accept the Terms and Privacy Policy." }),
    }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export const verifyEmailSchema = z.object({
  email,
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code."),
});

export const resendOtpSchema = z.object({ email });

// ---- 7.2 Lawyer registration ------------------------------------------------
const REQUIRED_DOCS: LawyerDocType[] = [
  LawyerDocType.bar_council_cert,
  LawyerDocType.cnic_front,
  LawyerDocType.cnic_back,
  LawyerDocType.law_degree,
  LawyerDocType.profile_photo,
];

export const registerLawyerSchema = z
  .object({
    // Step 1 — account info
    fullLegalName: z.string().trim().min(2).max(160),
    cnic: z.string().regex(/^\d{5}-\d{7}-\d$/, "CNIC must be in the format XXXXX-XXXXXXX-X."),
    email,
    phone: z.string().trim().min(7).max(20),
    password: strongPassword,
    confirmPassword: z.string(),
    // Step 2 — professional details
    barCouncilNumber: z.string().trim().min(2).max(60),
    province: z.nativeEnum(Province),
    city: z.string().trim().min(2).max(80),
    yearsExperienceBand: experienceBand,
    practiceAreas: z.array(z.string().trim().min(1)).min(1, "Select at least one practice area."),
    languages: z.array(z.string().trim().min(1)).min(1, "Select at least one language."),
    consultationFeePkr: z.number().int().min(0).max(10_000_000),
    bio: z.string().trim().min(200, "Bio must be at least 200 characters."),
    // Step 3 — documents (all 5 mandatory). Binary upload to object storage
    // arrives in Milestone 8; here we record the document references.
    documents: z
      .array(z.object({ docType: z.nativeEnum(LawyerDocType), fileUrl: z.string().min(1) }))
      .superRefine((docs, ctx) => {
        const provided = new Set(docs.map((d) => d.docType));
        for (const required of REQUIRED_DOCS) {
          if (!provided.has(required)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Missing required document: ${required}` });
          }
        }
      }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

// ---- 7.3 Login --------------------------------------------------------------
export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required."),
  rememberMe: z.boolean().optional().default(false),
  captchaToken: z.string().optional(),
});

export const loginTwoFactorSchema = z
  .object({
    twoFactorToken: z.string().min(1),
    code: z.string().regex(/^\d{6}$/).optional(),
    backupCode: z.string().min(6).optional(),
  })
  .refine((d) => d.code || d.backupCode, {
    message: "Provide a 6-digit code or a backup code.",
    path: ["code"],
  });

// ---- Tokens / sessions ------------------------------------------------------
export const refreshSchema = z.object({ refreshToken: z.string().min(1) });
export const logoutSchema = z.object({ refreshToken: z.string().min(1).optional() });
export const sessionIdParam = z.object({ id: z.string().uuid() });

// ---- 7.4 Forgot / reset / change password ----------------------------------
export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    newPassword: strongPassword,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: strongPassword,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

// ---- 2FA management ---------------------------------------------------------
export const enable2faSchema = z.object({ code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code.") });
export const disable2faSchema = z.object({ password: z.string().min(1) });
