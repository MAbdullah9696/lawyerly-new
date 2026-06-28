"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Feedback";
import { api, ApiRequestError, setAccessToken } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function TwoFactorPage() {
  const router = useRouter();
  const { setSession } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [useBackup, setUseBackup] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = sessionStorage.getItem("lawyerly_2fa");
    if (!t) {
      // No challenge in progress — go to login without an alarming message.
      router.replace("/login");
      return;
    }
    // Client-side expiry: the challenge token is only valid for 5 minutes.
    const ts = Number(sessionStorage.getItem("lawyerly_2fa_ts") ?? 0);
    const EXPIRY_MS = 5 * 60 * 1000;
    if (!ts || Date.now() - ts > EXPIRY_MS) {
      sessionStorage.removeItem("lawyerly_2fa");
      sessionStorage.removeItem("lawyerly_2fa_ts");
      sessionStorage.setItem("lawyerly_login_msg", "Your session expired. Please log in again.");
      router.replace("/login");
      return;
    }
    setToken(t);
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError("");
    setLoading(true);
    try {
      const session = await api.loginTwoFactor({
        twoFactorToken: token,
        ...(useBackup ? { backupCode: code } : { code }),
      });
      sessionStorage.removeItem("lawyerly_2fa");
      sessionStorage.removeItem("lawyerly_2fa_ts");
      setAccessToken(session.accessToken);
      setSession(session.accessToken, session.user);
      router.replace(session.redirectTo);
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === "twofa_expired") {
        sessionStorage.removeItem("lawyerly_2fa");
        sessionStorage.removeItem("lawyerly_2fa_ts");
        setError("Your verification session expired. Please log in again.");
      } else if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError("Verification failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="rounded-2xl border border-navy-100 bg-white p-8 shadow-card">
        <h1 className="text-2xl font-bold text-navy-900">Two-factor authentication</h1>
        <p className="mt-1 text-sm text-navy-500">
          {useBackup
            ? "Enter one of your saved backup codes."
            : "Enter the 6-digit code from your authenticator app."}
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {error && <Alert variant="error">{error}</Alert>}
          <Input
            label={useBackup ? "Backup code" : "Authentication code"}
            name="code"
            inputMode={useBackup ? "text" : "numeric"}
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={useBackup ? "XXXXXXXX" : "123456"}
            className="text-center text-lg tracking-[0.3em]"
            required
          />
          <Button type="submit" fullWidth loading={loading}>
            Verify &amp; Continue
          </Button>
        </form>

        <button
          onClick={() => {
            setUseBackup((b) => !b);
            setCode("");
            setError("");
          }}
          className="mt-4 text-sm font-semibold text-navy-600 hover:text-navy-900"
        >
          {useBackup ? "Use authenticator code instead" : "Use a backup code instead"}
        </button>
      </div>
      <p className="mt-6 text-center text-sm text-navy-500">
        <Link href="/login" className="font-semibold text-navy-900 hover:underline">
          ← Back to login
        </Link>
      </p>
    </div>
  );
}
