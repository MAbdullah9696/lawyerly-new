"use client";

import { StatusPage } from "@/components/StatusPage";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <StatusPage
      code="500"
      title="Something went wrong on our end"
      description="An unexpected error occurred. Please try again — if it keeps happening, contact support with the reference code below."
    >
      <button onClick={reset} className="mt-6 btn-primary">
        Try again
      </button>
      {error.digest && <p className="mt-4 text-xs text-navy-400">Reference code: {error.digest}</p>}
    </StatusPage>
  );
}
