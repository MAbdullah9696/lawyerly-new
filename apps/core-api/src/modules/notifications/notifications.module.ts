/** Notifications (§13). Mounted at /api/notifications. Any authenticated user. */
import { Router } from "express";
import { z } from "zod";
import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../middleware/error.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const PAGE_SIZE = 20;

const listQuery = z.object({ page: z.coerce.number().int().min(1).default(1) });
const idParam = z.object({ id: z.string().uuid() });

async function list(req: Request, res: Response) {
  const userId = req.auth!.userId;
  const page = Number((req.query as { page?: number }).page ?? 1);
  const [total, items, unreadCount] = await Promise.all([
    prisma.notification.count({ where: { userId } }),
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.notification.count({ where: { userId, read: false } }),
  ]);
  res.json({
    items: items.map((n) => ({
      id: n.id,
      type: n.type,
      text: n.text,
      link: n.link,
      read: n.read,
      createdAt: n.createdAt,
    })),
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    unreadCount,
  });
}

async function markRead(req: Request, res: Response) {
  const n = await prisma.notification.findUnique({ where: { id: req.params.id } });
  if (!n || n.userId !== req.auth!.userId) throw new AppError(404, "not_found", "Notification not found.");
  await prisma.notification.update({ where: { id: n.id }, data: { read: true } });
  res.json({ message: "Marked as read." });
}

async function markAllRead(req: Request, res: Response) {
  await prisma.notification.updateMany({ where: { userId: req.auth!.userId, read: false }, data: { read: true } });
  res.json({ message: "All notifications marked as read." });
}

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);
notificationsRouter.get("/", validate({ query: listQuery }), asyncHandler(list));
notificationsRouter.patch("/:id/read", validate({ params: idParam }), asyncHandler(markRead));
notificationsRouter.patch("/read-all", asyncHandler(markAllRead));
