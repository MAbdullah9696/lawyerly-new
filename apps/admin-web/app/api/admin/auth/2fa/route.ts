import { NextResponse } from "next/server";
import { coreFetch, setAdminCookie } from "@/lib/bff";

export async function POST(req: Request) {
  const body = await req.text();
  const { status, data } = await coreFetch("/api/admin/auth/2fa", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  if (status >= 400) return NextResponse.json(data, { status });
  // Move the admin token into an httpOnly cookie; return only the admin profile.
  const { token, admin } = data as { token: string; admin: unknown };
  const res = NextResponse.json({ admin }, { status });
  return setAdminCookie(res, token);
}
