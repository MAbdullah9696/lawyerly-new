import { NextResponse } from "next/server";
import { coreFetch, clearRefreshCookie } from "@/lib/bff";

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  await coreFetch("/api/auth/logout", { method: "POST", headers: { authorization: auth } });
  return clearRefreshCookie(NextResponse.json({ message: "Logged out." }));
}
