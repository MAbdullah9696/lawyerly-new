import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { coreFetch, REFRESH_COOKIE, withRefreshCookie, clearRefreshCookie } from "@/lib/bff";

export async function POST() {
  const jar = await cookies();
  const token = jar.get(REFRESH_COOKIE)?.value;
  if (!token) {
    return NextResponse.json(
      { error: { code: "no_session", message: "No active session." } },
      { status: 401 },
    );
  }
  const { status, data } = await coreFetch("/api/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: token }),
  });
  if (status >= 400) {
    return clearRefreshCookie(NextResponse.json(data, { status }));
  }
  const res = NextResponse.json({ accessToken: data.accessToken }, { status });
  return withRefreshCookie(res, data.refreshToken as string);
}
