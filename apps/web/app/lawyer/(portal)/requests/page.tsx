"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { lawyerApi } from "@/lib/api";
import { Spinner, Alert } from "@/components/ui/Feedback";
import { Button } from "@/components/ui/Button";
import { timeAgo } from "@/components/user/widgets";
import { DeclineModal } from "@/components/lawyer/DeclineModal";
import type { LawyerRequest } from "@/lib/types";

const TABS = ["pending", "declined", "expired"] as const;
type Tab = (typeof TABS)[number];

function countdown(expiresAt: string): string | null {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const hours = ms / 3600000;
  if (hours > 6) return null; // only show when < 6h remain
  const h = Math.floor(hours);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m left`;
}

export default function LawyerRequestsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("pending");
  const [requests, setRequests] = useState<LawyerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [fee, setFee] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [acceptFor, setAcceptFor] = useState<LawyerRequest | null>(null);
  const [declineFor, setDeclineFor] = useState<LawyerRequest | null>(null);
  const [error, setError] = useState("");

  function load(t: Tab) {
    setLoading(true);
    lawyerApi.requests(t).then((r) => setRequests(r.requests)).finally(() => setLoading(false));
  }
  useEffect(() => load(tab), [tab]);
  useEffect(() => { lawyerApi.profile().then((r) => setFee(r.profile.consultationFeePkr)).catch(() => {}); }, []);

  async function confirmAccept() {
    if (!acceptFor) return;
    setError("");
    try {
      const { consultationId } = await lawyerApi.accept(acceptFor.id);
      router.push(`/lawyer/consultation/${consultationId}`);
    } catch (e) {
      setError("Could not accept (you may be at capacity). Please try again.");
      setAcceptFor(null);
      load(tab);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold text-navy-900">Consultation Requests</h1>

      <div className="mt-5 flex gap-1 border-b border-navy-100">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={clsx("px-4 py-2.5 text-sm font-semibold capitalize transition", tab === t ? "border-b-2 border-navy-900 text-navy-900" : "text-navy-400 hover:text-navy-700")}>
            {t}
          </button>
        ))}
      </div>

      {error && <div className="mt-4"><Alert variant="error">{error}</Alert></div>}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : requests.length === 0 ? (
        <p className="py-16 text-center text-sm text-navy-400">No {tab} requests.</p>
      ) : (
        <ul className="mt-5 space-y-3">
          {requests.map((r) => {
            const cd = tab === "pending" ? countdown(r.expiresAt) : null;
            const long = r.description.length > 200;
            const shown = expanded === r.id || !long ? r.description : r.description.slice(0, 200) + "…";
            return (
              <li key={r.id} className="rounded-2xl border border-navy-100 bg-white p-5 shadow-card">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-navy-900">{r.clientFirstName}</span>
                    <span className="rounded-full bg-navy-50 px-2 py-0.5 text-xs font-medium text-navy-500">{r.caseType}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-navy-400">
                    {cd && <span className={clsx("font-semibold", cd === "Expired" ? "text-red-600" : "text-gold-700")}>{cd}</span>}
                    <span>sent {timeAgo(r.createdAt)}</span>
                  </div>
                </div>
                <p className="mt-2 text-sm text-navy-600">
                  {shown}{" "}
                  {long && <button onClick={() => setExpanded(expanded === r.id ? null : r.id)} className="font-semibold text-navy-700 hover:underline">{expanded === r.id ? "Read less" : "Read more"}</button>}
                </p>
                {r.status === "declined" && r.declineReason && (
                  <p className="mt-2 text-xs text-navy-400">Declined: {r.declineReason}</p>
                )}
                {tab === "pending" && (
                  <div className="mt-3 flex gap-2">
                    <Button className="!py-1.5 !text-sm" onClick={() => setAcceptFor(r)}>Accept</Button>
                    <Button variant="outline" className="!py-1.5 !text-sm" onClick={() => setDeclineFor(r)}>Decline</Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Accept confirm */}
      {acceptFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-navy-950/50" onClick={() => setAcceptFor(null)} />
          <div className="relative w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-card-lg">
            <h3 className="text-lg font-bold text-navy-900">Accept request</h3>
            <p className="text-sm text-navy-600">
              Your consultation fee is <b>PKR {(fee ?? 0).toLocaleString()}</b>. {acceptFor.clientFirstName} will be notified immediately and a chat thread will open.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAcceptFor(null)}>Cancel</Button>
              <Button onClick={confirmAccept}>Confirm Accept</Button>
            </div>
          </div>
        </div>
      )}

      {declineFor && (
        <DeclineModal
          clientName={declineFor.clientFirstName}
          onClose={() => setDeclineFor(null)}
          onConfirm={async (reason, message) => { await lawyerApi.decline(declineFor.id, reason, message); setDeclineFor(null); load(tab); }}
        />
      )}
    </div>
  );
}
