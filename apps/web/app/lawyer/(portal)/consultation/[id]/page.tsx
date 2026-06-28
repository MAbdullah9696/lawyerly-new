"use client";

import { use, useEffect, useRef, useState } from "react";
import { lawyerApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Spinner, Alert } from "@/components/ui/Feedback";
import { Button } from "@/components/ui/Button";
import { ChatPanel } from "@/components/consultation/ChatPanel";
import type { LawyerConsultation } from "@/lib/types";

export default function LawyerConsultationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const [data, setData] = useState<LawyerConsultation | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [savedAt, setSavedAt] = useState("");
  const [closeOpen, setCloseOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const dirty = useRef(false);

  function load() {
    lawyerApi.consultation(id).then((c) => { setData(c); setNotes(c.caseNotes); }).finally(() => setLoading(false));
  }
  useEffect(load, [id]);

  // Auto-save private notes every 30s when changed (§10.4).
  useEffect(() => {
    const t = setInterval(() => { if (dirty.current) saveNotes(); }, 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, notes]);

  async function saveNotes() {
    dirty.current = false;
    await lawyerApi.saveNotes(id, notes).catch(() => {});
    setSavedAt(new Date().toLocaleTimeString());
  }
  async function closeCase() { await lawyerApi.closeCase(id); setCloseOpen(false); load(); }

  if (loading || !data || !user) return <div className="flex justify-center py-20"><Spinner className="h-7 w-7" /></div>;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy-900">Consultation — {data.clientFirstName}</h1>
          <p className="text-sm text-navy-500">{data.caseType} · {data.status === "active" ? "Active" : "Closed"}</p>
        </div>
        {data.status === "active" && <Button variant="outline" onClick={() => setCloseOpen(true)}>Close Consultation</Button>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Chat */}
        <section className="flex h-[calc(100vh-12rem)] flex-col rounded-2xl border border-navy-100 bg-navy-50/40 shadow-card">
          <div className="flex items-center gap-2 border-b border-navy-100 bg-white px-4 py-2.5">
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-navy-400" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 10V8a6 6 0 0 1 12 0v2M5 10h14v10H5V10Z" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span className="text-sm font-medium text-navy-700">{data.clientFirstName} · End-to-end encrypted</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <ChatPanel
              consultationId={id}
              currentUserId={user.id}
              status={data.status}
              otherPartyName={data.clientFirstName}
              onClosedRemotely={load}
            />
          </div>
        </section>

        {/* Case info + notes */}
        <aside className="space-y-5">
          <section className="rounded-2xl border border-navy-100 bg-white p-5 shadow-card">
            <button onClick={() => setPanelOpen((o) => !o)} className="flex w-full items-center justify-between font-semibold text-navy-900">
              Case Information
              <svg viewBox="0 0 24 24" className={`h-4 w-4 transition ${panelOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            {panelOpen && (
              <div className="mt-3 space-y-3">
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between"><dt className="text-navy-400">Client</dt><dd className="font-medium text-navy-800">{data.clientFirstName}</dd></div>
                  <div className="flex justify-between"><dt className="text-navy-400">Case type</dt><dd className="font-medium text-navy-800">{data.caseType}</dd></div>
                  <div className="flex justify-between"><dt className="text-navy-400">Started</dt><dd className="font-medium text-navy-800">{new Date(data.startedAt).toLocaleDateString()}</dd></div>
                </dl>
                {data.description && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-navy-400">Request</p>
                    <p className="mt-1 text-sm text-navy-700">{data.description}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-navy-400">Shared documents</p>
                  <p className="mt-1 text-sm text-navy-400">None yet (sharing in Milestone 8).</p>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-navy-100 bg-white p-5 shadow-card">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-navy-900">Private Case Notes</h2>
              {savedAt && <span className="text-xs text-green-600">Saved {savedAt}</span>}
            </div>
            <p className="mt-1 text-xs text-navy-400">Only visible to you. Auto-saves.</p>
            <textarea
              value={notes}
              onChange={(e) => { setNotes(e.target.value); dirty.current = true; }}
              onBlur={() => dirty.current && saveNotes()}
              rows={6}
              className="field-input mt-2 resize-y"
              placeholder="Jot down private notes about this case…"
            />
          </section>
        </aside>
      </div>

      {closeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-navy-950/50" onClick={() => setCloseOpen(false)} />
          <div className="relative w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-card-lg">
            <h3 className="text-lg font-bold text-navy-900">Close consultation?</h3>
            <p className="text-sm text-navy-600">The client will be prompted to leave a review. Your private notes are preserved.</p>
            <Alert variant="info">Closing records your earnings for this consultation.</Alert>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCloseOpen(false)}>Cancel</Button>
              <Button onClick={closeCase}>Close Consultation</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
