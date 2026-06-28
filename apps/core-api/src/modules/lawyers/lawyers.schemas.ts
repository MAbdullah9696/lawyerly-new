import { z } from "zod";

export const listLawyersQuery = z.object({
  q: z.string().trim().optional(),
  practiceArea: z.string().optional(), // comma-separated
  city: z.string().trim().optional(),
  language: z.string().optional(), // comma-separated
  minFee: z.coerce.number().int().min(0).optional(),
  maxFee: z.coerce.number().int().min(0).optional(),
  experience: z.enum(["Any", "1-5", "6-10", "11+"]).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  sort: z.enum(["relevant", "rating", "fee_low", "fee_high", "experience", "reviews"]).default("relevant"),
  page: z.coerce.number().int().min(1).default(1),
});

export const lawyerIdParam = z.object({ id: z.string().uuid() });

export const reviewsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  sort: z.enum(["recent", "highest", "lowest"]).default("recent"),
});
