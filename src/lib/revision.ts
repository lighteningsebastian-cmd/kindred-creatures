import { REVISION_ADJUSTMENT } from "@/lib/images/prompts";

/**
 * What a customer can tell us about a portrait that is not quite right.
 *
 * THE BOUNDARY THIS FILE EXISTS TO HOLD: three things influence what the model
 * draws, and this file owns two of them. The photograph. A chip id from the
 * closed set below, bound to a sentence we wrote in prompts.ts. And, since 14
 * August, the answer to one named question — "what is one thing about them that
 * really stands out?" — which is sanitised by lib/standout.ts and reaches the
 * model as a pointer at the photograph rather than a description of the animal.
 * See docs/spec-standout-detail.md.
 *
 * THE NOTE BELOW IS NOT THAT QUESTION and must never become it. What somebody
 * types into "anything else you would like us to know" goes to a person and
 * only to a person. A general-purpose text box wired into a prompt hands a
 * stranger the controls on something we print and post, and "ignore previous
 * instructions" is the polite end of what arrives. The standout detail is
 * affordable because it is one question with a known shape, a filter, and two
 * humans between it and a garment; a free-form note has none of that.
 * See docs/spec-pipeline.md section 6.
 */

export const REVISION_REASONS = [
  "not-like-them",
  "wrong-colouring",
  "too-dark",
  "too-light",
  "wrong-angle",
  "something-else",
] as const;

export type RevisionReason = (typeof REVISION_REASONS)[number];

/** What the customer reads. The ids above are what we store. */
export const REVISION_LABELS: Record<RevisionReason, string> = {
  "not-like-them": "Doesn't look like them",
  "wrong-colouring": "Wrong colouring or markings",
  "too-dark": "Too dark",
  "too-light": "Too light",
  "wrong-angle": "Wrong angle",
  "something-else": "Something else",
};

/** Validated exactly as isArtStyle validates a style: a known id, or nothing. */
export function isRevisionReason(value: unknown): value is RevisionReason {
  return (
    typeof value === "string" &&
    (REVISION_REASONS as readonly string[]).includes(value)
  );
}

/** Longer than a sentence, shorter than an essay nobody will read. */
export const NOTE_MAX = 300;

/**
 * How many revisions we handle without a person. The third stops and comes to
 * the owner.
 *
 * The customer is NEVER shown a count. A visible limit turns a service into a
 * ration and makes someone adversarial about their own dog. The tone escalates
 * into personal attention instead, which reads as better service rather than
 * as running out of chances. Roughly R21 of generation against R405 of
 * contribution: affordable.
 */
export const AUTOMATED_ROUNDS = 2;

export function needsHuman(revisionCount: number): boolean {
  return revisionCount >= AUTOMATED_ROUNDS;
}

/**
 * The sentences to add to the prompt for a set of chips.
 *
 * Takes unknown input and returns only our own wording. Anything unrecognised
 * is dropped rather than passed through, so there is no path from a request
 * body to the model except through this filter.
 */
export function adjustmentsFor(reasons: unknown): string[] {
  if (!Array.isArray(reasons)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const reason of reasons) {
    if (!isRevisionReason(reason)) continue;
    if (seen.has(reason)) continue;
    seen.add(reason);
    const adjustment = REVISION_ADJUSTMENT[reason];
    // "something-else" has no adjustment on purpose: it means read my note.
    if (adjustment) out.push(adjustment);
  }
  return out;
}

/** Trims a customer note to something a person will actually read. */
export function normaliseNote(note: unknown): string | null {
  if (typeof note !== "string") return null;
  const trimmed = note.trim().slice(0, NOTE_MAX);
  return trimmed || null;
}
