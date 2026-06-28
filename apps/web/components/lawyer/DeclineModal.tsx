"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Select, Textarea } from "@/components/ui/Field";

const REASONS = ["Not my area of expertise", "Currently at capacity", "Insufficient case details", "Other"];

export function DeclineModal({
  clientName,
  onClose,
  onConfirm,
}: {
  clientName: string;
  onClose: () => void;
  onConfirm: (reason: string, message?: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function confirm() {
    if (!reason) return;
    setLoading(true);
    try {
      await onConfirm(reason, message || undefined);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-navy-950/50" onClick={onClose} />
      <div className="relative w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-card-lg">
        <h3 className="text-lg font-bold text-navy-900">Decline request</h3>
        <p className="text-sm text-navy-600">{clientName} will be notified with your reason.</p>
        <Select label="Reason (required)" options={REASONS} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Select a reason" />
        <Textarea label="Message (optional)" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={200} placeholder="Add a short note…" />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="!bg-red-600 hover:!bg-red-500" onClick={confirm} loading={loading} disabled={!reason}>Confirm Decline</Button>
        </div>
      </div>
    </div>
  );
}
