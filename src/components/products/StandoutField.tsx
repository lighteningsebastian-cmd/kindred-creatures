"use client";

import { STANDOUT_MAX } from "@/lib/standout";

/**
 * The one question whose answer reaches the model.
 *
 * ONE COMPONENT, TWO PLACES: the photo step asks it, and the revision screen
 * offers it back for editing (docs/spec-standout-detail.md sections 6 and 7).
 * The wording, the limit and the placeholder are the same in both because they
 * are the same question, and two copies of a question drift.
 *
 * THE PLACEHOLDER IS DOING REAL WORK, more than the label is. "He is my best
 * friend" is a true and useless answer: nothing in the prompt can act on it and
 * no filter can detect it, because filtering English prose by keyword is
 * unreliable in both directions. Steering toward something VISIBLE is therefore
 * a copy problem, and this is the copy that solves it. Do not replace the
 * example with something vaguer.
 *
 * THE HELPER TEXT IS LITERALLY TRUE, which is why it is worded this way. The
 * clause built from this answer tells the model to find the detail in the
 * photograph, not to draw it from these words, so "we look for this when we
 * draw them" is what actually happens. Promising that we will draw whatever
 * they type would be a promise the prompt deliberately does not keep.
 */
export function StandoutField({
  value,
  onChange,
  id = "standout-detail",
}: {
  value: string | null;
  onChange: (next: string | null) => void;
  id?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        What is one thing about them that really stands out?
      </label>
      <textarea
        id={id}
        value={value ?? ""}
        maxLength={STANDOUT_MAX}
        rows={2}
        onChange={(e) => onChange(e.target.value || null)}
        aria-describedby={`${id}-helper`}
        className="w-full rounded-md border border-line bg-base px-3 py-2 text-base text-ink placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base"
        placeholder="One ear flops over and the other one doesn't."
      />
      <p id={`${id}-helper`} className="text-sm text-muted">
        Optional. We look for this when we draw them, so the thing you love most
        does not get smoothed away.
      </p>
    </div>
  );
}
