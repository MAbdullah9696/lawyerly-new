/**
 * Lawyerly — database seed.
 *
 * Seeds reference/config data plus a few VERIFIED lawyer profiles (with reviews)
 * so the marketplace has data to display in development.
 * Idempotent: safe to run repeatedly.
 */
import { PrismaClient, type AdminRole, type CaseType, type ExperienceBand, type Province } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { authenticator } from "otplib";

const prisma = new PrismaClient();

// AES-256-GCM (matches apps/core-api/src/lib/crypto.ts format: iv.tag.ct base64).
function encryptSecret(plain: string): string {
  const key = Buffer.from(process.env.FIELD_ENCRYPTION_KEY ?? "", "base64");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv.toString("base64"), cipher.getAuthTag().toString("base64"), ct.toString("base64")].join(".");
}

// Admin roles only — secrets are generated fresh on each seed run (C-2 fix).
const ADMIN_SEEDS: { username: string; role: AdminRole }[] = [
  { username: "superadmin", role: "super_admin" },
  { username: "moderator1", role: "moderator" },
  { username: "analyst1", role: "analyst" },
];

async function seedAdmins() {
  if (!process.env.FIELD_ENCRYPTION_KEY) { console.log("Skipped admins (FIELD_ENCRYPTION_KEY not set)."); return; }
  const hash = await bcrypt.hash("Admin@2025", 12);
  const printed: { username: string; secret: string }[] = [];
  for (const a of ADMIN_SEEDS) {
    // Generate a unique TOTP secret for each admin on every seed run.
    const secret = authenticator.generateSecret();
    await prisma.adminAccount.upsert({
      where: { username: a.username },
      create: { username: a.username, passwordHash: hash, role: a.role, twoFactorSecret: encryptSecret(secret) },
      // Always update the secret so re-seeding produces fresh, known secrets.
      update: { twoFactorSecret: encryptSecret(secret) },
    });
    printed.push({ username: a.username, secret });
  }
  console.log("Admin accounts seeded (password: Admin@2025). TOTP secrets:");
  for (const { username, secret } of printed) {
    console.log(`  ${username.padEnd(14)} TOTP secret = ${secret}`);
  }
}

async function seedModeration() {
  const reporter = await prisma.user.findUnique({ where: { email: "seed.client@lawyerly.pk" } });
  const sana = await prisma.user.findUnique({ where: { email: "sana.malik@lawyerly.pk" } });
  const imran = await prisma.user.findUnique({ where: { email: "imran.qureshi@lawyerly.pk" } });
  if (reporter && sana && (await prisma.report.count()) === 0) {
    await prisma.report.create({ data: { reporterId: reporter.id, reportedPartyId: sana.id, type: "profile", reasonCategory: "Misleading credentials", reasonText: "The bio claims experience that seems exaggerated.", priority: "medium", status: "open" } });
    if (imran) await prisma.report.create({ data: { reporterId: reporter.id, reportedPartyId: imran.id, type: "review", reasonCategory: "Abusive language", reasonText: "A review on this lawyer uses offensive wording.", priority: "high", status: "open" } });
    console.log("Seeded 2 moderation reports.");
  }
  // Flag one existing review for the reviews queue.
  const aReview = await prisma.review.findFirst({ where: { flagged: false, removed: false } });
  if (aReview) { await prisma.review.update({ where: { id: aReview.id }, data: { flagged: true } }); console.log("Flagged 1 review for moderation."); }
}

const PRACTICE_AREAS = [
  "Civil Litigation",
  "Criminal Law",
  "Family Law",
  "Property & Real Estate",
  "Corporate & Business",
  "Constitutional Law",
  "Intellectual Property",
  "Labour Law",
  "Immigration",
  "Cyber Law",
];

const CHATBOT_DISCLAIMER =
  "This is not legal advice. Consult a licensed lawyer for your specific case.";

interface SeedReview {
  rating: number;
  text: string;
  caseType: CaseType;
  daysAgo: number;
}

interface SeedLawyer {
  email: string;
  fullName: string;
  province: Province;
  city: string;
  band: ExperienceBand;
  fee: number;
  practiceAreas: string[];
  languages: string[];
  bio: string;
  showWinLoss: boolean;
  winLoss?: { total: number; won: number; lost: number; ongoing: number };
  reviews: SeedReview[];
}

const SEED_LAWYERS: SeedLawyer[] = [
  {
    email: "bilal.ahmed@lawyerly.pk",
    fullName: "Bilal Ahmed",
    province: "Punjab",
    city: "Lahore",
    band: "BAND_6_10",
    fee: 5000,
    practiceAreas: ["Family Law", "Civil Litigation"],
    languages: ["English", "Urdu"],
    bio: "Family and civil litigation advocate based in Lahore with over eight years of courtroom practice across district and high courts. I focus on clear client communication, realistic expectations, and timely resolution of family disputes, guardianship, and civil suits.",
    showWinLoss: false,
    reviews: [
      { rating: 5, text: "Explained my options clearly and resolved my custody matter faster than I expected.", caseType: "Family", daysAgo: 6 },
      { rating: 4, text: "Professional and responsive throughout. Good value for the fee.", caseType: "Civil", daysAgo: 20 },
      { rating: 5, text: "Very patient and answered all my questions. Highly recommend.", caseType: "Family", daysAgo: 41 },
    ],
  },
  {
    email: "sana.malik@lawyerly.pk",
    fullName: "Sana Malik",
    province: "Sindh",
    city: "Karachi",
    band: "BAND_11_20",
    fee: 8000,
    practiceAreas: ["Criminal Law", "Constitutional Law"],
    languages: ["English", "Urdu", "Sindhi"],
    bio: "Criminal and constitutional law specialist practising before the Sindh High Court for fifteen years. I handle bail, trials, and constitutional petitions, with particular attention to procedural rigor and protecting the fundamental rights of my clients.",
    showWinLoss: true,
    winLoss: { total: 120, won: 86, lost: 18, ongoing: 16 },
    reviews: [
      { rating: 5, text: "Secured bail when I had lost hope. Knows the courts inside out.", caseType: "Criminal", daysAgo: 3 },
      { rating: 5, text: "Sharp, thorough, and always prepared. Outstanding advocate.", caseType: "Constitutional", daysAgo: 15 },
      { rating: 4, text: "Excellent legal mind. Communication could be a little quicker.", caseType: "Criminal", daysAgo: 33 },
    ],
  },
  {
    email: "imran.qureshi@lawyerly.pk",
    fullName: "Imran Qureshi",
    province: "Federal",
    city: "Islamabad",
    band: "BAND_1_5",
    fee: 3500,
    practiceAreas: ["Property & Real Estate", "Corporate & Business"],
    languages: ["English", "Urdu", "Punjabi"],
    bio: "Property and corporate advocate in Islamabad assisting clients with title verification, mutation disputes, tenancy, company incorporation, and commercial agreements. I aim to make property and business law approachable and transparent for first-time clients.",
    showWinLoss: false,
    reviews: [
      { rating: 4, text: "Helped me verify a plot title and avoid a bad purchase. Thorough work.", caseType: "Property", daysAgo: 9 },
      { rating: 4, text: "Good guidance on registering my company. Reasonable fee.", caseType: "Corporate", daysAgo: 27 },
    ],
  },
  {
    email: "ayesha.tariq@lawyerly.pk",
    fullName: "Ayesha Tariq",
    province: "KPK",
    city: "Peshawar",
    band: "BAND_20_PLUS",
    fee: 10000,
    practiceAreas: ["Cyber Law", "Labour Law"],
    languages: ["English", "Urdu", "Pashto"],
    bio: "Senior advocate with over twenty years of experience, now focused on cyber law (PECA 2016) and labour disputes. I represent clients in online harassment, data and defamation matters, and wrongful termination and wage claims before labour courts and tribunals.",
    showWinLoss: true,
    winLoss: { total: 210, won: 168, lost: 24, ongoing: 18 },
    reviews: [
      { rating: 5, text: "Handled my online harassment case with great sensitivity and skill.", caseType: "Other", daysAgo: 5 },
      { rating: 5, text: "Got my unpaid wages recovered. Knowledgeable and determined.", caseType: "Other", daysAgo: 18 },
      { rating: 4, text: "Very experienced. Helped me understand a complex PECA matter.", caseType: "Other", daysAgo: 50 },
    ],
  },
];

async function seedLawyers(passwordHash: string) {
  // A citizen who "authored" the seed reviews (reviews require a consultation).
  const reviewer = await prisma.user.upsert({
    where: { email: "seed.client@lawyerly.pk" },
    update: {},
    create: {
      role: "citizen",
      fullName: "Seed Client",
      email: "seed.client@lawyerly.pk",
      passwordHash,
      emailVerified: true,
      status: "active",
    },
  });

  let created = 0;
  for (const l of SEED_LAWYERS) {
    const existing = await prisma.user.findUnique({ where: { email: l.email } });
    if (existing) continue; // already seeded

    const ratingAvg =
      Math.round((l.reviews.reduce((s, r) => s + r.rating, 0) / l.reviews.length) * 10) / 10;

    const user = await prisma.user.create({
      data: {
        role: "lawyer",
        fullName: l.fullName,
        email: l.email,
        phone: "03000000000",
        passwordHash,
        emailVerified: true,
        status: "active",
        province: l.province,
        lawyerProfile: {
          create: {
            fullLegalName: l.fullName,
            cnicEncrypted: "seed-placeholder", // real encryption arrives via the app, not seed
            cnicLast4: "0000",
            barCouncilNumber: `BC-${l.province.slice(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 8999)}`,
            province: l.province,
            city: l.city,
            yearsExperienceBand: l.band,
            practiceAreas: l.practiceAreas,
            languages: l.languages,
            consultationFeePkr: l.fee,
            bio: l.bio,
            verificationStatus: "verified",
            availability: "online",
            showWinLossStats: l.showWinLoss,
            ratingAvg,
            reviewCount: l.reviews.length,
            wlTotal: l.winLoss?.total ?? 0,
            wlWon: l.winLoss?.won ?? 0,
            wlLost: l.winLoss?.lost ?? 0,
            wlOngoing: l.winLoss?.ongoing ?? 0,
          },
        },
      },
    });

    for (const r of l.reviews) {
      const when = new Date(Date.now() - r.daysAgo * 24 * 60 * 60 * 1000);
      const consultation = await prisma.consultation.create({
        data: {
          userId: reviewer.id,
          lawyerId: user.id,
          status: "closed",
          caseType: r.caseType,
          startedAt: when,
          closedAt: when,
        },
      });
      await prisma.review.create({
        data: {
          consultationId: consultation.id,
          lawyerId: user.id,
          userId: reviewer.id,
          rating: r.rating,
          text: r.text,
          caseType: r.caseType,
          createdAt: when,
        },
      });
    }
    created++;
  }
  console.log(`Seeded ${created} verified lawyers (with reviews).`);
}

const REQUEST_CITIZENS = [
  { email: "ahmed.raza@example.com", fullName: "Ahmed Raza" },
  { email: "fatima.noor@example.com", fullName: "Fatima Noor" },
  { email: "usman.ali@example.com", fullName: "Usman Ali" },
];

async function seedLawyerActivity(passwordHash: string) {
  const cfg = await prisma.systemConfig.findUnique({ where: { id: true } });
  const pct = cfg ? Number(cfg.platformFeePercent) : 10;

  // 1. Backfill transactions for closed consultations (drives earnings).
  const closed = await prisma.consultation.findMany({ where: { status: "closed" } });
  let txCreated = 0;
  for (const c of closed) {
    const exists = await prisma.transaction.findFirst({ where: { consultationId: c.id } });
    if (exists) continue;
    const profile = await prisma.lawyerProfile.findUnique({ where: { userId: c.lawyerId } });
    if (!profile) continue;
    const net = Math.round(profile.consultationFeePkr * (1 - pct / 100));
    await prisma.transaction.create({
      data: {
        consultationId: c.id,
        lawyerId: c.lawyerId,
        feePkr: profile.consultationFeePkr,
        platformFeePercent: pct.toFixed(2),
        netEarnedPkr: net,
        status: "paid",
        createdAt: c.closedAt ?? c.startedAt,
      },
    });
    txCreated++;
  }

  // 2. Request citizens
  const citizens = [];
  for (const rc of REQUEST_CITIZENS) {
    citizens.push(
      await prisma.user.upsert({
        where: { email: rc.email },
        update: {},
        create: { role: "citizen", fullName: rc.fullName, email: rc.email, passwordHash, emailVerified: true, status: "active" },
      }),
    );
  }

  // 3. Activity for Bilal (verified lawyer) — pending/declined/expired requests + an active case + payout method
  const bilal = await prisma.user.findUnique({ where: { email: "bilal.ahmed@lawyerly.pk" } });
  if (bilal) {
    const reqCount = await prisma.consultationRequest.count({ where: { lawyerId: bilal.id } });
    if (reqCount === 0) {
      const now = Date.now();
      // pending (fresh)
      await prisma.consultationRequest.create({
        data: { userId: citizens[0].id, lawyerId: bilal.id, caseType: "Family", status: "pending",
          description: "My spouse and I are separating and I need guidance on custody of our two children.",
          createdAt: new Date(now - 2 * 3600_000), expiresAt: new Date(now + 22 * 3600_000) },
      });
      // pending (near expiry < 6h to test countdown)
      await prisma.consultationRequest.create({
        data: { userId: citizens[1].id, lawyerId: bilal.id, caseType: "Civil", status: "pending",
          description: "A contractor has not completed work I paid for. What are my options to recover the amount?",
          createdAt: new Date(now - 19 * 3600_000), expiresAt: new Date(now + 5 * 3600_000) },
      });
      // declined
      await prisma.consultationRequest.create({
        data: { userId: citizens[2].id, lawyerId: bilal.id, caseType: "Criminal", status: "declined",
          declineReason: "Not my area of expertise",
          description: "I was issued an FIR and need urgent criminal defence help.",
          createdAt: new Date(now - 3 * 86400_000), expiresAt: new Date(now - 2 * 86400_000) },
      });
      // expired
      await prisma.consultationRequest.create({
        data: { userId: citizens[0].id, lawyerId: bilal.id, caseType: "Property", status: "expired",
          description: "Boundary dispute with a neighbour over a shared wall.",
          createdAt: new Date(now - 5 * 86400_000), expiresAt: new Date(now - 4 * 86400_000) },
      });
    }
    const activeCount = await prisma.consultation.count({ where: { lawyerId: bilal.id, status: "active" } });
    if (activeCount === 0) {
      const req = await prisma.consultationRequest.create({
        data: { userId: citizens[1].id, lawyerId: bilal.id, caseType: "Family", status: "accepted",
          description: "Need help drafting a maintenance agreement after divorce.",
          createdAt: new Date(Date.now() - 86400_000), expiresAt: new Date(Date.now()) },
      });
      await prisma.consultation.create({
        data: { userId: citizens[1].id, lawyerId: bilal.id, requestId: req.id, status: "active", caseType: "Family",
          caseNotes: "Client seeks a fair maintenance arrangement. Gathering income documents." },
      });
    }
    const methodCount = await prisma.payoutMethod.count({ where: { lawyerId: bilal.id } });
    if (methodCount === 0) {
      await prisma.payoutMethod.create({
        data: { lawyerId: bilal.id, type: "easypaisa", details: { mobile: "03001234567" }, isDefault: true },
      });
    }
  }

  // 4. A PENDING lawyer (for the /lawyer/pending screen)
  const pendingEmail = "hamza.sheikh@lawyerly.pk";
  if (!(await prisma.user.findUnique({ where: { email: pendingEmail } }))) {
    await prisma.user.create({
      data: {
        role: "lawyer", fullName: "Hamza Sheikh", email: pendingEmail, phone: "03009998888",
        passwordHash, emailVerified: true, status: "pending", province: "Punjab",
        lawyerProfile: {
          create: {
            fullLegalName: "Hamza Sheikh", cnicEncrypted: "seed-placeholder", cnicLast4: "1234",
            barCouncilNumber: "BC-PUN-7788", province: "Punjab", city: "Faisalabad",
            yearsExperienceBand: "BAND_1_5", practiceAreas: ["Corporate & Business"], languages: ["English", "Urdu"],
            consultationFeePkr: 4000,
            bio: "Newly enrolled advocate focusing on corporate and commercial matters in Faisalabad, assisting startups and small businesses with company incorporation, partnership deeds, commercial contracts, and regulatory compliance under Pakistani company and tax law. Committed to clear, affordable, and practical legal support for first-time founders.",
            verificationStatus: "pending", availability: "offline",
            documents: {
              create: [
                { docType: "bar_council_cert", fileUrl: "upload://bar_council_cert/cert.pdf", status: "submitted" },
                { docType: "cnic_front", fileUrl: "upload://cnic_front/front.jpg", status: "verified" },
                { docType: "cnic_back", fileUrl: "upload://cnic_back/back.jpg", status: "issue_found", issueNote: "Image is blurry — please re-upload a clearer photo of the CNIC back." },
                { docType: "law_degree", fileUrl: "upload://law_degree/degree.pdf", status: "submitted" },
                { docType: "profile_photo", fileUrl: "upload://profile_photo/photo.jpg", status: "submitted" },
              ],
            },
          },
        },
      },
    });
    console.log("Seeded 1 pending lawyer (hamza.sheikh@lawyerly.pk).");
  }

  console.log(`Seeded lawyer activity: ${txCreated} transactions backfilled.`);
}

async function main() {
  // Practice areas
  for (const name of PRACTICE_AREAS) {
    await prisma.practiceArea.upsert({ where: { name }, update: {}, create: { name, enabled: true } });
  }
  console.log(`Seeded ${PRACTICE_AREAS.length} practice areas.`);

  // SystemConfig singleton
  const practiceAreasJson = PRACTICE_AREAS.map((name) => ({ name, enabled: true }));
  await prisma.systemConfig.upsert({
    where: { id: true },
    update: { practiceAreas: practiceAreasJson, chatbotDisclaimerText: CHATBOT_DISCLAIMER },
    create: {
      id: true,
      practiceAreas: practiceAreasJson,
      chatbotDisclaimerText: CHATBOT_DISCLAIMER,
      platformFeePercent: "10.00",
      emailTemplates: {},
      maintenanceMode: false,
    },
  });
  console.log("Seeded SystemConfig singleton.");

  const passwordHash = await bcrypt.hash("Lawyer@2025", 12);
  await seedLawyers(passwordHash);
  await seedLawyerActivity(passwordHash);
  await seedAdmins();
  await seedModeration();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
