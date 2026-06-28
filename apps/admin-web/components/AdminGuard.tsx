"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Spinner } from "./ui";
import { useAdmin } from "@/lib/auth-context";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { admin, loading } = useAdmin();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !admin) router.replace("/admin/login");
  }, [loading, admin, router]);

  if (loading || !admin) {
    return <div className="flex min-h-screen items-center justify-center"><Spinner className="h-7 w-7" /></div>;
  }
  return <>{children}</>;
}
