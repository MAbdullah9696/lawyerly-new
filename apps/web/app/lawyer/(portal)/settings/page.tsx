"use client";

import { useEffect, useState } from "react";
import { lawyerApi } from "@/lib/api";
import { SecuritySection, Card } from "@/components/account/SecuritySection";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Alert, Spinner } from "@/components/ui/Feedback";

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange?: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={() => onChange?.(!checked)}
      className={`relative h-6 w-11 rounded-full transition ${checked ? "bg-navy-900" : "bg-navy-200"} ${disabled ? "opacity-50" : ""}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

export default function LawyerSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [cap, setCap] = useState(10);
  const [autoDecline, setAutoDecline] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [emailPrefs, setEmailPrefs] = useState({ request: true, expired: true, review: true, payout: true });

  useEffect(() => {
    lawyerApi.profile().then(({ profile }) => { setCap(profile.maxActiveConsultations); setAutoDecline(profile.autoDeclineWhenOffline); }).finally(() => setLoading(false));
  }, []);

  async function saveConsultation() {
    setSaving(true); setSaved(false);
    try { await lawyerApi.settings({ maxActiveConsultations: cap, autoDeclineWhenOffline: autoDecline }); setSaved(true); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner className="h-7 w-7" /></div>;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Settings</h1>
        <p className="mt-1 text-navy-500">Manage security, consultations, and notifications.</p>
      </div>

      <SecuritySection />

      <Card title="Consultation Capacity" desc="Control how many active consultations you take on.">
        {saved && <div className="mb-3"><Alert variant="success">Consultation settings saved.</Alert></div>}
        <div className="space-y-4">
          <div>
            <Input label="Max active consultations (1–50)" type="number" min={1} max={50} value={String(cap)} onChange={(e) => setCap(Math.max(1, Math.min(50, Number(e.target.value))))} className="w-40" />
            <p className="mt-1 text-xs text-navy-400">When reached, your profile shows “Currently Unavailable”.</p>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-navy-800">Auto-decline when Offline</p>
              <p className="text-xs text-navy-400">Requests received while offline are auto-declined.</p>
            </div>
            <Toggle checked={autoDecline} onChange={setAutoDecline} />
          </div>
          <div className="flex justify-end"><Button onClick={saveConsultation} loading={saving}>Save</Button></div>
        </div>
      </Card>

      <Card title="Notification Preferences" desc="Choose which emails you receive. Security alerts are always on.">
        <ul className="space-y-3">
          {[
            { key: "request" as const, label: "New consultation request" },
            { key: "expired" as const, label: "Request auto-expired" },
            { key: "review" as const, label: "New review received" },
            { key: "payout" as const, label: "Payout processed" },
          ].map((p) => (
            <li key={p.key} className="flex items-center justify-between">
              <span className="text-sm text-navy-700">{p.label}</span>
              <Toggle checked={emailPrefs[p.key]} onChange={(v) => setEmailPrefs((s) => ({ ...s, [p.key]: v }))} />
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-navy-400">Preference persistence is finalised in the notifications milestone.</p>
      </Card>
    </div>
  );
}
