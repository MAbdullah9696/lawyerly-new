"use client";

import Link from "next/link";
import { useState } from "react";
import { Logo } from "./Logo";
import { useAuth, dashboardPath } from "@/lib/auth-context";

const NAV_LINKS = [
  { href: "/user/find-lawyer", label: "Find a Lawyer" },
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/about", label: "About" },
];

export function PublicNavbar() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-navy-100 bg-white/90 backdrop-blur">
      <nav className="container-page flex h-16 items-center justify-between">
        <Logo />

        <div className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm font-medium text-navy-600 transition hover:text-navy-900">
              {l.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {loading ? (
            <div className="h-9 w-36 animate-pulse rounded-lg bg-navy-100" />
          ) : user ? (
            <Link href={dashboardPath(user)} className="btn-primary">
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="text-sm font-semibold text-navy-700 hover:text-navy-900">
                Log In
              </Link>
              <Link href="/register" className="btn-gold">
                Register
              </Link>
            </>
          )}
        </div>

        <button
          className="rounded-lg p-2 text-navy-700 md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
          </svg>
        </button>
      </nav>

      {open && (
        <div className="border-t border-navy-100 bg-white px-5 py-4 md:hidden">
          <div className="flex flex-col gap-3">
            {NAV_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="text-sm font-medium text-navy-700" onClick={() => setOpen(false)}>
                {l.label}
              </Link>
            ))}
            <hr className="border-navy-100" />
            {user ? (
              <Link href={dashboardPath(user)} className="btn-primary" onClick={() => setOpen(false)}>
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="btn-outline" onClick={() => setOpen(false)}>
                  Log In
                </Link>
                <Link href="/register" className="btn-gold" onClick={() => setOpen(false)}>
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
