/**
 * Email delivery monitoring (D4): remembering what we sent, and reading back
 * what the provider later said about it.
 *
 * The email helpers in ./index.ts deliberately never touch the database, so
 * this module is where the send sites (fulfilment and the admin ship action)
 * key a successful send to its order. The Resend webhook then closes the loop:
 * it looks a message id up here, records the delivery event, and marks the
 * order when the mail bounced.
 *
 * THE FAILURE POLICY, same as everywhere email touches money: recording is
 * best-effort and never throws. A ledger row that could not be written costs
 * us one association; a ledger that could take down a send, a webhook 200 or a
 * paid order would cost far more than it keeps.
 */

import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  emailEvents,
  orderEmails,
  orders,
  type EmailEvent,
  type EmailEventType,
  type OrderEmail,
  type OrderEmailKind,
} from "@/lib/db/schema";
import type { EmailResult } from "@/lib/email";

/** Payload text is provider-supplied on its way into a column. Keep it bounded. */
const MAX_RAW_CHARS = 10_000;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Keys a successful order-mail send to its order, so a later delivery event
 * can find its way back.
 *
 * Call it right after the send, with the EmailResult as it came back. A failed
 * send records nothing (there is no message id to key, and the failure is
 * already in fulfillment_events); a duplicate message id records nothing (the
 * unique key makes a replay a no-op). Never throws: see the module header.
 *
 * @param orderId the order the mail was about.
 * @param kind which of the three order mails this was.
 * @param recipient who it went to (customer or print shop).
 * @param result the send's outcome, straight from the helper.
 */
export async function recordOrderEmailSend(
  orderId: string,
  kind: OrderEmailKind,
  recipient: string,
  result: EmailResult,
): Promise<void> {
  if (!result.ok) return;

  try {
    const db = await getDb();
    await db
      .insert(orderEmails)
      .values({ orderId, kind, recipient, messageId: result.id })
      .onConflictDoNothing();
  } catch (error) {
    // Loud, then done. The mail went; the order stands; only the delivery
    // ledger has a gap, and that is the cheapest of the three to lose.
    console.error(
      `[email] could not record ${kind} send ${result.id} for order ${orderId}: ${errorMessage(error)}`,
    );
  }
}

/** What recording a webhook event amounted to. The route logs this, only. */
export type RecordEventResult = {
  /** False when persistence hiccupped. The webhook still answers 200. */
  recorded: boolean;
  /** The order the message id resolved to, or null for unkeyed mail. */
  orderId: string | null;
  /** True when a bounce marked the order for a human. */
  flaggedBounce: boolean;
};

/**
 * Records one verified delivery event and, on a bounce of an order email,
 * marks the order so admin shows "phone the customer".
 *
 * WHAT THIS NEVER DOES: re-send anything. A bounced address has just proven it
 * eats mail, and an automatic retry to the same address is reputation damage
 * dressed up as helpfulness. The one response to a bounce is a human and the
 * phone number on the order (D2 put it on file for exactly this).
 *
 * Idempotent per (message, type) via the unique index, so Svix's delivery
 * retries do not double-record. Never throws: an event that could not be
 * persisted is logged and reported back as recorded:false, and the caller
 * still answers 200 (the event was genuine; failing it would only make Svix
 * hammer a struggling database).
 *
 * @param type the event, already narrowed to the three we keep.
 * @param messageId the provider's id for the message the event is about.
 * @param recipient the address the provider reports for it.
 * @param raw the verified payload, verbatim.
 */
export async function recordEmailEvent(
  type: EmailEventType,
  messageId: string,
  recipient: string,
  raw: string,
): Promise<RecordEventResult> {
  let orderId: string | null = null;
  let flaggedBounce = false;

  try {
    const db = await getDb();

    // The association: was this message one of ours about an order?
    const [sent] = await db
      .select()
      .from(orderEmails)
      .where(eq(orderEmails.messageId, messageId));
    orderId = sent?.orderId ?? null;

    await db
      .insert(emailEvents)
      .values({
        messageId,
        recipient,
        type,
        orderId,
        raw: raw.slice(0, MAX_RAW_CHARS),
      })
      .onConflictDoNothing();

    if (type === "bounced" && orderId) {
      // Set once and kept: the first bounce is the news, and a later delivered
      // event for a DIFFERENT mail must not quietly clear a flag a human has
      // not yet acted on. Clearing is a human decision we do not automate.
      const marked = await db
        .update(orders)
        .set({ emailBouncedAt: new Date() })
        .where(eq(orders.id, orderId))
        .returning();
      flaggedBounce = marked.length > 0;
    }

    return { recorded: true, orderId, flaggedBounce };
  } catch (error) {
    console.error(
      `[email] could not record ${type} event for message ${messageId}: ${errorMessage(error)}`,
    );
    return { recorded: false, orderId, flaggedBounce };
  }
}

/** The one-word answer the admin chip shows for an order's customer mail. */
export type OrderEmailStatus = "sent" | "delivered" | "bounced";

export type OrderEmailSummary = {
  /** Worst-first: bounced beats delivered beats sent. Null when nothing sent. */
  status: OrderEmailStatus | null;
  /** Every send we keyed to the order, newest first, with its own outcome. */
  sends: (OrderEmail & { outcome: OrderEmailStatus })[];
};

function outcomeOf(events: EmailEvent[]): OrderEmailStatus {
  // A complaint is treated as a bounce for display: either way the address is
  // telling us to stop, and the human response is the same phone call.
  if (events.some((event) => event.type === "bounced" || event.type === "complained")) {
    return "bounced";
  }
  if (events.some((event) => event.type === "delivered")) return "delivered";
  return "sent";
}

/**
 * What became of an order's mail, for the admin detail page.
 *
 * @param orderId the order to summarise.
 * @returns the worst outcome across its sends plus the per-send detail. Reads
 * only; safe on any id (a malformed uuid is just an order with no mail).
 */
export async function orderEmailSummary(
  orderId: string,
): Promise<OrderEmailSummary> {
  try {
    const db = await getDb();
    const sends = await db
      .select()
      .from(orderEmails)
      .where(eq(orderEmails.orderId, orderId))
      .orderBy(desc(orderEmails.createdAt));

    if (sends.length === 0) return { status: null, sends: [] };

    const events = await db
      .select()
      .from(emailEvents)
      .where(
        inArray(
          emailEvents.messageId,
          sends.map((send) => send.messageId),
        ),
      );

    const byMessage = new Map<string, EmailEvent[]>();
    for (const event of events) {
      const list = byMessage.get(event.messageId) ?? [];
      list.push(event);
      byMessage.set(event.messageId, list);
    }

    const detailed = sends.map((send) => ({
      ...send,
      outcome: outcomeOf(byMessage.get(send.messageId) ?? []),
    }));

    const status: OrderEmailStatus = detailed.some(
      (send) => send.outcome === "bounced",
    )
      ? "bounced"
      : detailed.some((send) => send.outcome === "delivered")
        ? "delivered"
        : "sent";

    return { status, sends: detailed };
  } catch {
    // A malformed uuid, or a read that failed. The chip simply does not render.
    return { status: null, sends: [] };
  }
}
