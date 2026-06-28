/**
 * Consultations service (§8.5/§8.6/§8.8, §10.3/§10.4).
 * Message text is encrypted at rest (AES-256-GCM, lib/crypto). Lawyer case
 * notes are NEVER returned to a citizen — see getConsultationHeader.
 */
import type { CaseType, Message } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { resolvePhotoUrl } from "../../lib/storage.js";
import { AppError } from "../../middleware/error.js";
import { sendEmail } from "../../lib/mailer.js";
import {
  consultationAcceptedEmail, requestExpiredEmail, consultationClosedEmail,
  newConsultationRequestEmail, requestAutoExpiredEmail, newReviewEmail,
} from "../../lib/emailTemplates.js";
import { encryptField, decryptField } from "../../lib/crypto.js";
import { isUserInRoom, emitToRoom } from "../../realtime/io.js";

const firstName = (full: string) => full.split(" ")[0];
const REQUEST_TTL_MS = 24 * 60 * 60 * 1000;
const MESSAGE_PAGE_SIZE = 50;

async function notify(userId: string, type: string, text: string, link: string | null, email?: { to: string; subject: string; text: string; html?: string }) {
  await prisma.notification.create({ data: { userId, type, text, link } });
  if (email) sendEmail(email).catch(() => {});
}

// ---- participant guard ------------------------------------------------------
export async function participant(userId: string, consultationId: string) {
  const c = await prisma.consultation.findUnique({ where: { id: consultationId } });
  if (!c) throw new AppError(404, "consultation_not_found", "Consultation not found.");
  if (c.userId !== userId && c.lawyerId !== userId) {
    throw new AppError(403, "forbidden", "You are not a participant in this consultation.");
  }
  return { consultation: c, otherPartyId: c.userId === userId ? c.lawyerId : c.userId };
}

// ---- message helpers --------------------------------------------------------
export function messageToPayload(m: Message) {
  return {
    id: m.id,
    consultationId: m.consultationId,
    senderId: m.senderId,
    text: m.text ? decryptField(m.text) : null,
    attachments: m.attachments,
    deliveryStatus: m.deliveryStatus,
    createdAt: m.createdAt,
  };
}

/** Encrypt + persist a message, set delivery by recipient presence, emit to room. */
export async function createMessage(
  consultationId: string,
  senderId: string,
  plainText: string | null,
  attachments: unknown[] = [],
) {
  const { consultation, otherPartyId } = await participant(senderId, consultationId);
  if (consultation.status !== "active") {
    throw new AppError(409, "consultation_closed", "This consultation is closed.");
  }
  const present = await isUserInRoom(consultationId, otherPartyId);
  const msg = await prisma.message.create({
    data: {
      consultationId,
      senderId,
      text: plainText ? encryptField(plainText) : null,
      attachments: attachments as never,
      deliveryStatus: present ? "delivered" : "sent",
    },
  });
  const payload = messageToPayload(msg);
  emitToRoom(consultationId, "message", payload);
  return payload;
}

/** Mark the OTHER party's messages as delivered for this recipient; emit receipt. */
export async function markDelivered(consultationId: string, recipientId: string) {
  const affected = await prisma.message.findMany({
    where: { consultationId, senderId: { not: recipientId }, deliveryStatus: "sent" },
    select: { id: true },
  });
  if (affected.length === 0) return;
  await prisma.message.updateMany({
    where: { consultationId, senderId: { not: recipientId }, deliveryStatus: "sent" },
    data: { deliveryStatus: "delivered" },
  });
  emitToRoom(consultationId, "receipt", { messageIds: affected.map((a) => a.id), status: "delivered" });
}

/** Mark the OTHER party's messages as read; emit receipt. */
export async function markRead(consultationId: string, readerId: string) {
  const affected = await prisma.message.findMany({
    where: { consultationId, senderId: { not: readerId }, deliveryStatus: { in: ["sent", "delivered"] } },
    select: { id: true },
  });
  if (affected.length === 0) return;
  await prisma.message.updateMany({
    where: { consultationId, senderId: { not: readerId }, deliveryStatus: { in: ["sent", "delivered"] } },
    data: { deliveryStatus: "read" },
  });
  emitToRoom(consultationId, "receipt", { messageIds: affected.map((a) => a.id), status: "read" });
}

export async function getMessages(userId: string, consultationId: string, page = 1) {
  await participant(userId, consultationId);
  const [total, rows] = await Promise.all([
    prisma.message.count({ where: { consultationId } }),
    prisma.message.findMany({
      where: { consultationId },
      orderBy: { createdAt: "asc" },
      skip: (page - 1) * MESSAGE_PAGE_SIZE,
      take: MESSAGE_PAGE_SIZE,
    }),
  ]);
  return { messages: rows.map(messageToPayload), total, page, pageSize: MESSAGE_PAGE_SIZE };
}

export async function attachDocument(userId: string, consultationId: string, documentId: string) {
  await participant(userId, consultationId);
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc || doc.userId !== userId) throw new AppError(404, "document_not_found", "Document not found.");
  return createMessage(consultationId, userId, null, [{ documentId: doc.id, fileName: doc.fileName }]);
}

// ---- consultation header (role-aware; NO case notes for citizen) -----------
export async function getConsultationHeader(userId: string, consultationId: string) {
  const { consultation: c } = await participant(userId, consultationId);
  const viewerIsLawyer = c.lawyerId === userId;
  const otherId = viewerIsLawyer ? c.userId : c.lawyerId;
  const other = await prisma.user.findUnique({
    where: { id: otherId },
    include: { lawyerProfile: { select: { availability: true } } },
  });
  const review = await prisma.review.findUnique({ where: { consultationId } });
  return {
    id: c.id,
    status: c.status,
    caseType: c.caseType,
    startedAt: c.startedAt,
    closedAt: c.closedAt,
    viewerRole: viewerIsLawyer ? "lawyer" : "citizen",
    otherParty: {
      id: otherId,
      // lawyers see only the client's first name (privacy §11)
      name: viewerIsLawyer ? firstName(other?.fullName ?? "Client") : other?.fullName ?? "Lawyer",
      photoUrl: await resolvePhotoUrl(other?.profilePhotoUrl ?? null),
      availability: other?.lawyerProfile?.availability ?? null,
    },
    reviewSubmitted: Boolean(review),
    // NOTE: caseNotes intentionally excluded here. Lawyers fetch notes via
    // GET /api/lawyer/consultations/:id instead.
  };
}

// ---- requests (§8.5) --------------------------------------------------------
export async function createRequest(userId: string, lawyerId: string, caseType: CaseType, description: string) {
  const lawyer = await prisma.user.findUnique({ where: { id: lawyerId }, include: { lawyerProfile: true } });
  if (!lawyer || lawyer.role !== "lawyer" || lawyer.lawyerProfile?.verificationStatus !== "verified") {
    throw new AppError(404, "lawyer_not_found", "Lawyer not found.");
  }
  const dup = await prisma.consultationRequest.findFirst({ where: { userId, lawyerId, status: "pending" } });
  if (dup) throw new AppError(409, "duplicate_request", "You already have a pending request with this lawyer.");

  const req = await prisma.consultationRequest.create({
    data: { userId, lawyerId, caseType, description, status: "pending", expiresAt: new Date(Date.now() + REQUEST_TTL_MS) },
  });
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const reqT = newConsultationRequestEmail(lawyer.fullName, firstName(user?.fullName ?? "a client"), caseType);
  await notify(
    lawyerId,
    "new_request",
    `New consultation request from ${firstName(user?.fullName ?? "a client")} (${caseType}).`,
    "/lawyer/requests",
    { to: lawyer.email, ...reqT },
  );
  return { requestId: req.id };
}

export async function listMyRequests(userId: string) {
  const rows = await prisma.consultationRequest.findMany({
    where: { userId, status: "pending" },
    orderBy: { createdAt: "desc" },
    include: { lawyer: { select: { fullName: true, profilePhotoUrl: true } } },
  });
  return Promise.all(rows.map(async (r) => ({
    id: r.id,
    lawyerName: r.lawyer.fullName,
    lawyerPhotoUrl: await resolvePhotoUrl(r.lawyer.profilePhotoUrl),
    caseType: r.caseType,
    description: r.description,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
  })));
}

export async function cancelRequest(userId: string, requestId: string) {
  const req = await prisma.consultationRequest.findUnique({ where: { id: requestId } });
  if (!req || req.userId !== userId) throw new AppError(404, "request_not_found", "Request not found.");
  if (req.status !== "pending") throw new AppError(409, "not_pending", "Only pending requests can be cancelled.");
  await prisma.consultationRequest.delete({ where: { id: requestId } });
  return { ok: true };
}

// ---- my-consultations list (§8.8) ------------------------------------------
export async function listConsultations(userId: string, tab: "active" | "pending" | "closed") {
  if (tab === "pending") {
    return { items: await listMyRequests(userId) };
  }
  const rows = await prisma.consultation.findMany({
    where: { userId, status: tab },
    orderBy: tab === "active" ? { startedAt: "desc" } : { closedAt: "desc" },
    include: {
      lawyer: { select: { fullName: true, profilePhotoUrl: true } },
      review: { select: { id: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  const items = await Promise.all(
    rows.map(async (c) => {
      const last = c.messages[0];
      const unread = tab === "active"
        ? await prisma.message.count({ where: { consultationId: c.id, senderId: { not: userId }, deliveryStatus: { not: "read" } } })
        : 0;
      return {
        id: c.id,
        lawyerName: c.lawyer.fullName,
        lawyerPhotoUrl: await resolvePhotoUrl(c.lawyer.profilePhotoUrl),
        caseType: c.caseType,
        startedAt: c.startedAt,
        closedAt: c.closedAt,
        lastMessage: last ? (last.text ? decryptField(last.text) : "📎 Attachment") : null,
        lastMessageAt: last?.createdAt ?? null,
        unread,
        reviewSubmitted: Boolean(c.review),
      };
    }),
  );
  return { items };
}

// ---- close (§8.6.6) — either party; records earnings once ------------------
export async function closeConsultation(userId: string, consultationId: string) {
  const { consultation: c } = await participant(userId, consultationId);
  if (c.status === "closed") throw new AppError(409, "already_closed", "This consultation is already closed.");

  const profile = await prisma.lawyerProfile.findUnique({ where: { userId: c.lawyerId } });
  const cfg = await prisma.systemConfig.findUnique({ where: { id: true } });
  const pct = cfg ? Number(cfg.platformFeePercent) : 10;
  const fee = profile?.consultationFeePkr ?? 0;
  const net = Math.round(fee * (1 - pct / 100));

  await prisma.$transaction(async (tx) => {
    await tx.consultation.update({ where: { id: consultationId }, data: { status: "closed", closedAt: new Date() } });
    const existingTxn = await tx.transaction.findFirst({ where: { consultationId } });
    if (!existingTxn) {
      await tx.transaction.create({
        data: { consultationId, lawyerId: c.lawyerId, feePkr: fee, platformFeePercent: pct.toFixed(2), netEarnedPkr: net, status: "paid" },
      });
    }
  });

  emitToRoom(consultationId, "consultation_closed", { consultationId });
  const otherId = c.userId === userId ? c.lawyerId : c.userId;
  await notify(otherId, "consultation_closed", "A consultation has been closed.", c.userId === otherId ? `/user/consultation/${consultationId}` : `/lawyer/consultation/${consultationId}`);
  // Prompt the client to review (if the lawyer closed) — client gets the review modal in-app.
  return { ok: true };
}

// ---- review (§8.6.8) --------------------------------------------------------
export async function submitReview(userId: string, consultationId: string, rating: number, text: string | undefined, caseType?: CaseType) {
  const { consultation: c } = await participant(userId, consultationId);
  if (c.userId !== userId) throw new AppError(403, "forbidden", "Only the client can leave a review.");
  if (c.status !== "closed") throw new AppError(409, "not_closed", "You can review only after the consultation ends.");
  const existing = await prisma.review.findUnique({ where: { consultationId } });
  if (existing) throw new AppError(409, "already_reviewed", "You have already reviewed this consultation.");

  await prisma.review.create({
    data: { consultationId, lawyerId: c.lawyerId, userId, rating, text: text || null, caseType: caseType ?? c.caseType },
  });

  // Recalculate the lawyer's rating from non-removed reviews.
  const agg = await prisma.review.aggregate({
    where: { lawyerId: c.lawyerId, removed: false },
    _avg: { rating: true },
    _count: true,
  });
  await prisma.lawyerProfile.update({
    where: { userId: c.lawyerId },
    data: { ratingAvg: (agg._avg.rating ?? 0).toFixed(1), reviewCount: agg._count },
  });
  const lawyerUser = await prisma.user.findUnique({ where: { id: c.lawyerId } });
  const reviewT = lawyerUser ? newReviewEmail(lawyerUser.fullName, rating) : null;
  await notify(
    c.lawyerId,
    "new_review",
    `You received a new ${rating}-star review.`,
    "/lawyer/dashboard",
    reviewT && lawyerUser ? { to: lawyerUser.email, ...reviewT } : undefined,
  );
  return { ok: true };
}

// ---- auto-expiry sweep (§8.5 step 6) ---------------------------------------
export async function expirePendingRequests(): Promise<number> {
  const due = await prisma.consultationRequest.findMany({
    where: { status: "pending", expiresAt: { lt: new Date() } },
    include: {
      user: { select: { fullName: true, email: true } },
      lawyer: { select: { fullName: true, email: true } },
    },
  });
  if (due.length === 0) return 0;
  await prisma.consultationRequest.updateMany({
    where: { id: { in: due.map((r) => r.id) } },
    data: { status: "expired" },
  });
  // Notify BOTH parties for each expired request.
  for (const r of due) {
    const expiredT = requestExpiredEmail(r.user.fullName, r.lawyer.fullName);
    const autoT = requestAutoExpiredEmail(r.lawyer.fullName);
    await prisma.notification.create({
      data: { userId: r.userId, type: "request_expired", text: `Your request to ${r.lawyer.fullName} expired with no response. You can request another lawyer.`, link: "/user/find-lawyer" },
    });
    await sendEmail({ to: r.user.email, ...expiredT }).catch(() => {});
    await prisma.notification.create({
      data: { userId: r.lawyerId, type: "request_expired", text: `A consultation request from ${firstName(r.user.fullName)} expired (no response within 24h).`, link: "/lawyer/requests" },
    });
    await sendEmail({ to: r.lawyer.email, ...autoT }).catch(() => {});
  }
  return due.length;
}
