"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { lawyersApi, consultationsApi, ApiRequestError } from "@/lib/api";
import { Spinner, Alert } from "@/components/ui/Feedback";
import { Button } from "@/components/ui/Button";
import { Select, Textarea } from "@/components/ui/Field";
import { StarRating, AvailabilityDot, Avatar } from "@/components/user/widgets";
import type { LawyerDetailResult } from "@/lib/types";

const REPORT_REASONS = ["Fake or misleading profile", "Inappropriate content", "Impersonation", "Other"];
const CASE_TYPES = ["Civil", "Criminal", "Family", "Property", "Corporate", "Constitutional", "Other"];

export default function LawyerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<LawyerDetailResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewSort, setReviewSort] = useState("recent");

  const router = useRouter();
  const [startOpen, setStartOpen] = useState(false);
  const [caseType, setCaseType] = useState("");
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [startError, setStartError] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportDone, setReportDone] = useState(false);

  async function sendRequest() {
    if (!caseType || !description.trim()) return;
    setSending(true); setStartError("");
    try {
      await consultationsApi.request({ lawyerId: id, caseType, description: description.trim() });
      setSent(true);
    } catch (e) {
      setStartError(e instanceof ApiRequestError ? e.message : "Could not send request.");
    } finally { setSending(false); }
  }

  useEffect(() => {
    setLoading(true);
    lawyersApi
      .get(id, { page: reviewPage, sort: reviewSort })
      .then(setData)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id, reviewPage, reviewSort]);

  if (loading && !data) return <div className="flex justify-center py-20"><Spinner className="h-7 w-7" /></div>;
  if (notFound || !data) return <div className="mx-auto max-w-2xl py-20 text-center text-navy-500">This lawyer profile could not be found.</div>;

  const l = data.lawyer;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Left summary */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-2xl border border-navy-100 bg-white p-6 text-center shadow-card">
            <div className="flex justify-center"><Avatar name={l.fullName} url={l.photoUrl} size={96} /></div>
            <h1 className="mt-3 text-xl font-bold text-navy-900">{l.fullName}</h1>
            <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-green-700">
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor"><path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 10a1 1 0 1 1 1.4-1.4l3.1 3.1 6.8-6.8a1 1 0 0 1 1.4 0Z" clipRule="evenodd" /></svg>
              Verified by Lawyerly
            </p>
            <div className="mt-3 flex justify-center"><StarRating value={l.ratingAvg} size="lg" /></div>
            <p className="text-xs text-navy-400">{l.reviewCount} reviews</p>
            <div className="mt-2 flex justify-center"><AvailabilityDot status={l.availability} /></div>
            <div className="my-4 rounded-xl bg-navy-50 py-3">
              <p className="text-xs text-navy-400">Consultation fee</p>
              <p className="text-2xl font-bold text-navy-900">PKR {l.consultationFeePkr.toLocaleString()}</p>
            </div>
            <Button fullWidth onClick={() => setStartOpen(true)}>
              {l.availability === "offline" ? "Request Consultation" : "Start Consultation"}
            </Button>
            <p className="mt-3 flex items-center justify-center gap-1 text-xs text-navy-400">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 10V8a6 6 0 0 1 12 0v2M5 10h14v10H5V10Z" strokeLinecap="round" strokeLinejoin="round" /></svg>
              End-to-end encrypted chat
            </p>
          </div>
        </aside>

        {/* Right details */}
        <div className="space-y-6">
          <section className="rounded-2xl border border-navy-100 bg-white p-6 shadow-card">
            <h2 className="font-semibold text-navy-900">About</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-navy-700">{l.bio}</p>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-navy-400">Practice Areas</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {l.practiceAreas.map((p) => <span key={p} className="rounded-full bg-gold-50 px-2.5 py-0.5 text-xs font-medium text-gold-800">{p}</span>)}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-navy-400">Languages</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {l.languages.map((p) => <span key={p} className="rounded-full bg-navy-50 px-2.5 py-0.5 text-xs font-medium text-navy-600">{p}</span>)}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-navy-400">Experience</p>
                <p className="mt-1 text-sm text-navy-700">{l.experienceLabel}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-navy-400">Bar Council #</p>
                <p className="mt-1 text-sm text-navy-700">{l.barCouncilNumberMasked}</p>
              </div>
            </div>
          </section>

          {l.showWinLossStats && l.winLoss && (
            <section className="rounded-2xl border border-navy-100 bg-white p-6 shadow-card">
              <h2 className="font-semibold text-navy-900">Case Statistics</h2>
              <div className="mt-3 grid grid-cols-4 gap-3 text-center">
                {[
                  { l: "Total", v: l.winLoss.total, c: "text-navy-900" },
                  { l: "Won", v: l.winLoss.won, c: "text-green-600" },
                  { l: "Lost", v: l.winLoss.lost, c: "text-red-600" },
                  { l: "Ongoing", v: l.winLoss.ongoing, c: "text-gold-700" },
                ].map((s) => (
                  <div key={s.l} className="rounded-xl bg-navy-50 py-3">
                    <p className={`text-2xl font-bold ${s.c}`}>{s.v}</p>
                    <p className="text-xs text-navy-400">{s.l}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-navy-100 bg-white p-6 shadow-card">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-navy-900">Client Reviews</h2>
              <select value={reviewSort} onChange={(e) => { setReviewSort(e.target.value); setReviewPage(1); }} className="field-input w-40 py-1.5 text-sm">
                <option value="recent">Most Recent</option>
                <option value="highest">Highest Rated</option>
                <option value="lowest">Lowest Rated</option>
              </select>
            </div>
            {l.reviewsRemoved > 0 && (
              <p className="mt-2 text-xs text-navy-400">{l.reviewsRemoved} review{l.reviewsRemoved !== 1 ? "s" : ""} removed by moderators</p>
            )}
            <div className="mt-4 space-y-4">
              {data.reviews.items.length === 0 ? (
                <p className="py-6 text-center text-sm text-navy-400">No reviews yet.</p>
              ) : (
                data.reviews.items.map((r) => (
                  <div key={r.id} className="border-b border-navy-100 pb-4 last:border-0">
                    <div className="flex items-center justify-between">
                      <StarRating value={r.rating} />
                      <span className="rounded-full bg-navy-50 px-2 py-0.5 text-xs font-medium text-navy-500">{r.caseType}</span>
                    </div>
                    {r.text && <p className="mt-2 text-sm text-navy-700">{r.text}</p>}
                    <p className="mt-1 text-xs text-navy-400">{new Date(r.date).toLocaleDateString()}</p>
                  </div>
                ))
              )}
            </div>
            {data.reviews.totalPages > 1 && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <button disabled={reviewPage <= 1} onClick={() => setReviewPage((p) => p - 1)} className="btn-outline py-1.5 text-sm disabled:opacity-40">Previous</button>
                <span className="px-2 text-sm text-navy-500">{data.reviews.page}/{data.reviews.totalPages}</span>
                <button disabled={reviewPage >= data.reviews.totalPages} onClick={() => setReviewPage((p) => p + 1)} className="btn-outline py-1.5 text-sm disabled:opacity-40">Next</button>
              </div>
            )}
          </section>

          <button onClick={() => { setReportOpen(true); setReportDone(false); }} className="text-xs text-navy-400 hover:text-navy-600 hover:underline">Report this profile</button>
        </div>
      </div>

      {/* Start consultation modal (§8.5) */}
      {startOpen && (
        <Modal onClose={() => { setStartOpen(false); setSent(false); }} title="Start a consultation">
          {sent ? (
            <>
              <Alert variant="success">Your request has been sent to {l.fullName}. You'll be notified when they accept.</Alert>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setStartOpen(false); setSent(false); }}>Close</Button>
                <Button onClick={() => router.push("/user/my-consultations")}>View my requests</Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-navy-600">
                Consultation fee: <b>PKR {l.consultationFeePkr.toLocaleString()}</b>.
                {l.availability === "offline" && " This lawyer is offline — your request will be waiting when they return."}
              </p>
              {startError && <Alert variant="error">{startError}</Alert>}
              <Select label="Case type" options={CASE_TYPES} value={caseType} onChange={(e) => setCaseType(e.target.value)} placeholder="Select case type" />
              <div>
                <Textarea label="Describe your case briefly" value={description} onChange={(e) => setDescription(e.target.value.slice(0, 500))} maxLength={500} placeholder="What do you need help with?" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setStartOpen(false)}>Cancel</Button>
                <Button onClick={sendRequest} loading={sending} disabled={!caseType || description.trim().length === 0}>Send Request</Button>
              </div>
            </>
          )}
        </Modal>
      )}

      {/* Report modal */}
      {reportOpen && (
        <Modal onClose={() => setReportOpen(false)} title="Report this profile">
          {reportDone ? (
            <>
              <Alert variant="success">Thank you. Our moderation team will review this profile.</Alert>
              <div className="flex justify-end"><Button variant="outline" onClick={() => setReportOpen(false)}>Close</Button></div>
            </>
          ) : (
            <>
              <p className="text-sm text-navy-600">Why are you reporting this profile?</p>
              <div className="space-y-2">
                {REPORT_REASONS.map((r) => (
                  <button key={r} onClick={() => setReportDone(true)} className="block w-full rounded-lg border border-navy-200 px-3 py-2 text-left text-sm text-navy-700 hover:border-navy-400 hover:bg-navy-50">{r}</button>
                ))}
              </div>
              <p className="text-xs text-navy-400">Report handling is finalised in the moderation milestone.</p>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-navy-950/50" onClick={onClose} />
      <div className="relative w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-card-lg">
        <h3 className="text-lg font-bold text-navy-900">{title}</h3>
        {children}
      </div>
    </div>
  );
}
