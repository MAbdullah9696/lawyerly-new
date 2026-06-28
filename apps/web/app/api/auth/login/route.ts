import { proxyAuthIssue } from "@/lib/bff";

// Returns tokens on success, or { twoFactorRequired, twoFactorToken } when 2FA
// is enabled, or a 400/423 error for captcha_required / account_locked.
export const POST = (req: Request) => proxyAuthIssue(req, "/api/auth/login");
