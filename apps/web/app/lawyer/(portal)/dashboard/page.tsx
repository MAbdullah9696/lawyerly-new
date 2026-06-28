"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { lawyerApi } from "@/lib/api";
import { Spinner } from "@/components/ui/Feedback";
import { Button } from "@/components/ui/Button";
import { StarRating, timeAgo } from "@/components/user/widgets";
import { DeclineModal } from "@/components/lawyer/DeclineModal";
import type { LawyerDashboard } from "@/lib/types";

const METRIC_ICONS = {
  week: "M8 7V3m8 4V3M4 11h16M5 5h14v16H5z",
  earnings: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  views: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  rating: "M12 2l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 15l-5.2 2.6 1-5.8L3.5 8.2l5.9-.9L12 2z",
};

export default function LawyerDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<LawyerDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [declineFor, setDeclineFor] = useState<{ id: string; name: string } | null>(null);

  function load() {
    setLoading(true);
    lawyerApi.dashboard().then(setData).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function accept(id: string) {
    await lawyerApi.accept(id);
    load();
  }

  if (loading || !data) return <div className="flex justify-center py-20"><Spinner className="h-7 w-7" /></div>;

  const m = data.metrics;
  const cards = [
    { label: "Consultations This Week", value: m.consultationsThisWeek, icon: METRIC_ICONS.week },
    { label: "Total Earnings", value: `PKR ${m.totalEarningsPkr.toLocaleString()}`, icon: METRIC_ICONS.earnings },
    { label: "Profile Views (30d)", value: m.profileViews30, icon: METRIC_ICONS.views },
    { label: "Average Rating", value: m.avgRating.toFixed(1), icon: METRIC_ICONS.rating },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Welcome back, {user?.fullName?.split(" ")[0]}</h1>
        <p className="mt-1 text-navy-500">Here's your practice at a glance.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-navy-100 bg-white p-5 shadow-card">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy-900 text-gold-400">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={c.icon} /></svg>
            </span>
            <p className="mt-3 text-2xl font-bold text-navy-900">{c.value}</p>
            <p className="text-sm text-navy-500">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pending requests */}
        <section className="rounded-2xl border border-navy-100 bg-white p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-navy-900">Pending Requests {data.pendingCount > 0 && <span className="ml-1 rounded-full bg-gold-100 px-2 py-0.5 text-xs font-bold text-gold-800">{data.pendingCount}</span>}</h2>
            <Link href="/lawyer/requests" className="text-sm font-semibold text-navy-600 hover:text-navy-900">View all</Link>
          </div>
          {data.pendingRequests.length === 0 ? (
            <p className="py-6 text-center text-sm text-navy-400">No pending requests.</p>
          ) : (
            <ul className="space-y-3">
              {data.pendingRequests.map((r) => (
                <li key={r.id} className="rounded-xl border border-navy-100 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-navy-800">{r.clientFirstName}</span>
                    <span className="rounded-full bg-navy-50 px-2 py-0.5 text-xs font-medium text-navy-500">{r.caseType}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-navy-500">{r.description}</p>
                  <div className="mt-2 flex gap-2">
                    <Button className="!py-1.5 !text-xs" onClick={() => accept(r.id)}>Accept</Button>
                    <Button variant="outline" className="!py-1.5 !text-xs" onClick={() => setDeclineFor({ id: r.id, name: r.clientFirstName })}>Decline</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Active cases */}
        <section className="rounded-2xl border border-navy-100 bg-white p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-navy-900">Active Cases {data.activeCount > 0 && <span className="ml-1 rounded-full bg-navy-100 px-2 py-0.5 text-xs font-bold text-navy-700">{data.activeCount}</span>}</h2>
            <Link href="/lawyer/cases" className="text-sm font-semibold text-navy-600 hover:text-navy-900">View all</Link>
          </div>
          {data.activeCases.length === 0 ? (
            <p className="py-6 text-center text-sm text-navy-400">No active cases.</p>
          ) : (
            <ul className="divide-y divide-navy-100">
              {data.activeCases.map((c) => (
                <li key={c.id}>
                  <Link href={`/lawyer/consultation/${c.id}`} className="flex items-center justify-between py-3 hover:bg-navy-50">
                    <div>
                      <p className="text-sm font-medium text-navy-800">{c.clientFirstName}</p>
                      <p className="text-xs text-navy-400">{c.caseType} · started {timeAgo(c.startedAt)}</p>
                    </div>
                    <span className="text-xs font-semibold text-navy-600">Open →</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Recent reviews */}
      <section className="rounded-2xl border border-navy-100 bg-white p-5 shadow-card">
        <h2 className="mb-4 font-semibold text-navy-900">Recent Reviews</h2>
        {data.recentReviews.length === 0 ? (
          <p className="py-6 text-center text-sm text-navy-400">No reviews yet.</p>
        ) : (
          <ul className="space-y-3">
            {data.recentReviews.map((r) => (
              <li key={r.id} className="rounded-xl bg-navy-50 p-3">
                <div className="flex items-center justify-between">
                  <StarRating value={r.rating} />
                  <span className="text-xs text-navy-400">{timeAgo(r.date)}</span>
                </div>
                {r.text && <p className="mt-1.5 text-sm text-navy-700">{r.text}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {declineFor && (
        <DeclineModal
          clientName={declineFor.name}
          onClose={() => setDeclineFor(null)}
          onConfirm={async (reason, message) => { await lawyerApi.decline(declineFor.id, reason, message); setDeclineFor(null); load(); }}
        />
      )}
    </div>
  );
}
