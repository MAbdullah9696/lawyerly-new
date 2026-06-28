"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Input, PasswordInput, Checkbox } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Feedback";
import { api, ApiRequestError, setAccessToken } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { AuthSession } from "@/lib/types";

export default function LoginPage() {
  const router = useRouter();
  const { setSession } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [captchaChecked, setCaptchaChecked] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [notice, setNotice] = useState("");

  // Pick up a one-time notice handed off from another auth screen (e.g. an
  // expired 2FA challenge), then clear it so it doesn't persist on reload.
  useEffect(() => {
    const msg = sessionStorage.getItem("lawyerly_login_msg");
    if (msg) {
      setNotice(msg);
      sessionStorage.removeItem("lawyerly_login_msg");
    }
  }, []);

  // Lockout countdown (§7.3).
  useEffect(() => {
    if (!lockedUntil) return;
    const tick = () => {
      const secs = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
      setRemaining(secs);
      if (secs === 0) setLockedUntil(null);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [lockedUntil]);

  const locked = lockedUntil !== null && remaining > 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (locked) return;
    setError("");
    setNotice("");
    setLoading(true);
    try {
      const res = await api.login({
        email,
        password,
        rememberMe: remember,
        captchaToken: captchaRequired ? (captchaChecked ? "dev-captcha" : "") : undefined,
      });
      if ("twoFactorRequired" in res) {
        sessionStorage.setItem("lawyerly_2fa", res.twoFactorToken);
        sessionStorage.setItem("lawyerly_2fa_ts", Date.now().toString());
        router.push("/login/2fa");
        return;
      }
      const session = res as AuthSession;
      setAccessToken(session.accessToken);
      setSession(session.accessToken, session.user);
      router.replace(session.redirectTo);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        if (err.code === "captcha_required") {
          setCaptchaRequired(true);
          setError("Please complete the verification below and try again.");
        } else if (err.code === "account_locked") {
          setLockedUntil(Date.now() + 15 * 60 * 1000);
        } else {
          setError(err.message);
        }
      } else {
        setError("Unable to log in. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <div className="w-full max-w-md">
      <div className="rounded-2xl border border-navy-100 bg-white p-8 shadow-card">
        <h1 className="text-2xl font-bold text-navy-900">Welcome back</h1>
        <p className="mt-1 text-sm text-navy-500">Log in to your Lawyerly account.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {locked && (
            <Alert variant="warning">
              Too many failed attempts. Your account is locked. Try again in <b>{mm}:{ss}</b>.
            </Alert>
          )}
          {notice && !error && !locked && <Alert variant="info">{notice}</Alert>}
          {error && !locked && <Alert variant="error">{error}</Alert>}

          <Input
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <div>
            <PasswordInput
              label="Password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <div className="mt-2 flex items-center justify-between">
              <Checkbox
                label="Remember me for 30 days"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <Link href="/forgot-password" className="text-sm font-semibold text-navy-600 hover:text-navy-900">
                Forgot password?
              </Link>
            </div>
          </div>

          {captchaRequired && (
            <div className="rounded-lg border border-navy-200 bg-navy-50 p-3">
              <Checkbox
                label="I’m not a robot (CAPTCHA — dev placeholder)"
                checked={captchaChecked}
                onChange={(e) => setCaptchaChecked(e.target.checked)}
              />
            </div>
          )}

          <Button type="submit" fullWidth loading={loading} disabled={locked}>
            Log In
          </Button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-navy-500">
        New to Lawyerly?{" "}
        <Link href="/register" className="font-semibold text-navy-900 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
