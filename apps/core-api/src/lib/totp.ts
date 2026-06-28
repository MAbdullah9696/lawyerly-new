/**
 * TOTP-based 2FA (§7.3 / §8.9). Uses otplib for code generation/verification
 * and qrcode to render the enrolment QR. Backup codes are single-use.
 */
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { randomToken, sha256 } from "./crypto.js";

const ISSUER = "Lawyerly";

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export function buildOtpAuthUrl(accountLabel: string, secret: string): string {
  return authenticator.keyuri(accountLabel, ISSUER, secret);
}

export function buildQrDataUrl(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl);
}

export function verifyTotp(token: string, secret: string): boolean {
  return authenticator.verify({ token, secret });
}

/** Returns 8 plaintext backup codes plus their hashes (store only the hashes). */
export function generateBackupCodes(count = 8): { codes: string[]; hashes: string[] } {
  const codes = Array.from({ length: count }, () => randomToken(5).slice(0, 8).toUpperCase());
  return { codes, hashes: codes.map(sha256) };
}
