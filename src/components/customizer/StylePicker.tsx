"use client";

import { cn } from "@/lib/cn";
import { ART_STYLES, ART_STYLE_LABELS, type ArtStyle } from "@/lib/images/provider";

export type StylePickerProps = {
  value: ArtStyle | null;
  onSelect: (style: ArtStyle) => void;
  disabled?: boolean;
};

const BLURB: Record<ArtStyle, string> = {
  "classic-portrait": "Warm, painterly, framed like a keepsake.",
  "line-sketch": "Clean single-line ink, quiet and modern.",
  watercolor: "Soft washes with a hand-painted feel.",
};

// Tiny decorative sample per style (a paw in the style's accent over a wash).
const SAMPLE: Record<ArtStyle, { bg: string; accent: string }> = {
  "classic-portrait": { bg: "#efe9df", accent: "#7c2f2f" },
  "line-sketch": { bg: "#f3efe7", accent: "#3a332b" },
  watercolor: { bg: "#ece7dd", accent: "#a97f4d" },
};

function SampleGlyph({ style }: { style: ArtStyle }) {
  const { bg, accent } = SAMPLE[style];
  return (
    <svg
      viewBox="0 0 64 64"
      className="h-12 w-12 rounded-sm"
      role="img"
      aria-hidden
    >
      <rect width="64" height="64" fill={bg} />
      <g fill={accent}>
        <ellipse cx="32" cy="40" rx="12" ry="10" />
        <circle cx="20" cy="26" r="4.5" />
        <circle cx="27" cy="20" r="4.5" />
        <circle cx="37" cy="20" r="4.5" />
        <circle cx="44" cy="26" r="4.5" />
      </g>
    </svg>
  );
}

/**
 * Three near-square style cards. Picking one triggers generation upstream.
 */
export function StylePicker({ value, onSelect, disabled }: StylePickerProps) {
  return (
    <div>
      <p className="eyebrow mb-3 text-xs text-muted">Choose a style</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {ART_STYLES.map((style) => {
          const selected = style === value;
          return (
            <button
              key={style}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              onClick={() => onSelect(style)}
              className={cn(
                "flex flex-col items-start gap-3 rounded-md border p-4 text-left transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base",
                "disabled:cursor-not-allowed disabled:opacity-60",
                selected
                  ? "border-accent bg-accent-tint"
                  : "border-line bg-surface hover:border-line-strong",
              )}
            >
              <SampleGlyph style={style} />
              <span className="font-display text-lg text-ink">
                {ART_STYLE_LABELS[style]}
              </span>
              <span className="text-sm text-muted">{BLURB[style]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
