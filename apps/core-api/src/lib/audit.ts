/** Append-only admin audit log (§12.9). Every admin action records an entry. */
import { prisma } from "./prisma.js";

export async function writeAudit(
  adminUsername: string,
  actionType: string,
  targetId?: string | null,
  details?: Record<string, unknown>,
): Promise<void> {
  await prisma.auditLog.create({
    data: { adminUsername, actionType, targetId: targetId ?? null, details: (details ?? {}) as never },
  });
}
