"use client";

import Link from "next/link";
import { use, useState } from "react";
import { PasswordInput } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Alert, PasswordMeter } from "@/components/ui/Feedback";
import { api, ApiRequestError } from "@/lib/api";
import { scorePassword } from "@/lib/validation";

export default function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const strength = scorePassword(pw);
  const match = confirm.length > 0 && pw === confirm;
  const canSubmit = strength.valid && match;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.resetPassword({ token, newPassword: pw, confirmPassword: confirm });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not reset password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="rounded-2xl border border-navy-100 bg-white p-8 shadow-card">
        <h1 className="text-2xl font-bold text-navy-900">Set a new password</h1>
        <p className="mt-1 text-sm text-navy-500">Choose a strong password you haven’t used before.</p>

        {done ? (
          <div className="mt-6 space-y-4">
            <Alert variant="success">Password changed successfully. Please log in.</Alert>
            <Link href="/login" className="btn-primary w-full">
              Go to login
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            {error && <Alert variant="error">{error}</Alert>}
            <div>
              <PasswordInput
                label="New password"
                name="newPassword"
                autoComplete="new-password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                required
              />
              {pw.length > 0 && <PasswordMeter strength={strength} />}
            </div>
            <PasswordInput
              label="Confirm new password"
              name="confirmPassword"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              error={confirm.length > 0 && !match ? "Passwords do not match." : undefined}
              required
            />
            <Button type="submit" fullWidth loading={loading} disabled={!canSubmit}>
              Reset password
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
