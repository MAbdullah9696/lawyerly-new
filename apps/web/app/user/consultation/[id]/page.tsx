"use client";

import { use, useEffect, useRef, useState } from "react";
import { consultationsApi, documentsApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Spinner, Alert } from "@/components/ui/Feedback";
import { Button } from "@/components/ui/Button";
import { Avatar, AvailabilityDot } from "@/components/user/widgets";
import { ChatPanel } from "@/components/consultation/ChatPanel";
import type { ConsultationHeader, DocumentDTO } from "@/lib/types";

const REPORT_REASONS = ["Inappropriate behaviour", "Spam or solicitation", "Off-platform payment request", "Other"];

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

export default function UserConsultationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const [header, setHeader] = useState<ConsultationHeader | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportDone, setReportDone] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [attachDocs, setAttachDocs] = useState<DocumentDTO[]>([]);
  const [attachLoading, setAttachLoading] = useState(false);
  const [attaching, setAttaching] = useState<string | null>(null);
  const [attachToast, setAttachToast] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  // review form
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewDone, setReviewDone] = useState(false);

  function load() { consultationsApi.header(id).then(setHeader).finally(() => setLoading(false)); }
  useEffect(load, [id]);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  async function closeConsultation() {
    await consultationsApi.close(id);
    setConfirmClose(false);
    await new Promise((r) => setTimeout(r, 100));
    load();
    if (!header?.reviewSubmitted) setReviewOpen(true);
  }

  async function submitReview(skip = false) {
    if (skip) { setReviewOpen(false); load(); return; }
    if (rating === 0) return;
    setReviewSaving(true);
    try {
      await consultationsApi.review(id, { rating, text: reviewText || undefined });
      setReviewDone(true);
      load();
    } finally { setReviewSaving(false); }
  }

  async function openAttach() {
    setAttachOpen(true);
    setAttachLoading(true);
    try {
      const { documents } = await documentsApi.list();
      setAttachDocs(documents.filter((d) => d.status === "analysis_complete" || d.status === "low_confidence"));
    } finally {
      setAttachLoading(false);
    }
  }

  async function attach(docId: string) {
    setAttaching(docId);
    try {
      await consultationsApi.attach(id, docId);
      setAttachToast("Document shared in chat.");
      setAttachOpen(false);
      setTimeout(() => setAttachToast(""), 4000);
    } catch {
      setAttachToast("Failed to attach document.");
      setTimeout(() => setAttachToast(""), 4000);
    } finally {
      setAttaching(null);
    }
  }

  if (loading || !header || !user) return <div className="flex justify-center py-20"><Spinner className="h-7 w-7" /></div>;

  const closed = header.status === "closed";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex h-[calc(100vh-7.5rem)] flex-col rounded-2xl border border-navy-100 bg-navy-50/40 shadow-card">
        {/* header */}
        <div className="flex items-center justify-between border-b border-navy-100 bg-white px-4 py-3">
          <div className="flex items-center gap-3">
            <Avatar name={header.otherParty.name} url={header.otherParty.photoUrl} size={40} />
            <div>
              <p className="font-semibold text-navy-900">{header.otherParty.name}</p>
              <div className="flex items-center gap-2">
                {header.otherParty.availability && <AvailabilityDot status={header.otherParty.availability} />}
                <span className="inline-flex items-center gap-1 text-[11px] text-navy-400">
                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 10V8a6 6 0 0 1 12 0v2M5 10h14v10H5V10Z" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  End-to-end encrypted
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {!closed && <Button variant="outline" className="!py-1.5 !text-sm" onClick={() => setConfirmClose(true)}>End Consultation</Button>}
            <div className="relative" ref={menuRef}>
              <button onClick={() => setMenuOpen((o) => !o)} className="rounded-lg p-2 text-navy-500 hover:bg-navy-50" aria-label="More">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" /></svg>
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-44 overflow-hidden rounded-xl border border-navy-100 bg-white py-1 shadow-card-lg">
                  <button onClick={() => { setMenuOpen(false); setReportOpen(true); setReportDone(false); }} className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50">Report</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {closed && (
          <div className="border-b border-navy-100 bg-gold-50 px-4 py-2 text-center text-xs text-gold-800">
            This consultation has ended.{" "}
            {!header.reviewSubmitted && <button onClick={() => setReviewOpen(true)} className="font-semibold underline">Leave a review</button>}
          </div>
        )}

        <ChatPanel
          consultationId={id}
          currentUserId={user.id}
          status={header.status}
          otherPartyName={header.otherParty.name}
          onAttach={openAttach}
          onClosedRemotely={load}
        />
      </div>

      {/* confirm close */}
      {confirmClose && (
        <Modal title="End consultation?" onClose={() => setConfirmClose(false)}>
          <p className="text-sm text-navy-600">After ending, the chat becomes read-only and you'll be asked to leave a review.</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmClose(false)}>Cancel</Button>
            <Button onClick={closeConsultation}>End Consultation</Button>
          </div>
        </Modal>
      )}

      {/* review */}
      {reviewOpen && (
        <Modal title="Rate your consultation" onClose={() => submitReview(true)}>
          {reviewDone ? (
            <>
              <Alert variant="success">Thank you for your feedback!</Alert>
              <div className="flex justify-end"><Button variant="outline" onClick={() => setReviewOpen(false)}>Close</Button></div>
            </>
          ) : (
            <>
              <div className="flex justify-center gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <button key={i} onClick={() => setRating(i)} aria-label={`${i} stars`}>
                    <svg viewBox="0 0 24 24" className={`h-8 w-8 ${i <= rating ? "text-gold-500" : "text-navy-200"}`} fill="currentColor"><path d="M12 2l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 15l-5.2 2.6 1-5.8L3.5 8.2l5.9-.9L12 2z" /></svg>
                  </button>
                ))}
              </div>
              <textarea value={reviewText} onChange={(e) => setReviewText(e.target.value.slice(0, 500))} rows={3} placeholder="Share your experience (optional)…" className="field-input resize-none" />
              <div className="text-right text-xs text-navy-400">{reviewText.length}/500</div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => submitReview(true)}>Skip for now</Button>
                <Button onClick={() => submitReview(false)} loading={reviewSaving} disabled={rating === 0}>Submit Review</Button>
              </div>
            </>
          )}
        </Modal>
      )}

      {/* report */}
      {reportOpen && (
        <Modal title="Report this consultation" onClose={() => setReportOpen(false)}>
          {reportDone ? (
            <>
              <Alert variant="success">Thank you. Our moderation team will review this.</Alert>
              <div className="flex justify-end"><Button variant="outline" onClick={() => setReportOpen(false)}>Close</Button></div>
            </>
          ) : (
            <>
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

      {/* attachment picker (My Documents) */}
      {attachOpen && (
        <Modal title="Attach a document" onClose={() => setAttachOpen(false)}>
          <p className="text-sm text-navy-600">Select an analysed document from <b>My Documents</b> to share in this chat.</p>
          {attachLoading ? (
            <div className="flex justify-center py-6"><Spinner className="h-6 w-6" /></div>
          ) : attachDocs.length === 0 ? (
            <Alert variant="info">
              No analysed documents yet. Upload a document in{" "}
              <a href="/user/my-documents" className="font-semibold underline">My Documents</a>{" "}
              first.
            </Alert>
          ) : (
            <ul className="max-h-64 divide-y divide-navy-100 overflow-y-auto rounded-xl border border-navy-100">
              {attachDocs.map((doc) => (
                <li key={doc.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-navy-900">{doc.fileName}</p>
                    {doc.analysis?.caseType && (
                      <p className="text-xs text-navy-400">{doc.analysis.caseType}</p>
                    )}
                  </div>
                  <button
                    onClick={() => attach(doc.id)}
                    disabled={attaching === doc.id}
                    className="shrink-0 rounded-lg bg-navy-900 px-3 py-1 text-xs font-semibold text-white hover:bg-navy-700 disabled:opacity-50"
                  >
                    {attaching === doc.id ? "Sharing…" : "Share"}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setAttachOpen(false)}>Close</Button>
          </div>
        </Modal>
      )}

      {/* success / error toast */}
      {attachToast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-navy-900 px-4 py-2.5 text-sm font-medium text-white shadow-card-lg">
          {attachToast}
        </div>
      )}
    </div>
  );
}
