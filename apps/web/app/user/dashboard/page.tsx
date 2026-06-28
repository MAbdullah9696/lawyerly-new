"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { chatApi, notificationsApi } from "@/lib/api";
import { Spinner } from "@/components/ui/Feedback";
import { timeAgo } from "@/components/user/widgets";
import type { ChatSessionSummary, NotificationItem } from "@/lib/types";

const QUICK_ACTIONS = [
  { href: "/user/chatbot", title: "Ask AI Chatbot", desc: "Get instant preliminary guidance", icon: "M8 10h8M8 14h5M21 12a9 9 0 0 1-13 8l-4 1 1-4a9 9 0 1 1 16-5Z" },
  { href: "/user/find-lawyer", title: "Find a Lawyer", desc: "Search verified lawyers", icon: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.3-4.3" },
  { href: "/user/my-documents", title: "Upload Document", desc: "Analyse a legal document", icon: "M12 16V4m0 0 4 4m-4-4-4 4M4 20h16" },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [notifs, setNotifs] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([chatApi.sessions(), notificationsApi.list(1)])
      .then(([s, n]) => {
        setSessions(s.sessions.slice(0, 3));
        setNotifs(n.items.slice(0, 3));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Greeting */}
      <div className="rounded-2xl bg-navy-900 p-7 text-white">
        <h1 className="text-2xl font-bold sm:text-3xl">
          {greeting()}, {user?.fullName?.split(" ")[0]} 👋
        </h1>
        <p className="mt-1 text-navy-200">
          {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy-400">Quick actions</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {QUICK_ACTIONS.map((a) => (
            <Link key={a.href} href={a.href} className="group rounded-2xl border border-navy-100 bg-white p-5 shadow-card transition hover:-translate-y-1 hover:shadow-card-lg">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-900 text-gold-400 group-hover:bg-navy-800">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={a.icon} /></svg>
              </span>
              <h3 className="mt-4 font-semibold text-navy-900">{a.title}</h3>
              <p className="text-sm text-navy-500">{a.desc}</p>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Active consultations (Milestone 6) */}
        <section className="rounded-2xl border border-navy-100 bg-white p-5 shadow-card lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-navy-900">Active Consultations</h2>
            <Link href="/user/my-consultations" className="text-sm font-semibold text-navy-600 hover:text-navy-900">View all</Link>
          </div>
          <div className="rounded-xl border border-dashed border-navy-200 py-10 text-center text-sm text-navy-400">
            No active consultations yet.{" "}
            <Link href="/user/find-lawyer" className="font-semibold text-navy-700 hover:underline">Find a lawyer</Link> to get started.
          </div>
        </section>

        {/* Notifications */}
        <section className="rounded-2xl border border-navy-100 bg-white p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-navy-900">Notifications</h2>
            <Link href="/user/notifications" className="text-sm font-semibold text-navy-600 hover:text-navy-900">View all</Link>
          </div>
          {loading ? (
            <div className="flex justify-center py-6"><Spinner /></div>
          ) : notifs.length === 0 ? (
            <p className="py-6 text-center text-sm text-navy-400">You're all caught up.</p>
          ) : (
            <ul className="space-y-3">
              {notifs.map((n) => (
                <li key={n.id} className={`rounded-lg border-l-2 p-2.5 text-sm ${n.read ? "border-navy-100 text-navy-500" : "border-gold-400 bg-navy-50 text-navy-800"}`}>
                  <p>{n.text}</p>
                  <p className="mt-1 text-xs text-navy-400">{timeAgo(n.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Recent AI chats */}
      <section className="rounded-2xl border border-navy-100 bg-white p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-navy-900">Recent AI Chats</h2>
          <Link href="/user/chatbot" className="text-sm font-semibold text-navy-600 hover:text-navy-900">Open chatbot</Link>
        </div>
        {loading ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : sessions.length === 0 ? (
          <p className="py-6 text-center text-sm text-navy-400">No chats yet. Ask the AI your first legal question.</p>
        ) : (
          <ul className="divide-y divide-navy-100">
            {sessions.map((s) => (
              <li key={s.id}>
                <Link href={`/user/chatbot?session=${s.id}`} className="flex items-center justify-between py-3 hover:bg-navy-50">
                  <span className="truncate pr-4 text-sm font-medium text-navy-800">{s.title}</span>
                  <span className="shrink-0 text-xs text-navy-400">{timeAgo(s.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
