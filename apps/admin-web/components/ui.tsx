"use client";

import clsx from "clsx";

export function Spinner({ className }: { className?: string }) {
  return <span className={clsx("inline-block h-5 w-5 animate-spin rounded-full border-2 border-navy-300 border-t-navy-900", className)} />;
}

export function Alert({ variant = "error", children }: { variant?: "error" | "success" | "info" | "warning"; children: React.ReactNode }) {
  const styles = {
    error: "border-red-200 bg-red-50 text-red-700",
    success: "border-green-200 bg-green-50 text-green-700",
    info: "border-navy-200 bg-navy-50 text-navy-700",
    warning: "border-gold-200 bg-gold-50 text-gold-800",
  }[variant];
  return <div className={clsx("rounded-lg border px-3 py-2 text-sm", styles)}>{children}</div>;
}

export function Field({ label, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <div>
      {label && <label className="label">{label}</label>}
      <input className="field" {...rest} />
    </div>
  );
}

export function Select({ label, options, placeholder, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; options: { value: string; label: string }[]; placeholder?: string }) {
  return (
    <div>
      {label && <label className="label">{label}</label>}
      <select className="field" {...rest}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export function Textarea({ label, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <div>
      {label && <label className="label">{label}</label>}
      <textarea className="field min-h-[90px] resize-y" {...rest} />
    </div>
  );
}

export function Modal({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-950/50" onClick={onClose} />
      <div className={clsx("relative max-h-[90vh] w-full overflow-y-auto rounded-xl bg-white p-6 shadow-card", wide ? "max-w-3xl" : "max-w-md")}>
        <h3 className="mb-4 text-lg font-bold text-navy-900">{title}</h3>
        {children}
      </div>
    </div>
  );
}

export function Chip({ tone, children }: { tone: "green" | "red" | "gold" | "navy" | "gray"; children: React.ReactNode }) {
  const styles = {
    green: "bg-green-50 text-green-700", red: "bg-red-50 text-red-700", gold: "bg-gold-50 text-gold-800",
    navy: "bg-navy-900 text-white", gray: "bg-navy-50 text-navy-600",
  }[tone];
  return <span className={clsx("chip", styles)}>{children}</span>;
}

export function StatTone(status: string): "green" | "red" | "gold" | "gray" {
  if (["active", "verified", "resolved", "paid"].includes(status)) return "green";
  if (["banned", "rejected", "issue_found", "high"].includes(status)) return "red";
  if (["pending", "suspended", "open", "submitted", "medium"].includes(status)) return "gold";
  return "gray";
}
