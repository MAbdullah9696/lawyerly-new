import { z } from "zod";
import { CaseType } from "@prisma/client";

export const createRequestSchema = z.object({
  lawyerId: z.string().uuid(),
  caseType: z.nativeEnum(CaseType),
  description: z.string().trim().min(1, "Please describe your case.").max(500, "Max 500 characters."),
});

export const idParam = z.object({ id: z.string().uuid() });

export const listQuery = z.object({
  tab: z.enum(["active", "pending", "closed"]).default("active"),
});

export const messagesQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
});

export const sendMessageSchema = z.object({
  text: z.string().trim().min(1, "Message cannot be empty.").max(5000),
});

export const attachSchema = z.object({
  documentId: z.string().uuid(),
});

export const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  text: z.string().trim().max(500).optional(),
  caseType: z.nativeEnum(CaseType).optional(),
});
