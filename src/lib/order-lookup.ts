/**
 * Self-service order lookup: the data half of "find my order".
 *
 * THE WHOLE POINT IS THAT A REFERENCE ALONE PROVES NOTHING. The public reference
 * is short and speakable, which is exactly what makes it guessable: KC-YYMM-XXXXX
 * has a small enough space that a script could walk it. So a reference on its own
 * never reveals an order. A lookup succeeds only when the reference AND the order
 * email match the SAME order, and even then the caller is handed the existing
 * signed order-status token, not the order's contents.
 *
 * ONE MISS, NO MATTER WHAT. A wrong reference, a right reference with the wrong
 * email, and a pair that match nothing all return the same {matched:false}. The
 * caller must render one identical message for all of them: telling "no such
 * reference" apart from "wrong email for a real reference" would turn this into
 * the enumeration oracle the design exists to avoid.
 */

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { orders } from "@/lib/db/schema";
import { normalisePublicRef } from "@/lib/order-ref";
import { normaliseEmail } from "@/lib/newsletter";

export type LookupResult =
  | { matched: true; orderId: string }
  | { matched: false };

/**
 * Finds the order a reference-and-email pair identifies, or reports a miss.
 *
 * The reference is normalised (see normalisePublicRef: case, spacing and a
 * missing prefix are all forgiven) and looked up against the unique publicRef
 * column. The email is compared case-insensitively (normaliseEmail on both
 * sides), because an order stores the address as it was typed at checkout, not
 * lower-cased. A missing row and a mismatched email are deliberately the same
 * outcome.
 *
 * @param ref the reference as the customer typed it.
 * @param email the order email as the customer typed it.
 * @returns the order id on a full match, or {matched:false} on anything else.
 */
export async function findOrderByRefAndEmail(
  ref: string,
  email: string,
): Promise<LookupResult> {
  const normalisedRef = normalisePublicRef(ref);

  const db = await getDb();
  let row;
  try {
    [row] = await db
      .select({ id: orders.id, email: orders.email })
      .from(orders)
      .where(eq(orders.publicRef, normalisedRef));
  } catch {
    // A database hiccup is a miss, not a leak: the customer is told the same
    // generic thing and can try again.
    row = undefined;
  }

  if (!row) return { matched: false };
  if (normaliseEmail(row.email) !== normaliseEmail(email)) {
    return { matched: false };
  }

  return { matched: true, orderId: row.id };
}
