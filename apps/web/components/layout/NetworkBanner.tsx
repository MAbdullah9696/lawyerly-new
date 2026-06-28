"use client";
import { useEffect, useState } from "react";

export function NetworkBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    if (!navigator.onLine) setOffline(true);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="alert"
      className="fixed top-0 inset-x-0 z-[150] bg-red-600 py-2 text-center text-sm font-semibold text-white"
    >
      You are offline — check your internet connection.
    </div>
  );
}
