import { NextResponse } from "next/server";
import { coreFetch } from "@/lib/bff";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const { status, data } = await coreFetch("/api/auth/me", { headers: { authorization: auth } });
  return NextResponse.json(data, { status });
}
