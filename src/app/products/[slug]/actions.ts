"use server";

import { getDb } from "@/lib/db/client";
import { breedRequests } from "@/lib/db/schema";
import { SPECIES, type Species } from "@/lib/breeds";

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
