import Link from "next/link";
import clsx from "clsx";

export function Logo({ className, variant = "dark" }: { className?: string; variant?: "dark" | "light" }) {
  const text = variant === "light" ? "text-white" : "text-navy-900";
  return (
    <Link href="/" className={clsx("inline-flex items-center gap-2", className)}>
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-900 text-gold-400 shadow-sm">
        {/* Scales-of-justice glyph */}
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 3v18M5 21h14M7 6l-3 6a3 3 0 0 0 6 0L7 6Zm10 0-3 6a3 3 0 0 0 6 0l-3-6ZM5 6h14" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className={clsx("font-serif text-xl font-bold tracking-tight", text)}>
        Lawyerly
      </span>
    </Link>
  );
}
