/** Client-side validation mirroring CLAUDE.md §7 (also enforced server-side). */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const CNIC_RE = /^\d{5}-\d{7}-\d$/;

export function isValidEmail(v: string): boolean {
  return EMAIL_RE.test(v.trim());
}

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: "Weak" | "Fair" | "Strong";
  checks: { length: boolean; upper: boolean; digit: boolean; special: boolean };
  /** Meets the hard requirements from §7.2 (min 8, upper, digit, special). */
  valid: boolean;
}

export function scorePassword(pw: string): PasswordStrength {
  const checks = {
    length: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    digit: /[0-9]/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
  };
  const passed = Object.values(checks).filter(Boolean).length;
  const valid = checks.length && checks.upper && checks.digit && checks.special;
  let label: PasswordStrength["label"] = "Weak";
  if (passed >= 4) label = "Strong";
  else if (passed >= 2) label = "Fair";
  return { score: passed as PasswordStrength["score"], label, checks, valid };
}

/** Live formatter for CNIC input: digits -> XXXXX-XXXXXXX-X */
export function formatCnic(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 13);
  const parts = [d.slice(0, 5), d.slice(5, 12), d.slice(12, 13)].filter(Boolean);
  return parts.join("-");
}

export function isValidCnic(v: string): boolean {
  return CNIC_RE.test(v);
}
