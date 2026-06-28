"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { adminApi, type AdminProfile } from "./api";

interface Ctx {
  admin: AdminProfile | null;
  loading: boolean;
  setAdmin: (a: AdminProfile) => void;
  logout: () => Promise<void>;
}

const AdminContext = createContext<Ctx | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [admin, setAdminState] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const setAdmin = useCallback((a: AdminProfile) => setAdminState(a), []);
  const logout = useCallback(async () => {
    try { await adminApi.logout(); } catch { /* ignore */ }
    setAdminState(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    adminApi.me()
      .then((a) => { if (!cancelled) setAdminState(a); })
      .catch(() => { if (!cancelled) setAdminState(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const value = useMemo(() => ({ admin, loading, setAdmin, logout }), [admin, loading, setAdmin, logout]);
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin(): Ctx {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used within AdminProvider");
  return ctx;
}

export const can = {
  write: (role?: string) => role === "super_admin" || role === "moderator",
  super: (role?: string) => role === "super_admin",
};
