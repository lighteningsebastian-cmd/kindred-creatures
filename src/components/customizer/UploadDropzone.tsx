"use client";

import { useRef, useState, type DragEvent } from "react";
import { UploadSimple, Warning } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";

export type UploadDropzoneProps = {
  /** Object URL of the currently chosen photo, if any. */
  photoPreview: string | null;
  /** True while the upload/moderation request is in flight. */
  busy: boolean;
  /** Friendly moderation-reject reason to show inline, if any. */
  rejectReason: string | null;
  /** True before a colour and size are chosen: the zone reads quiet and inert. */
  disabled?: boolean;
  onFile: (file: File) => void;
};

const ACCEPT = "image/jpeg,image/png,image/webp,image/heic";

/**
 * Drag-and-drop plus file-picker for the pet photo. Presentational: it surfaces
 * the chosen photo and any moderation message, and hands the raw File up to the
 * Customizer, which downscales, uploads and moderates.
 */
export function UploadDropzone({
  photoPreview,
  busy,
  rejectReason,
  disabled = false,
  onFile,
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const pick = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />

      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Upload a photo of your pet"
        aria-busy={busy}
        aria-disabled={disabled}
        onClick={pick}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            pick();
          }
        }}
        onDragOver={(e) => {
          if (disabled) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "relative flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-6 text-center transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base",
          disabled
            ? "cursor-not-allowed border-line bg-surface opacity-60"
            : "cursor-pointer",
          !disabled && dragging
            ? "border-accent bg-accent-tint"
            : !disabled && "border-line-strong bg-surface",
        )}
      >
        {photoPreview ? (
          <>
            {/* Chosen photo preview; object URL from the browser. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoPreview}
              alt="The photo you chose"
              className={cn(
                "max-h-[240px] w-auto rounded-md object-contain transition-opacity",
                busy && "opacity-60",
              )}
            />
            {busy ? (
              <p className="eyebrow text-xs text-muted">Checking your photo</p>
            ) : rejectReason ? (
              <p className="text-sm text-muted">
                Click to choose a different photo.
              </p>
            ) : (
              <p className="text-sm text-muted">
                Looks good. Click to choose a different photo.
              </p>
            )}
          </>
        ) : (
          <>
            <UploadSimple size={32} className="text-accent" aria-hidden />
            <p className="font-display text-xl text-ink">
              Upload the photo that captures them best
            </p>
            <p className="max-w-sm text-sm text-muted">
              Drag it here or click to browse. A clear, well-lit photo makes the
              best portrait. JPEG, PNG, WebP or HEIC, up to 10MB.
            </p>
          </>
        )}
      </div>

      {rejectReason ? (
        <p
          role="alert"
          className="flex items-start gap-2 text-sm font-medium text-signal-error"
        >
          <Warning size={18} className="mt-0.5 shrink-0" aria-hidden />
          <span>{rejectReason}</span>
        </p>
      ) : null}
    </div>
  );
}
