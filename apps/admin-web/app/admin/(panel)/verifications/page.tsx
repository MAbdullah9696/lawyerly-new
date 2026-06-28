"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { adminApi, ApiRequestError } from "@/lib/api";
import { useAdmin, can } from "@/lib/auth-context";
import { Spinner, Modal, Chip, Alert, Textarea } from "@/components/ui";

const TABS = ["pending", "approved", "rejected", "resubmitted"] as const;
type Tab = (typeof TABS)[number];

interface Row { userId: string; name: string; barCouncilNumber: string; province: string; city: string; submittedAt: string; hoursSince: number; documentsCount: number; verifiedDocs: number }
interface Detail {
  userId: string;
  profile: { fullLegalName: string; cnicLast4: string; barCouncilNumber: string; province: string; city: string; yearsExperienceBand: string; practiceAreas: string[]; languages: string[]; consultationFeePkr: number; bio: string; verificationStatus: string; email: string; phone: string };
  documents: { id: string; docType: string; fileUrl: string; status: string; issueNote: string | null }[];
}

const DOC_LABEL: Record<string, string> = { bar_council_cert: "Bar Council Certificate", cnic_front: "CNIC (Front)", cnic_back: "CNIC (Back)", law_degree: "Law Degree", profile_photo: "Profile Photo" };

export default function VerificationsPage() {
  const { admin } = useAdmin();
  const writable = can.write(admin?.role);
  const [tab, setTab] = useState<Tab>("pending");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [allowResub, setAllowResub] = useState(true);
  const [issueFor, setIssueFor] = useState<string | null>(null);
  const [issueNote, setIssueNote] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback((t: Tab) => {
    setLoading(true);
    adminApi.get<{ items: Row[] }>(`verifications?tab=${t}`).then((r) => setRows(r.items)).finally(() => setLoading(false));
  }, []);
  useEffect(() => load(tab), [tab, load]);

  async function open(userId: string) {
    setErr(""); setRejecting(false);
    const d = await adminApi.get<Detail>(`verifications/${userId}`);
    setDetail(d);
  }
  async function setDoc(docId: string, status: "verified" | "issue_found", note?: string) {
    if (!detail) return;
    await adminApi.patch(`verifications/${detail.userId}/documents/${docId}`, { status, issueNote: note });
    setIssueFor(null); setIssueNote("");
    open(detail.userId);
  }
  async function approve() {
    if (!detail) return;
    setErr("");
    try { await adminApi.patch(`verifications/${detail.userId}/approve`); setDetail(null); load(tab); }
    catch (e) { setErr(e instanceof ApiRequestError ? e.message : "Approve failed."); }
  }
  async function reject() {
    if (!detail) return;
    setErr("");
    try { await adminApi.patch(`verifications/${detail.userId}/reject`, { reason, allowResubmission: allowResub }); setDetail(null); setReason(""); load(tab); }
    catch (e) { setErr(e instanceof ApiRequestError ? e.message : "Reject failed."); }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy-900">Lawyer Verifications</h1>
      <div className="mt-4 flex gap-1 border-b border-navy-100">
        {TABS.map((t) => <button key={t} onClick={() => setTab(t)} className={clsx("px-4 py-2 text-sm font-semibold capitalize", tab === t ? "border-b-2 border-navy-900 text-navy-900" : "text-navy-400 hover:text-navy-700")}>{t}</button>)}
      </div>

      {loading ? <div className="flex justify-center py-16"><Spinner /></div> : rows.length === 0 ? <p className="py-16 text-center text-sm text-navy-400">No {tab} applications.</p> : (
        <div className="mt-4 overflow-x-auto card">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-navy-100 text-left text-xs uppercase tracking-wide text-navy-400">
              <th className="p-3">Lawyer</th><th className="p-3">Bar Council #</th><th className="p-3">Province</th><th className="p-3">Submitted</th><th className="p-3">Docs</th><th className="p-3"></th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.userId} className="border-b border-navy-50 hover:bg-navy-50/50">
                  <td className="p-3 font-medium text-navy-900">{r.name}</td>
                  <td className="p-3 text-navy-600">{r.barCouncilNumber}</td>
                  <td className="p-3 text-navy-600">{r.province}, {r.city}</td>
                  <td className="p-3 text-navy-600">{new Date(r.submittedAt).toLocaleDateString()} <span className={r.hoursSince > 48 ? "text-red-600" : "text-navy-400"}>({r.hoursSince}h)</span></td>
                  <td className="p-3 text-navy-600">{r.verifiedDocs}/{r.documentsCount}</td>
                  <td className="p-3 text-right"><button onClick={() => open(r.userId)} className="btn-outline !py-1 !text-xs">Review</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detail && (
        <Modal title={`Review — ${detail.profile.fullLegalName}`} wide onClose={() => setDetail(null)}>
          {err && <div className="mb-3"><Alert variant="error">{err}</Alert></div>}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2 text-sm">
              <h4 className="font-semibold text-navy-900">Profile</h4>
              <p><span className="text-navy-400">Bar Council #:</span> {detail.profile.barCouncilNumber}</p>
              <p><span className="text-navy-400">CNIC:</span> *****-*******-{detail.profile.cnicLast4}</p>
              <p><span className="text-navy-400">Location:</span> {detail.profile.city}, {detail.profile.province}</p>
              <p><span className="text-navy-400">Email:</span> {detail.profile.email}</p>
              <p><span className="text-navy-400">Fee:</span> PKR {detail.profile.consultationFeePkr.toLocaleString()}</p>
              <p><span className="text-navy-400">Practice:</span> {detail.profile.practiceAreas.join(", ")}</p>
              <p className="text-navy-600">{detail.profile.bio}</p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-navy-900">Documents</h4>
              {detail.documents.map((doc) => (
                <div key={doc.id} className="rounded-lg border border-navy-100 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-navy-800">{DOC_LABEL[doc.docType] ?? doc.docType}</span>
                    <Chip tone={doc.status === "verified" ? "green" : doc.status === "issue_found" ? "red" : "gray"}>{doc.status}</Chip>
                  </div>
                  <p className="mt-1 truncate text-xs text-navy-400">{doc.fileUrl}</p>
                  {doc.issueNote && <p className="mt-1 text-xs text-red-600">{doc.issueNote}</p>}
                  {writable && (
                    issueFor === doc.id ? (
                      <div className="mt-2 space-y-2">
                        <Textarea placeholder="Describe the issue…" value={issueNote} onChange={(e) => setIssueNote(e.target.value)} />
                        <div className="flex gap-2"><button onClick={() => setDoc(doc.id, "issue_found", issueNote)} className="btn-danger !py-1 !text-xs" disabled={!issueNote.trim()}>Flag issue</button><button onClick={() => setIssueFor(null)} className="btn-outline !py-1 !text-xs">Cancel</button></div>
                      </div>
                    ) : (
                      <div className="mt-2 flex gap-2">
                        <button onClick={() => setDoc(doc.id, "verified")} className="btn-outline !py-1 !text-xs">Mark verified</button>
                        <button onClick={() => { setIssueFor(doc.id); setIssueNote(""); }} className="btn-outline !py-1 !text-xs !text-red-600">Issue found</button>
                      </div>
                    )
                  )}
                </div>
              ))}
            </div>
          </div>

          {writable && detail.profile.verificationStatus === "pending" && (
            <div className="mt-5 border-t border-navy-100 pt-4">
              {rejecting ? (
                <div className="space-y-3">
                  <Textarea label="Rejection reason (min 50 chars)" value={reason} onChange={(e) => setReason(e.target.value)} />
                  <label className="flex items-center gap-2 text-sm text-navy-700"><input type="checkbox" checked={allowResub} onChange={(e) => setAllowResub(e.target.checked)} /> Allow resubmission</label>
                  <div className="flex justify-end gap-2"><button onClick={() => setRejecting(false)} className="btn-outline">Cancel</button><button onClick={reject} className="btn-danger" disabled={reason.trim().length < 50}>Confirm Reject</button></div>
                </div>
              ) : (
                <div className="flex justify-end gap-2">
                  <button onClick={() => setRejecting(true)} className="btn-outline !text-red-600">Reject Application</button>
                  <button onClick={approve} className="btn-gold">Approve Lawyer</button>
                </div>
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
