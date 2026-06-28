"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function SessionExpiredModal() {
  const [open, setOpen] = useState(false);
  const [returnTo, setReturnTo] = useState("/");
  const router = useRouter();

  useEffect(() => {
    const handler = (e: Event) => {
      setReturnTo((e as CustomEvent<{ returnTo?: string }>).detail?.returnTo ?? "/");
      setOpen(true);
    };
    window.addEventListener("session-expired", handler);
    return () => window.removeEventListener("session-expired", handler);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-navy-950/60 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl text-center space-y-4">
        <h3 className="text-lg font-bold text-navy-900">Session expired</h3>
        <p className="text-sm text-navy-600">
          Your session has expired. Please log in again to continue.
        </p>
        <button
          className="w-full rounded-xl bg-navy-900 py-2.5 text-sm font-semibold text-white hover:bg-navy-700 transition-colors"
          onClick={() =>
            router.push(`/login?redirect=${encodeURIComponent(returnTo)}`)
          }
        >
          Log in again
        </button>
      </div>
    </div>
  );
}
