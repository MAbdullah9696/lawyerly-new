"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { lawyerApi } from "@/lib/api";
import { Spinner } from "@/components/ui/Feedback";
import { StarRating, timeAgo } from "@/components/user/widgets";
import type { LawyerCaseItem } from "@/lib/types";

const TABS = ["active", "closed"] as const;
type Tab = (typeof TABS)[number];

export default function LawyerCasesPage() {
  const [tab, setTab] = useState<Tab>("active");
  const [cases, setCases] = useState<LawyerCaseItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    lawyerApi.cases(tab).then((r) => setCases(r.cases)).finally(() => setLoading(false));
  }, [tab]);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold text-navy-900">Cases</h1>

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
      ) : cases.length === 0 ? (
        <p className="py-16 text-center text-sm text-navy-400">No {tab} cases.</p>
      ) : (
        <ul className="mt-5 space-y-3">
          {cases.map((c) => (
            <li key={c.id}>
              <Link href={`/lawyer/consultation/${c.id}`} className="flex items-center justify-between rounded-2xl border border-navy-100 bg-white p-5 shadow-card transition hover:shadow-card-lg">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-navy-900">{c.clientFirstName}</span>
                    <span className="rounded-full bg-navy-50 px-2 py-0.5 text-xs font-medium text-navy-500">{c.caseType}</span>
                  </div>
                  <p className="mt-1 text-xs text-navy-400">
                    {tab === "active" ? `Started ${timeAgo(c.startedAt)}` : `Closed ${c.closedAt ? timeAgo(c.closedAt) : ""}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {tab === "closed" && (c.review ? <StarRating value={c.review.rating} /> : <span className="text-xs text-navy-400">No review</span>)}
                  <span className="text-xs font-semibold text-navy-600">Open →</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
