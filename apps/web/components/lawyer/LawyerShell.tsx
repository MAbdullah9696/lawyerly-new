"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Logo } from "@/components/Logo";
import { Avatar } from "@/components/user/widgets";
import { useAuth } from "@/lib/auth-context";
import { lawyerApi, notificationsApi } from "@/lib/api";

const NAV = [
  { href: "/lawyer/dashboard", label: "Dashboard", icon: "M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6V11h-6v9Zm0-16v5h6V4h-6Z" },
  { href: "/lawyer/requests", label: "Consultation Requests", icon: "M12 3a9 9 0 1 1-9 9M3 3v6h6M21 12a9 9 0 0 1-2 5" },
  { href: "/lawyer/cases", label: "Active Cases", icon: "M7 3h7l5 5v13H7V3Zm7 0v5h5" },
  { href: "/lawyer/profile/edit", label: "My Profile", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" },
  { href: "/lawyer/earnings", label: "Earnings", icon: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" },
  { href: "/lawyer/settings", label: "Settings", icon: "M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm9 3-2 1 1 3-2 2-3-1-1 2h-3l-1-2-3 1-2-2 1-3-2-1v-3l2-1-1-3 2-2 3 1 1-2h3l1 2 3-1 2 2-1 3 2 1v3Z" },
];

const AVAIL = {
  online: { label: "Online", dot: "bg-green-500", next: "busy" as const },
  busy: { label: "Busy", dot: "bg-amber-500", next: "offline" as const },
  offline: { label: "Offline", dot: "bg-navy-300", next: "online" as const },
};
type Avail = keyof typeof AVAIL;

function AvailabilityToggle() {
  const [status, setStatus] = useState<Avail | null>(null);
  useEffect(() => {
    lawyerApi.profile().then((r) => setStatus(r.profile.availability)).catch(() => setStatus("offline"));
  }, []);
  if (!status) return <div className="h-8 w-24 animate-pulse rounded-full bg-navy-100" />;
  const a = AVAIL[status];
  return (
    <button
      onClick={async () => { const next = a.next; setStatus(next); await lawyerApi.setAvailability(next).catch(() => {}); }}
      className="inline-flex items-center gap-2 rounded-full border border-navy-200 bg-white px-3 py-1.5 text-sm font-medium text-navy-700 hover:border-navy-400"
      title="Click to change availability"
    >
      <span className={clsx("h-2.5 w-2.5 rounded-full", a.dot)} />
      {a.label}
    </button>
  );
}

function NotificationsBell() {
  const [count, setCount] = useState(0);
  useEffect(() => { notificationsApi.list(1).then((r) => setCount(r.unreadCount)).catch(() => {}); }, []);
  return (
    <Link href="/lawyer/notifications" className="relative rounded-lg p-2 text-navy-600 hover:bg-navy-50" aria-label="Notifications">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" strokeLinecap="round" strokeLinejoin="round" /></svg>
      {count > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{count > 99 ? "99+" : count}</span>}
    </Link>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-1">
      {NAV.map((n) => {
        const active = pathname === n.href || pathname.startsWith(n.href.replace("/edit", "") + "/") || (n.href.includes("profile") && pathname.startsWith("/lawyer/profile"));
        return (
          <Link key={n.href} href={n.href} onClick={onNavigate}
            className={clsx("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition", active ? "bg-navy-900 text-white" : "text-navy-600 hover:bg-navy-50 hover:text-navy-900")}>
            <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={n.icon} /></svg>
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function LawyerShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) setAvatarOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="min-h-screen bg-navy-50">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-navy-100 bg-white px-4 py-5 lg:block">
        <Logo className="mb-8 px-2" />
        <NavLinks />
      </aside>

      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-navy-950/40" onClick={() => setMenuOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-white px-4 py-5">
            <Logo className="mb-8 px-2" />
            <NavLinks onNavigate={() => setMenuOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-navy-100 bg-white/90 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button className="rounded-lg p-2 text-navy-600 hover:bg-navy-50 lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Menu">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" /></svg>
            </button>
            <Logo className="lg:hidden" />
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <AvailabilityToggle />
            <NotificationsBell />
            <div className="relative" ref={avatarRef}>
              <button onClick={() => setAvatarOpen((o) => !o)} className="flex items-center gap-2 rounded-lg p-1 hover:bg-navy-50">
                <Avatar name={user?.fullName ?? "Lawyer"} size={34} />
                <span className="hidden text-sm font-medium text-navy-800 sm:block">{user?.fullName}</span>
              </button>
              {avatarOpen && (
                <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-xl border border-navy-100 bg-white py-1 shadow-card-lg">
                  <Link href="/lawyer/profile/edit" className="block px-4 py-2 text-sm text-navy-700 hover:bg-navy-50" onClick={() => setAvatarOpen(false)}>My Profile</Link>
                  <Link href="/lawyer/settings" className="block px-4 py-2 text-sm text-navy-700 hover:bg-navy-50" onClick={() => setAvatarOpen(false)}>Settings</Link>
                  <hr className="my-1 border-navy-100" />
                  <button onClick={() => logout()} className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50">Log Out</button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
