/**
 * The fulfilment transitions the owner can drive by hand, and the guards on them.
 *
 * WHERE THE GUARD LIVES. In the WHERE clause, not in the button. Every function
 * here moves an order with an UPDATE that names both the id and the status it
 * expects to find, so an order that is not in that state updates zero rows and
 * the transition is refused. Hiding a button is a courtesy to the owner; this is
 * what actually stops a stale tab, a double click, or a hand-written POST from
 * jumping an order from paid to shipped.
 *
 * WHAT IS NOT HERE, and must never be added: anything that writes status "paid".
 * Only a verified PayFast ITN may do that (see the notify route). An admin
 * control that marked an order paid would make the whole ITN verification
 * optional, since the way to pay for a garment would be to ask us nicely.
 *
 * This module has no React and no route imports on purpose, matching
 * fulfillment.ts: the actions in the (dashboard) group wrap it and add the auth
 * check, and the tests drive it directly.
 */

import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  fulfillmentEvents,
  orders,
  type Order,
  type OrderStatus,
} from "@/lib/db/schema";
import { sendShippingNotification, type EmailResult } from "@/lib/email";

/**
 * The only transitions this shop performs by hand, as a table rather than as
 * scattered ifs. Read it as: to reach KEY, an order must currently be VALUE.
 */
export const ALLOWED_FROM: Partial<Record<OrderStatus, OrderStatus>> = {
  printed: "sent_to_printer",
  shipped: "printed",
};

export type OpResult =
  | { ok: true; order: Order; email?: EmailResult }
  | { ok: false; reason: OpRefusal };

/** Why a transition was refused. The UI turns these into sentences. */
export type OpRefusal =
  | "order-not-found"
  | "tracking-required"
  | "wrong-status";

async function record(
  orderId: string,
  detail: string,
  outcome: "ok" | "failed" = "ok",
): Promise<void> {
  try {
    const db = await getDb();
    await db.insert(fulfillmentEvents).values({
      orderId,
      artworkId: null,
      step: "fulfil",
      outcome,
      detail: detail.slice(0, 500),
    });
  } catch {
    // Same policy as fulfillment.ts: the breadcrumb explains an order, and must
    // never be the thing that takes the order down.
  }
}

async function load(orderId: string): Promise<Order | undefined> {
  const db = await getDb();
  try {
    const [row] = await db.select().from(orders).where(eq(orders.id, orderId));
    return row;
  } catch {
    // A malformed uuid matches nothing: an unknown order, not a fault.
    return undefined;
  }
}

/**
 * sent_to_printer to printed. The print shop has confirmed the garment exists.
 *
 * @param orderId the order to move.
 * @returns the updated order, or why it was refused.
 */
export async function markPrinted(orderId: string): Promise<OpResult> {
  const db = await getDb();
  if (!(await load(orderId))) return { ok: false, reason: "order-not-found" };

  const [updated] = await db
    .update(orders)
    .set({ status: "printed" })
    .where(and(eq(orders.id, orderId), eq(orders.status, ALLOWED_FROM.printed!)))
    .returning();

  if (!updated) return { ok: false, reason: "wrong-status" };

  await record(orderId, "admin: marked printed");
  return { ok: true, order: updated };
}

/**
 * printed to shipped, with the waybill, and the mail that tells the customer.
 *
 * THE ORDER OF OPERATIONS IS THE POINT. The tracking number and the status go in
 * as one UPDATE, and the mail is sent from the row that UPDATE returned. That is
 * what makes sendShippingNotification safe to call: it throws a TypeError on an
 * order with no tracking number, and the only order we hand it is one the
 * database has just confirmed has one.
 *
 * A FAILED MAIL DOES NOT UNSHIP THE ORDER. The garment is with the courier
 * either way; rolling the status back to make the mail's failure disappear would
 * be lying about where a parcel is. The failure comes back to the caller instead,
 * so the owner sees it and can pass the number on by hand.
 *
 * @param orderId the order to ship.
 * @param trackingNumber the courier's waybill. Required and non-empty.
 * @returns the updated order plus the email result, or why it was refused.
 */
export async function markShipped(
  orderId: string,
  trackingNumber: string,
): Promise<OpResult> {
  const tracking = trackingNumber.trim();
  // Checked before the UPDATE: an order that reached "shipped" with no waybill
  // is an order whose customer can never be told where their parcel is.
  if (!tracking) return { ok: false, reason: "tracking-required" };

  const db = await getDb();
  if (!(await load(orderId))) return { ok: false, reason: "order-not-found" };

  const [updated] = await db
    .update(orders)
    .set({ status: "shipped", trackingNumber: tracking })
    .where(and(eq(orders.id, orderId), eq(orders.status, ALLOWED_FROM.shipped!)))
    .returning();

  if (!updated) return { ok: false, reason: "wrong-status" };

  await record(orderId, `admin: marked shipped, tracking ${tracking}`);

  const email = await sendShippingNotification(updated);
  await record(
    orderId,
    email.ok
      ? `shipping notification sent: ${email.id}`
      : `shipping notification failed: ${email.error.message}`,
    email.ok ? "ok" : "failed",
  );

  return { ok: true, order: updated, email };
}
