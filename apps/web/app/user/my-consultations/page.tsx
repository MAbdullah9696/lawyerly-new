"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { consultationsApi } from "@/lib/api";
import { Spinner } from "@/components/ui/Feedback";
import { Button } from "@/components/ui/Button";
import { Avatar, StarRating, timeAgo } from "@/components/user/widgets";
import type { MyConsultationItem, MyRequestItem } from "@/lib/types";

const TABS = ["active", "pending", "closed"] as const;
type Tab = (typeof TABS)[number];

function countdown(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "Expiring…";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h >= 1 ? `${h}h ${m}m left` : `${m}m left`;
}

export default function MyConsultationsPage() {
  const [tab, setTab] = useState<Tab>("active");
  const [items, setItems] = useState<(MyConsultationItem | MyRequestItem)[]>([]);
  const [loading, setLoading] = useState(true);

  function load(t: Tab) {
    setLoading(true);
    consultationsApi.list(t).then((r) => setItems(r.items)).finally(() => setLoading(false));
  }
  useEffect(() => load(tab), [tab]);

  async function cancel(id: string) { await consultationsApi.cancelRequest(id); load("pending"); }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-navy-900">My Consultations</h1>

      <div className="mt-5 flex gap-1 border-b border-navy-100">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={clsx("px-4 py-2.5 text-sm font-semibold capitalize transition", tab === t ? "border-b-2 border-navy-900 text-navy-900" : "text-navy-400 hover:text-navy-700")}>
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : items.length === 0 ? (
        <p className="py-16 text-center text-sm text-navy-400">No {tab} consultations.</p>
      ) : (
        <ul className="mt-5 space-y-3">
          {tab === "pending"
            ? (items as MyRequestItem[]).map((r) => (
                <li key={r.id} className="rounded-2xl border border-navy-100 bg-white p-5 shadow-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={r.lawyerName} url={r.lawyerPhotoUrl} size={44} />
                      <div>
                        <p className="font-semibold text-navy-900">{r.lawyerName}</p>
                        <p className="text-xs text-navy-400">{r.caseType} · sent {timeAgo(r.createdAt)}</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-gold-50 px-2.5 py-1 text-xs font-semibold text-gold-800">{countdown(r.expiresAt)}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-navy-500">{r.description}</p>
                  <div className="mt-3 flex justify-end">
                    <Button variant="outline" className="!py-1.5 !text-sm" onClick={() => cancel(r.id)}>Cancel request</Button>
                  </div>
                </li>
              ))
            : (items as MyConsultationItem[]).map((c) => (
                <li key={c.id}>
                  <Link href={`/user/consultation/${c.id}`} className="flex items-center gap-3 rounded-2xl border border-navy-100 bg-white p-5 shadow-card transition hover:shadow-card-lg">
                    <Avatar name={c.lawyerName} url={c.lawyerPhotoUrl} size={44} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-semibold text-navy-900">{c.lawyerName}</p>
                        {tab === "active" && c.unread > 0 && <span className="rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">{c.unread}</span>}
                      </div>
                      {tab === "active" ? (
                        <p className="truncate text-xs text-navy-400">{c.lastMessage ?? "No messages yet"} {c.lastMessageAt && `· ${timeAgo(c.lastMessageAt)}`}</p>
                      ) : (
                        <p className="text-xs text-navy-400">{c.caseType} · closed {c.closedAt ? timeAgo(c.closedAt) : ""}</p>
                      )}
                    </div>
                    {tab === "closed" && (c.reviewSubmitted ? <span className="text-xs font-medium text-green-600">Reviewed</span> : <span className="text-xs font-semibold text-navy-600">Leave review →</span>)}
                  </Link>
                </li>
              ))}
        </ul>
      )}
    </div>
  );
}
