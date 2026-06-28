/** Admin panel service (§12). Every mutating action writes to the audit log. */
import type { Prisma, AdminRole } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { resolvePhotoUrl } from "../../lib/storage.js";
import { AppError } from "../../middleware/error.js";
import { sendEmail } from "../../lib/mailer.js";
import {
  lawyerApprovedEmail, lawyerRejectedEmail, accountSuspendedEmail, accountBannedEmail,
  suspensionLiftedEmail, adminPasswordResetEmail, adminAccountWarningEmail,
  adminReportResolvedEmail, adminNewApplicationEmail, adminHighPriorityReportEmail,
} from "../../lib/emailTemplates.js";
import { writeAudit } from "../../lib/audit.js";
import { hashPassword } from "../../lib/password.js";
import { encryptField, randomToken, sha256 } from "../../lib/crypto.js";
import { generateTotpSecret, buildOtpAuthUrl, buildQrDataUrl } from "../../lib/totp.js";
import { env } from "../../config/env.js";

const firstName = (f: string) => f.split(" ")[0];
const dayStart = (offset = 0) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + offset); return d; };

async function recalcRating(lawyerId: string) {
  const agg = await prisma.review.aggregate({ where: { lawyerId, removed: false }, _avg: { rating: true }, _count: true });
  await prisma.lawyerProfile.update({ where: { userId: lawyerId }, data: { ratingAvg: (agg._avg.rating ?? 0).toFixed(1), reviewCount: agg._count } });
}

// ============================================================================
// Dashboard (§12.2)
// ============================================================================
export async function getDashboard() {
  const t0 = dayStart(0);
  const d30 = dayStart(-30);
  const d7 = dayStart(-7);
  const overdue = new Date(Date.now() - 48 * 3600_000);

  const [totalUsers, totalVerifiedLawyers, pendingVerifications, activeConsultations,
    newUsersToday, newLawyersToday, docsToday, chatToday, openReports, overdueVerifs, growthRows, caseVol, fbUp, fbDown] =
    await Promise.all([
      prisma.user.count({ where: { role: "citizen" } }),
      prisma.lawyerProfile.count({ where: { verificationStatus: "verified" } }),
      prisma.lawyerProfile.count({ where: { verificationStatus: "pending" } }),
      prisma.consultation.count({ where: { status: "active" } }),
      prisma.user.count({ where: { role: "citizen", createdAt: { gte: t0 } } }),
      prisma.user.count({ where: { role: "lawyer", createdAt: { gte: t0 } } }),
      prisma.document.count({ where: { status: "analysis_complete", uploadDate: { gte: t0 } } }),
      prisma.chatSession.count({ where: { createdAt: { gte: t0 } } }),
      prisma.report.count({ where: { status: "open" } }),
      prisma.lawyerProfile.findMany({
        where: { verificationStatus: "pending", createdAt: { lt: overdue } },
        orderBy: { createdAt: "asc" },
        include: { user: { select: { fullName: true } } },
      }),
      prisma.user.findMany({ where: { createdAt: { gte: d30 }, role: { in: ["citizen", "lawyer"] } }, select: { role: true, createdAt: true } }),
      prisma.consultation.groupBy({ by: ["caseType"], where: { startedAt: { gte: d7 } }, _count: true }),
      prisma.chatMessage.count({ where: { feedback: "up" } }),
      prisma.chatMessage.count({ where: { feedback: "down" } }),
    ]);

  // 30-day dual-line growth buckets
  const days: { date: string; users: number; lawyers: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const start = dayStart(-i), end = dayStart(-i + 1);
    const label = start.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
    days.push({
      date: label,
      users: growthRows.filter((r) => r.role === "citizen" && r.createdAt >= start && r.createdAt < end).length,
      lawyers: growthRows.filter((r) => r.role === "lawyer" && r.createdAt >= start && r.createdAt < end).length,
    });
  }

  return {
    metrics: { totalUsers, totalVerifiedLawyers, pendingVerifications, activeConsultations },
    today: { newUsers: newUsersToday, newLawyers: newLawyersToday, documentsProcessed: docsToday, chatSessions: chatToday },
    charts: {
      growth: days,
      consultationsByCaseType: caseVol.map((c) => ({ caseType: c.caseType, count: c._count })),
      chatbotFeedback: { up: fbUp, down: fbDown },
    },
    alerts: {
      unreviewedReports: openReports,
      overdueVerifications: overdueVerifs.map((v) => ({
        userId: v.userId, name: v.user.fullName, hoursWaiting: Math.floor((Date.now() - v.createdAt.getTime()) / 3600_000),
      })),
      systemHealth: {
        apiUptimePercent: 100,
        apiUptimeSeconds: Math.floor(process.uptime()),
        avgResponseMs: null, // request-timing metrics not yet instrumented
        storageUsedGb: null,
        storageTotalGb: null,
        ocrPipeline: "not_configured", // OCR arrives in Milestone 8
      },
    },
  };
}

// ============================================================================
// Verifications (§12.3)
// ============================================================================
const VERIF_TAB: Record<string, "pending" | "verified" | "rejected"> = { pending: "pending", approved: "verified", rejected: "rejected" };

export async function listVerifications(tab: string) {
  if (tab === "resubmitted") return { items: [] }; // resubmission history not modelled yet
  const status = VERIF_TAB[tab] ?? "pending";
  const rows = await prisma.lawyerProfile.findMany({
    where: { verificationStatus: status },
    orderBy: { createdAt: "asc" }, // FIFO
    include: { user: { select: { id: true, fullName: true } }, documents: true },
  });
  return {
    items: rows.map((p) => ({
      userId: p.userId,
      name: p.user.fullName,
      barCouncilNumber: p.barCouncilNumber,
      province: p.province,
      city: p.city,
      submittedAt: p.createdAt,
      hoursSince: Math.floor((Date.now() - p.createdAt.getTime()) / 3600_000),
      documentsCount: p.documents.length,
      verifiedDocs: p.documents.filter((d) => d.status === "verified").length,
    })),
  };
}

export async function getVerification(userId: string) {
  const p = await prisma.lawyerProfile.findUnique({
    where: { userId },
    include: { user: { select: { id: true, fullName: true, email: true, phone: true } }, documents: true },
  });
  if (!p) throw new AppError(404, "not_found", "Application not found.");
  return {
    userId: p.userId,
    profile: {
      fullLegalName: p.fullLegalName, cnicLast4: p.cnicLast4, barCouncilNumber: p.barCouncilNumber,
      province: p.province, city: p.city, yearsExperienceBand: p.yearsExperienceBand,
      practiceAreas: p.practiceAreas, languages: p.languages, consultationFeePkr: p.consultationFeePkr,
      bio: p.bio, verificationStatus: p.verificationStatus, submittedAt: p.createdAt,
      email: p.user.email, phone: p.user.phone,
    },
    documents: await Promise.all(p.documents.map(async (d) => ({ id: d.id, docType: d.docType, fileUrl: await resolvePhotoUrl(d.fileUrl), status: d.status, issueNote: d.issueNote }))),
  };
}

export async function approveVerification(adminUsername: string, userId: string) {
  const p = await prisma.lawyerProfile.findUnique({ where: { userId }, include: { user: true } });
  if (!p) throw new AppError(404, "not_found", "Application not found.");
  // §14 edge case: Bar Council number must be unique among verified lawyers.
  const clash = await prisma.lawyerProfile.findFirst({
    where: { barCouncilNumber: p.barCouncilNumber, verificationStatus: "verified", NOT: { userId } },
  });
  if (clash) throw new AppError(409, "bar_council_taken", "This Bar Council number is already registered to another verified lawyer account.");

  await prisma.$transaction([
    prisma.lawyerProfile.update({ where: { userId }, data: { verificationStatus: "verified" } }),
    prisma.user.update({ where: { id: userId }, data: { status: "active" } }),
    prisma.notification.create({ data: { userId, type: "verification_approved", text: "Congratulations — your lawyer application has been approved!", link: "/lawyer/dashboard" } }),
  ]);
  const approvedT = lawyerApprovedEmail(p.user.fullName);
  sendEmail({ to: p.user.email, ...approvedT }).catch(() => {});
  await writeAudit(adminUsername, "verification_approved", userId, { barCouncilNumber: p.barCouncilNumber });
  return { ok: true };
}

export async function rejectVerification(adminUsername: string, userId: string, reason: string, allowResubmission: boolean) {
  const p = await prisma.lawyerProfile.findUnique({ where: { userId }, include: { user: true } });
  if (!p) throw new AppError(404, "not_found", "Application not found.");
  await prisma.lawyerProfile.update({ where: { userId }, data: { verificationStatus: "rejected" } });
  await prisma.notification.create({ data: { userId, type: "verification_rejected", text: `Your application was not approved. ${allowResubmission ? "You may resubmit." : ""}`, link: "/lawyer/pending" } });
  const rejectedT = lawyerRejectedEmail(p.user.fullName, reason, allowResubmission);
  sendEmail({ to: p.user.email, ...rejectedT }).catch(() => {});
  await writeAudit(adminUsername, "verification_rejected", userId, { reason, allowResubmission });
  return { ok: true };
}

export async function updateVerificationDocument(adminUsername: string, userId: string, docId: string, status: "verified" | "issue_found", issueNote?: string) {
  const doc = await prisma.lawyerDocument.findUnique({ where: { id: docId }, include: { lawyerProfile: true } });
  if (!doc || doc.lawyerProfile.userId !== userId) throw new AppError(404, "not_found", "Document not found.");
  await prisma.lawyerDocument.update({ where: { id: docId }, data: { status, issueNote: status === "issue_found" ? issueNote ?? null : null } });
  await writeAudit(adminUsername, "verification_document_updated", docId, { userId, status, issueNote });
  return { ok: true };
}

// ============================================================================
// Users (§12.4)
// ============================================================================
export async function listUsers(f: { q?: string; role?: string; status?: string; from?: string; to?: string }) {
  const where: Prisma.UserWhereInput = {
    role: f.role && f.role !== "all" ? (f.role as never) : { in: ["citizen", "lawyer"] },
    ...(f.status && f.status !== "all" ? { status: f.status as never } : {}),
    ...(f.from || f.to ? { createdAt: { ...(f.from ? { gte: new Date(f.from) } : {}), ...(f.to ? { lte: new Date(f.to) } : {}) } } : {}),
    ...(f.q ? { OR: [{ fullName: { contains: f.q, mode: "insensitive" } }, { email: { contains: f.q, mode: "insensitive" } }, { phone: { contains: f.q } }] } : {}),
  };
  const rows = await prisma.user.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 });
  const withCounts = await Promise.all(rows.map(async (u) => ({
    id: u.id, fullName: u.fullName, email: u.email, role: u.role, status: u.status,
    createdAt: u.createdAt, lastLoginAt: u.lastLoginAt, suspendedUntil: u.suspendedUntil,
    consultations: await prisma.consultation.count({ where: u.role === "lawyer" ? { lawyerId: u.id } : { userId: u.id } }),
  })));
  return { items: withCounts };
}

export async function getUserDetail(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId }, include: { lawyerProfile: true } });
  if (!u) throw new AppError(404, "not_found", "User not found.");
  const [consultations, documents, reportsAgainst, reportsBy] = await Promise.all([
    prisma.consultation.findMany({ where: { OR: [{ userId }, { lawyerId: userId }] }, orderBy: { startedAt: "desc" }, take: 50, include: { user: { select: { fullName: true } }, lawyer: { select: { fullName: true } } } }),
    prisma.document.findMany({ where: { userId }, orderBy: { uploadDate: "desc" } }),
    prisma.report.count({ where: { reportedPartyId: userId } }),
    prisma.report.count({ where: { reporterId: userId } }),
  ]);
  return {
    user: {
      id: u.id, fullName: u.fullName, email: u.email, phone: u.phone, role: u.role, status: u.status,
      province: u.province, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt, suspendedUntil: u.suspendedUntil,
      lawyer: u.lawyerProfile ? { verificationStatus: u.lawyerProfile.verificationStatus, barCouncilNumber: u.lawyerProfile.barCouncilNumber, cnicLast4: u.lawyerProfile.cnicLast4 } : null,
    },
    consultations: consultations.map((c) => ({ id: c.id, status: c.status, caseType: c.caseType, with: u.role === "lawyer" ? c.user.fullName : c.lawyer.fullName, startedAt: c.startedAt })),
    documents: documents.map((d) => ({ id: d.id, fileName: d.fileName, status: d.status, uploadDate: d.uploadDate })),
    reportsAgainst, reportsBy,
  };
}

async function invalidateUserSessions(userId: string) {
  await prisma.session.deleteMany({ where: { userId } });
  await prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function suspendUser(adminUsername: string, userId: string, days: number | null, reason: string) {
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u) throw new AppError(404, "not_found", "User not found.");
  const until = days ? new Date(Date.now() + days * 86400_000) : null;
  await prisma.user.update({ where: { id: userId }, data: { status: "suspended", suspendedUntil: until } });
  await invalidateUserSessions(userId);
  const suspT = accountSuspendedEmail(u.fullName, reason, until ? until.toDateString() : null);
  sendEmail({ to: u.email, ...suspT }).catch(() => {});
  await writeAudit(adminUsername, "user_suspended", userId, { days, until, reason });
  return { ok: true };
}

export async function banUser(adminUsername: string, userId: string, confirmEmail: string) {
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u) throw new AppError(404, "not_found", "User not found.");
  if (confirmEmail !== u.email) throw new AppError(400, "confirm_mismatch", "Email confirmation does not match.");
  await prisma.user.update({ where: { id: userId }, data: { status: "banned", suspendedUntil: null } });
  await invalidateUserSessions(userId);
  const bannedT = accountBannedEmail(u.fullName);
  sendEmail({ to: u.email, ...bannedT }).catch(() => {});
  await writeAudit(adminUsername, "user_banned", userId, { email: u.email });
  return { ok: true };
}

export async function liftSuspension(adminUsername: string, userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u) throw new AppError(404, "not_found", "User not found.");
  await prisma.user.update({ where: { id: userId }, data: { status: "active", suspendedUntil: null } });
  const liftedT = suspensionLiftedEmail(u.fullName);
  sendEmail({ to: u.email, ...liftedT }).catch(() => {});
  await writeAudit(adminUsername, "user_suspension_lifted", userId);
  return { ok: true };
}

export async function adminResetPassword(adminUsername: string, userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u) throw new AppError(404, "not_found", "User not found.");
  const token = randomToken(32);
  await prisma.passwordResetToken.create({ data: { userId, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 15 * 60_000) } });
  const resetT = adminPasswordResetEmail(u.fullName, `${env.WEB_ORIGIN}/reset-password/${token}`);
  sendEmail({ to: u.email, ...resetT }).catch(() => {});
  await writeAudit(adminUsername, "user_password_reset", userId);
  return { ok: true };
}

// ============================================================================
// Reports (§12.5)
// ============================================================================
export async function listReports(f: { status?: string; priority?: string; type?: string }) {
  const where: Prisma.ReportWhereInput = {
    ...(f.status && f.status !== "all" ? { status: f.status as never } : {}),
    ...(f.priority && f.priority !== "all" ? { priority: f.priority as never } : {}),
    ...(f.type && f.type !== "all" ? { type: f.type as never } : {}),
  };
  const rows = await prisma.report.findMany({ where, orderBy: [{ status: "asc" }, { createdAt: "desc" }], include: { reporter: { select: { fullName: true } }, reportedParty: { select: { fullName: true } } } });
  return { items: rows.map((r) => ({ id: r.id, reporter: firstName(r.reporter.fullName), reportedParty: r.reportedParty.fullName, type: r.type, reasonCategory: r.reasonCategory, priority: r.priority, status: r.status, createdAt: r.createdAt })) };
}

export async function getReport(id: string) {
  const r = await prisma.report.findUnique({ where: { id }, include: { reporter: { select: { id: true, fullName: true, email: true } }, reportedParty: { select: { id: true, fullName: true, email: true, status: true } } } });
  if (!r) throw new AppError(404, "not_found", "Report not found.");
  return { id: r.id, type: r.type, reasonCategory: r.reasonCategory, reasonText: r.reasonText, priority: r.priority, status: r.status, resolutionNote: r.resolutionNote, createdAt: r.createdAt, reporter: r.reporter, reportedParty: r.reportedParty };
}

export async function resolveReport(adminUsername: string, id: string, action: string, resolutionNote: string, opts: { reviewId?: string; days?: number }) {
  const r = await prisma.report.findUnique({ where: { id }, include: { reporter: true, reportedParty: true } });
  if (!r) throw new AppError(404, "not_found", "Report not found.");
  if (r.status === "resolved") throw new AppError(409, "already_resolved", "This report is already resolved.");

  switch (action) {
    case "warn": {
      const warnT = adminAccountWarningEmail(r.reportedParty.email, resolutionNote);
      sendEmail({ to: r.reportedParty.email, ...warnT }).catch(() => {});
      break;
    }
    case "suspend":
      await suspendUser(adminUsername, r.reportedPartyId, opts.days ?? 7, `Report resolution: ${resolutionNote}`);
      break;
    case "ban":
      await prisma.user.update({ where: { id: r.reportedPartyId }, data: { status: "banned", suspendedUntil: null } });
      await invalidateUserSessions(r.reportedPartyId);
      break;
    case "remove_content":
      if (opts.reviewId) await removeReview(adminUsername, opts.reviewId, `Removed via report: ${resolutionNote}`);
      break;
    case "dismiss":
    default:
      break;
  }
  await prisma.report.update({ where: { id }, data: { status: "resolved", resolutionNote } });
  const resolvedT = adminReportResolvedEmail(r.reporter.email);
  sendEmail({ to: r.reporter.email, ...resolvedT }).catch(() => {});
  await writeAudit(adminUsername, "report_resolved", id, { action, resolutionNote });
  return { ok: true };
}

// ============================================================================
// Reviews (§12.6)
// ============================================================================
export async function listReviews(f: { flagged?: string; q?: string }) {
  const where: Prisma.ReviewWhereInput = {
    ...(f.flagged === "true" ? { flagged: true, removed: false } : {}),
  };
  const rows = await prisma.review.findMany({ where, orderBy: { createdAt: "desc" }, take: 100, include: { lawyer: { select: { fullName: true } }, user: { select: { fullName: true } } } });
  return { items: rows.map((r) => ({ id: r.id, rating: r.rating, text: r.text, caseType: r.caseType, lawyer: r.lawyer.fullName, reviewer: firstName(r.user.fullName), flagged: r.flagged, removed: r.removed, removalReason: r.removalReason, date: r.createdAt })) };
}

export async function approveFlaggedReview(adminUsername: string, id: string) {
  const r = await prisma.review.findUnique({ where: { id } });
  if (!r) throw new AppError(404, "not_found", "Review not found.");
  await prisma.review.update({ where: { id }, data: { flagged: false } });
  await writeAudit(adminUsername, "review_flag_approved", id);
  return { ok: true };
}

export async function removeReview(adminUsername: string, id: string, reason: string) {
  const r = await prisma.review.findUnique({ where: { id } });
  if (!r) throw new AppError(404, "not_found", "Review not found.");
  await prisma.review.update({ where: { id }, data: { removed: true, removalReason: reason, flagged: false } });
  await recalcRating(r.lawyerId);
  await prisma.notification.create({ data: { userId: r.userId, type: "review_removed", text: `A review you posted was removed by moderators. Reason: ${reason}`, link: null } });
  await prisma.notification.create({ data: { userId: r.lawyerId, type: "review_removed", text: "A review on your profile was removed by moderators.", link: "/lawyer/dashboard" } });
  await writeAudit(adminUsername, "review_removed", id, { reason });
  return { ok: true };
}

// ============================================================================
// Analytics (§12.7)
// ============================================================================
export async function getAnalytics(fromStr?: string, toStr?: string) {
  const to = toStr ? new Date(toStr) : new Date();
  const from = fromStr ? new Date(fromStr) : new Date(Date.now() - 30 * 86400_000);

  const [signups, consults, caseTypes, chatSessions, chatMsgs, fbUp, fbDown, byProvince, lawyers] = await Promise.all([
    prisma.user.findMany({ where: { createdAt: { gte: from, lte: to }, role: { in: ["citizen", "lawyer"] } }, select: { role: true, createdAt: true } }),
    prisma.consultation.findMany({ where: { startedAt: { gte: from, lte: to } }, select: { status: true, startedAt: true, closedAt: true } }),
    prisma.consultation.groupBy({ by: ["caseType"], where: { startedAt: { gte: from, lte: to } }, _count: true }),
    prisma.chatSession.count({ where: { createdAt: { gte: from, lte: to } } }),
    prisma.chatMessage.count({ where: { sender: "ai", createdAt: { gte: from, lte: to } } }),
    prisma.chatMessage.count({ where: { feedback: "up", createdAt: { gte: from, lte: to } } }),
    prisma.chatMessage.count({ where: { feedback: "down", createdAt: { gte: from, lte: to } } }),
    prisma.user.groupBy({ by: ["province"], where: { role: "citizen", province: { not: null } }, _count: true }),
    prisma.lawyerProfile.findMany({ where: { verificationStatus: "verified" }, orderBy: { reviewCount: "desc" }, take: 10, include: { user: { select: { fullName: true } } } }),
  ]);

  const closed = consults.filter((c) => c.status === "closed");
  const avgDurationMin = closed.length
    ? Math.round(closed.reduce((s, c) => s + (c.closedAt ? (c.closedAt.getTime() - c.startedAt.getTime()) / 60000 : 0), 0) / closed.length)
    : 0;

  return {
    range: { from, to },
    userGrowth: { totalSignups: signups.length, citizens: signups.filter((s) => s.role === "citizen").length, lawyers: signups.filter((s) => s.role === "lawyer").length },
    consultations: { started: consults.length, completed: closed.length, active: consults.filter((c) => c.status === "active").length, avgDurationMin, byCaseType: caseTypes.map((c) => ({ caseType: c.caseType, count: c._count })) },
    chatbot: { sessions: chatSessions, aiMessages: chatMsgs, thumbsUpPercent: fbUp + fbDown ? Math.round((fbUp / (fbUp + fbDown)) * 100) : null },
    documents: { processed: 0, ocrSuccessRate: null, note: "Document analyzer metrics available after Milestone 8" },
    geographic: byProvince.map((p) => ({ province: p.province, count: p._count })),
    lawyerPerformance: lawyers.map((l) => ({ name: l.user.fullName, reviews: l.reviewCount, rating: Number(l.ratingAvg) })),
  };
}

// ============================================================================
// Settings & admin accounts (§12.8)
// ============================================================================
export async function getSettings() {
  const cfg = await prisma.systemConfig.findUnique({ where: { id: true } });
  const practiceAreas = await prisma.practiceArea.findMany({ orderBy: { name: "asc" } });
  const admins = await prisma.adminAccount.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, username: true, role: true, isActive: true, lastLoginAt: true } });
  return {
    chatbotDisclaimerText: cfg?.chatbotDisclaimerText ?? "",
    platformFeePercent: cfg ? Number(cfg.platformFeePercent) : 10,
    maintenanceMode: cfg?.maintenanceMode ?? false,
    emailTemplates: cfg?.emailTemplates ?? {},
    practiceAreas: practiceAreas.map((p) => ({ id: p.id, name: p.name, enabled: p.enabled })),
    admins,
  };
}

export async function updateSettings(adminUsername: string, data: {
  chatbotDisclaimerText?: string; platformFeePercent?: number; maintenanceMode?: boolean;
  emailTemplates?: Record<string, string>; practiceAreas?: { name: string; enabled: boolean }[];
}) {
  await prisma.systemConfig.update({
    where: { id: true },
    data: {
      ...(data.chatbotDisclaimerText !== undefined ? { chatbotDisclaimerText: data.chatbotDisclaimerText } : {}),
      ...(data.platformFeePercent !== undefined ? { platformFeePercent: data.platformFeePercent.toFixed(2) } : {}),
      ...(data.maintenanceMode !== undefined ? { maintenanceMode: data.maintenanceMode } : {}),
      ...(data.emailTemplates !== undefined ? { emailTemplates: data.emailTemplates as never } : {}),
    },
  });
  if (data.practiceAreas) {
    for (const pa of data.practiceAreas) {
      await prisma.practiceArea.upsert({ where: { name: pa.name }, update: { enabled: pa.enabled }, create: { name: pa.name, enabled: pa.enabled } });
    }
  }
  await writeAudit(adminUsername, "settings_updated", null, { fields: Object.keys(data) });
  return getSettings();
}

export async function createAdminAccount(adminUsername: string, username: string, password: string, role: AdminRole) {
  const existing = await prisma.adminAccount.findUnique({ where: { username } });
  if (existing) throw new AppError(409, "username_taken", "That admin username is taken.");
  const secret = generateTotpSecret();
  const admin = await prisma.adminAccount.create({
    data: { username, passwordHash: await hashPassword(password), role, twoFactorSecret: encryptField(secret) },
  });
  const otpauthUrl = buildOtpAuthUrl(`admin:${username}`, secret);
  await writeAudit(adminUsername, "admin_account_created", admin.id, { username, role });
  return { id: admin.id, username, role, twoFactorSecret: secret, otpauthUrl, qrDataUrl: await buildQrDataUrl(otpauthUrl) };
}

export async function updateAdminAccount(adminUsername: string, selfId: string, id: string, data: { role?: AdminRole; isActive?: boolean }) {
  if (id === selfId && data.isActive === false) throw new AppError(400, "cannot_disable_self", "You cannot deactivate your own account.");
  const admin = await prisma.adminAccount.findUnique({ where: { id } });
  if (!admin) throw new AppError(404, "not_found", "Admin account not found.");
  const updated = await prisma.adminAccount.update({ where: { id }, data });
  if (data.isActive === false) await prisma.adminSession.deleteMany({ where: { adminId: id } }); // log out deactivated admin
  await writeAudit(adminUsername, "admin_account_updated", id, data as Record<string, unknown>);
  return { id: updated.id, username: updated.username, role: updated.role, isActive: updated.isActive };
}

// ============================================================================
// Audit log (§12.9)
// ============================================================================
export async function getAuditLog(f: { q?: string; from?: string; to?: string; page?: number }) {
  const PAGE = 50;
  const page = f.page ?? 1;
  const where: Prisma.AuditLogWhereInput = {
    ...(f.from || f.to ? { createdAt: { ...(f.from ? { gte: new Date(f.from) } : {}), ...(f.to ? { lte: new Date(f.to) } : {}) } } : {}),
    ...(f.q ? { OR: [{ adminUsername: { contains: f.q, mode: "insensitive" } }, { actionType: { contains: f.q, mode: "insensitive" } }, { targetId: { contains: f.q } }] } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE }),
  ]);
  return {
    items: rows.map((a) => ({ id: a.id, adminUsername: a.adminUsername, actionType: a.actionType, targetId: a.targetId, details: a.details, createdAt: a.createdAt })),
    total, page, pageSize: PAGE, totalPages: Math.max(1, Math.ceil(total / PAGE)),
  };
}
