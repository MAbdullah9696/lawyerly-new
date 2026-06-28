import { z } from "zod";
import { AvailabilityStatus, PayoutMethodType } from "@prisma/client";

export const requestsQuery = z.object({
  tab: z.enum(["pending", "declined", "expired"]).default("pending"),
});

export const casesQuery = z.object({
  tab: z.enum(["active", "closed"]).default("active"),
});

export const idParam = z.object({ id: z.string().uuid() });

export const declineSchema = z.object({
  reason: z.enum([
    "Not my area of expertise",
    "Currently at capacity",
    "Insufficient case details",
    "Other",
  ]),
  message: z.string().trim().max(200).optional(),
});

export const caseNotesSchema = z.object({
  caseNotes: z.string().max(10000).default(""),
});

export const availabilitySchema = z.object({
  availability: z.nativeEnum(AvailabilityStatus),
});

// §10.5 — editable fields only. Read-only (name, CNIC, Bar Council, law degree)
// are intentionally absent.
export const updateProfileSchema = z
  .object({
    bio: z.string().trim().min(200, "Bio must be at least 200 characters.").optional(),
    practiceAreas: z.array(z.string().trim().min(1)).min(1).optional(),
    languages: z.array(z.string().trim().min(1)).min(1).optional(),
    consultationFeePkr: z.number().int().min(0).max(10_000_000).optional(),
    availability: z.nativeEnum(AvailabilityStatus).optional(),
    showWinLossStats: z.boolean().optional(),
    profilePhotoUrl: z.string().max(2048).nullable().optional(),
    // Win/loss stats are self-reported by the lawyer (M1 decision).
    wlTotal: z.number().int().min(0).optional(),
    wlWon: z.number().int().min(0).optional(),
    wlLost: z.number().int().min(0).optional(),
    wlOngoing: z.number().int().min(0).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "No fields to update." });

export const payoutMethodSchema = z.object({
  type: z.nativeEnum(PayoutMethodType),
  details: z.record(z.string(), z.string()), // {iban,title} | {mobile}
  isDefault: z.boolean().optional().default(false),
});

// §10.7 — settings (consultation cap + auto-decline)
export const lawyerSettingsSchema = z
  .object({
    maxActiveConsultations: z.number().int().min(1).max(50).optional(),
    autoDeclineWhenOffline: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "No fields to update." });
