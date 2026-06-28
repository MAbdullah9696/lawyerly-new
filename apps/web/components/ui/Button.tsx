import clsx from "clsx";
import Link from "next/link";

type Variant = "primary" | "gold" | "outline";

const variantClass: Record<Variant, string> = {
  primary: "btn-primary",
  gold: "btn-gold",
  outline: "btn-outline",
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  fullWidth?: boolean;
}

export function Button({
  variant = "primary",
  loading,
  fullWidth,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={clsx(variantClass[variant], fullWidth && "w-full", className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant = "primary",
  fullWidth,
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  fullWidth?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={clsx(variantClass[variant], fullWidth && "w-full", className)}>
      {children}
    </Link>
  );
}
