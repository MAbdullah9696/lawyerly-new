/** Lawyer marketplace service (CLAUDE.md §8.3 / §8.4). Verified lawyers only. */
import type { Prisma, ExperienceBand } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { resolvePhotoUrl } from "../../lib/storage.js";
import { AppError } from "../../middleware/error.js";

const PAGE_SIZE = 12;
const REVIEW_PAGE_SIZE = 5;

const EXPERIENCE_MAP: Record<string, ExperienceBand[]> = {
  "1-5": ["BAND_1_5"],
  "6-10": ["BAND_6_10"],
  "11+": ["BAND_11_20", "BAND_20_PLUS"],
};

const BAND_LABEL: Record<ExperienceBand, string> = {
  BAND_1_5: "1–5 years",
  BAND_6_10: "6–10 years",
  BAND_11_20: "11–20 years",
  BAND_20_PLUS: "20+ years",
};

interface ListFilters {
  q?: string;
  practiceArea?: string;
  city?: string;
  language?: string;
  minFee?: number;
  maxFee?: number;
  experience?: "Any" | "1-5" | "6-10" | "11+";
  minRating?: number;
  sort: "relevant" | "rating" | "fee_low" | "fee_high" | "experience" | "reviews";
  page: number;
}

function orderBy(sort: ListFilters["sort"]): Prisma.LawyerProfileOrderByWithRelationInput {
  switch (sort) {
    case "fee_low":
      return { consultationFeePkr: "asc" };
    case "fee_high":
      return { consultationFeePkr: "desc" };
    case "experience":
      return { yearsExperienceBand: "desc" };
    case "reviews":
      return { reviewCount: "desc" };
    case "rating":
    case "relevant":
    default:
      return { ratingAvg: "desc" };
  }
}

export async function listLawyers(f: ListFilters) {
  const practiceAreas = f.practiceArea?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  const languages = f.language?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  const bands = f.experience && f.experience !== "Any" ? EXPERIENCE_MAP[f.experience] : undefined;

  const where: Prisma.LawyerProfileWhereInput = {
    verificationStatus: "verified",
    ...(f.city ? { city: { equals: f.city, mode: "insensitive" } } : {}),
    ...(practiceAreas.length ? { practiceAreas: { hasSome: practiceAreas } } : {}),
    ...(languages.length ? { languages: { hasSome: languages } } : {}),
    ...(bands ? { yearsExperienceBand: { in: bands } } : {}),
    ...(f.minFee !== undefined || f.maxFee !== undefined
      ? { consultationFeePkr: { gte: f.minFee ?? 0, ...(f.maxFee !== undefined ? { lte: f.maxFee } : {}) } }
      : {}),
    ...(f.minRating ? { ratingAvg: { gte: f.minRating } } : {}),
    ...(f.q ? { user: { fullName: { contains: f.q, mode: "insensitive" } } } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.lawyerProfile.count({ where }),
    prisma.lawyerProfile.findMany({
      where,
      orderBy: orderBy(f.sort),
      skip: (f.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { user: { select: { id: true, fullName: true, profilePhotoUrl: true } } },
    }),
  ]);

  const items = await Promise.all(
    rows.map(async (p) => ({
      id: p.user.id,
      fullName: p.user.fullName,
      photoUrl: await resolvePhotoUrl(p.user.profilePhotoUrl),
      verified: true,
      practiceAreas: p.practiceAreas,
      languages: p.languages,
      city: p.city,
      province: p.province,
      ratingAvg: Number(p.ratingAvg),
      reviewCount: p.reviewCount,
      consultationFeePkr: p.consultationFeePkr,
      availability: p.availability,
      experienceLabel: BAND_LABEL[p.yearsExperienceBand],
      maxedOut: false,
    })),
  );

  return {
    items,
    total,
    page: f.page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

function maskBarCouncil(num: string): string {
  const visible = num.slice(0, 4);
  return `${visible}-****`;
}

export async function getLawyer(userId: string, reviewsPage: number, reviewSort: "recent" | "highest" | "lowest") {
  const p = await prisma.lawyerProfile.findFirst({
    where: { userId, verificationStatus: "verified" },
    include: { user: { select: { id: true, fullName: true, profilePhotoUrl: true } } },
  });
  if (!p) throw new AppError(404, "lawyer_not_found", "Lawyer not found.");

  const reviewOrder: Prisma.ReviewOrderByWithRelationInput =
    reviewSort === "highest" ? { rating: "desc" } : reviewSort === "lowest" ? { rating: "asc" } : { createdAt: "desc" };

  const [reviewTotal, reviews, removedCount] = await Promise.all([
    prisma.review.count({ where: { lawyerId: userId, removed: false } }),
    prisma.review.findMany({
      where: { lawyerId: userId, removed: false },
      orderBy: reviewOrder,
      skip: (reviewsPage - 1) * REVIEW_PAGE_SIZE,
      take: REVIEW_PAGE_SIZE,
    }),
    prisma.review.count({ where: { lawyerId: userId, removed: true } }),
  ]);

  return {
    lawyer: {
      id: p.user.id,
      fullName: p.user.fullName,
      photoUrl: await resolvePhotoUrl(p.user.profilePhotoUrl),
      verified: true,
      bio: p.bio,
      practiceAreas: p.practiceAreas,
      languages: p.languages,
      city: p.city,
      province: p.province,
      experienceLabel: BAND_LABEL[p.yearsExperienceBand],
      barCouncilNumberMasked: maskBarCouncil(p.barCouncilNumber),
      consultationFeePkr: p.consultationFeePkr,
      availability: p.availability,
      ratingAvg: Number(p.ratingAvg),
      reviewCount: p.reviewCount,
      showWinLossStats: p.showWinLossStats,
      winLoss: p.showWinLossStats
        ? { total: p.wlTotal, won: p.wlWon, lost: p.wlLost, ongoing: p.wlOngoing }
        : null,
      reviewsRemoved: removedCount,
    },
    reviews: {
      items: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        text: r.text,
        caseType: r.caseType,
        date: r.createdAt,
      })),
      total: reviewTotal,
      page: reviewsPage,
      pageSize: REVIEW_PAGE_SIZE,
      totalPages: Math.max(1, Math.ceil(reviewTotal / REVIEW_PAGE_SIZE)),
    },
  };
}
