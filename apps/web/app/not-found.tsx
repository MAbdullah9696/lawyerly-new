import Link from "next/link";
import { StatusPage } from "@/components/StatusPage";

export default function NotFound() {
  return (
    <StatusPage
      code="404"
      title="Page not found"
      description="The page you’re looking for doesn’t exist or may have moved."
      action={{ href: "/", label: "Go Home" }}
    >
      <form action="/user/find-lawyer" className="mt-8 w-full max-w-sm">
        <input
          name="q"
          placeholder="Search for a lawyer…"
          className="field-input"
          aria-label="Search"
        />
      </form>
      <p className="mt-3 text-xs text-navy-400">
        Looking for help? <Link href="/register" className="font-semibold text-navy-700 hover:underline">Create an account</Link>
      </p>
    </StatusPage>
  );
}
