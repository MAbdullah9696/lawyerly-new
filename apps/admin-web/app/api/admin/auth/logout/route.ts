import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { coreFetch, ADMIN_COOKIE, clearAdminCookie } from "@/lib/bff";

export async function POST() {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (token) await coreFetch("/api/admin/auth/logout", { method: "POST", headers: { authorization: `Bearer ${token}` } });
  return clearAdminCookie(NextResponse.json({ ok: true }));
}
