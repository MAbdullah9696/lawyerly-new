/**
 * HTML email templates for all §13 transactional emails.
 * Each function returns { subject, html, text } ready for sendEmail().
 * Admin can override body text via SystemConfig.emailTemplates (stored in DB).
 */

// ─── Base wrapper ─────────────────────────────────────────────────────────────

function wrap(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 16px;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
      <!-- Header -->
      <tr><td style="background:#0f2744;padding:24px 32px;">
        <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-.3px;">Lawyerly</p>
        <p style="margin:4px 0 0;font-size:12px;color:#8eaac8;">Pakistan's Legal Guidance Platform</p>
      </td></tr>
      <!-- Body -->
      <tr><td style="padding:32px;">
        <h2 style="margin:0 0 16px;font-size:18px;font-weight:700;color:#0f2744;">${title}</h2>
        ${bodyHtml}
        <hr style="margin:28px 0;border:none;border-top:1px solid #e8eaed;">
        <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.5;">
          This email was sent by Lawyerly. If you did not expect it, you can safely ignore it.<br>
          <strong>This is not legal advice.</strong> AI guidance on this platform is for informational purposes only.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function p(text: string) {
  return `<p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">${text}</p>`;
}

function btn(label: string, href: string) {
  return `<p style="margin:20px 0;"><a href="${href}" style="display:inline-block;background:#0f2744;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:15px;font-weight:600;">${label}</a></p>`;
}

function code(val: string) {
  return `<p style="margin:20px 0;"><span style="display:inline-block;background:#f3f4f6;border-radius:8px;padding:16px 28px;font-size:28px;font-weight:700;letter-spacing:8px;color:#0f2744;">${val}</span></p>`;
}

function note(text: string) {
  return `<p style="margin:0;font-size:13px;color:#9ca3af;">${text}</p>`;
}

// ─── Custom template substitution ─────────────────────────────────────────────
// If a custom template string exists in SystemConfig.emailTemplates[key],
// {{variable}} placeholders are substituted and returned as the body text.

export function renderCustomTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

// ─── User templates ───────────────────────────────────────────────────────────

export function otpEmail(name: string, otp: string) {
  const title = "Your Lawyerly verification code";
  const html = wrap(title,
    p(`Hi ${name},`) +
    p("Use the code below to verify your email address. It expires in <strong>10 minutes</strong>.") +
    code(otp) +
    note("If you didn't create a Lawyerly account, you can safely ignore this email.")
  );
  const text = `Hi ${name},\n\nYour Lawyerly verification code is: ${otp}\n\nIt expires in 10 minutes.`;
  return { subject: title, html, text };
}

export function emailVerifiedEmail(name: string) {
  const title = "Welcome to Lawyerly!";
  const html = wrap(title,
    p(`Hi ${name},`) +
    p("Your email has been verified. You can now use the AI Legal Chatbot, search for lawyers, and upload documents for analysis.") +
    btn("Go to Dashboard", `${process.env.WEB_ORIGIN ?? "http://localhost:3000"}/user/dashboard`) +
    note("Remember: AI guidance is for informational purposes only — not legal advice.")
  );
  const text = `Hi ${name},\n\nYour email has been verified. Welcome to Lawyerly!\n\nLog in at ${process.env.WEB_ORIGIN ?? "http://localhost:3000"}/login`;
  return { subject: title, html, text };
}

export function passwordResetEmail(name: string, link: string) {
  const title = "Reset your Lawyerly password";
  const html = wrap(title,
    p(`Hi ${name},`) +
    p("We received a request to reset your password. Click the button below within <strong>15 minutes</strong>.") +
    btn("Reset Password", link) +
    p("If you didn't request this, you can ignore this email — your password won't change.") +
    note(`Or paste this link: <a href="${link}" style="color:#0f2744;">${link}</a>`)
  );
  const text = `Hi ${name},\n\nReset your Lawyerly password using this link (valid 15 minutes):\n${link}\n\nIf you didn't request a reset, ignore this email.`;
  return { subject: title, html, text };
}

export function passwordChangedEmail(name: string) {
  const title = "Your password was changed";
  const html = wrap(title,
    p(`Hi ${name},`) +
    p("Your Lawyerly account password was just changed. If you did this, no action is needed.") +
    p("If you didn't change your password, please reset it immediately and contact support.")
  );
  const text = `Hi ${name},\n\nYour Lawyerly password was changed. If this wasn't you, reset your password immediately.`;
  return { subject: title, html, text };
}

export function newDeviceLoginEmail(name: string, city: string, device: string) {
  const title = "New sign-in to your Lawyerly account";
  const html = wrap(title,
    p(`Hi ${name},`) +
    p(`We detected a new login to your account from <strong>${device}</strong>${city ? ` in ${city}` : ""}.`) +
    p("If this was you, no action is needed. If you don't recognise this sign-in, change your password immediately.") +
    btn("Change Password", `${process.env.WEB_ORIGIN ?? "http://localhost:3000"}/user/settings`)
  );
  const text = `Hi ${name},\n\nNew login detected from ${device}${city ? ` in ${city}` : ""}.\n\nIf this wasn't you, change your password at: ${process.env.WEB_ORIGIN ?? "http://localhost:3000"}/user/settings`;
  return { subject: title, html, text };
}

export function accountSuspendedEmail(name: string, reason: string, until: string | null) {
  const title = "Your Lawyerly account has been suspended";
  const html = wrap(title,
    p(`Hi ${name},`) +
    p(`Your account has been suspended${until ? ` until <strong>${until}</strong>` : ""}.`) +
    p(`<strong>Reason:</strong> ${reason}`) +
    p("If you believe this is an error, please contact our support team.")
  );
  const text = `Hi ${name},\n\nYour account has been suspended${until ? ` until ${until}` : ""}.\nReason: ${reason}`;
  return { subject: title, html, text };
}

export function consultationAcceptedEmail(name: string, lawyerName: string) {
  const title = "Your consultation request was accepted";
  const html = wrap(title,
    p(`Hi ${name},`) +
    p(`<strong>${lawyerName}</strong> has accepted your consultation request. You can now chat directly.`) +
    btn("Open Chat", `${process.env.WEB_ORIGIN ?? "http://localhost:3000"}/user/my-consultations`)
  );
  const text = `Hi ${name},\n\n${lawyerName} accepted your consultation request.\n\nOpen chat: ${process.env.WEB_ORIGIN ?? "http://localhost:3000"}/user/my-consultations`;
  return { subject: title, html, text };
}

export function requestExpiredEmail(name: string, lawyerName: string) {
  const title = "Your consultation request has expired";
  const html = wrap(title,
    p(`Hi ${name},`) +
    p(`Your consultation request to <strong>${lawyerName}</strong> expired after 24 hours without a response.`) +
    p("You can send a request to another lawyer.") +
    btn("Find a Lawyer", `${process.env.WEB_ORIGIN ?? "http://localhost:3000"}/user/find-lawyer`)
  );
  const text = `Hi ${name},\n\nYour consultation request to ${lawyerName} has expired.\n\nFind another lawyer: ${process.env.WEB_ORIGIN ?? "http://localhost:3000"}/user/find-lawyer`;
  return { subject: title, html, text };
}

export function requestDeclinedEmail(name: string, lawyerName: string, reason: string) {
  const title = "Your consultation request was declined";
  const html = wrap(title,
    p(`Hi ${name},`) +
    p(`<strong>${lawyerName}</strong> was unable to accept your consultation request.`) +
    p(`Reason: <em>${reason}</em>`) +
    p("You can send a request to another lawyer at any time.") +
    btn("Find a Lawyer", `${process.env.WEB_ORIGIN ?? "http://localhost:3000"}/user/find-lawyer`)
  );
  const text = `Hi ${name},\n\n${lawyerName} declined your consultation request.\nReason: ${reason}\n\nFind another lawyer: ${process.env.WEB_ORIGIN ?? "http://localhost:3000"}/user/find-lawyer`;
  return { subject: title, html, text };
}

export function consultationClosedEmail(name: string, lawyerName: string) {
  const title = "Your consultation has ended — leave a review";
  const html = wrap(title,
    p(`Hi ${name},`) +
    p(`Your consultation with <strong>${lawyerName}</strong> has been closed.`) +
    p("We'd love to hear your feedback. Reviews help other citizens find the right lawyer.") +
    btn("Leave a Review", `${process.env.WEB_ORIGIN ?? "http://localhost:3000"}/user/my-consultations`)
  );
  const text = `Hi ${name},\n\nYour consultation with ${lawyerName} has ended.\n\nLeave a review: ${process.env.WEB_ORIGIN ?? "http://localhost:3000"}/user/my-consultations`;
  return { subject: title, html, text };
}

export function documentAnalysisCompleteEmail(name: string, fileName: string) {
  const title = "Your document analysis is ready";
  const html = wrap(title,
    p(`Hi ${name},`) +
    p(`Your document <strong>${fileName}</strong> has been analysed.`) +
    p("View the extracted entities, case type classification, and plain-English summary in your documents page.") +
    btn("View Analysis", `${process.env.WEB_ORIGIN ?? "http://localhost:3000"}/user/my-documents`)
  );
  const text = `Hi ${name},\n\nYour document "${fileName}" analysis is ready.\n\nView it at: ${process.env.WEB_ORIGIN ?? "http://localhost:3000"}/user/my-documents`;
  return { subject: title, html, text };
}

// ─── Lawyer templates ─────────────────────────────────────────────────────────

export function lawyerApplicationReceivedEmail(name: string) {
  const title = "We received your Lawyerly application";
  const html = wrap(title,
    p(`Hi ${name},`) +
    p("Thank you for applying to join Lawyerly. Our team will review your application within <strong>48 hours</strong>.") +
    p("We'll email you once a decision has been made. In the meantime you can check your document status on the pending screen.")
  );
  const text = `Hi ${name},\n\nWe received your Lawyerly application. We'll review it within 48 hours and email you the result.`;
  return { subject: title, html, text };
}

export function lawyerApprovedEmail(name: string) {
  const title = "Congratulations — your Lawyerly application is approved!";
  const html = wrap(title,
    p(`Hi ${name},`) +
    p("Your application has been reviewed and <strong>approved</strong>. You now have full access to your lawyer dashboard.") +
    p("Start by setting your availability and accepting consultation requests.") +
    btn("Go to Dashboard", `${process.env.WEB_ORIGIN ?? "http://localhost:3000"}/lawyer/dashboard`)
  );
  const text = `Hi ${name},\n\nCongratulations! Your Lawyerly application has been approved.\n\nLog in at: ${process.env.WEB_ORIGIN ?? "http://localhost:3000"}/login`;
  return { subject: title, html, text };
}

export function lawyerRejectedEmail(name: string, reason: string, allowResubmission: boolean) {
  const title = "Update on your Lawyerly application";
  const html = wrap(title,
    p(`Hi ${name},`) +
    p("We have reviewed your application and unfortunately we were unable to approve it at this time.") +
    p(`<strong>Reason:</strong> ${reason}`) +
    (allowResubmission
      ? p("You are welcome to correct the identified issues and resubmit your application.") + btn("Resubmit", `${process.env.WEB_ORIGIN ?? "http://localhost:3000"}/lawyer/pending`)
      : p("If you have questions, please contact our support team."))
  );
  const text = `Hi ${name},\n\nYour application was not approved.\n\nReason: ${reason}\n\n${allowResubmission ? "You may correct the issues and resubmit." : "Contact support if you have questions."}`;
  return { subject: title, html, text };
}

export function newConsultationRequestEmail(lawyerName: string, clientFirst: string, caseType: string) {
  const title = "New consultation request";
  const html = wrap(title,
    p(`Hi ${lawyerName},`) +
    p(`You have a new <strong>${caseType}</strong> consultation request from <strong>${clientFirst}</strong>.`) +
    p("Please respond within <strong>24 hours</strong> — unanswered requests affect your response rate.") +
    btn("View Request", `${process.env.WEB_ORIGIN ?? "http://localhost:3000"}/lawyer/requests`)
  );
  const text = `Hi ${lawyerName},\n\nNew ${caseType} consultation request from ${clientFirst}. Respond within 24 hours.\n\nView: ${process.env.WEB_ORIGIN ?? "http://localhost:3000"}/lawyer/requests`;
  return { subject: title, html, text };
}

export function requestAutoExpiredEmail(lawyerName: string) {
  const title = "A consultation request has auto-expired";
  const html = wrap(title,
    p(`Hi ${lawyerName},`) +
    p("A consultation request expired without a response. Your response rate has been updated.") +
    p("Staying responsive helps you rank higher in search results.")
  );
  const text = `Hi ${lawyerName},\n\nA consultation request expired without a response. Your response rate has been updated.`;
  return { subject: title, html, text };
}

export function newReviewEmail(lawyerName: string, rating: number) {
  const stars = "★".repeat(rating) + "☆".repeat(5 - rating);
  const title = "You received a new review";
  const html = wrap(title,
    p(`Hi ${lawyerName},`) +
    p(`You received a new <strong>${rating}-star</strong> review ${stars}.`) +
    btn("View Reviews", `${process.env.WEB_ORIGIN ?? "http://localhost:3000"}/lawyer/profile/edit`)
  );
  const text = `Hi ${lawyerName},\n\nYou received a new ${rating}-star review.\n\nView: ${process.env.WEB_ORIGIN ?? "http://localhost:3000"}/lawyer/profile/edit`;
  return { subject: title, html, text };
}

export function payoutProcessedEmail(lawyerName: string, amount: number) {
  const title = "Your payout has been processed";
  const html = wrap(title,
    p(`Hi ${lawyerName},`) +
    p(`Your payout of <strong>PKR ${amount.toLocaleString()}</strong> has been processed and will arrive within 3–5 business days.`) +
    btn("View Earnings", `${process.env.WEB_ORIGIN ?? "http://localhost:3000"}/lawyer/earnings`)
  );
  const text = `Hi ${lawyerName},\n\nYour payout of PKR ${amount.toLocaleString()} has been processed. Expect it within 3-5 business days.`;
  return { subject: title, html, text };
}

// ─── Admin alert templates ────────────────────────────────────────────────────

export function adminNewApplicationEmail(count: number) {
  const title = `[Lawyerly Admin] New lawyer application${count > 1 ? "s" : ""} awaiting review`;
  const html = wrap(title,
    p(`There ${count === 1 ? "is" : "are"} <strong>${count}</strong> new lawyer application${count > 1 ? "s" : ""} awaiting review.`) +
    btn("Review Applications", `${process.env.ADMIN_WEB_ORIGIN ?? "http://localhost:3100"}/admin/verifications`)
  );
  const text = `${count} new lawyer application(s) awaiting review.\n\nReview at: ${process.env.ADMIN_WEB_ORIGIN ?? "http://localhost:3100"}/admin/verifications`;
  return { subject: title, html, text };
}

export function adminHighPriorityReportEmail(reportId: string) {
  const title = "[Lawyerly Admin] High-priority report requires attention";
  const html = wrap(title,
    p(`A new high-priority report (ID: <strong>${reportId}</strong>) has been submitted and requires immediate review.`) +
    btn("View Report", `${process.env.ADMIN_WEB_ORIGIN ?? "http://localhost:3100"}/admin/reports`)
  );
  const text = `High-priority report ${reportId} submitted.\n\nReview at: ${process.env.ADMIN_WEB_ORIGIN ?? "http://localhost:3100"}/admin/reports`;
  return { subject: title, html, text };
}

export function adminLoginNewIpEmail(username: string, ip: string) {
  const title = "[Lawyerly Admin] New admin login detected";
  const html = wrap(title,
    p(`Admin account <strong>${username}</strong> logged in from a new IP address: <strong>${ip}</strong>.`) +
    p("If this was not you, revoke the session and change the password immediately.")
  );
  const text = `Admin ${username} logged in from new IP: ${ip}.\n\nIf this wasn't you, take action immediately.`;
  return { subject: title, html, text };
}

export function adminFailedLoginEmail(username: string, ip: string) {
  const title = "[Lawyerly Admin] Failed admin login attempt";
  const html = wrap(title,
    p(`A failed login attempt was detected for admin account <strong>${username}</strong>.`) +
    p(`IP address: <strong>${ip}</strong>`) +
    p("If you are seeing repeated failures, review access to admin credentials.")
  );
  const text = `Failed admin login attempt.\nUsername: ${username}\nIP: ${ip}\nTime: ${new Date().toISOString()}`;
  return { subject: title, html, text };
}

export function adminAccountWarningEmail(email: string, note: string) {
  const title = "A warning regarding your Lawyerly account";
  const html = wrap(title,
    p("Your account has received a moderation warning.") +
    p(note)
  );
  const text = `Your account received a warning.\n\n${note}`;
  return { subject: title, html, text };
}

export function adminReportResolvedEmail(email: string) {
  const title = "We reviewed your report";
  const html = wrap(title,
    p("Thank you for your report. Our moderation team has reviewed it and taken appropriate action.") +
    p("We appreciate your help in keeping Lawyerly safe.")
  );
  const text = "We reviewed your report and took appropriate action. Thank you for helping keep Lawyerly safe.";
  return { subject: title, html, text };
}

export function adminPasswordResetEmail(name: string, link: string) {
  const title = "Reset your Lawyerly password";
  const html = wrap(title,
    p(`Hi ${name},`) +
    p("An administrator has initiated a password reset for your account. Click the button below within <strong>15 minutes</strong>.") +
    btn("Reset Password", link)
  );
  const text = `Hi ${name},\n\nAdmin-initiated password reset. Use this link within 15 minutes:\n${link}`;
  return { subject: title, html, text };
}

export function suspensionLiftedEmail(name: string) {
  const title = "Your Lawyerly account is active again";
  const html = wrap(title,
    p(`Hi ${name},`) +
    p("Your account suspension has been lifted. You can now log in and use Lawyerly again.") +
    btn("Log In", `${process.env.WEB_ORIGIN ?? "http://localhost:3000"}/login`)
  );
  const text = `Hi ${name},\n\nYour account suspension has been lifted. You can log in again.`;
  return { subject: title, html, text };
}

export function accountBannedEmail(name: string) {
  const title = "Your Lawyerly account has been permanently closed";
  const html = wrap(title,
    p(`Hi ${name},`) +
    p("Your account has been permanently banned for violating our Terms of Service.") +
    p("If you believe this is an error, contact support.")
  );
  const text = `Hi ${name},\n\nYour account has been permanently banned for violating our Terms of Service.`;
  return { subject: title, html, text };
}
