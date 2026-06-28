/**
 * Documents service — upload registration, pipeline orchestration, analysis persistence.
 *
 * Flow:
 *   1. Client PUT → MinIO (direct, presigned URL)
 *   2. Client → POST /api/documents/upload (objectKey, fileName, fileType)
 *   3. Service creates Document record (status=processing), returns immediately
 *   4. Background: fetch presigned GET → POST ai-service/ocr → POST ai-service/analyze
 *   5. Save DocumentAnalysis, update status (analysis_complete | low_confidence | processing_failed)
 *   6. Raw OCR text deleted immediately after analysis (never persisted — privacy §8.7/§9.2)
 */
import { prisma } from "../../lib/prisma.js";
import { env } from "../../config/env.js";
import { presignGet, deleteObject } from "../../lib/storage.js";
import { AppError } from "../../middleware/error.js";
import { sendEmail } from "../../lib/mailer.js";
import { documentAnalysisCompleteEmail } from "../../lib/emailTemplates.js";
import { DocumentStatus, CaseType } from "@prisma/client";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
]);

const ALLOWED_EXTS = new Set(["pdf", "jpg", "jpeg", "png"]);

export function validateDocumentType(fileType: string, fileName: string): void {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_MIME_TYPES.has(fileType) || !ALLOWED_EXTS.has(ext)) {
    throw new AppError(
      400,
      "invalid_file_type",
      "Only PDF, JPG, and PNG files are accepted.",
    );
  }
}

export async function registerUpload(
  userId: string,
  objectKey: string,
  fileName: string,
  fileType: string,
): Promise<string> {
  validateDocumentType(fileType, fileName);
  const doc = await prisma.document.create({
    data: {
      userId,
      fileName,
      fileType,
      fileUrl: objectKey,
      status: "processing",
    },
  });

  // Kick off pipeline in background — do NOT await (return fast to client).
  runPipeline(doc.id, objectKey).catch((err) =>
    console.error(`[pipeline] document ${doc.id} failed:`, err),
  );

  return doc.id;
}

export async function getUserDocuments(userId: string) {
  const docs = await prisma.document.findMany({
    where: { userId },
    orderBy: { uploadDate: "desc" },
    include: { analysis: true },
  });
  return docs.map(formatDoc);
}

export async function getDocumentById(userId: string, id: string) {
  const doc = await prisma.document.findFirst({
    where: { id, userId },
    include: { analysis: true },
  });
  if (!doc) throw new AppError(404, "not_found", "Document not found.");
  return formatDoc(doc);
}

export async function getDocumentAnalysis(userId: string, id: string) {
  const doc = await prisma.document.findFirst({
    where: { id, userId },
    include: { analysis: true },
  });
  if (!doc) throw new AppError(404, "not_found", "Document not found.");
  if (!doc.analysis) throw new AppError(404, "no_analysis", "Analysis not yet available.");
  return formatAnalysis(doc.analysis);
}

export async function getDocumentServeUrl(userId: string, id: string): Promise<string> {
  const doc = await prisma.document.findFirst({ where: { id, userId } });
  if (!doc) throw new AppError(404, "not_found", "Document not found.");
  return presignGet(doc.fileUrl, 3600);
}

export async function softDeleteDocument(userId: string, id: string): Promise<void> {
  const doc = await prisma.document.findFirst({ where: { id, userId } });
  if (!doc) throw new AppError(404, "not_found", "Document not found.");

  // Delete from storage (best-effort — storage may have already failed).
  deleteObject(doc.fileUrl).catch((e) =>
    console.warn(`[storage] could not delete ${doc.fileUrl}:`, e),
  );

  await prisma.document.delete({ where: { id } });
}

// ─── Presigned URL helpers ───────────────────────────────────────────────────

async function resolveFileUrl(objectKey: string): Promise<string> {
  // Reject raw URLs — all stored values must be object keys (L-3 fix).
  if (objectKey.startsWith("http://") || objectKey.startsWith("https://")) {
    throw new Error(`Document fileUrl is a raw URL instead of an object key: ${objectKey.slice(0, 60)}`);
  }
  return presignGet(objectKey, 3600);
}

// ─── Pipeline ────────────────────────────────────────────────────────────────

async function runPipeline(docId: string, objectKey: string): Promise<void> {
  try {
    // Step 1: get presigned GET URL for the AI service to fetch.
    const fileUrl = await resolveFileUrl(objectKey);

    // Step 2: OCR (X-API-Key authenticates to the ai-service, C-1 fix).
    const ocrRes = await fetch(`${env.AI_SERVICE_URL}/ocr`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": env.AI_SERVICE_API_KEY },
      body: JSON.stringify({ fileUrl }),
    });
    if (!ocrRes.ok) {
      const err = await ocrRes.text();
      throw new Error(`OCR service error (${ocrRes.status}): ${err}`);
    }
    const ocrData = (await ocrRes.json()) as {
      text: string;
      confidence: number;
      lowConfidence: boolean;
    };

    // Step 3: NLP — pass OCR text for analysis.
    const nlpRes = await fetch(`${env.AI_SERVICE_URL}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": env.AI_SERVICE_API_KEY },
      body: JSON.stringify({ text: ocrData.text }),
    });
    if (!nlpRes.ok) {
      const err = await nlpRes.text();
      throw new Error(`NLP service error (${nlpRes.status}): ${err}`);
    }
    const nlpData = (await nlpRes.json()) as {
      caseType: string;
      summary: string;
      entities: { type: string; value: string; confidence: number }[];
      overallConfidence: number;
    };

    // Step 4: Persist analysis — raw OCR text is NOT stored (privacy rule §8.7).
    const caseTypeEnum = toCaseTypeEnum(nlpData.caseType);
    const finalStatus: DocumentStatus = ocrData.lowConfidence
      ? "low_confidence"
      : "analysis_complete";

    await prisma.$transaction([
      prisma.documentAnalysis.upsert({
        where: { documentId: docId },
        create: {
          documentId: docId,
          caseType: caseTypeEnum,
          summary: nlpData.summary,
          entities: nlpData.entities as unknown as import("@prisma/client").Prisma.InputJsonValue,
          overallConfidence: nlpData.overallConfidence,
        },
        update: {
          caseType: caseTypeEnum,
          summary: nlpData.summary,
          entities: nlpData.entities as unknown as import("@prisma/client").Prisma.InputJsonValue,
          overallConfidence: nlpData.overallConfidence,
        },
      }),
      prisma.document.update({
        where: { id: docId },
        data: { status: finalStatus },
      }),
    ]);

    console.log(`[pipeline] document ${docId} → ${finalStatus}`);
    // Email user that analysis is ready.
    const doc2 = await prisma.document.findUnique({ where: { id: docId }, include: { user: { select: { email: true, fullName: true } } } });
    if (doc2?.user) {
      const analysisT = documentAnalysisCompleteEmail(doc2.user.fullName, doc2.fileName);
      await sendEmail({ to: doc2.user.email, ...analysisT }).catch(() => {});
    }
  } catch (err) {
    console.error(`[pipeline] document ${docId} failed:`, err);
    await prisma.document.update({
      where: { id: docId },
      data: { status: "processing_failed" },
    }).catch(() => {});
  }
}

// ─── Formatters ──────────────────────────────────────────────────────────────

function formatDoc(doc: {
  id: string;
  fileName: string;
  fileType: string;
  fileUrl: string;
  status: DocumentStatus;
  uploadDate: Date;
  analysis: {
    caseType: CaseType | null;
    summary: string | null;
    entities: unknown;
    overallConfidence: unknown;
    createdAt: Date;
  } | null;
}) {
  return {
    id: doc.id,
    fileName: doc.fileName,
    fileType: doc.fileType,
    objectKey: doc.fileUrl,
    status: doc.status,
    uploadDate: doc.uploadDate.toISOString(),
    analysis: doc.analysis ? formatAnalysis(doc.analysis) : null,
  };
}

function formatAnalysis(a: {
  caseType: CaseType | null;
  summary: string | null;
  entities: unknown;
  overallConfidence: unknown;
  createdAt: Date;
}) {
  return {
    caseType: a.caseType,
    summary: a.summary,
    entities: a.entities,
    overallConfidence:
      a.overallConfidence != null ? Number(a.overallConfidence) : null,
    createdAt: a.createdAt.toISOString(),
  };
}

function toCaseTypeEnum(raw: string): CaseType {
  const valid: Record<string, CaseType> = {
    Civil: "Civil",
    Criminal: "Criminal",
    Family: "Family",
    Property: "Property",
    Corporate: "Corporate",
    Constitutional: "Constitutional",
    Other: "Other",
  };
  return valid[raw] ?? "Other";
}
