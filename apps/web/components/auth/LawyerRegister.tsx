"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input, PasswordInput, Select, Textarea, MultiSelect, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Alert, PasswordMeter, StepProgress } from "@/components/ui/Feedback";
import { api, ApiRequestError, presignAndUpload, setAccessToken } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatCnic, isValidCnic, isValidEmail, scorePassword } from "@/lib/validation";
import { PROVINCES, PRACTICE_AREAS, LANGUAGES, EXPERIENCE_BANDS, LAWYER_DOCS, type LawyerDocKey } from "@/lib/constants";

type Files = Partial<Record<LawyerDocKey, File>>;

function validateFile(key: LawyerDocKey, file: File): string | null {
  const spec = LAWYER_DOCS.find((d) => d.key === key)!;
  const ext = "." + file.name.split(".").pop()?.toLowerCase();
  if (!spec.accept.split(",").includes(ext)) return `Allowed types: ${spec.accept}`;
  if (file.size > spec.maxMB * 1024 * 1024) return `Max size is ${spec.maxMB}MB`;
  return null;
}

export function LawyerRegister({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const { setSession } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [formError, setFormError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [loading, setLoading] = useState(false);

  const [f, setF] = useState({
    fullLegalName: "",
    cnic: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    barCouncilNumber: "",
    province: "",
    city: "",
    yearsExperienceBand: "",
    consultationFeePkr: "",
    bio: "",
  });
  const [practiceAreas, setPracticeAreas] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [files, setFiles] = useState<Files>({});
  const [fileErrors, setFileErrors] = useState<Partial<Record<LawyerDocKey, string>>>({});
  const [uploading, setUploading] = useState<Partial<Record<LawyerDocKey, boolean>>>({});
  const [uploadProgress, setUploadProgress] = useState("");

  const strength = scorePassword(f.password);
  const confirmMatch = f.confirmPassword.length > 0 && f.password === f.confirmPassword;

  function set<K extends keyof typeof f>(k: K, v: string) {
    setF((p) => ({ ...p, [k]: v }));
    if (k === "email") setEmailError("");
  }
  function toggle(list: string[], setList: (v: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  }

  const step1Valid =
    f.fullLegalName.trim().length >= 2 &&
    isValidCnic(f.cnic) &&
    isValidEmail(f.email) &&
    f.phone.trim().length >= 7 &&
    strength.valid &&
    confirmMatch;
  const step2Valid =
    f.barCouncilNumber.trim().length >= 2 &&
    !!f.province &&
    f.city.trim().length >= 2 &&
    !!f.yearsExperienceBand &&
    practiceAreas.length >= 1 &&
    languages.length >= 1 &&
    Number(f.consultationFeePkr) >= 0 &&
    f.consultationFeePkr !== "" &&
    f.bio.trim().length >= 200;
  const step3Valid =
    LAWYER_DOCS.every((d) => files[d.key]) && Object.keys(fileErrors).every((k) => !fileErrors[k as LawyerDocKey]);

  function onFile(key: LawyerDocKey, file?: File) {
    if (!file) return;
    const err = validateFile(key, file);
    setFileErrors((e) => ({ ...e, [key]: err ?? undefined }));
    if (!err) setFiles((p) => ({ ...p, [key]: file }));
    else setFiles((p) => ({ ...p, [key]: undefined }));
  }

  async function submit() {
    setFormError("");
    setLoading(true);
    try {
      // Upload all 5 documents to MinIO in parallel, then register with core-api
      setUploadProgress("Uploading documents… (1/5)");
      const uploadedDocs = await Promise.all(
        LAWYER_DOCS.map(async (d, i) => {
          setUploading((prev) => ({ ...prev, [d.key]: true }));
          try {
            const objectKey = await presignAndUpload(files[d.key]!, "lawyer-doc");
            setUploadProgress(`Uploading documents… (${i + 2}/5)`);
            return { docType: d.key, fileUrl: objectKey };
          } catch {
            throw new Error(`Failed to upload ${d.label}. Please try again.`);
          } finally {
            setUploading((prev) => ({ ...prev, [d.key]: false }));
          }
        }),
      );
      setUploadProgress("Submitting application…");
      const session = await api.registerLawyer({
        fullLegalName: f.fullLegalName,
        cnic: f.cnic,
        email: f.email,
        phone: f.phone,
        password: f.password,
        confirmPassword: f.confirmPassword,
        barCouncilNumber: f.barCouncilNumber,
        province: f.province,
        city: f.city,
        yearsExperienceBand: f.yearsExperienceBand,
        practiceAreas,
        languages,
        consultationFeePkr: Number(f.consultationFeePkr),
        bio: f.bio,
        documents: uploadedDocs,
      });
      setAccessToken(session.accessToken);
      setSession(session.accessToken, session.user);
      router.replace(session.redirectTo);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        if (err.code === "email_taken") {
          setEmailError("This email is already registered.");
          setStep(1);
        } else {
          setFormError(err.message);
        }
      } else {
        setFormError(err instanceof Error ? err.message : "Could not submit your application. Please try again.");
      }
    } finally {
      setLoading(false);
      setUploadProgress("");
    }
  }

  return (
    <div className="w-full max-w-2xl">
      <div className="rounded-2xl border border-navy-100 bg-white p-8 shadow-card">
        <StepProgress step={step} total={3} labels={["Account Info", "Professional Details", "Documents"]} />
        {formError && <div className="mb-4"><Alert variant="error">{formError}</Alert></div>}

        {step === 1 && (
          <>
            <h1 className="text-2xl font-bold text-navy-900">Lawyer account</h1>
            <p className="mt-1 text-sm text-navy-500">Tell us who you are. This must match your legal documents.</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Input label="Full legal name" value={f.fullLegalName} onChange={(e) => set("fullLegalName", e.target.value)} required />
              </div>
              <Input
                label="CNIC"
                value={f.cnic}
                onChange={(e) => set("cnic", formatCnic(e.target.value))}
                placeholder="XXXXX-XXXXXXX-X"
                valid={isValidCnic(f.cnic)}
                error={f.cnic.length > 0 && !isValidCnic(f.cnic) ? "Format: XXXXX-XXXXXXX-X" : undefined}
                required
              />
              <Input label="Phone" value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="03XXXXXXXXX" required />
              <div className="sm:col-span-2">
                <Input
                  label="Email"
                  type="email"
                  value={f.email}
                  onChange={(e) => set("email", e.target.value)}
                  valid={isValidEmail(f.email) && !emailError}
                  error={emailError || (f.email.length > 0 && !isValidEmail(f.email) ? "Enter a valid email." : undefined)}
                  required
                />
              </div>
              <div>
                <PasswordInput label="Password" autoComplete="new-password" value={f.password} onChange={(e) => set("password", e.target.value)} required />
                {f.password.length > 0 && <PasswordMeter strength={strength} />}
              </div>
              <PasswordInput
                label="Confirm password"
                autoComplete="new-password"
                value={f.confirmPassword}
                onChange={(e) => set("confirmPassword", e.target.value)}
                error={f.confirmPassword.length > 0 && !confirmMatch ? "Passwords do not match." : undefined}
                required
              />
            </div>
            <div className="mt-6 flex items-center justify-between">
              <button onClick={onBack} className="text-sm font-medium text-navy-500 hover:text-navy-900">← Change role</button>
              <Button onClick={() => setStep(2)} disabled={!step1Valid}>Continue</Button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="text-2xl font-bold text-navy-900">Professional details</h1>
            <p className="mt-1 text-sm text-navy-500">This information appears on your public profile after verification.</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Input label="Bar Council enrollment number" value={f.barCouncilNumber} onChange={(e) => set("barCouncilNumber", e.target.value)} required />
              <Select label="Province" options={PROVINCES} value={f.province} onChange={(e) => set("province", e.target.value)} placeholder="Select province" />
              <Input label="City" value={f.city} onChange={(e) => set("city", e.target.value)} required />
              <Select label="Years of experience" options={EXPERIENCE_BANDS} value={f.yearsExperienceBand} onChange={(e) => set("yearsExperienceBand", e.target.value)} placeholder="Select band" />
              <div className="sm:col-span-2">
                <MultiSelect label="Practice areas" options={PRACTICE_AREAS} selected={practiceAreas} onToggle={(v) => toggle(practiceAreas, setPracticeAreas, v)} error={practiceAreas.length === 0 ? undefined : undefined} />
              </div>
              <div className="sm:col-span-2">
                <MultiSelect label="Languages" options={LANGUAGES} selected={languages} onToggle={(v) => toggle(languages, setLanguages, v)} />
              </div>
              <Input label="Consultation fee (PKR)" type="number" min={0} value={f.consultationFeePkr} onChange={(e) => set("consultationFeePkr", e.target.value)} required />
              <div className="sm:col-span-2">
                <Textarea
                  label="Professional bio"
                  value={f.bio}
                  onChange={(e) => set("bio", e.target.value)}
                  maxLength={2000}
                  placeholder="Describe your experience, practice focus, and approach (minimum 200 characters)…"
                />
                {f.bio.length > 0 && f.bio.trim().length < 200 && (
                  <FieldError message={`${200 - f.bio.trim().length} more characters needed.`} />
                )}
              </div>
            </div>
            <div className="mt-6 flex items-center justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>← Back</Button>
              <Button onClick={() => setStep(3)} disabled={!step2Valid}>Continue</Button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="text-2xl font-bold text-navy-900">Upload documents</h1>
            <p className="mt-1 text-sm text-navy-500">All five documents are required. We verify your application within 48 hours.</p>
            <div className="mt-6 space-y-3">
              {LAWYER_DOCS.map((d) => {
                const file = files[d.key];
                const err = fileErrors[d.key];
                return (
                  <div key={d.key} className="rounded-xl border border-navy-100 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-navy-900">{d.label}</p>
                        <p className="text-xs text-navy-400">{d.accept.replace(/\./g, "").toUpperCase()} · max {d.maxMB}MB</p>
                      </div>
                      <label className="btn-outline cursor-pointer text-xs">
                        {file ? "Replace" : "Choose file"}
                        <input
                          type="file"
                          accept={d.accept}
                          className="hidden"
                          onChange={(e) => onFile(d.key, e.target.files?.[0])}
                        />
                      </label>
                    </div>
                    {file && !err && (
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-green-600">
                        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor"><path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 10a1 1 0 1 1 1.4-1.4l3.1 3.1 6.8-6.8a1 1 0 0 1 1.4 0Z" clipRule="evenodd" /></svg>
                        {file.name} ({(file.size / 1024 / 1024).toFixed(2)}MB)
                      </p>
                    )}
                    <FieldError message={err} />
                  </div>
                );
              })}
            </div>
            {uploadProgress && (
              <div className="mt-3 rounded-lg bg-navy-50 px-4 py-2 text-sm text-navy-700">
                {uploadProgress}
              </div>
            )}
            <div className="mt-6 flex items-center justify-between">
              <Button variant="outline" onClick={() => setStep(2)} disabled={loading}>← Back</Button>
              <Button onClick={submit} loading={loading} disabled={!step3Valid || loading}>Submit Application</Button>
            </div>
          </>
        )}
      </div>

      <p className="mt-6 text-center text-sm text-navy-500">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-navy-900 hover:underline">Log in</Link>
      </p>
    </div>
  );
}
