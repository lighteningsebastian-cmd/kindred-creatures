"use client";

import { useState } from "react";
import { suggestEmail } from "@/lib/email-typo";

/**
 * The quiet email typo net (D2). Shown under any email field, it offers one
 * tap-to-accept correction when the domain looks like a one-edit slip of a
 * common provider, and nothing at all otherwise. It NEVER blocks a submit and
 * never validates: the field is submittable with or without acting on it. A
 * customer who meant what they typed can dismiss it, and it stays gone until the
 * address changes to a different near-miss.
 *
 * @param email the current field value.
 * @param onAccept called with the corrected address when the suggestion is
 * tapped; the parent owns the field value and swaps it in.
 * @param id optional id so the field can point aria-describedby at this hint.
 */
export function EmailSuggestion({
  email,
  onAccept,
  id,
}: {
  email: string;
  onAccept: (corrected: string) => void;
  id?: string;
}) {
  const [dismissed, setDismissed] = useState<string | null>(null);

  const suggestion = suggestEmail(email);
  if (!suggestion || suggestion === dismissed) return null;

  return (
    <p id={id} className="text-sm text-muted">
      Did you mean{" "}
      <button
        type="button"
        onClick={() => onAccept(suggestion)}
        className="font-medium text-accent underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base"
      >
        {suggestion}
      </button>
      ?{" "}
      <button
        type="button"
        onClick={() => setDismissed(suggestion)}
        aria-label="Dismiss email suggestion"
        className="text-muted underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base"
      >
        No, that is right
      </button>
    </p>
  );
}
