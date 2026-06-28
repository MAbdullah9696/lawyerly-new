import Link from "next/link";
import { Logo } from "@/components/Logo";
import { RoleGuard } from "@/components/RoleGuard";
import { DISCLAIMER_FOOTER } from "@/lib/constants";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard mode="guest">
      <div className="flex min-h-screen flex-col bg-navy-50">
        <header className="border-b border-navy-100 bg-white">
          <div className="container-page flex h-16 items-center justify-between">
            <Logo />
            <Link href="/" className="text-sm font-medium text-navy-500 hover:text-navy-900">
              ← Back to site
            </Link>
          </div>
        </header>

        <main className="flex flex-1 items-start justify-center px-5 py-10 sm:py-14">
          {children}
        </main>

        <footer className="border-t border-navy-100 bg-white">
          <div className="container-page py-4">
            <p className="text-center text-xs text-navy-400">{DISCLAIMER_FOOTER}</p>
          </div>
        </footer>
      </div>
    </RoleGuard>
  );
}
