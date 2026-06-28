import clsx from "clsx";

export function StarRating({ value, size = "sm" }: { value: number; size?: "sm" | "lg" }) {
  const full = Math.round(value);
  const px = size === "lg" ? "h-5 w-5" : "h-4 w-4";
  return (
    <span className="inline-flex items-center gap-1">
      <span className="flex">
        {[1, 2, 3, 4, 5].map((i) => (
          <svg key={i} viewBox="0 0 20 20" className={clsx(px, i <= full ? "text-gold-500" : "text-navy-200")} fill="currentColor">
            <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 15l-5.2 2.6 1-5.8L1.5 7.7l5.9-.9L10 1.5z" />
          </svg>
        ))}
      </span>
      <span className={clsx("font-semibold text-navy-800", size === "lg" ? "text-base" : "text-sm")}>
        {value.toFixed(1)}
      </span>
    </span>
  );
}

const AVAIL: Record<string, { dot: string; label: string }> = {
  online: { dot: "bg-green-500", label: "Online" },
  busy: { dot: "bg-amber-500", label: "Busy" },
  offline: { dot: "bg-navy-300", label: "Offline" },
};

export function AvailabilityDot({ status }: { status: string }) {
  const a = AVAIL[status] ?? AVAIL.offline;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-navy-500">
      <span className={clsx("h-2 w-2 rounded-full", a.dot)} />
      {a.label}
    </span>
  );
}

export function Avatar({ name, url, size = 40 }: { name: string; url?: string | null; size?: number }) {
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span
      className="flex items-center justify-center rounded-full bg-navy-900 font-serif font-semibold text-gold-400"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials}
    </span>
  );
}

export function timeAgo(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}
