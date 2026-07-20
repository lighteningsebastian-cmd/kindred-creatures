/**
 * The owned-truth half of the newsletter: reads and writes to the `subscribers`
 * table. Pure data access, no HTTP and no React, so routes and the provider seam
 * can both lean on it. The idempotency rules the spec turns on live here, in one
 * place, rather than being re-derived at every call site.
 *
 *   - A brand-new address is inserted active with `consentAt = now`.
 *   - An address that is already ACTIVE is a no-op success: no second row, no
 *     error. Re-subscribing is a normal thing a person does, not a fault.
 *   - An address that had UNSUBSCRIBED is reactivated: status back to active and
 *     a fresh `consentAt`, because consent has been given again and POPIA wants
 *     that moment recorded.
 *
 * Email is normalised (lowercased, trimmed) before any lookup or write, so
 * "Sam@Example.com " and "sam@example.com" are the same subscriber.
 */

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  subscribers,
  type Subscriber,
  type SubscriberSource,
} from "@/lib/db/schema";

/** Lowercased and trimmed. The single definition of "the same address". */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** What an upsert did, so callers can tell a new sign-up from a returning one. */
export type UpsertOutcome = "created" | "reactivated" | "noop";

export interface UpsertResult {
  outcome: UpsertOutcome;
  subscriber: Subscriber;
}

/**
 * Records consent for `email` from `source`, idempotently (see file header).
 * Returns the resulting row and which of the three paths was taken.
 */
export async function upsertSubscriber(input: {
  email: string;
  source: SubscriberSource;
}): Promise<UpsertResult> {
  const email = normaliseEmail(input.email);
  const db = await getDb();

  const existing = (
    await db.select().from(subscribers).where(eq(subscribers.email, email))
  )[0];

  if (existing) {
    // Already active: nothing to do, and saying so is the success case.
    if (existing.status === "active") {
      return { outcome: "noop", subscriber: existing };
    }
    // Was unsubscribed: consent given again, so flip back and re-stamp it.
    const [reactivated] = await db
      .update(subscribers)
      .set({ status: "active", source: input.source, consentAt: new Date() })
      .where(eq(subscribers.email, email))
      .returning();
    return { outcome: "reactivated", subscriber: reactivated };
  }

  const [created] = await db
    .insert(subscribers)
    .values({
      email,
      source: input.source,
      status: "active",
      consentAt: new Date(),
    })
    .returning();
  return { outcome: "created", subscriber: created };
}

/** What `setUnsubscribed` found. `missing` is not an error: unsubscribing an
 * address we never had is a harmless no-op the caller may want to know about. */
export type UnsubscribeOutcome = "unsubscribed" | "already" | "missing";

export interface UnsubscribeResult {
  outcome: UnsubscribeOutcome;
  subscriber: Subscriber | null;
}

/**
 * Flips `email` to unsubscribed. Idempotent: doing it twice is fine, and an
 * unknown address is reported as `missing` rather than throwing.
 */
export async function setUnsubscribed(
  email: string,
): Promise<UnsubscribeResult> {
  const normalised = normaliseEmail(email);
  const db = await getDb();

  const existing = (
    await db
      .select()
      .from(subscribers)
      .where(eq(subscribers.email, normalised))
  )[0];

  if (!existing) return { outcome: "missing", subscriber: null };
  if (existing.status === "unsubscribed") {
    return { outcome: "already", subscriber: existing };
  }

  const [updated] = await db
    .update(subscribers)
    .set({ status: "unsubscribed" })
    .where(eq(subscribers.email, normalised))
    .returning();
  return { outcome: "unsubscribed", subscriber: updated };
}
