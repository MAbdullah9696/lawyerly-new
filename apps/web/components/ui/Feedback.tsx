import clsx from "clsx";
import type { PasswordStrength } from "@/lib/validation";

export function Alert({
  variant = "error",
  children,
}: {
  variant?: "error" | "success" | "info" | "warning";
  children: React.ReactNode;
}) {
  const styles = {
    error: "border-red-200 bg-red-50 text-red-700",
    success: "border-green-200 bg-green-50 text-green-700",
    info: "border-navy-200 bg-navy-50 text-navy-700",
    warning: "border-gold-200 bg-gold-50 text-gold-800",
  }[variant];
  return (
    <div className={clsx("rounded-lg border px-4 py-3 text-sm", styles)} role="alert">
      {children}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={clsx(
        "inline-block h-5 w-5 animate-spin rounded-full border-2 border-navy-300 border-t-navy-900",
        className,
      )}
    />
  );
}

/** "Step X of Y" indicator with a progress bar (multi-step auth forms, §7). */
export function StepProgress({ step, total, labels }: { step: number; total: number; labels?: string[] }) {
  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center justify-between text-xs font-medium text-navy-500">
        <span>
          Step {step} of {total}
          {labels?.[step - 1] ? ` — ${labels[step - 1]}` : ""}
        </span>
        <span>{Math.round((step / total) * 100)}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-navy-100">
        <div
          className="h-full rounded-full bg-gold-500 transition-all duration-300"
          style={{ width: `${(step / total) * 100}%` }}
        />
      </div>
    </div>
  );
}

export function PasswordMeter({ strength }: { strength: PasswordStrength }) {
  const color =
    strength.label === "Strong"
      ? "bg-green-500"
      : strength.label === "Fair"
        ? "bg-gold-500"
        : "bg-red-400";
  const textColor =
    strength.label === "Strong"
      ? "text-green-600"
      : strength.label === "Fair"
        ? "text-gold-700"
        : "text-red-600";
  return (
    <div className="mt-2">
      <div className="flex gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={clsx("h-1.5 flex-1 rounded-full", i < strength.score ? color : "bg-navy-100")}
          />
        ))}
      </div>
      <div className="mt-1.5 flex items-center justify-between text-xs">
        <span className={clsx("font-semibold", textColor)}>{strength.label}</span>
        <span className="text-navy-400">8+ chars · uppercase · digit · symbol</span>
      </div>
    </div>
  );
}
