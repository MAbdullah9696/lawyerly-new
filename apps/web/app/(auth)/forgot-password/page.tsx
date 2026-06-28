"use client";

import Link from "next/link";
import { useState } from "react";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Feedback";
import { api } from "@/lib/api";
import { isValidEmail } from "@/lib/validation";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.forgotPassword({ email });
    } catch {
      /* response is intentionally generic — ignore errors (anti-enumeration) */
    } finally {
      setLoading(false);
      setSent(true);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="rounded-2xl border border-navy-100 bg-white p-8 shadow-card">
        <h1 className="text-2xl font-bold text-navy-900">Reset your password</h1>
        <p className="mt-1 text-sm text-navy-500">
          Enter your email and we’ll send you a secure reset link.
        </p>

        {sent ? (
          <div className="mt-6 space-y-4">
            <Alert variant="success">
              If this email is registered, you will receive a reset link shortly. The link is valid for 15
              minutes.
            </Alert>
            <Link href="/login" className="btn-outline w-full">
              Return to login
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <Input
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button type="submit" fullWidth loading={loading} disabled={!isValidEmail(email)}>
              Send reset link
            </Button>
          </form>
        )}
      </div>
      <p className="mt-6 text-center text-sm text-navy-500">
        <Link href="/login" className="font-semibold text-navy-900 hover:underline">
          ← Back to login
        </Link>
      </p>
    </div>
  );
}
