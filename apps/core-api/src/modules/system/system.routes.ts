import { Router } from "express";
import { prisma } from "../../lib/prisma.js";

export const systemRouter = Router();

/** Public — no auth. Returns maintenance mode flag for Next.js middleware. */
systemRouter.get("/status", async (_req, res, next) => {
  try {
    const cfg = await prisma.systemConfig.findUnique({ where: { id: true } });
    res.json({ maintenanceMode: cfg?.maintenanceMode ?? false });
  } catch (err) {
    next(err);
  }
});
