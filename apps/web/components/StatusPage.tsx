import Link from "next/link";
import { Logo } from "./Logo";

export function StatusPage({
  code,
  title,
  description,
  action,
  children,
}: {
  code: string;
  title: string;
  description: string;
  action?: { href: string; label: string };
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-navy-50 px-5 text-center">
      <Logo className="mb-8" />
      <p className="font-serif text-7xl font-bold text-gold-400">{code}</p>
      <h1 className="mt-3 text-2xl font-bold text-navy-900">{title}</h1>
      <p className="mt-2 max-w-md text-navy-500">{description}</p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        {action && (
          <Link href={action.href} className="btn-primary">
            {action.label}
          </Link>
        )}
        <Link href="/" className="btn-outline">
          Back to Home
        </Link>
      </div>
      {children}
    </div>
  );
}
