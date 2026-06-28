import { z } from "zod";

export const uploadSchema = z.object({
  objectKey: z.string().min(1).max(512),
  fileName: z.string().min(1).max(255),
  fileType: z.string().min(1).max(128),
});

export const shareSchema = z.object({
  consultationId: z.string().uuid(),
});
