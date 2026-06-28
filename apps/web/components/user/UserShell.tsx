"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Logo } from "@/components/Logo";
import { Avatar } from "./widgets";
import { useAuth } from "@/lib/auth-context";
import { notificationsApi } from "@/lib/api";

const NAV = [
  { href: "/user/dashboard", label: "Dashboard", icon: "M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6V11h-6v9Zm0-16v5h6V4h-6Z" },
  { href: "/user/chatbot", label: "AI Chatbot", icon: "M8 10h8M8 14h5M21 12a9 9 0 0 1-13 8l-4 1 1-4a9 9 0 1 1 16-5Z" },
  { href: "/user/find-lawyer", label: "Find a Lawyer", icon: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.3-4.3" },
  { href: "/user/my-documents", label: "My Documents", icon: "M7 3h7l5 5v13H7V3Zm7 0v5h5" },
  { href: "/user/my-consultations", label: "My Consultations", icon: "M3 12a9 9 0 1 1 4.5 7.8L3 21l1.2-4.5A9 9 0 0 1 3 12Z" },
  { href: "/user/settings", label: "Settings", icon: "M10.3 3.3 9.9 5a7 7 0 0 0-1.7 1l-1.7-.6-1.7 3 1.3 1.2a7 7 0 0 0 0 2L4.8 13l1.7 3 1.7-.6a7 7 0 0 0 1.7 1l.4 1.7h3.4l.4-1.7a7 7 0 0 0 1.7-1l1.7.6 1.7-3-1.3-1.2a7 7 0 0 0 0-2l1.3-1.2-1.7-3-1.7.6a7 7 0 0 0-1.7-1l-.4-1.7h-3.4ZM12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z" },
];

function NotificationsBell() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    notificationsApi.list(1).then((r) => setCount(r.unreadCount)).catch(() => {});
  }, []);
  return (
    <Link href="/user/notifications" className="relative rounded-lg p-2 text-navy-600 hover:bg-navy-50" aria-label="Notifications">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-1">
      {NAV.map((n) => {
        const active = pathname === n.href || pathname.startsWith(n.href + "/");
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={onNavigate}
            className={clsx(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
              active ? "bg-navy-900 text-white" : "text-navy-600 hover:bg-navy-50 hover:text-navy-900",
            )}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d={n.icon} />
            </svg>
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function UserShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) setAvatarOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="min-h-screen bg-navy-50">
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-navy-100 bg-white px-4 py-5 lg:block">
        <Logo className="mb-8 px-2" />
        <NavLinks />
      </aside>

      {/* Mobile drawer */}
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
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-navy-100 bg-white/90 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button className="rounded-lg p-2 text-navy-600 hover:bg-navy-50 lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Menu">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" /></svg>
            </button>
            <Logo className="lg:hidden" />
          </div>

          <div className="flex items-center gap-2">
            <NotificationsBell />
            <div className="relative" ref={avatarRef}>
              <button onClick={() => setAvatarOpen((o) => !o)} className="flex items-center gap-2 rounded-lg p-1 hover:bg-navy-50">
                <Avatar name={user?.fullName ?? "User"} size={34} />
                <span className="hidden text-sm font-medium text-navy-800 sm:block">{user?.fullName}</span>
              </button>
              {avatarOpen && (
                <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-xl border border-navy-100 bg-white py-1 shadow-card-lg">
                  <Link href="/user/profile" className="block px-4 py-2 text-sm text-navy-700 hover:bg-navy-50" onClick={() => setAvatarOpen(false)}>My Profile</Link>
                  <Link href="/user/settings" className="block px-4 py-2 text-sm text-navy-700 hover:bg-navy-50" onClick={() => setAvatarOpen(false)}>Settings</Link>
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
