import { NextResponse } from "next/server";

const CORE = process.env.CORE_API_URL ?? "http://localhost:4000";
export const ADMIN_COOKIE = process.env.ADMIN_COOKIE_NAME ?? "lawyerly_admin";
const MAX_AGE = 12 * 60 * 60; // 12h ceiling; server enforces 30-min inactivity

export async function coreFetch(path: string, init: RequestInit) {
  const res = await fetch(`${CORE}${path}`, { ...init, cache: "no-store" });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : {} };
}

export function setAdminCookie(res: NextResponse, token: string) {
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: MAX_AGE,
  });
  return res;
}
export function clearAdminCookie(res: NextResponse) {
  res.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
