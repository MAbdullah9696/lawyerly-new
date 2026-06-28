import { proxyJson } from "@/lib/bff";

export const POST = (req: Request) => proxyJson(req, "/api/auth/reset-password");
