/**
 * The customer-facing order reference: the thing someone reads down the phone to
 * the shop, or types into "find my order". It is NOT the order id.
 *
 * WHY A SEPARATE REFERENCE. The order id is a uuid, and orderRef(order.id) in the
 * email layer is just its first block. Both are fine as an internal handle, but
 * neither is meant to be spoken aloud or typed by a person: a uuid is long and
 * full of ambiguous characters. This reference is short, groups by month, and
 * draws from an alphabet chosen so it can never spell a word and never trips on
 * the characters people misread (O for 0, I/l for 1).
 *
 * WHAT IT IS NOT. A short reference is guessable, so it never unlocks anything on
 * its own: the order-lookup flow always requires this reference AND the order
 * email together, and the order-status page is still gated by a signed token.
 * This value is a label, not a credential.
 *
 * FORMAT. `KC-<YYMM>-<5 chars>`, e.g. `KC-2607-K4M9P`. The middle is the order
 * month in the shop's own terms; the suffix is five characters from the
 * unambiguous alphabet below.
 */

import { randomInt } from "node:crypto";

/**
 * The alphabet the suffix is drawn from: consonants with the vowels removed (so
 * a suffix cannot spell a word) and the letters and digits people misread
 * dropped as well. Gone: every vowel (A E I O U), the letter L (reads as 1 or I),
 * and the digits 0 and 1. What remains is 28 characters, all upper case.
 */
export const REF_ALPHABET = "BCDFGHJKMNPQRSTVWXYZ23456789";

/** How many characters the random suffix carries. 28^5 is ~17 million. */
const SUFFIX_LENGTH = 5;

/** The fixed brand prefix every reference opens with. */
const PREFIX = "KC";

/**
 * A fresh reference for an order created at `now`. Pure but for its randomness:
 * the month comes from `now` (UTC, so it does not drift with the test runner's
 * clock), and the suffix is five unbiased draws from REF_ALPHABET.
 *
 * @param now when the order is being created. Defaults to the current time.
 * @returns a reference of the form `KC-YYMM-XXXXX`.
 */
export function generatePublicRef(now: Date = new Date()): string {
  const yy = String(now.getUTCFullYear() % 100).padStart(2, "0");
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");

  let suffix = "";
  for (let i = 0; i < SUFFIX_LENGTH; i += 1) {
    suffix += REF_ALPHABET[randomInt(REF_ALPHABET.length)];
  }

  return `${PREFIX}-${yy}${mm}-${suffix}`;
}

/**
 * A reference that is not already taken. Generation is random, so a collision is
 * astronomically unlikely, but "unlikely" is not "impossible" and the reference
 * is unique in the database. This retries against a caller-supplied existence
 * check; the unique constraint on the column is the real backstop, this loop
 * just keeps the common case from ever reaching it.
 *
 * @param exists returns true when a reference is already in use.
 * @param now passed through to generatePublicRef.
 * @param maxAttempts how many fresh references to try before giving up.
 * @returns an unused reference.
 * @throws if every attempt collided, which for a healthy table cannot happen.
 */
export async function generateUniquePublicRef(
  exists: (ref: string) => Promise<boolean>,
  now: Date = new Date(),
  maxAttempts = 10,
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const ref = generatePublicRef(now);
    if (!(await exists(ref))) return ref;
  }
  throw new Error("Could not generate a unique public order reference.");
}

/**
 * Coerces whatever a customer typed into the canonical reference form so it can
 * be compared against the stored value. People will paste "kc 2607 k4m9p", drop
 * the prefix, use spaces instead of hyphens, or lower-case the lot; all of those
 * should find the same order. This upper-cases, strips every character that is
 * not a letter or digit, and re-inserts the `KC-YYMM-` shape when it can.
 *
 * It never asserts validity: a nonsense input normalises to some string that
 * simply will not match any order, which is exactly what the lookup wants (one
 * generic miss, no "that is not even a valid reference" tell).
 *
 * @param input the raw reference as typed.
 * @returns the normalised reference, upper-cased and hyphenated.
 */
export function normalisePublicRef(input: string): string {
  const cleaned = input.toUpperCase().replace(/[^A-Z0-9]/g, "");

  // Tolerate a missing prefix: "2607K4M9P" is the same order as "KC2607K4M9P".
  const body = cleaned.startsWith(PREFIX) ? cleaned.slice(PREFIX.length) : cleaned;

  // A well-formed body is 4 month digits then the suffix. Re-hyphenate what we
  // can; anything shorter is returned prefixed but unsplit, and simply misses.
  if (body.length >= 4) {
    const month = body.slice(0, 4);
    const suffix = body.slice(4);
    return `${PREFIX}-${month}-${suffix}`;
  }

  return `${PREFIX}-${body}`;
}
