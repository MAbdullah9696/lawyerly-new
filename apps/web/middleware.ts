import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip: maintenance page itself, admin routes, Next.js internals, API proxy, static files.
  if (
    pathname.startsWith("/maintenance") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.includes(".")
  ) {
    return;
  }

  try {
    const apiBase = process.env.NEXT_PUBLIC_CORE_API_URL ?? "http://localhost:4000";
    const res = await fetch(`${apiBase}/api/system/status`, {
      // Cache for 60 s to avoid per-request DB hits in production.
      next: { revalidate: 60 },
    } as RequestInit);
    if (res.ok) {
      const { maintenanceMode } = (await res.json()) as { maintenanceMode: boolean };
      if (maintenanceMode) {
        return NextResponse.redirect(new URL("/maintenance", request.url));
      }
    }
  } catch {
    // Fail open — never block users if core-api is unreachable.
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
