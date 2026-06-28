/**
 * Server-only BFF helpers. The browser never talks to core-api directly for
 * token flows: these proxy to core-api and keep the refresh token in an
 * httpOnly cookie, returning only the access token to the client.
 */
import { NextResponse } from "next/server";

const CORE = process.env.CORE_API_URL ?? "http://localhost:4000";
export const REFRESH_COOKIE = process.env.REFRESH_COOKIE_NAME ?? "lawyerly_refresh";
const REFRESH_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

interface CoreResult {
  status: number;
  data: Record<string, unknown>;
}

export async function coreFetch(path: string, init: RequestInit): Promise<CoreResult> {
  const res = await fetch(`${CORE}${path}`, { ...init, cache: "no-store" });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  return { status: res.status, data };
}

export function withRefreshCookie(res: NextResponse, token: string): NextResponse {
  res.cookies.set(REFRESH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: REFRESH_MAX_AGE,
  });
  return res;
}

export function clearRefreshCookie(res: NextResponse): NextResponse {
  res.cookies.set(REFRESH_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}

/** Plain JSON POST proxy (endpoints that issue no tokens). */
export async function proxyJson(req: Request, path: string): Promise<NextResponse> {
  const body = await req.text();
  const { status, data } = await coreFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  return NextResponse.json(data, { status });
}

/**
 * Token-issuing proxy: on success, move `refreshToken` out of the body and into
 * the httpOnly cookie. Handles the 2FA-challenge response (no tokens) too.
 */
export async function proxyAuthIssue(req: Request, path: string): Promise<NextResponse> {
  const body = await req.text();
  const { status, data } = await coreFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  if (status >= 400) return NextResponse.json(data, { status });
  const { refreshToken, ...rest } = data as { refreshToken?: string };
  const res = NextResponse.json(rest, { status });
  if (refreshToken) withRefreshCookie(res, refreshToken);
  return res;
}
