"use client";

import { useEffect, useState } from "react";
import { usersApi, presignAndUpload } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Alert, Spinner } from "@/components/ui/Feedback";
import { Avatar } from "@/components/user/widgets";
import { PROVINCES } from "@/lib/constants";
import type { FullProfile } from "@/lib/types";

export default function ProfilePage() {
  const { refreshUser } = useAuth();
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [province, setProvince] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    usersApi.me().then(({ profile: p }) => {
      setProfile(p);
      setFullName(p.fullName);
      setPhone(p.phone ?? "");
      setProvince(p.province ?? "");
      if (p.profilePhotoUrl) setPhotoPreview(p.profilePhotoUrl);
    }).finally(() => setLoading(false));
  }, []);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Client-side validation
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
      await usersApi.update({ profilePhotoUrl: objectKey });
      await refreshUser();
    } catch {
      setPhotoError("Photo upload failed. Please try again.");
      setPhotoPreview(profile?.profilePhotoUrl ?? null);
    } finally {
      setUploadingPhoto(false);
    }
    e.target.value = ""; // reset input
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await usersApi.update({ fullName, phone: phone || null, province: province || null });
      await refreshUser();
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner className="h-7 w-7" /></div>;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-navy-900">My Profile</h1>
      <p className="mt-1 text-navy-500">Manage your personal information.</p>

      <form onSubmit={save} className="mt-6 space-y-6 rounded-2xl border border-navy-100 bg-white p-6 shadow-card">
        {saved && <Alert variant="success">Profile updated successfully.</Alert>}

        {/* Profile photo */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar name={fullName || "User"} url={photoPreview} size={72} />
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
            <p className="mt-1 text-xs text-navy-400">JPG or PNG, max 2 MB.</p>
            {photoError && <p className="mt-1 text-xs text-red-600">{photoError}</p>}
          </div>
        </div>

        <Input label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="03XXXXXXXXX" />
        <Select label="Province" options={PROVINCES} value={province} onChange={(e) => setProvince(e.target.value)} placeholder="Select province" />
        <Input label="Email" value={profile?.email ?? ""} disabled hint="Email cannot be changed after registration." />

        <div className="flex justify-end">
          <Button type="submit" loading={saving} disabled={fullName.trim().length < 2}>Save Changes</Button>
        </div>
      </form>
    </div>
  );
}
