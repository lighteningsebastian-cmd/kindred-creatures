"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

/**
 * When the dashboard itself breaks.
 *
 * It says nothing about what went wrong. The owner cannot act on a stack trace,
 * and this boundary catches errors from code that reads PayFast config and
 * storage credentials: an error message rendered here is a message rendered to
 * whoever is looking at the screen. It goes to the server log instead, which is
 * where the person who can fix it is already looking.
 *
 * The important line is the last one. A failed dashboard must not imply a failed
 * shop: orders are still arriving and the ITN webhook does not run through here.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin] dashboard render failed", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-16 md:px-6">
      <div className="max-w-prose rounded-md border border-line bg-surface p-6">
        <p className="eyebrow text-[11px] text-signal-error">Something broke</p>
        <h1 className="mt-3 font-display text-2xl text-ink">
          The dashboard could not load.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          This is a fault on our side, not a problem with any order. Try again,
          and if it keeps happening the server log has the detail.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Orders are still being taken and paid orders are still going to the
          print shop. Nothing here is lost.
        </p>

        {error.digest ? (
          <p className="mt-4 font-mono text-xs text-muted">
            Reference {error.digest}
          </p>
        ) : null}

        <div className="mt-6">
          <Button block size="sm" onClick={reset}>
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}
