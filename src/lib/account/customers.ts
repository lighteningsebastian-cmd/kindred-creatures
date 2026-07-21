/**
 * Customer records and the claim that ties past guest orders to an account.
 *
 * The whole of an account's identity is an email. This module never touches
 * authentication (that is session.ts + the login tokens); it only reads and
 * writes the row and links orders to it by matching, case-insensitively, the
 * email a guest checked out with.
 */

import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { customers, orders, type Customer } from "@/lib/db/schema";
import { normaliseEmail } from "@/lib/newsletter";

/**
 * The account for an email, created if it did not exist. Insert-then-select with
 * onConflictDoNothing so two links opened at once cannot make two rows for one
 * address (email is unique; the loser of the race no-ops and both read the same
 * winner).
 */
export async function findOrCreateCustomer(email: string): Promise<Customer> {
  const e = normaliseEmail(email);
  const db = await getDb();
  await db.insert(customers).values({ email: e }).onConflictDoNothing();
  const [row] = await db
    .select()
    .from(customers)
    .where(eq(customers.email, e));
  return row;
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  const db = await getDb();
  const [row] = await db.select().from(customers).where(eq(customers.id, id));
  return row ?? null;
}

/**
 * Attaches this customer's unclaimed guest orders to their account, matching on
 * a case-insensitive email. Only orders with a null customerId are touched, so
 * re-running on every login is safe and cheap and never steals an order that
 * already belongs to someone. Orders under a different email are never touched.
 *
 * @returns how many orders were newly claimed (0 on a repeat login).
 */
export async function claimOrdersForCustomer(
  customerId: string,
  email: string,
): Promise<number> {
  const e = normaliseEmail(email);
  const db = await getDb();
  const claimed = await db
    .update(orders)
    .set({ customerId })
    .where(
      and(sql`lower(${orders.email}) = ${e}`, isNull(orders.customerId)),
    )
    .returning();
  return claimed.length;
}
