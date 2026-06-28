import { NextResponse } from "next/server";
import { coreFetch } from "@/lib/bff";

export async function POST(req: Request) {
  const body = await req.text();
  const { status, data } = await coreFetch("/api/admin/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  return NextResponse.json(data, { status });
}
