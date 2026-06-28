import { proxyAuthIssue } from "@/lib/bff";

export const POST = (req: Request) => proxyAuthIssue(req, "/api/auth/login/2fa");
