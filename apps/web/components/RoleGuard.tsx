"use client";

/**
 * RoleGuard: client-side routing guard.
 *  - mode="guest": auth pages. If already logged in, bounce to the role's
 *    dashboard (/user/dashboard, /lawyer/dashboard|pending, /admin/dashboard).
 *  - mode="role": protected pages. Requires a logged-in user whose role is in
 *    `allow`; otherwise redirect to /login (unauthenticated) or /403 (wrong role).
 */
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Spinner } from "./ui/Feedback";
import { useAuth, dashboardPath, type Role } from "@/lib/auth-context";

export function RoleGuard({
  mode,
  allow,
  children,
}: {
  mode: "guest" | "role";
  allow?: Role[];
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (mode === "guest" && user) {
      router.replace(dashboardPath(user));
    }
    if (mode === "role") {
      if (!user) router.replace("/login");
      else if (allow && !allow.includes(user.role)) router.replace("/403");
    }
  }, [loading, user, mode, allow, router]);

  if (loading || (mode === "guest" && user) || (mode === "role" && !user)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner className="h-7 w-7" />
      </div>
    );
  }
  return <>{children}</>;
}
