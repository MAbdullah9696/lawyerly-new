"use client";

/**
 * Auth state held in React memory (NOT localStorage). On mount we attempt a
 * silent refresh: the BFF reads the httpOnly refresh cookie, rotates it, and
 * returns a fresh access token, which we then use to load the current user.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, setAccessToken } from "./api";
import type { PublicUser, Role } from "./types";

interface AuthContextValue {
  user: PublicUser | null;
  loading: boolean;
  setSession: (accessToken: string, user: PublicUser) => void;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function dashboardPath(user: Pick<PublicUser, "role" | "status">): string {
  switch (user.role) {
    case "citizen":
      return "/user/dashboard";
    case "admin":
      return "/admin/dashboard";
    case "lawyer":
      return user.status === "active" ? "/lawyer/dashboard" : "/lawyer/pending";
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  const setSession = useCallback((accessToken: string, u: PublicUser) => {
    setAccessToken(accessToken);
    setUser(u);
  }, []);

  const refreshUser = useCallback(async () => {
    const { user } = await api.me();
    setUser(user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    setAccessToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { accessToken } = await api.refresh();
        setAccessToken(accessToken);
        const { user } = await api.me();
        if (!cancelled) setUser(user);
      } catch {
        if (!cancelled) {
          setAccessToken(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({ user, loading, setSession, refreshUser, logout }),
    [user, loading, setSession, refreshUser, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export type { Role };
