"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input, PasswordInput, Checkbox } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Alert, PasswordMeter, StepProgress } from "@/components/ui/Feedback";
import { OtpStep } from "./OtpStep";
import { api, ApiRequestError, setAccessToken } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { isValidEmail, scorePassword } from "@/lib/validation";
import type { AuthSession } from "@/lib/types";

export function CitizenRegister({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const { setSession } = useAuth();

  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    agreeTerms: false,
  });
  const [emailError, setEmailError] = useState("");
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  const strength = scorePassword(form.password);
  const emailLooksValid = isValidEmail(form.email);
  const confirmMatch = form.confirmPassword.length > 0 && form.password === form.confirmPassword;
  const canSubmit =
    form.fullName.trim().length >= 2 &&
    emailLooksValid &&
    strength.valid &&
    confirmMatch &&
    form.agreeTerms;

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    if (k === "email") setEmailError("");
  }

  async function submitStep1(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setEmailError("");
    setLoading(true);
    try {
      await api.registerUser({
        fullName: form.fullName,
        email: form.email,
        phone: form.phone || undefined,
        password: form.password,
        confirmPassword: form.confirmPassword,
        agreeTerms: form.agreeTerms,
      });
      setStep(2);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        if (err.code === "email_taken") setEmailError("This email is already registered.");
        else if (err.fields?.email) setEmailError(err.fields.email[0]);
        else setFormError(err.message);
      } else {
        setFormError("Could not create your account. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  function onVerified(session: AuthSession) {
    setAccessToken(session.accessToken);
    setSession(session.accessToken, session.user);
    router.replace(session.redirectTo);
  }

  return (
    <div className="w-full max-w-md">
      <div className="rounded-2xl border border-navy-100 bg-white p-8 shadow-card">
        <StepProgress step={step} total={2} labels={["Basic Info", "Verify Email"]} />

        {step === 1 ? (
          <>
            <h1 className="text-2xl font-bold text-navy-900">Create your account</h1>
            <p className="mt-1 text-sm text-navy-500">Join as a citizen to get legal guidance.</p>

            <form onSubmit={submitStep1} className="mt-6 space-y-4">
              {formError && <Alert variant="error">{formError}</Alert>}
              <Input
                label="Full name"
                name="fullName"
                value={form.fullName}
                onChange={(e) => set("fullName", e.target.value)}
                required
              />
              <Input
                label="Email"
                name="email"
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                valid={emailLooksValid && !emailError}
                error={
                  emailError ||
                  (form.email.length > 0 && !emailLooksValid ? "Enter a valid email address." : undefined)
                }
                required
              />
              <Input
                label="Phone (optional)"
                name="phone"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="03XXXXXXXXX"
              />
              <div>
                <PasswordInput
                  label="Password"
                  name="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  required
                />
                {form.password.length > 0 && <PasswordMeter strength={strength} />}
              </div>
              <PasswordInput
                label="Confirm password"
                name="confirmPassword"
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={(e) => set("confirmPassword", e.target.value)}
                error={
                  form.confirmPassword.length > 0 && !confirmMatch ? "Passwords do not match." : undefined
                }
                required
              />
              <Checkbox
                checked={form.agreeTerms}
                onChange={(e) => set("agreeTerms", e.target.checked)}
                label={
                  <>
                    I agree to the{" "}
                    <Link href="/terms" target="_blank" className="font-semibold text-navy-900 hover:underline">
                      Terms
                    </Link>{" "}
                    and{" "}
                    <Link href="/privacy" target="_blank" className="font-semibold text-navy-900 hover:underline">
                      Privacy Policy
                    </Link>
                    .
                  </>
                }
              />
              <Button type="submit" fullWidth loading={loading} disabled={!canSubmit}>
                Create Account
              </Button>
            </form>

            <button onClick={onBack} className="mt-4 text-sm font-medium text-navy-500 hover:text-navy-900">
              ← Choose a different role
            </button>
          </>
        ) : (
          <OtpStep email={form.email} onVerified={onVerified} />
        )}
      </div>

      <p className="mt-6 text-center text-sm text-navy-500">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-navy-900 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
