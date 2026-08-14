import { STANDOUT_LEAD, STANDOUT_TAIL } from "@/lib/images/prompts";

/**
 * The one question whose answer reaches the model.
 *
 * "What is one thing about them that really stands out?" — and what they type
 * is quoted into the prompt. Every other free-text field in this system goes to
 * a person and always will (docs/spec-pipeline.md section 6). This file is the
 * fence around that single exception.
 *
 * NOTHING HERE IS SENT TO THE MODEL. The words we say live in images/prompts.ts
 * with every other word we say; this file only decides how much of a customer's
 * sentence survives to be quoted between them. Same division as revision.ts.
 *
 * SANITISING HAPPENS ON THE WAY OUT, not on the way in. What gets stored is
 * what the customer actually wrote, because the person reading the job sheet
 * needs to see that, not a laundered version of it. The filter runs when the
 * prompt is built — exactly as adjustmentsFor filters chip ids at the same
 * moment and for the same reason.
 *
 * WHAT ACTUALLY STANDS BETWEEN A BAD SENTENCE AND A PRINTED GARMENT is not this
 * file. It is that the customer approves the portrait before anything is
 * printed, and that the admin approvals queue sits behind that, and that this
 * text is never printed on anything. The worst case here is a wasted
 * generation. That is what makes the hole affordable; the steps below just make
 * it small.
 */

/**
 * Long enough for "One ear flops over and the other one doesn't", short enough
 * that it stays a detail rather than becoming a brief. Enforced in the field
 * and again here, because a browser is not a trust boundary.
 */
export const STANDOUT_MAX = 140;

/**
 * Anything that is not a letter, a mark, a digit, a space or one of the few
 * punctuation marks a real sentence needs.
 *
 * An allowlist rather than a blocklist, deliberately: the set of characters a
 * sentence about a dog needs is small and knowable, and the set somebody might
 * use to reshape a prompt is not. Colons and semicolons are absent on purpose —
 * they are how a list of instructions is introduced, and no answer to this
 * question needs one.
 */
const DISALLOWED = /[^\p{L}\p{M}\p{N} ,.'\-!?()&/]/gu;

/** Curly and slanted apostrophes. A phone types these by default. */
const APOSTROPHES = /[‘’‛ʼ´`]/g;

/**
 * Every kind of quote mark, removed rather than replaced.
 *
 * These are the characters that close our quoted span and open somebody else's,
 * which would put their sentence where our instructions go. There is no answer
 * to "what stands out about your pet" that needs one.
 */
const QUOTES = /["“”„‟«»‹›]/g;

/**
 * Sentences that are not about an animal.
 *
 * A SPEED BUMP, NOT A WALL, and it is important that nobody reads it as one.
 * Pattern lists like this are trivially worked around by anyone who wants to,
 * and every entry risks eating a real customer's answer. It stays short for
 * that reason. The wall is three other things: the quote stripping above, the
 * clause's own instruction to ignore anything embedded in the words, and the
 * two people who see a portrait before it is printed.
 */
const INJECTION = [
  /ignore\s+(all\s+|any\s+)?(previous|prior|earlier|the\s+above)/,
  /disregard\s+(all\s+|any\s+|the\s+)?(previous|prior|earlier|above|instruction)/,
  /forget\s+(everything|all|the\s+above|what)/,
  /system\s+prompt/,
  /new\s+instructions?\b/,
  /instead\s+(draw|make|render|generate|paint)/,
];

/**
 * What survives of a customer's answer, or null if nothing does.
 *
 * Returns null rather than an empty string so that "they did not answer" and
 * "nothing they wrote was usable" are the same case at every call site: both
 * mean no clause, which is how every portrait was drawn before this existed.
 */
export function sanitiseStandout(raw: unknown): string | null {
  if (typeof raw !== "string") return null;

  const cleaned = raw
    // Fold lookalikes first, so a fullwidth or decorated character cannot carry
    // punctuation past an allowlist that would have rejected the plain form.
    .normalize("NFKC")
    .replace(APOSTROPHES, "'")
    .replace(QUOTES, "")
    // Whitespace becomes spaces BEFORE the allowlist runs. A newline is not on
    // the allowlist, so stripping first would weld the last word of one line to
    // the first word of the next.
    .replace(/\s+/g, " ")
    .replace(DISALLOWED, "")
    // Again, because removing a character can leave a gap behind.
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, STANDOUT_MAX)
    .trim();

  if (!cleaned) return null;
  const lowered = cleaned.toLowerCase();
  if (INJECTION.some((pattern) => pattern.test(lowered))) return null;

  return cleaned;
}

/**
 * The finished clause, ready to drop into the prompt, or null when there is
 * nothing to say.
 *
 * A blocked or empty answer returns null and the prompt is assembled without
 * it. It is NOT replaced with a placeholder sentence: a clause announcing that
 * the owner said something unusable is a sentence about our moderation, and the
 * model would try to draw it.
 */
export function standoutClause(raw: unknown): string | null {
  const detail = sanitiseStandout(raw);
  if (!detail) return null;
  return `${STANDOUT_LEAD}${detail}${STANDOUT_TAIL}`;
}
