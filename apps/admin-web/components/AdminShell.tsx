"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useAdmin } from "@/lib/auth-context";

const NAV = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6V11h-6v9Zm0-16v5h6V4h-6Z" },
  { href: "/admin/verifications", label: "Verifications", icon: "m9 12 2 2 4-4M12 3l7 3v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6l7-3Z" },
  { href: "/admin/users", label: "Users", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" },
  { href: "/admin/reports", label: "Reports", icon: "M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" },
  { href: "/admin/reviews", label: "Reviews", icon: "M12 2l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 15l-5.2 2.6 1-5.8L3.5 8.2l5.9-.9L12 2z" },
  { href: "/admin/analytics", label: "Analytics", icon: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
  { href: "/admin/settings", label: "Settings", icon: "M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm9 3-2 1 1 3-2 2-3-1-1 2h-3l-1-2-3 1-2-2 1-3-2-1v-3l2-1-1-3 2-2 3 1 1-2h3l1 2 3-1 2 2-1 3 2 1v3Z" },
  { href: "/admin/audit-log", label: "Audit Log", icon: "M7 3h7l5 5v13H7V3Zm7 0v5h5M9 13h6M9 17h6" },
];

const ROLE_LABEL: Record<string, string> = { super_admin: "Super Admin", moderator: "Moderator", analyst: "Analyst" };

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { admin, logout } = useAdmin();
  const pathname = usePathname();

  return (
    <div className="min-h-screen lg:flex">
      <aside className="flex w-full shrink-0 flex-col bg-navy-950 text-navy-200 lg:h-screen lg:w-60 lg:sticky lg:top-0">
        <div className="flex items-center gap-2 border-b border-white/10 px-5 py-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-900 text-gold-400">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3v18M5 21h14M7 6l-3 6a3 3 0 0 0 6 0L7 6Zm10 0-3 6a3 3 0 0 0 6 0l-3-6ZM5 6h14" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <div>
            <p className="font-serif text-base font-bold text-white">Lawyerly</p>
            <p className="text-[10px] uppercase tracking-widest text-gold-400">Admin</p>
          </div>
        </div>
        <nav className="flex flex-row gap-1 overflow-x-auto p-2 lg:flex-1 lg:flex-col lg:overflow-visible">
          {NAV.map((n) => {
            const active = pathname.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} className={clsx("flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition", active ? "bg-white/10 text-white" : "text-navy-300 hover:bg-white/5 hover:text-white")}>
                <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={n.icon} /></svg>
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden items-center justify-between border-t border-white/10 px-4 py-3 lg:flex">
          <div>
            <p className="text-sm font-semibold text-white">{admin?.username}</p>
            <p className="text-[11px] text-gold-400">{ROLE_LABEL[admin?.role ?? ""] ?? ""}</p>
          </div>
          <button onClick={() => logout()} className="text-xs font-semibold text-red-300 hover:text-red-200">Log out</button>
        </div>
      </aside>

      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-4 flex items-center justify-between lg:hidden">
          <span className="text-sm font-semibold text-navy-700">{admin?.username} · {ROLE_LABEL[admin?.role ?? ""]}</span>
          <button onClick={() => logout()} className="text-xs font-semibold text-red-600">Log out</button>
        </div>
        {children}
      </main>
    </div>
  );
}
