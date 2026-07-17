"use client";

import { ArrowClockwise, Warning } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { GarmentMockup } from "./GarmentMockup";
import type { Product } from "@/lib/products";

export type PreviewStageProps = {
  product: Product;
  color: string;
  previewUrl: string | null;
  loading: boolean;
  failed: boolean;
  /** Tries left before the cap; null before the first generation. */
  remaining: number | null;
  onRegenerate: () => void;
};

const CAP = 3;

/**
 * The garment with the portrait composited in, plus regenerate controls and the
 * remaining-tries messaging. Loading uses a skeleton, never a spinner.
 */
export function PreviewStage({
  product,
  color,
  previewUrl,
  loading,
  failed,
  remaining,
  onRegenerate,
}: PreviewStageProps) {
  const atCap = remaining !== null && remaining <= 0;

  return (
    <div className="flex flex-col gap-4">
      <GarmentMockup
        product={product}
        color={color}
        previewUrl={loading ? null : previewUrl}
        loading={loading}
      />

      {failed ? (
        <div className="flex flex-col gap-3 rounded-md border border-line bg-surface p-4">
          <p className="flex items-start gap-2 text-sm font-medium text-signal-error">
            <Warning size={18} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              Something went wrong making that portrait. Please try again.
            </span>
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={onRegenerate}
            disabled={atCap}
            className="w-full sm:w-auto"
          >
            <ArrowClockwise size={18} aria-hidden />
            Try again
          </Button>
        </div>
      ) : previewUrl && !loading ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <p className="text-sm text-muted">
              {/* "of 3" keeps the noun plural at every count: 1 of 3 tries. */}
              {remaining !== null ? `${remaining} of ${CAP} tries left` : null}
            </p>
            {atCap ? (
              <p className="text-sm text-muted">
                You have used every try for this photo. Upload a new photo to
                start fresh.
              </p>
            ) : null}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={onRegenerate}
            disabled={atCap}
            className="w-full sm:w-auto"
          >
            <ArrowClockwise size={18} aria-hidden />
            Regenerate
          </Button>
        </div>
      ) : loading ? (
        <p className="eyebrow text-xs text-muted">Drawing your portrait</p>
      ) : null}
    </div>
  );
}
