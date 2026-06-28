"use client";

import clsx from "clsx";
import { useState } from "react";

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-sm text-red-600">{message}</p>;
}

export function FieldOk({ show }: { show?: boolean }) {
  if (!show) return null;
  return (
    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-green-600">
      <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor">
        <path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 10a1 1 0 1 1 1.4-1.4l3.1 3.1 6.8-6.8a1 1 0 0 1 1.4 0Z" clipRule="evenodd" />
      </svg>
    </span>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  valid?: boolean;
  hint?: string;
}

export function Input({ label, error, valid, hint, className, id, ...rest }: InputProps) {
  const inputId = id || rest.name;
  return (
    <div>
      {label && (
        <label htmlFor={inputId} className="field-label">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={inputId}
          className={clsx("field-input", error && "field-input-error", valid && "pr-10", className)}
          {...rest}
        />
        <FieldOk show={valid && !error} />
      </div>
      {hint && !error && <p className="mt-1.5 text-xs text-navy-400">{hint}</p>}
      <FieldError message={error} />
    </div>
  );
}

export function PasswordInput({ label, error, hint, ...rest }: InputProps) {
  const [show, setShow] = useState(false);
  const inputId = rest.id || rest.name;
  return (
    <div>
      {label && (
        <label htmlFor={inputId} className="field-label">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={inputId}
          type={show ? "text" : "password"}
          className={clsx("field-input pr-12", error && "field-input-error")}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-navy-500 hover:text-navy-800"
          tabIndex={-1}
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
      {hint && !error && <p className="mt-1.5 text-xs text-navy-400">{hint}</p>}
      <FieldError message={error} />
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: readonly string[];
  placeholder?: string;
}

export function Select({ label, error, options, placeholder, className, ...rest }: SelectProps) {
  const id = rest.id || rest.name;
  return (
    <div>
      {label && (
        <label htmlFor={id} className="field-label">
          {label}
        </label>
      )}
      <select
        id={id}
        className={clsx("field-input appearance-none bg-white", error && "field-input-error", className)}
        {...rest}
      >
        <option value="" disabled>
          {placeholder ?? "Select…"}
        </option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <FieldError message={error} />
    </div>
  );
}

export function Textarea({
  label,
  error,
  maxLength,
  value,
  className,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string }) {
  const id = rest.id || rest.name;
  const count = typeof value === "string" ? value.length : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        {label && (
          <label htmlFor={id} className="field-label">
            {label}
          </label>
        )}
        {maxLength && (
          <span className={clsx("text-xs", count > maxLength ? "text-red-600" : "text-navy-400")}>
            {count}
            {maxLength ? `/${maxLength}` : ""}
          </span>
        )}
      </div>
      <textarea
        id={id}
        value={value}
        maxLength={maxLength}
        className={clsx("field-input min-h-[120px] resize-y", error && "field-input-error", className)}
        {...rest}
      />
      <FieldError message={error} />
    </div>
  );
}

export function Checkbox({
  label,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-sm text-navy-700">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-navy-300 text-navy-900 focus:ring-navy-400"
        {...rest}
      />
      <span>{label}</span>
    </label>
  );
}

/** Pill-style multi-select used for practice areas / languages. */
export function MultiSelect({
  label,
  options,
  selected,
  onToggle,
  error,
}: {
  label: string;
  options: readonly string[];
  selected: string[];
  onToggle: (value: string) => void;
  error?: string;
}) {
  return (
    <div>
      <span className="field-label">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = selected.includes(o);
          return (
            <button
              key={o}
              type="button"
              onClick={() => onToggle(o)}
              className={clsx(
                "rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
                active
                  ? "border-navy-900 bg-navy-900 text-white"
                  : "border-navy-200 bg-white text-navy-600 hover:border-navy-400",
              )}
            >
              {o}
            </button>
          );
        })}
      </div>
      <FieldError message={error} />
    </div>
  );
}
