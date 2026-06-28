"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Feedback";
import { api, ApiRequestError } from "@/lib/api";
import type { AuthSession } from "@/lib/types";

/** Step 2 of citizen registration (§7.1): email OTP with resend countdown. */
export function OtpStep({ email, onVerified }: { email: string; onVerified: (s: AuthSession) => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(60); // resend available after 60s

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const session = await api.verifyEmail({ email, code });
      onVerified(session);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Verification failed.");
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setError("");
    setInfo("");
    try {
      await api.resendOtp({ email });
      setInfo("A new code has been sent to your email.");
      setCooldown(60);
    } catch (err) {
      if (err instanceof ApiRequestError) setError(err.message);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy-900">Verify your email</h1>
      <p className="mt-1 text-sm text-navy-500">
        We sent a 6-digit code to <span className="font-semibold text-navy-800">{email}</span>. It expires in
        10 minutes.
      </p>

      <form onSubmit={verify} className="mt-6 space-y-4">
        {error && <Alert variant="error">{error}</Alert>}
        {info && !error && <Alert variant="success">{info}</Alert>}
        <Input
          label="Verification code"
          name="code"
          inputMode="numeric"
          maxLength={6}
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="123456"
          className="text-center text-2xl tracking-[0.5em]"
          required
        />
        <Button type="submit" fullWidth loading={loading} disabled={code.length !== 6}>
          Verify &amp; Continue
        </Button>
      </form>

      <div className="mt-4 text-center text-sm text-navy-500">
        Didn’t get a code?{" "}
        {cooldown > 0 ? (
          <span className="text-navy-400">Resend in {cooldown}s</span>
        ) : (
          <button onClick={resend} className="font-semibold text-navy-900 hover:underline">
            Resend code
          </button>
        )}
      </div>
    </div>
  );
}
