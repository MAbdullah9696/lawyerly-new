"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { consultationsApi, documentsApi, presignAndUpload } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Alert, Spinner } from "@/components/ui/Feedback";
import type { DocumentDTO, DocumentEntity, DocumentEntityType, MyConsultationItem } from "@/lib/types";

// ─── Entity display config ────────────────────────────────────────────────────

const ENTITY_STYLES: Record<DocumentEntityType, { bg: string; text: string; label: string }> = {
  Person:         { bg: "bg-yellow-100", text: "text-yellow-800", label: "People" },
  Date:           { bg: "bg-blue-100",   text: "text-blue-800",   label: "Dates" },
  LegalSection:   { bg: "bg-green-100",  text: "text-green-800",  label: "Legal Sections" },
  MonetaryAmount: { bg: "bg-purple-100", text: "text-purple-800", label: "Amounts" },
  Location:       { bg: "bg-gray-100",   text: "text-gray-700",   label: "Locations" },
  Organization:   { bg: "bg-orange-100", text: "text-orange-800", label: "Organizations" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ACCEPTED_MIME = new Set(["application/pdf", "image/jpeg", "image/png", "image/jpg"]);
const MAX_BYTES = 10 * 1024 * 1024;

function validateFile(file: File): string | null {
  if (!ACCEPTED_MIME.has(file.type)) return "Only PDF, JPG, or PNG files are accepted.";
  if (file.size > MAX_BYTES) return "File must be 10 MB or smaller.";
  return null;
}

function statusBadge(status: DocumentDTO["status"]) {
  const map: Record<string, { cls: string; label: string }> = {
    uploaded:         { cls: "bg-gray-100 text-gray-600",   label: "Queued" },
    processing:       { cls: "bg-blue-100 text-blue-700",   label: "Processing" },
    analysis_complete:{ cls: "bg-green-100 text-green-700", label: "Analysis Complete" },
    low_confidence:   { cls: "bg-yellow-100 text-yellow-700", label: "Low Confidence" },
    processing_failed:{ cls: "bg-red-100 text-red-700",     label: "Failed" },
  };
  const s = map[status] ?? map.uploaded;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>
      {status === "processing" && <Spinner className="h-3 w-3" />}
      {s.label}
    </span>
  );
}

function fileIcon(fileType: string) {
  const isPdf = fileType === "application/pdf";
  return (
    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${isPdf ? "bg-red-50" : "bg-blue-50"}`}>
      <svg viewBox="0 0 24 24" className={`h-5 w-5 ${isPdf ? "text-red-500" : "text-blue-500"}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {isPdf ? (
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-2 9v6m-2-2 2 2 2-2M14 2v6h6" />
        ) : (
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
        )}
      </svg>
    </div>
  );
}

// ─── Analysis split-screen modal ──────────────────────────────────────────────

function AnalysisModal({ doc, onClose }: { doc: DocumentDTO; onClose: () => void }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [activeConsultations, setActiveConsultations] = useState<MyConsultationItem[]>([]);
  const [sharing, setSharing] = useState<string | null>(null);
  const [shareSuccess, setShareSuccess] = useState("");
  const [shareError, setShareError] = useState("");
  const [showShareMenu, setShowShareMenu] = useState(false);

  useEffect(() => {
    documentsApi.serveUrl(doc.id).then(({ url }) => setPreviewUrl(url)).catch(() => {});
    consultationsApi.list("active").then((r) => {
      setActiveConsultations(r.items as MyConsultationItem[]);
    }).catch(() => {});
  }, [doc.id]);

  async function share(consultationId: string) {
    setSharing(consultationId);
    setShareError("");
    try {
      await consultationsApi.attach(consultationId, doc.id);
      setShareSuccess("Document shared successfully.");
      setShowShareMenu(false);
    } catch {
      setShareError("Could not share document. Please try again.");
    } finally {
      setSharing(null);
    }
  }

  const analysis = doc.analysis;
  const entityGroups = analysis
    ? Object.entries(ENTITY_STYLES).reduce<Record<string, DocumentEntity[]>>((acc, [type]) => {
        const ents = analysis.entities.filter((e) => e.type === type);
        if (ents.length) acc[type] = ents;
        return acc;
      }, {})
    : {};

  const conf = analysis?.overallConfidence ?? 0;
  const confPct = Math.round(conf * 100);
  const lowConf = conf < 0.6;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-navy-100 px-6 py-4">
          <div>
            <h2 className="font-semibold text-navy-900 truncate max-w-xs">{doc.fileName}</h2>
            <div className="mt-0.5 flex items-center gap-2">
              {statusBadge(doc.status)}
              {doc.analysis?.caseType && (
                <span className="rounded-full bg-navy-100 px-2 py-0.5 text-xs font-medium text-navy-700">
                  {doc.analysis.caseType}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Share with Lawyer */}
            <div className="relative">
              <Button
                variant="outline"
                onClick={() => { setShowShareMenu((o) => !o); setShareError(""); setShareSuccess(""); }}
              >
                <svg viewBox="0 0 24 24" className="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
                Share with Lawyer
              </Button>
              {showShareMenu && (
                <div className="absolute right-0 z-10 mt-2 w-64 rounded-xl border border-navy-100 bg-white p-2 shadow-card-lg">
                  {activeConsultations.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-navy-500">
                      No active consultations. Start one from Find a Lawyer.
                    </p>
                  ) : (
                    activeConsultations.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => share(c.id)}
                        disabled={sharing === c.id}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-navy-700 hover:bg-navy-50 disabled:opacity-50"
                      >
                        {sharing === c.id && <Spinner className="h-3.5 w-3.5" />}
                        {c.lawyerName} — {c.caseType}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-navy-400 hover:bg-navy-50 hover:text-navy-700"
              aria-label="Close"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" /></svg>
            </button>
          </div>
        </div>

        {shareSuccess && <div className="mx-6 mt-3"><Alert variant="success">{shareSuccess}</Alert></div>}
        {shareError && <div className="mx-6 mt-3"><Alert variant="error">{shareError}</Alert></div>}

        {/* Split-screen body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left — document preview */}
          <div className="flex w-1/2 flex-col border-r border-navy-100 bg-gray-50">
            <div className="flex items-center justify-between border-b border-navy-100 bg-white px-4 py-2">
              <span className="text-xs font-medium text-navy-500 uppercase tracking-wide">Document Preview</span>
            </div>
            <div className="flex-1 overflow-hidden">
              {previewUrl ? (
                doc.fileType === "application/pdf" ? (
                  <iframe
                    src={previewUrl}
                    className="h-full w-full"
                    title="Document preview"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl}
                      alt="Document preview"
                      className="max-h-full max-w-full rounded-lg object-contain shadow"
                    />
                  </div>
                )
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Spinner className="h-8 w-8 text-navy-400" />
                </div>
              )}
            </div>
          </div>

          {/* Right — analysis panel */}
          <div className="flex w-1/2 flex-col overflow-y-auto">
            <div className="flex items-center justify-between border-b border-navy-100 bg-white px-4 py-2">
              <span className="text-xs font-medium text-navy-500 uppercase tracking-wide">Analysis Results</span>
            </div>

            {!analysis ? (
              <div className="flex flex-1 items-center justify-center p-8 text-center text-navy-500">
                <div>
                  <svg viewBox="0 0 24 24" className="mx-auto mb-3 h-10 w-10 text-navy-300" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 12h.01M15 12h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  Analysis not yet available for this document.
                </div>
              </div>
            ) : (
              <div className="space-y-5 p-5">
                {/* Low confidence warning */}
                {(doc.status === "low_confidence" || lowConf) && (
                  <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-3">
                    <div className="flex items-start gap-2">
                      <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600" fill="none" stroke="currentColor" strokeWidth="2"><path d="m10.29 3.86-8.73 15.14A1 1 0 0 0 2.44 21h19.12a1 1 0 0 0 .88-1.5L13.71 3.86a1 1 0 0 0-1.71 0ZM12 9v4M12 17h.01" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      <p className="text-sm text-yellow-800">
                        <strong>Low confidence scan.</strong> The document may be handwritten, blurry, or low-resolution. Results should be verified manually.
                      </p>
                    </div>
                  </div>
                )}

                {/* Disclaimer */}
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                  This is not legal advice. Consult a licensed lawyer for your specific case.
                </div>

                {/* Case type */}
                {analysis.caseType && (
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-navy-400">Case Type</p>
                    <span className="inline-flex items-center rounded-full bg-navy-900 px-3 py-1 text-sm font-medium text-white">
                      {analysis.caseType}
                    </span>
                  </div>
                )}

                {/* Confidence bar */}
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-navy-400">Overall Confidence</p>
                    <span className={`text-xs font-bold ${confPct >= 70 ? "text-green-600" : confPct >= 50 ? "text-yellow-600" : "text-red-600"}`}>
                      {confPct}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                    <div
                      className={`h-full rounded-full transition-all ${confPct >= 70 ? "bg-green-500" : confPct >= 50 ? "bg-yellow-500" : "bg-red-500"}`}
                      style={{ width: `${confPct}%` }}
                    />
                  </div>
                </div>

                {/* Summary */}
                {analysis.summary && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-400">Summary</p>
                    <p className="text-sm leading-relaxed text-navy-700">{analysis.summary}</p>
                  </div>
                )}

                {/* Entities by type */}
                {Object.entries(entityGroups).length > 0 && (
                  <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-navy-400">Extracted Entities</p>
                    <div className="space-y-3">
                      {Object.entries(entityGroups).map(([type, ents]) => {
                        const style = ENTITY_STYLES[type as DocumentEntityType];
                        return (
                          <div key={type}>
                            <p className="mb-1.5 text-xs font-medium text-navy-500">{style.label}</p>
                            <div className="flex flex-wrap gap-1.5">
                              {ents.map((e, i) => (
                                <span
                                  key={i}
                                  title={`Confidence: ${Math.round(e.confidence * 100)}%`}
                                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}
                                >
                                  {e.value}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {analysis.entities.length === 0 && (
                  <p className="text-sm text-navy-400">No specific entities were extracted from this document.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Delete confirmation modal ────────────────────────────────────────────────

function DeleteModal({ doc, onCancel, onConfirm, loading }: {
  doc: DocumentDTO;
  onCancel: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="font-semibold text-navy-900">Delete Document?</h3>
        <p className="mt-2 text-sm text-navy-600">
          <strong>{doc.fileName}</strong> will be permanently deleted. This action cannot be undone.
        </p>
        <div className="mt-5 flex gap-3 justify-end">
          <Button variant="outline" onClick={onCancel} disabled={loading}>Cancel</Button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition"
          >
            {loading && <Spinner className="h-4 w-4" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Upload drop zone ─────────────────────────────────────────────────────────

function UploadZone({ onUpload }: { onUpload: (file: File) => void }) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    const err = validateFile(file);
    if (err) { setError(err); return; }
    setError("");
    onUpload(file);
  }

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition ${
          dragging ? "border-navy-500 bg-navy-50" : "border-navy-200 hover:border-navy-400 hover:bg-gray-50"
        }`}
      >
        <svg viewBox="0 0 24 24" className="mx-auto mb-3 h-10 w-10 text-navy-300" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
        </svg>
        <p className="font-medium text-navy-700">Drop your document here, or click to browse</p>
        <p className="mt-1 text-sm text-navy-400">PDF, JPG, or PNG — max 10 MB</p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
        />
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MyDocumentsPage() {
  const [docs, setDocs] = useState<DocumentDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [analysisDoc, setAnalysisDoc] = useState<DocumentDTO | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<DocumentDTO | null>(null);
  const [deleting, setDeleting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchDocs = useCallback(async () => {
    try {
      const { documents } = await documentsApi.list();
      setDocs(documents);
      return documents;
    } catch {
      return [];
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchDocs().finally(() => setLoading(false));
  }, [fetchDocs]);

  // Polling for processing docs
  useEffect(() => {
    const needsPoll = docs.some((d) => d.status === "processing" || d.status === "uploaded");
    if (needsPoll && !pollRef.current) {
      pollRef.current = setInterval(() => {
        fetchDocs().then((updated) => {
          const stillProcessing = updated.some((d) => d.status === "processing" || d.status === "uploaded");
          if (!stillProcessing && pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        });
      }, 3000);
    }
    if (!needsPoll && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [docs, fetchDocs]);

  async function handleUpload(file: File) {
    setUploading(true);
    setUploadError("");
    try {
      const objectKey = await presignAndUpload(file, "document");
      const { documentId } = await documentsApi.upload({
        objectKey,
        fileName: file.name,
        fileType: file.type || "application/octet-stream",
      });
      // Optimistically add as processing
      const optimistic: DocumentDTO = {
        id: documentId,
        fileName: file.name,
        fileType: file.type,
        objectKey,
        status: "processing",
        uploadDate: new Date().toISOString(),
        analysis: null,
      };
      setDocs((prev) => [optimistic, ...prev]);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    if (!deleteDoc) return;
    setDeleting(true);
    try {
      await documentsApi.delete(deleteDoc.id);
      setDocs((prev) => prev.filter((d) => d.id !== deleteDoc.id));
      setDeleteDoc(null);
    } catch {
      // keep modal open, show nothing (retry by closing and reopening)
    } finally {
      setDeleting(false);
    }
  }

  // Refresh a single doc in the list when analysis view is opened (may have updated)
  async function openAnalysis(doc: DocumentDTO) {
    setAnalysisDoc(doc);
    // Refresh in background to show latest analysis data
    try {
      const { document: fresh } = await documentsApi.get(doc.id);
      setAnalysisDoc(fresh);
      setDocs((prev) => prev.map((d) => (d.id === fresh.id ? fresh : d)));
    } catch { /* keep existing */ }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">My Documents</h1>
        <p className="mt-1 text-navy-500">Upload legal documents for AI-powered analysis.</p>
      </div>

      {/* Upload zone */}
      <div className="rounded-2xl border border-navy-100 bg-white p-6 shadow-card">
        <h2 className="mb-4 font-semibold text-navy-800">Upload New Document</h2>
        {uploading ? (
          <div className="flex items-center justify-center gap-3 rounded-xl border-2 border-dashed border-navy-200 py-10">
            <Spinner className="h-5 w-5 text-navy-500" />
            <span className="text-sm text-navy-600">Uploading document…</span>
          </div>
        ) : (
          <UploadZone onUpload={handleUpload} />
        )}
        {uploadError && <div className="mt-3"><Alert variant="error">{uploadError}</Alert></div>}
      </div>

      {/* Document list */}
      <div className="rounded-2xl border border-navy-100 bg-white shadow-card">
        <div className="border-b border-navy-100 px-6 py-4">
          <h2 className="font-semibold text-navy-800">
            Documents {docs.length > 0 && <span className="ml-1 text-navy-400 font-normal text-sm">({docs.length})</span>}
          </h2>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner className="h-7 w-7 text-navy-400" />
          </div>
        ) : docs.length === 0 ? (
          <div className="py-16 text-center text-navy-400">
            <svg viewBox="0 0 24 24" className="mx-auto mb-3 h-12 w-12 text-navy-200" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM14 2v6h6" />
            </svg>
            <p className="font-medium">No documents uploaded yet</p>
            <p className="mt-1 text-sm">Upload a PDF or image above to get started.</p>
          </div>
        ) : (
          <ul className="divide-y divide-navy-50">
            {docs.map((doc) => {
              const canAnalyze = doc.status === "analysis_complete" || doc.status === "low_confidence";
              return (
                <li key={doc.id} className="flex items-center gap-4 px-6 py-4">
                  {fileIcon(doc.fileType)}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-navy-900">{doc.fileName}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2">
                      <span className="text-xs text-navy-400">
                        {new Date(doc.uploadDate).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                      {statusBadge(doc.status)}
                      {doc.status === "low_confidence" && (
                        <span className="flex items-center gap-1 text-xs text-yellow-700">
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="m10.29 3.86-8.73 15.14A1 1 0 0 0 2.44 21h19.12a1 1 0 0 0 .88-1.5L13.71 3.86a1 1 0 0 0-1.71 0Z" strokeLinecap="round" /><line x1="12" y1="9" x2="12" y2="13" strokeLinecap="round" /><line x1="12" y1="17" x2="12.01" y2="17" strokeLinecap="round" /></svg>
                          Low confidence scan
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {canAnalyze && (
                      <Button variant="outline" onClick={() => openAnalysis(doc)}>
                        View Analysis
                      </Button>
                    )}
                    <button
                      onClick={() => setDeleteDoc(doc)}
                      className="rounded-lg p-2 text-navy-400 hover:bg-red-50 hover:text-red-600 transition"
                      title="Delete document"
                      aria-label="Delete"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                      </svg>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Analysis modal */}
      {analysisDoc && (
        <AnalysisModal doc={analysisDoc} onClose={() => setAnalysisDoc(null)} />
      )}

      {/* Delete confirmation */}
      {deleteDoc && (
        <DeleteModal
          doc={deleteDoc}
          onCancel={() => setDeleteDoc(null)}
          onConfirm={handleDelete}
          loading={deleting}
        />
      )}
    </div>
  );
}
