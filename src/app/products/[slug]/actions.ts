"use server";

import { getDb } from "@/lib/db/client";
import { breedRequests } from "@/lib/db/schema";
import { SPECIES, type Species } from "@/lib/breeds";
import { loadPrintFont } from "@/lib/print/fonts";
import { NAME_MAX } from "@/lib/companion";

/** Longer than any real breed name; anything past this is not a search. */
const MAX_QUERY = 60;

/**
 * Records a breed somebody looked for and did not find.
 *
 * This is the only reason the list grows in the right order: every miss is a
 * vote, so the next breeds added are the ones customers actually asked for
 * rather than the ones we guessed at.
 *
 * Never throws. A failed log must not interrupt somebody buying a hoodie, and
 * there is nothing the customer could do about it anyway.
 *
 * ponytail: no rate limit, this is a public unauthenticated write. Capped
 * length and dropped blanks are the whole of the defence. Add one if the table
 * ever fills with junk; it is a list the owner reads by hand, so noise is
 * visible immediately.
 */
export async function logBreedRequest(
  query: string,
  species: Species,
): Promise<void> {
  const trimmed = query.trim().slice(0, MAX_QUERY);
  if (!trimmed) return;
  // Reject anything that is not a species we actually offer, rather than
  // trusting a string that arrived from a browser.
  if (species !== "other" && !(species in SPECIES)) return;

  try {
    const db = await getDb();
    await db.insert(breedRequests).values({ query: trimmed, species });
  } catch {
    // Best effort by design.
  }
}

/**
 * Words we will not print on a garment. Deliberately short.
 *
 * ponytail: an English starter list only. South Africa has eleven official
 * languages and this covers one of them, so the owner should extend it from
 * what actually turns up. The real backstop is that every order is seen by a
 * human before it goes to the printer, and this only has to catch the obvious
 * case at the moment of typing.
 */
const UNPRINTABLE_WORDS = [
  "fuck",
  "shit",
  "cunt",
  "bitch",
  "bastard",
  "dick",
  "piss",
  "wank",
  "kaffir",
  "poes",
  "doos",
  "naai",
];

export type NameCheck = { ok: true } | { ok: false; reason: string };

/**
 * Can this name actually be printed, and should it be?
 *
 * The point is timing. The name is set in a real font on a real garment, so a
 * character the font has no glyph for is not a rendering bug, it is a blank
 * space on something already paid for and not returnable. Answering while the
 * customer is still typing costs a round trip and saves a refund.
 *
 * Coverage is asked of the font file itself rather than approximated with a
 * regex, so there is one source of truth and it is the same file the plate is
 * set from. The name is PRINTED, never prompted: it goes nowhere near the image
 * model (docs/spec-pipeline.md section 6).
 */
export async function checkCreatureName(name: string): Promise<NameCheck> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: true };
  if (trimmed.length > NAME_MAX) {
    return { ok: false, reason: `Names can be up to ${NAME_MAX} characters.` };
  }

  const lowered = trimmed.toLowerCase();
  if (UNPRINTABLE_WORDS.some((word) => lowered.includes(word))) {
    return { ok: false, reason: "We would rather not print that one." };
  }

  // Young Serif sets the name on both sides, so its coverage is the answer.
  const font = loadPrintFont("frontName");
  const missing = [...trimmed].filter(
    (char) => font.charToGlyph(char).index === 0,
  );
  if (missing.length > 0) {
    return {
      ok: false,
      reason: `We cannot print ${missing.join(" ")} yet. Letters, spaces, hyphens and accents all work.`,
    };
  }

  return { ok: true };
}
