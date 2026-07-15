"use client";

import { useId, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type InputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "id"
> & {
  label: string;
  /** Optional guidance shown below the field (hidden while an error is shown). */
  helperText?: string;
  /** Error message shown below the field; announced via role="alert". */
  error?: string;
  id?: string;
};

export function Input({
  label,
  helperText,
  error,
  id,
  className,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const helperId = `${inputId}-helper`;
  const errorId = `${inputId}-error`;

  const describedBy =
    [error ? errorId : null, helperText && !error ? helperId : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "w-full rounded-[10px] border bg-base px-3 py-2 text-base text-ink",
          "placeholder:text-muted focus-visible:outline-none focus-visible:ring-2",
          "focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base",
          error ? "border-btn" : "border-line",
          className,
        )}
        {...props}
      />
      {helperText && !error ? (
        <p id={helperId} className="text-sm text-muted">
          {helperText}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-sm font-medium text-btn">
          {error}
        </p>
      ) : null}
    </div>
  );
}
