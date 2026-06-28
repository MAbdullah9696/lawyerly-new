import { z } from "zod";

export const sendMessageSchema = z.object({
  sessionId: z.string().uuid().optional(),
  message: z.string().trim().min(1, "Message cannot be empty.").max(1000, "Message is too long (max 1000)."),
});

export const sessionIdParam = z.object({ id: z.string().uuid() });
export const messageIdParam = z.object({ id: z.string().uuid() });

export const feedbackSchema = z.object({
  feedback: z.enum(["up", "down"]).nullable(),
});
