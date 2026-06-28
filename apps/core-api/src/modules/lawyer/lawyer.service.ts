/** Lawyer portal service (CLAUDE.md §10). All actions scoped to the caller. */
import type { LawyerProfile } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { resolvePhotoUrl } from "../../lib/storage.js";
import { AppError } from "../../middleware/error.js";
import { encryptField, decryptField } from "../../lib/crypto.js";
import { sendEmail } from "../../lib/mailer.js";
import {
  consultationAcceptedEmail, requestDeclinedEmail, requestExpiredEmail, consultationClosedEmail, payoutProcessedEmail, newReviewEmail,
} from "../../lib/emailTemplates.js";

const firstName = (full: string) => full.split(" ")[0];

function startOfWeek(d = new Date()): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Monday=0
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x;
}
function startOfMonth(offset = 0, d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth() + offset, 1);
}

async function platformFeePercent(): Promise<number> {
  const cfg = await prisma.systemConfig.findUnique({ where: { id: true } });
  return cfg ? Number(cfg.platformFeePercent) : 10;
}

async function getProfile(userId: string): Promise<LawyerProfile> {
  const p = await prisma.lawyerProfile.findUnique({ where: { userId } });
  if (!p) throw new AppError(404, "profile_not_found", "Lawyer profile not found.");
  return p;
}

async function notify(userId: string, type: string, text: string, link: string | null, email?: { to: string; subject: string; text: string; html?: string }) {
  await prisma.notification.create({ data: { userId, type, text, link } });
  if (email) sendEmail(email).catch(() => {});
}

/** Lazily expire pending requests past their 24h window (§10.3). */
async function expireStale(lawyerId: string) {
  await prisma.consultationRequest.updateMany({
    where: { lawyerId, status: "pending", expiresAt: { lt: new Date() } },
    data: { status: "expired" },
  });
}

// ============================================================================
// Dashboard (§10.2)
// ============================================================================
export async function getDashboard(lawyerId: string) {
  await expireStale(lawyerId);
  const profile = await getProfile(lawyerId);

  const [consultationsThisWeek, earningsAgg, pendingReqs, activeCases, recentReviews, pendingCount, activeCount] =
    await Promise.all([
      prisma.consultation.count({ where: { lawyerId, startedAt: { gte: startOfWeek() } } }),
      prisma.transaction.aggregate({ where: { lawyerId }, _sum: { netEarnedPkr: true } }),
      prisma.consultationRequest.findMany({
        where: { lawyerId, status: "pending" },
        orderBy: { createdAt: "desc" },
        take: 3,
        include: { user: { select: { fullName: true } } },
      }),
      prisma.consultation.findMany({
        where: { lawyerId, status: "active" },
        orderBy: { startedAt: "desc" },
        take: 5,
        include: { user: { select: { fullName: true } } },
      }),
      prisma.review.findMany({ where: { lawyerId, removed: false }, orderBy: { createdAt: "desc" }, take: 2 }),
      prisma.consultationRequest.count({ where: { lawyerId, status: "pending" } }),
      prisma.consultation.count({ where: { lawyerId, status: "active" } }),
    ]);

  return {
    metrics: {
      consultationsThisWeek,
      totalEarningsPkr: earningsAgg._sum.netEarnedPkr ?? 0,
      profileViews30: 0, // profile-view tracking not yet implemented
      avgRating: Number(profile.ratingAvg),
    },
    availability: profile.availability,
    pendingRequests: pendingReqs.map((r) => ({
      id: r.id,
      clientFirstName: firstName(r.user.fullName),
      caseType: r.caseType,
      description: r.description,
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
    })),
    pendingCount,
    activeCases: activeCases.map((c) => ({
      id: c.id,
      clientFirstName: firstName(c.user.fullName),
      caseType: c.caseType,
      startedAt: c.startedAt,
    })),
    activeCount,
    recentReviews: recentReviews.map((r) => ({ id: r.id, rating: r.rating, text: r.text, date: r.createdAt })),
  };
}

// ============================================================================
// Requests (§10.3)
// ============================================================================
export async function listRequests(lawyerId: string, tab: "pending" | "declined" | "expired") {
  await expireStale(lawyerId);
  const rows = await prisma.consultationRequest.findMany({
    where: { lawyerId, status: tab },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { fullName: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    clientFirstName: firstName(r.user.fullName),
    caseType: r.caseType,
    description: r.description,
    status: r.status,
    declineReason: r.declineReason,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
  }));
}

export async function acceptRequest(lawyerId: string, requestId: string) {
  await expireStale(lawyerId);
  const req = await prisma.consultationRequest.findUnique({ where: { id: requestId } });
  if (!req || req.lawyerId !== lawyerId) throw new AppError(404, "request_not_found", "Request not found.");
  if (req.status !== "pending") throw new AppError(409, "not_pending", "This request is no longer pending.");

  const profile = await getProfile(lawyerId);
  const activeCount = await prisma.consultation.count({ where: { lawyerId, status: "active" } });
  if (activeCount >= profile.maxActiveConsultations) {
    throw new AppError(409, "at_capacity", "You are at your active consultation capacity.");
  }

  const consultation = await prisma.$transaction(async (tx) => {
    await tx.consultationRequest.update({ where: { id: requestId }, data: { status: "accepted" } });
    return tx.consultation.create({
      data: { userId: req.userId, lawyerId, requestId, status: "active", caseType: req.caseType },
    });
  });

  const [lawyer, citizenUser] = await Promise.all([
    prisma.user.findUnique({ where: { id: lawyerId } }),
    prisma.user.findUnique({ where: { id: req.userId } }),
  ]);
  const acceptT = lawyer && citizenUser
    ? consultationAcceptedEmail(citizenUser.fullName, lawyer.fullName)
    : null;
  await notify(
    req.userId,
    "request_accepted",
    `${lawyer?.fullName ?? "Your lawyer"} accepted your consultation request.`,
    `/user/consultation/${consultation.id}`,
    acceptT && citizenUser ? { to: citizenUser.email, ...acceptT } : undefined,
  );
  return { consultationId: consultation.id };
}

export async function declineRequest(lawyerId: string, requestId: string, reason: string, message?: string) {
  const req = await prisma.consultationRequest.findUnique({ where: { id: requestId } });
  if (!req || req.lawyerId !== lawyerId) throw new AppError(404, "request_not_found", "Request not found.");
  if (req.status !== "pending") throw new AppError(409, "not_pending", "This request is no longer pending.");

  const declineReason = message ? `${reason}: ${message}` : reason;
  await prisma.consultationRequest.update({ where: { id: requestId }, data: { status: "declined", declineReason } });
  const [lawyer, citizenUser] = await Promise.all([
    prisma.user.findUnique({ where: { id: lawyerId } }),
    prisma.user.findUnique({ where: { id: req.userId } }),
  ]);
  const declineT = lawyer && citizenUser
    ? requestDeclinedEmail(citizenUser.fullName, lawyer.fullName, reason)
    : null;
  await notify(
    req.userId,
    "request_declined",
    `Your consultation request was declined. Reason: ${reason}`,
    "/user/my-consultations",
    declineT && citizenUser ? { to: citizenUser.email, ...declineT } : undefined,
  );
  return { ok: true };
}

// ============================================================================
// Cases (§10.4)
// ============================================================================
export async function listCases(lawyerId: string, tab: "active" | "closed") {
  const rows = await prisma.consultation.findMany({
    where: { lawyerId, status: tab },
    orderBy: tab === "active" ? { startedAt: "desc" } : { closedAt: "desc" },
    include: { user: { select: { fullName: true } }, review: { select: { id: true, rating: true } } },
  });
  return rows.map((c) => ({
    id: c.id,
    clientFirstName: firstName(c.user.fullName),
    caseType: c.caseType,
    startedAt: c.startedAt,
    closedAt: c.closedAt,
    review: c.review ? { rating: c.review.rating } : null,
  }));
}

export async function getConsultation(lawyerId: string, id: string) {
  const c = await prisma.consultation.findUnique({
    where: { id },
    include: { user: { select: { fullName: true } }, request: { select: { description: true } } },
  });
  if (!c || c.lawyerId !== lawyerId) throw new AppError(404, "consultation_not_found", "Consultation not found.");
  return {
    id: c.id,
    status: c.status,
    clientFirstName: firstName(c.user.fullName),
    caseType: c.caseType,
    description: c.request?.description ?? null,
    startedAt: c.startedAt,
    closedAt: c.closedAt,
    caseNotes: safeDecryptNotes(c.caseNotes),
    sharedDocuments: [], // document sharing arrives in Milestone 8
  };
}

export async function saveCaseNotes(lawyerId: string, id: string, caseNotes: string) {
  const c = await prisma.consultation.findUnique({ where: { id } });
  if (!c || c.lawyerId !== lawyerId) throw new AppError(404, "consultation_not_found", "Consultation not found.");
  // Encrypt case notes at rest (L-2 fix — matches message encryption).
  await prisma.consultation.update({ where: { id }, data: { caseNotes: caseNotes ? encryptField(caseNotes) : null } });
  return { ok: true };
}

/** Decrypt case notes; falls back to plaintext for pre-encryption rows. */
function safeDecryptNotes(raw: string | null): string {
  if (!raw) return "";
  try {
    return decryptField(raw);
  } catch {
    return raw; // plaintext fallback for rows written before encryption was added
  }
}

export async function closeConsultation(lawyerId: string, id: string) {
  const c = await prisma.consultation.findUnique({ where: { id } });
  if (!c || c.lawyerId !== lawyerId) throw new AppError(404, "consultation_not_found", "Consultation not found.");
  if (c.status === "closed") throw new AppError(409, "already_closed", "This consultation is already closed.");

  const profile = await getProfile(lawyerId);
  const pct = await platformFeePercent();
  const fee = profile.consultationFeePkr;
  const net = Math.round(fee * (1 - pct / 100));

  await prisma.$transaction([
    prisma.consultation.update({ where: { id }, data: { status: "closed", closedAt: new Date() } }),
    prisma.transaction.create({
      data: { consultationId: id, lawyerId, feePkr: fee, platformFeePercent: pct.toFixed(2), netEarnedPkr: net, status: "paid" },
    }),
  ]);
  const [lawyerUser, citizenUser] = await Promise.all([
    prisma.user.findUnique({ where: { id: lawyerId } }),
    prisma.user.findUnique({ where: { id: c.userId } }),
  ]);
  const closedT = lawyerUser && citizenUser
    ? consultationClosedEmail(citizenUser.fullName, lawyerUser.fullName)
    : null;
  await notify(
    c.userId,
    "consultation_closed",
    "Your consultation has ended. Please leave a review.",
    `/user/consultation/${id}`,
    closedT && citizenUser ? { to: citizenUser.email, ...closedT } : undefined,
  );
  return { ok: true };
}

// ============================================================================
// Earnings & payouts (§10.6)
// ============================================================================
export async function getEarnings(lawyerId: string) {
  const txns = await prisma.transaction.findMany({ where: { lawyerId }, orderBy: { createdAt: "desc" } });
  const payouts = await prisma.payout.findMany({ where: { lawyerId }, orderBy: { requestedAt: "desc" }, include: { method: true } });
  const methods = await prisma.payoutMethod.findMany({ where: { lawyerId } });

  const now = new Date();
  const thisMonthStart = startOfMonth(0, now);
  const lastMonthStart = startOfMonth(-1, now);

  const sum = (arr: typeof txns) => arr.reduce((s, t) => s + t.netEarnedPkr, 0);
  const allTime = sum(txns);
  const thisMonth = sum(txns.filter((t) => t.createdAt >= thisMonthStart));
  const lastMonth = sum(txns.filter((t) => t.createdAt >= lastMonthStart && t.createdAt < thisMonthStart));
  const reservedPayouts = payouts
    .filter((p) => ["requested", "processing", "paid"].includes(p.status))
    .reduce((s, p) => s + p.amountPkr, 0);
  const pendingPayout = Math.max(0, allTime - reservedPayouts);

  // Last 12 months chart
  const chart: { month: string; total: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const start = startOfMonth(-i, now);
    const end = startOfMonth(-i + 1, now);
    const total = sum(txns.filter((t) => t.createdAt >= start && t.createdAt < end));
    chart.push({ month: start.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }), total });
  }

  return {
    summary: { thisMonth, lastMonth, allTime, pendingPayout },
    chart,
    transactions: txns.map((t, i) => ({
      id: t.id,
      consultationId: t.consultationId,
      client: `Client #${String(txns.length - i).padStart(2, "0")}`,
      date: t.createdAt,
      feePkr: t.feePkr,
      platformFeePercent: Number(t.platformFeePercent),
      netEarnedPkr: t.netEarnedPkr,
      status: t.status,
    })),
    methods: methods.map((m) => ({ id: m.id, type: m.type, details: m.details, isDefault: m.isDefault })),
    payouts: payouts.map((p) => ({
      id: p.id,
      amountPkr: p.amountPkr,
      method: p.method?.type ?? null,
      status: p.status,
      requestedAt: p.requestedAt,
      processedAt: p.processedAt,
    })),
  };
}

export async function addPayoutMethod(lawyerId: string, type: string, details: Record<string, string>, isDefault: boolean) {
  if (isDefault) {
    await prisma.payoutMethod.updateMany({ where: { lawyerId, isDefault: true }, data: { isDefault: false } });
  }
  const existing = await prisma.payoutMethod.count({ where: { lawyerId } });
  const m = await prisma.payoutMethod.create({
    data: { lawyerId, type: type as never, details, isDefault: isDefault || existing === 0 },
  });
  return { id: m.id };
}

export async function requestPayout(lawyerId: string) {
  const { summary } = await getEarnings(lawyerId);
  if (summary.pendingPayout < 1000) {
    throw new AppError(400, "below_minimum", "A minimum of PKR 1,000 is required to request a payout.");
  }
  const method = await prisma.payoutMethod.findFirst({ where: { lawyerId, isDefault: true } });
  if (!method) throw new AppError(400, "no_method", "Add a default payout method first.");

  const payout = await prisma.payout.create({
    data: { lawyerId, amountPkr: summary.pendingPayout, methodId: method.id, status: "requested" },
  });
  return { payoutId: payout.id, amountPkr: payout.amountPkr };
}

// ============================================================================
// Profile (§10.5) / Availability / Settings (§10.7)
// ============================================================================
export async function getOwnProfile(lawyerId: string) {
  const user = await prisma.user.findUnique({ where: { id: lawyerId } });
  const p = await prisma.lawyerProfile.findUnique({ where: { userId: lawyerId }, include: { documents: true } });
  if (!user || !p) throw new AppError(404, "profile_not_found", "Lawyer profile not found.");
  return {
    // read-only
    fullLegalName: p.fullLegalName,
    cnicLast4: p.cnicLast4,
    barCouncilNumber: p.barCouncilNumber,
    email: user.email,
    verificationStatus: p.verificationStatus,
    submittedAt: p.createdAt,
    // editable
    bio: p.bio,
    practiceAreas: p.practiceAreas,
    languages: p.languages,
    consultationFeePkr: p.consultationFeePkr,
    availability: p.availability,
    showWinLossStats: p.showWinLossStats,
    profilePhotoUrl: await resolvePhotoUrl(user.profilePhotoUrl),
    province: p.province,
    city: p.city,
    yearsExperienceBand: p.yearsExperienceBand,
    winLoss: { total: p.wlTotal, won: p.wlWon, lost: p.wlLost, ongoing: p.wlOngoing },
    ratingAvg: Number(p.ratingAvg),
    reviewCount: p.reviewCount,
    // settings
    maxActiveConsultations: p.maxActiveConsultations,
    autoDeclineWhenOffline: p.autoDeclineWhenOffline,
    // documents (pending screen)
    documents: p.documents.map((d) => ({ id: d.id, docType: d.docType, status: d.status, issueNote: d.issueNote, uploadedAt: d.uploadedAt })),
  };
}

interface ProfileUpdate {
  bio?: string;
  practiceAreas?: string[];
  languages?: string[];
  consultationFeePkr?: number;
  availability?: never;
  showWinLossStats?: boolean;
  profilePhotoUrl?: string | null;
  wlTotal?: number;
  wlWon?: number;
  wlLost?: number;
  wlOngoing?: number;
}

export async function updateOwnProfile(lawyerId: string, data: ProfileUpdate) {
  const { profilePhotoUrl, ...profileFields } = data;
  await prisma.$transaction(async (tx) => {
    await tx.lawyerProfile.update({ where: { userId: lawyerId }, data: profileFields });
    if (profilePhotoUrl !== undefined) {
      await tx.user.update({ where: { id: lawyerId }, data: { profilePhotoUrl } });
    }
  });
  return getOwnProfile(lawyerId);
}

export async function setAvailability(lawyerId: string, availability: "online" | "busy" | "offline") {
  await prisma.lawyerProfile.update({ where: { userId: lawyerId }, data: { availability } });
  return { availability };
}

export async function updateSettings(lawyerId: string, data: { maxActiveConsultations?: number; autoDeclineWhenOffline?: boolean }) {
  await prisma.lawyerProfile.update({ where: { userId: lawyerId }, data });
  return { ok: true };
}
