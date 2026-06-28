"use client";

/**
 * Routes lawyers by verification status (§10):
 *  - pending/unverified lawyers are confined to /lawyer/pending
 *  - active (verified) lawyers are bounced away from /lawyer/pending
 */
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Spinner } from "@/components/ui/Feedback";
import { useAuth } from "@/lib/auth-context";

export function LawyerStatusGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isPending = user?.status !== "active";
  const onPendingPage = pathname === "/lawyer/pending";

  useEffect(() => {
    if (loading || !user) return;
    if (isPending && !onPendingPage) router.replace("/lawyer/pending");
    else if (!isPending && onPendingPage) router.replace("/lawyer/dashboard");
  }, [loading, user, isPending, onPendingPage, router]);

  const redirecting = !loading && user && ((isPending && !onPendingPage) || (!isPending && onPendingPage));
  if (loading || redirecting) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner className="h-7 w-7" />
      </div>
    );
  }
  return <>{children}</>;
}
