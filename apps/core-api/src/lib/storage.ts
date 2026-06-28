/**
 * MinIO / S3-compatible object storage helpers (§11, §8.7).
 * Presigned PUT → client uploads directly to MinIO.
 * Presigned GET → 1-hour expiring URLs served to the browser.
 * MIME type + magic-bytes validation happen before PUT (in the upload route).
 */
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env.js";
import crypto from "node:crypto";

export const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY,
  },
  forcePathStyle: true, // required for MinIO
});

const BUCKET = env.S3_BUCKET;

/** Ensure the bucket exists (called at startup). */
export async function ensureBucket(): Promise<void> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
    console.log(`[storage] created bucket: ${BUCKET}`);
  }
}

/** Generate a presigned PUT URL + final object key.
 *  The caller passes the key; the server validates and confirms it. */
export async function presignPut(
  objectKey: string,
  contentType: string,
  expiresInSeconds = 300,
): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket: BUCKET,
    Key: objectKey,
    ContentType: contentType,
  });
  return getSignedUrl(s3, cmd, { expiresIn: expiresInSeconds });
}

/** Generate a presigned GET URL (1-hour expiry per §11). */
export async function presignGet(objectKey: string, expiresInSeconds = 3600): Promise<string> {
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: objectKey });
  return getSignedUrl(s3, cmd, { expiresIn: expiresInSeconds });
}

/** Delete an object from storage. */
export async function deleteObject(objectKey: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: objectKey }));
}

/** Build a stable object key from a folder prefix + random suffix. */
export function makeObjectKey(folder: "documents" | "profiles" | "lawyer-docs", ext: string): string {
  const rand = crypto.randomBytes(12).toString("hex");
  return `${folder}/${rand}.${ext}`;
}

/**
 * Resolve a stored profilePhotoUrl: objectKey → presigned GET URL (24-hour expiry).
 * data: URIs (base64 inline) are returned as-is.
 * Full http/https URLs are rejected — all stored values must be object keys (L-3 fix).
 */
export async function resolvePhotoUrl(raw: string | null | undefined): Promise<string | null> {
  if (!raw) return null;
  if (raw.startsWith("data:")) return raw; // inline base64, safe passthrough
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    // Stored value is a raw URL rather than an object key — log and skip rather
    // than exposing it, so a single bad row doesn't crash the whole page.
    console.warn("[storage] resolvePhotoUrl: raw URL stored as objectKey (expected object key):", raw.slice(0, 60));
    return null;
  }
  return presignGet(raw, 86400); // 24-hour expiry
}

/** Allowed MIME types + max sizes by upload category. */
export const UPLOAD_RULES = {
  document: {
    mimes: ["application/pdf", "image/jpeg", "image/png"],
    maxBytes: 10 * 1024 * 1024,
    exts: ["pdf", "jpg", "jpeg", "png"],
  },
  profile: {
    mimes: ["image/jpeg", "image/png"],
    maxBytes: 2 * 1024 * 1024,
    exts: ["jpg", "jpeg", "png"],
  },
  "lawyer-doc": {
    mimes: ["application/pdf", "image/jpeg", "image/png"],
    maxBytes: 5 * 1024 * 1024,
    exts: ["pdf", "jpg", "jpeg", "png"],
  },
} as const;

export type UploadCategory = keyof typeof UPLOAD_RULES;
