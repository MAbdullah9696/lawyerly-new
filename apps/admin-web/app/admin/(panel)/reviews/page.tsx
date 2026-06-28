"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi, ApiRequestError } from "@/lib/api";
import { useAdmin, can } from "@/lib/auth-context";
import { Spinner, Chip, Modal, Alert, Textarea } from "@/components/ui";

interface Review { id: string; rating: number; text: string | null; caseType: string; lawyer: string; reviewer: string; flagged: boolean; removed: boolean; removalReason: string | null; date: string }

export default function ReviewsPage() {
  const { admin } = useAdmin();
  const writable = can.write(admin?.role);
  const [flaggedOnly, setFlaggedOnly] = useState(true);
  const [rows, setRows] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [removeFor, setRemoveFor] = useState<Review | null>(null);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    adminApi.get<{ items: Review[] }>(`reviews?flagged=${flaggedOnly}`).then((r) => setRows(r.items)).finally(() => setLoading(false));
  }, [flaggedOnly]);
  useEffect(load, [load]);

  async function approveFlag(id: string) { await adminApi.post(`reviews/${id}/approve-flag`); load(); }
  async function remove() {
    if (!removeFor) return;
    setErr("");
    try { await adminApi.post(`reviews/${removeFor.id}/remove`, { reason }); setRemoveFor(null); setReason(""); load(); }
    catch (e) { setErr(e instanceof ApiRequestError ? e.message : "Failed."); }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy-900">Reviews</h1>
        <label className="flex items-center gap-2 text-sm text-navy-700"><input type="checkbox" checked={flaggedOnly} onChange={(e) => setFlaggedOnly(e.target.checked)} /> Flagged only</label>
      </div>

      {loading ? <div className="flex justify-center py-16"><Spinner /></div> : rows.length === 0 ? <p className="py-16 text-center text-sm text-navy-400">No reviews.</p> : (
        <ul className="mt-4 space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gold-600">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                    {r.flagged && <Chip tone="red">Flagged</Chip>}
                    {r.removed && <Chip tone="gray">Removed</Chip>}
                    <Chip tone="gray">{r.caseType}</Chip>
                  </div>
                  <p className="mt-1 text-sm text-navy-700">{r.text ?? <span className="text-navy-400">No text</span>}</p>
                  <p className="mt-1 text-xs text-navy-400">by {r.reviewer} → {r.lawyer} · {new Date(r.date).toLocaleDateString()}</p>
                  {r.removalReason && <p className="mt-1 text-xs text-red-600">Removed: {r.removalReason}</p>}
                </div>
                {writable && !r.removed && (
                  <div className="flex shrink-0 gap-2">
                    {r.flagged && <button onClick={() => approveFlag(r.id)} className="btn-outline !py-1 !text-xs">Approve (clear flag)</button>}
                    <button onClick={() => { setRemoveFor(r); setReason(""); setErr(""); }} className="btn-outline !py-1 !text-xs !text-red-600">Remove</button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {removeFor && (
        <Modal title="Remove review" onClose={() => setRemoveFor(null)}>
          {err && <div className="mb-3"><Alert variant="error">{err}</Alert></div>}
          <Alert variant="warning">This permanently removes the review and notifies both the reviewer and the lawyer.</Alert>
          <div className="mt-3"><Textarea label="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          <div className="mt-3 flex justify-end gap-2"><button onClick={() => setRemoveFor(null)} className="btn-outline">Cancel</button><button onClick={remove} className="btn-danger" disabled={!reason.trim()}>Remove Review</button></div>
        </Modal>
      )}
    </div>
  );
}
