"use client";

import { useEffect, useState } from "react";
import { lawyerApi, presignAndUpload } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Input, Select, Textarea, MultiSelect, Checkbox } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Alert, Spinner } from "@/components/ui/Feedback";
import { Avatar, StarRating } from "@/components/user/widgets";
import { PRACTICE_AREAS, LANGUAGES } from "@/lib/constants";
import type { LawyerOwnProfile } from "@/lib/types";

const AVAIL = ["online", "busy", "offline"];

export default function LawyerProfileEditPage() {
  const { refreshUser } = useAuth();
  const [p, setP] = useState<LawyerOwnProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [pendingPhotoKey, setPendingPhotoKey] = useState<string | null>(null);

  // editable state
  const [bio, setBio] = useState("");
  const [areas, setAreas] = useState<string[]>([]);
  const [langs, setLangs] = useState<string[]>([]);
  const [fee, setFee] = useState("");
  const [availability, setAvailability] = useState("offline");
  const [showWL, setShowWL] = useState(false);
  const [wl, setWl] = useState({ total: 0, won: 0, lost: 0, ongoing: 0 });

  useEffect(() => {
    lawyerApi.profile().then(({ profile }) => {
      setP(profile);
      setBio(profile.bio); setAreas(profile.practiceAreas); setLangs(profile.languages);
      setFee(String(profile.consultationFeePkr)); setAvailability(profile.availability);
      setShowWL(profile.showWinLossStats); setWl(profile.winLoss);
      if (profile.profilePhotoUrl) setPhotoPreview(profile.profilePhotoUrl);
    }).finally(() => setLoading(false));
  }, []);

  const bioOk = bio.trim().length >= 200;
  const canSave = bioOk && areas.length >= 1 && langs.length >= 1 && Number(fee) >= 0;

  function toggle(list: string[], set: (v: string[]) => void, v: string) {
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setPhotoError("Only JPG or PNG images are accepted.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setPhotoError("Photo must be 2 MB or smaller.");
      return;
    }
    setPhotoError("");
    setPhotoPreview(URL.createObjectURL(file));
    setUploadingPhoto(true);
    try {
      const objectKey = await presignAndUpload(file, "profile");
      setPendingPhotoKey(objectKey);
    } catch {
      setPhotoError("Photo upload failed. Please try again.");
      setPhotoPreview(p?.profilePhotoUrl ?? null);
      setPendingPhotoKey(null);
    } finally {
      setUploadingPhoto(false);
    }
    e.target.value = "";
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSaved(false); setSaving(true);
    try {
      const { profile } = await lawyerApi.updateProfile({
        bio, practiceAreas: areas, languages: langs, consultationFeePkr: Number(fee),
        availability, showWinLossStats: showWL,
        wlTotal: wl.total, wlWon: wl.won, wlLost: wl.lost, wlOngoing: wl.ongoing,
        ...(pendingPhotoKey !== null ? { profilePhotoUrl: pendingPhotoKey } : {}),
      });
      setP(profile);
      setPendingPhotoKey(null);
      await refreshUser();
      setSaved(true);
    } catch {
      setError("Could not save changes. Please check the fields and try again.");
    } finally { setSaving(false); }
  }

  if (loading || !p) return <div className="flex justify-center py-20"><Spinner className="h-7 w-7" /></div>;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy-900">Edit Profile</h1>
        <Button variant="outline" onClick={() => setPreview(true)}>Preview My Profile</Button>
      </div>

      <form onSubmit={save} className="mt-6 space-y-6">
        {saved && <Alert variant="success">Profile saved. Your fee change applies to new requests only.</Alert>}
        {error && <Alert variant="error">{error}</Alert>}

        {/* Photo + read-only */}
        <section className="rounded-2xl border border-navy-100 bg-white p-6 shadow-card">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar name={p.fullLegalName} url={photoPreview} size={72} />
              {uploadingPhoto && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/30">
                  <Spinner className="h-5 w-5 border-white border-t-transparent" />
                </div>
              )}
            </div>
            <div>
              <label className="btn-outline cursor-pointer text-sm">
                {uploadingPhoto ? "Uploading…" : "Change photo"}
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png"
                  className="hidden"
                  onChange={handlePhotoChange}
                  disabled={uploadingPhoto}
                />
              </label>
              <p className="mt-1 text-xs text-navy-400">JPG or PNG, max 2 MB. Photo is saved with the form.</p>
              {photoError && <p className="mt-1 text-xs text-red-600">{photoError}</p>}
              {pendingPhotoKey && !uploadingPhoto && (
                <p className="mt-1 text-xs text-green-600">New photo ready — click Save Changes to apply.</p>
              )}
            </div>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Input label="Full legal name (read-only)" value={p.fullLegalName} disabled />
            <Input label="Email (read-only)" value={p.email} disabled />
            <Input label="Bar Council # (read-only)" value={p.barCouncilNumber} disabled />
            <Input label="CNIC (read-only)" value={`*****-*******-${p.cnicLast4 ?? "*"}`} disabled />
          </div>
          <p className="mt-2 text-xs text-navy-400">To change read-only fields, contact admin support.</p>
        </section>

        {/* Editable */}
        <section className="space-y-5 rounded-2xl border border-navy-100 bg-white p-6 shadow-card">
          <div>
            <Textarea label="Professional bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={2000} />
            {!bioOk && bio.length > 0 && <p className="text-sm text-red-600">{200 - bio.trim().length} more characters needed.</p>}
          </div>
          <MultiSelect label="Practice areas" options={PRACTICE_AREAS} selected={areas} onToggle={(v) => toggle(areas, setAreas, v)} />
          <MultiSelect label="Languages" options={LANGUAGES} selected={langs} onToggle={(v) => toggle(langs, setLangs, v)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Consultation fee (PKR)" type="number" min={0} value={fee} onChange={(e) => setFee(e.target.value)} hint="Applies to new requests only." />
            <Select label="Availability" options={AVAIL} value={availability} onChange={(e) => setAvailability(e.target.value)} />
          </div>
        </section>

        {/* Win/Loss */}
        <section className="rounded-2xl border border-navy-100 bg-white p-6 shadow-card">
          <Checkbox label="Show Win/Loss statistics on my public profile" checked={showWL} onChange={(e) => setShowWL(e.target.checked)} />
          {showWL && (
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {(["total", "won", "lost", "ongoing"] as const).map((k) => (
                <Input key={k} label={k[0].toUpperCase() + k.slice(1)} type="number" min={0} value={String(wl[k])} onChange={(e) => setWl((s) => ({ ...s, [k]: Number(e.target.value) }))} />
              ))}
            </div>
          )}
        </section>

        <div className="flex justify-end">
          <Button type="submit" loading={saving} disabled={!canSave}>Save Changes</Button>
        </div>
      </form>

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
          <div className="absolute inset-0 bg-navy-950/50" onClick={() => setPreview(false)} />
          <div className="relative max-h-full w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-card-lg">
            <div className="mb-3 rounded-lg bg-gold-50 px-3 py-1.5 text-center text-xs font-semibold text-gold-800">You are viewing a preview</div>
            <div className="text-center">
              <div className="flex justify-center"><Avatar name={p.fullLegalName} url={photoPreview} size={88} /></div>
              <h3 className="mt-3 text-xl font-bold text-navy-900">{p.fullLegalName}</h3>
              <p className="text-xs font-semibold text-green-700">Verified by Lawyerly</p>
              <div className="mt-2 flex justify-center"><StarRating value={p.ratingAvg} /></div>
              <p className="text-xs text-navy-400">{p.city}, {p.province}</p>
              <p className="mt-3 text-2xl font-bold text-navy-900">PKR {Number(fee).toLocaleString()}</p>
            </div>
            <p className="mt-4 text-sm text-navy-700">{bio}</p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {areas.map((a) => <span key={a} className="rounded-full bg-gold-50 px-2.5 py-0.5 text-xs font-medium text-gold-800">{a}</span>)}
            </div>
            {showWL && (
              <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                {([["Total", wl.total], ["Won", wl.won], ["Lost", wl.lost], ["Ongoing", wl.ongoing]] as const).map(([l, v]) => (
                  <div key={l} className="rounded-lg bg-navy-50 py-2"><p className="text-lg font-bold text-navy-900">{v}</p><p className="text-xs text-navy-400">{l}</p></div>
                ))}
              </div>
            )}
            <Button variant="outline" fullWidth className="mt-5" onClick={() => setPreview(false)}>Close preview</Button>
          </div>
        </div>
      )}
    </div>
  );
}
