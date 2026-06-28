import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { coreFetch, ADMIN_COOKIE } from "@/lib/bff";

// Generic authenticated proxy: browser /api/admin/* -> core-api /api/admin/*
// with the admin token (httpOnly cookie) injected server-side as Bearer.
async function proxy(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  const search = new URL(req.url).search;
  const target = `/api/admin/${path.join("/")}${search}`;
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const body = hasBody ? await req.text() : undefined;
  const { status, data } = await coreFetch(target, {
    method: req.method,
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body,
  });
  return NextResponse.json(data, { status });
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
