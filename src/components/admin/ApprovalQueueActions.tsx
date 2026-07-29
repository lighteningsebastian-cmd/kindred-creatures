"use client";

import { useState, useTransition } from "react";

type Result = { ok: boolean; message: string };

/**
 * The two things the owner can do to a waiting portrait.
 *
 * Releasing to print is the consequential one, so it confirms first: it sets
 * the same timestamp the customer's own approval sets, and a job sheet is a
 * garment we have committed to making.
 *
 * "Regenerate" is deliberately absent. Drawing again needs the generation path
 * that moves after payment in build step 7, and a button that appears to work
 * and does not is worse than one that is not there yet.
 */
export function ApprovalQueueActions({
  artworkId,
  alreadyMarked,
  onRelease,
  onMarkPersonal,
}: {
  artworkId: string;
  alreadyMarked: boolean;
  onRelease: (artworkId: string) => Promise<Result>;
  onMarkPersonal: (artworkId: string) => Promise<Result>;
}) {
  const [result, setResult] = useState<Result | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const button =
    "eyebrow rounded-md border px-3 py-1.5 text-[11px] transition-colors " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent " +
    "focus-visible:ring-offset-2 focus-visible:ring-offset-base " +
    "disabled:pointer-events-none disabled:opacity-50";

  if (result) {
    return (
      <p
        role="status"
        className={result.ok ? "text-sm text-ink" : "text-sm text-btn"}
      >
        {result.message}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {confirming ? (
        <>
          <span className="text-sm text-ink">
            Release to print? This is what sends it to the press.
          </span>
          <button
            type="button"
            disabled={pending}
            className={`${button} border-btn bg-btn text-base`}
            onClick={() =>
              startTransition(async () => setResult(await onRelease(artworkId)))
            }
          >
            Yes, release
          </button>
          <button
            type="button"
            disabled={pending}
            className={`${button} border-line text-ink hover:bg-surface-alt`}
            onClick={() => setConfirming(false)}
          >
            Cancel
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            disabled={pending}
            className={`${button} border-line-strong text-ink hover:bg-surface-alt`}
            onClick={() => setConfirming(true)}
          >
            Release to print
          </button>
          <button
            type="button"
            disabled={pending || alreadyMarked}
            className={`${button} border-line text-ink hover:bg-surface-alt`}
            onClick={() =>
              startTransition(async () =>
                setResult(await onMarkPersonal(artworkId)),
              )
            }
          >
            {alreadyMarked ? "Marked for contact" : "Mark for personal contact"}
          </button>
        </>
      )}
    </div>
  );
}
