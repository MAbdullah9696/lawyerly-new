/**
 * Password hashing (bcrypt cost 12), strength validation, and the
 * HaveIBeenPwned k-anonymity breach check (CLAUDE.md §7.2 / §7.4 / §11).
 */
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { env } from "../config/env.js";

const BCRYPT_COST = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Strength rules (§7.2): min 8 chars, ≥1 uppercase, ≥1 digit, ≥1 special.
 * Returns null when valid, or a human-readable message when not.
 */
export function validatePasswordStrength(pw: string): string | null {
  if (pw.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(pw)) return "Password must contain at least one uppercase letter.";
  if (!/[0-9]/.test(pw)) return "Password must contain at least one digit.";
  if (!/[^A-Za-z0-9]/.test(pw)) return "Password must contain at least one special character.";
  return null;
}

/**
 * HaveIBeenPwned range API (k-anonymity): we send only the first 5 chars of the
 * SHA-1 hash and check the returned suffixes locally. Never sends the password.
 * Fails open (returns false) if the service is unreachable.
 */
export async function isPasswordPwned(pw: string): Promise<boolean> {
  if (!env.HIBP_ENABLED) return false;
  try {
    const sha1 = crypto.createHash("sha1").update(pw).digest("hex").toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
    });
    if (!res.ok) return false;
    const body = await res.text();
    return body
      .split("\n")
      .some((line) => line.split(":")[0]?.trim() === suffix);
  } catch {
    return false; // fail open — availability over strictness for this check
  }
}
