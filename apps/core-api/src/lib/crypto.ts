/**
 * Field-level encryption (AES-256-GCM) for sensitive columns: CNIC and TOTP
 * secrets (CLAUDE.md §11). The key never touches the database.
 *
 * Stored format: base64(iv).base64(authTag).base64(ciphertext)
 */
import crypto from "node:crypto";
import { env } from "../config/env.js";

const KEY = Buffer.from(env.FIELD_ENCRYPTION_KEY, "base64");
const ALGO = "aes-256-gcm";
const IV_BYTES = 12;

export function encryptField(plaintext: string): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(".");
}

export function decryptField(payload: string): string {
  const [ivB64, tagB64, ctB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !ctB64) throw new Error("Malformed ciphertext");
  const decipher = crypto.createDecipheriv(ALGO, KEY, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/** SHA-256 hex digest — used to store opaque tokens/OTPs (never the raw value). */
export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/** Cryptographically-random URL-safe token. */
export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

/** Numeric OTP of the given length (default 6). */
export function randomNumericCode(length = 6): string {
  let code = "";
  while (code.length < length) {
    code += crypto.randomInt(0, 10).toString();
  }
  return code;
}
