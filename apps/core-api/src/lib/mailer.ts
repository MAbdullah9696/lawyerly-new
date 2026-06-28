/**
 * Transactional email (§13). In development (no SMTP_HOST configured) emails are
 * logged to the console so flows like OTP and password reset are testable via
 * curl. When SMTP_HOST is set, sends through nodemailer (Mailtrap or any SMTP).
 */
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config/env.js";

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!env.SMTP_HOST) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    });
  }
  return transporter;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<void> {
  const t = getTransporter();
  if (!t) {
    if (env.NODE_ENV === "production") {
      // In production, a missing SMTP config means emails are silently dropped —
      // log a warning (without the OTP/link) so the issue is visible in Railway logs.
      console.warn(
        `[mailer] WARNING: SMTP_HOST not configured in production. Email NOT sent to: ${opts.to} | Subject: ${opts.subject}`,
      );
      return;
    }
    // Dev fallback — surfaces OTPs / reset links in the server log.
    console.log("\n========== [DEV EMAIL] ==========");
    console.log(`To:      ${opts.to}`);
    console.log(`Subject: ${opts.subject}`);
    console.log(opts.text);
    console.log("=================================\n");
    return;
  }
  await t.sendMail({
    from: env.EMAIL_FROM,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    ...(opts.html ? { html: opts.html } : {}),
  });
}
