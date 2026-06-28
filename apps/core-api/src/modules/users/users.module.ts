/** Citizen profile (§8.9 profile section). Mounted at /api/users. */
import { Router } from "express";
import { z } from "zod";
import type { Request, Response } from "express";
import { Province } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { resolvePhotoUrl } from "../../lib/storage.js";
import { AppError } from "../../middleware/error.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

// Email is read-only post-registration (§8.9). Profile photo upload is
// metadata-only until Milestone 8 (object storage).
const updateSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().min(7).max(20).nullable().optional(),
  province: z.nativeEnum(Province).nullable().optional(),
  profilePhotoUrl: z.string().max(2048).nullable().optional(),
});

async function publicProfile(u: {
  id: string; role: string; fullName: string; email: string; phone: string | null;
  province: string | null; profilePhotoUrl: string | null; twoFactorEnabled: boolean; status: string;
}) {
  return {
    id: u.id, role: u.role, fullName: u.fullName, email: u.email, phone: u.phone,
    province: u.province, profilePhotoUrl: await resolvePhotoUrl(u.profilePhotoUrl),
    twoFactorEnabled: u.twoFactorEnabled, status: u.status,
  };
}

async function getMe(req: Request, res: Response) {
  const u = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!u) throw new AppError(404, "not_found", "User not found.");
  res.json({ profile: await publicProfile(u) });
}

async function updateMe(req: Request, res: Response) {
  const data = req.body as z.infer<typeof updateSchema>;
  const u = await prisma.user.update({
    where: { id: req.auth!.userId },
    data: {
      ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.province !== undefined ? { province: data.province } : {}),
      ...(data.profilePhotoUrl !== undefined ? { profilePhotoUrl: data.profilePhotoUrl } : {}),
    },
  });
  res.json({ message: "Profile updated.", profile: await publicProfile(u) });
}

export const usersRouter = Router();
usersRouter.use(requireAuth);
usersRouter.get("/me", asyncHandler(getMe));
usersRouter.patch("/me", validate({ body: updateSchema }), asyncHandler(updateMe));
