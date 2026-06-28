"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { notificationsApi } from "@/lib/api";
import { Spinner } from "@/components/ui/Feedback";
import { timeAgo } from "@/components/user/widgets";
import type { NotificationListResult } from "@/lib/types";

export default function LawyerNotificationsPage() {
  const [data, setData] = useState<NotificationListResult | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    notificationsApi.list(page).then(setData).finally(() => setLoading(false));
  }
  useEffect(load, [page]);

  async function markRead(id: string) {
    await notificationsApi.markRead(id);
    load();
  }
  async function markAll() {
    await notificationsApi.markAllRead();
    load();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Notifications</h1>
          {data && <p className="mt-1 text-sm text-navy-500">{data.unreadCount} unread</p>}
        </div>
        {data && data.unreadCount > 0 && (
          <button onClick={markAll} className="text-sm font-semibold text-navy-600 hover:text-navy-900">Mark all as read</button>
        )}
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-card">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : !data || data.items.length === 0 ? (
          <p className="py-16 text-center text-sm text-navy-400">You have no notifications.</p>
        ) : (
          <ul className="divide-y divide-navy-100">
            {data.items.map((n) => (
              <li key={n.id} className={`flex items-start gap-3 px-5 py-4 ${n.read ? "" : "bg-navy-50/60"}`}>
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-gold-400"}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-navy-800">{n.text}</p>
                  <p className="mt-1 text-xs text-navy-400">{timeAgo(n.createdAt)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {n.link && <Link href={n.link} className="text-xs font-semibold text-navy-600 hover:underline">View</Link>}
                  {!n.read && <button onClick={() => markRead(n.id)} className="text-xs font-semibold text-navy-500 hover:text-navy-900">Mark read</button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {data && data.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn-outline disabled:opacity-40">Previous</button>
          <span className="px-3 text-sm text-navy-500">Page {data.page} of {data.totalPages}</span>
          <button disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)} className="btn-outline disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
}
