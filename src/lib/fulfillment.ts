/**
 * What happens after the money lands: the print file, the print shop, and the
 * customer's receipt.
 *
 * This module is deliberately free of route and React imports. Its callers are
 * the PayFast ITN webhook (via next/server's after(), so a slow generation
 * cannot make PayFast wait) and, later, the admin retry button. Both hand it an
 * order id and nothing else; everything it needs it reads for itself.
 *
 * THE COST PRINCIPLE. generatePrintFile is the one call in this shop that
 * spends real money, and it is the only reason this code does not run until an
 * order is genuinely `paid`. Previews are cheap and watermarked; a print file is
 * not. Everything below is arranged around not paying for the same portrait
 * twice: an artwork that already has a printKey is never regenerated, no matter
 * how many times a retry, a duplicate ITN or an impatient admin arrives.
 *
 * THE FAILURE POLICY, stated once and enforced below.
 *
 *   - A print file that cannot be generated FLAGS the order, sends no job sheet,
 *     and writes why to fulfillment_events. Nothing is lost: the payment stands,
 *     the order is retryable, and a human has a sentence to read.
 *   - A job sheet that cannot be sent does NOT flag the order and does NOT roll
 *     back sent_to_printer. The print file exists and is durable, so the shop
 *     can still be told by hand or by S8's re-send. It is loud: console.error
 *     plus a fulfillment_events row with outcome "failed", because a print shop
 *     that was never told is an operational incident.
 *   - A customer confirmation that cannot be sent is a nuisance, not an
 *     incident. It is recorded and otherwise ignored.
 *
 * The line under all three: losing an order is worse than a missed email. Email
 * never unwinds a payment.
 */

import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { getDb, type Db } from "@/lib/db/client";
import {
  artworks,
  fulfillmentEvents,
  orderItems,
  orders,
  type Artwork,
  type FulfillmentOutcome,
  type FulfillmentStep,
  type Order,
  type OrderItem,
} from "@/lib/db/schema";
import {
  sendJobSheet,
  sendOrderConfirmation,
  orderRef,
  type EmailResult,
} from "@/lib/email";
import { getImageProvider } from "@/lib/images";
import { sniffImageExtension } from "@/lib/images/detect";
import { getProduct, printPixels } from "@/lib/products";
import { getStorage } from "@/lib/storage";

/** Order states that mean fulfilment has already happened and must not repeat. */
const FULFILLED_STATES = new Set(["sent_to_printer", "printed", "shipped"]);

/** Error text is caller-supplied on its way into a column. Keep it bounded. */
const MAX_DETAIL_CHARS = 500;

/** One line's print file: made now, found already made, or not made at all. */
export type PrintFileLine =
  | { ok: true; artworkId: string; printKey: string; generated: boolean }
  | { ok: false; artworkId: string; reason: string };

export type PrintFilesResult = {
  /** True only when every line has a print file. One bad line fails the order. */
  ok: boolean;
  lines: PrintFileLine[];
};

/** What a fulfilment attempt did, in enough detail for a caller to log or show. */
export type FulfillmentResult =
  | {
      status: "sent_to_printer";
      orderId: string;
      printKeys: string[];
      /** ok:false here needs a human: the shop does not know about this job. */
      jobSheet: EmailResult;
      /** ok:false here is a nuisance. The order is unaffected. */
      confirmation: EmailResult;
    }
  | { status: "already-fulfilled"; orderId: string }
  | {
      status: "flagged";
      orderId: string;
      reason: string;
      failures: { artworkId: string; reason: string }[];
    }
  | { status: "refused"; orderId: string; reason: string };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function loadOrder(db: Db, orderId: string): Promise<Order | undefined> {
  try {
    const [row] = await db.select().from(orders).where(eq(orders.id, orderId));
    return row;
  } catch {
    // A malformed uuid never matches a row: an unknown order, not a fault.
    return undefined;
  }
}

/**
 * Writes one breadcrumb. Swallows its own errors on purpose: the trail exists to
 * explain an order, and a trail that could take the order down with it would be
 * worse than no trail at all.
 */
async function record(
  db: Db,
  orderId: string,
  step: FulfillmentStep,
  outcome: FulfillmentOutcome,
  detail?: string,
  artworkId?: string,
): Promise<void> {
  try {
    await db.insert(fulfillmentEvents).values({
      orderId,
      artworkId: artworkId ?? null,
      step,
      outcome,
      detail: detail ? detail.slice(0, MAX_DETAIL_CHARS) : null,
    });
  } catch (error) {
    console.error(
      `[fulfillment] could not record ${step}/${outcome} for order ${orderId}: ${errorMessage(error)}`,
    );
  }
}

/**
 * The print file for one line.
 *
 * The early return on an existing printKey is the whole idempotency story and it
 * sits before every expensive thing in this function on purpose. The guarded
 * UPDATE at the end is the second half of it: two runs racing on one artwork
 * cannot both write a key, so the loser adopts the winner's file rather than
 * leaving a second one orphaned in storage with the row pointing elsewhere.
 */
async function generatePrintFile(
  db: Db,
  orderId: string,
  item: OrderItem,
): Promise<PrintFileLine> {
  const artworkId = item.artworkId;

  const fail = async (reason: string): Promise<PrintFileLine> => {
    await record(db, orderId, "generate-print-file", "failed", reason, artworkId);
    return { ok: false, artworkId, reason };
  };

  const [artwork] = await db
    .select()
    .from(artworks)
    .where(eq(artworks.id, artworkId));

  if (!artwork) return fail("the artwork row this line points at is missing");

  if (artwork.printKey) {
    // Already paid for once. This is the retry, the duplicate ITN and the admin
    // clicking twice, and none of them bills us again.
    await record(
      db,
      orderId,
      "generate-print-file",
      "skipped",
      `print file already exists: ${artwork.printKey}`,
      artworkId,
    );
    return { ok: true, artworkId, printKey: artwork.printKey, generated: false };
  }

  const product = getProduct(item.productSlug);
  if (!product) return fail(`unknown product slug "${item.productSlug}"`);

  const style = artwork.style;
  if (!style) return fail("no art style was ever chosen for this artwork");

  // 300 DPI across the product's print area. The print shop's sheet quotes the
  // same numbers, so the two cannot drift: both come from printPixels().
  const { widthPx, heightPx } = printPixels(product);

  try {
    const provider = await getImageProvider();
    const { printBytes } = await provider.generatePrintFile({
      uploadKey: artwork.uploadKey,
      style,
      widthPx,
      heightPx,
    });

    // Providers return raw bytes and disagree about the format (the mock draws
    // SVG, OpenAI returns PNG), so the key is named after what actually arrived.
    const ext = sniffImageExtension(printBytes);
    const printKey = `prints/${artworkId}/${Date.now()}.${ext}`;
    await getStorage().put(printKey, printBytes, `image/${ext}`);

    const claimed = await db
      .update(artworks)
      .set({ printKey, status: "ready" })
      .where(and(eq(artworks.id, artworkId), isNull(artworks.printKey)))
      .returning();

    if (claimed.length === 0) {
      // A concurrent run got there first. Theirs is the file the row names, so
      // theirs is the file the job sheet links; ours is a few cents wasted, not
      // a mismatch to paper over.
      const [current] = await db
        .select()
        .from(artworks)
        .where(eq(artworks.id, artworkId));
      if (!current?.printKey) {
        return fail("the print file was stored but the artwork row lost it");
      }
      return { ok: true, artworkId, printKey: current.printKey, generated: false };
    }

    await record(db, orderId, "generate-print-file", "ok", printKey, artworkId);
    return { ok: true, artworkId, printKey, generated: true };
  } catch (error) {
    // The artwork's pipeline failed, so say so on the row. A successful retry
    // puts it back to "ready" with the key on it.
    await db
      .update(artworks)
      .set({ status: "failed" })
      .where(eq(artworks.id, artworkId));
    return fail(errorMessage(error));
  }
}

/**
 * Every print file an order needs, made or confirmed.
 *
 * @param orderId the order to work through. Its status is NOT checked here;
 * fulfillPaidOrder owns that guard and this is the step it drives.
 * @returns ok:true only when every line has a print file.
 */
export async function generatePrintFilesForOrder(
  orderId: string,
): Promise<PrintFilesResult> {
  const db = await getDb();
  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  // Serial, not Promise.all. These are expensive, rate-limited calls to an
  // image provider, and a twenty-line order firing twenty at once is how a shop
  // discovers its rate limit on the one path where failure costs a customer.
  const lines: PrintFileLine[] = [];
  for (const item of items) {
    lines.push(await generatePrintFile(db, orderId, item));
  }

  return { ok: lines.every((line) => line.ok), lines };
}

async function artworksFor(db: Db, items: OrderItem[]): Promise<Artwork[]> {
  if (items.length === 0) return [];
  return db
    .select()
    .from(artworks)
    .where(inArray(artworks.id, items.map((item) => item.artworkId)));
}

async function flag(
  db: Db,
  order: Order,
  reason: string,
  failures: { artworkId: string; reason: string }[],
): Promise<FulfillmentResult> {
  // Guarded on "paid" for the same reason the webhook guards its own
  // transition: an order already moving through the print shop must not be
  // dragged backwards by a late or duplicate attempt.
  await db
    .update(orders)
    .set({ status: "flagged" })
    .where(and(eq(orders.id, order.id), eq(orders.status, "paid")));

  await record(db, order.id, "fulfil", "failed", reason);
  console.error(
    `[fulfillment] order ${orderRef(order.id)} flagged: ${reason}. No job sheet was sent.`,
  );

  return { status: "flagged", orderId: order.id, reason, failures };
}

/**
 * The whole post-payment story for one order: print files, then the shop and the
 * customer, then `paid` to `sent_to_printer`.
 *
 * Only a `paid` order may be fulfilled, and an order that has already been
 * fulfilled is a no-op rather than a second job sheet. Read the file header for
 * the failure policy; the short version is that a generation failure flags and a
 * failed email never does.
 *
 * @param orderId the order to fulfil.
 * @returns what happened, typed. Never throws for an expected failure.
 */
export async function fulfillPaidOrder(
  orderId: string,
): Promise<FulfillmentResult> {
  const db = await getDb();
  const order = await loadOrder(db, orderId);

  if (!order) return { status: "refused", orderId, reason: "order-not-found" };

  if (FULFILLED_STATES.has(order.status)) {
    return { status: "already-fulfilled", orderId };
  }

  // The state guard. "pending" is the one that matters: an unpaid order must
  // never reach the provider, because that call costs money we have not taken.
  if (order.status !== "paid") {
    return { status: "refused", orderId, reason: `not-paid:${order.status}` };
  }

  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  if (items.length === 0) {
    // Checkout cannot write one of these, so if we are looking at one, something
    // upstream is wrong and a human should see it before the shop does.
    return flag(db, order, "the order has no lines to print", []);
  }

  const print = await generatePrintFilesForOrder(orderId);

  if (!print.ok) {
    const failures = print.lines.flatMap((line) =>
      line.ok ? [] : [{ artworkId: line.artworkId, reason: line.reason }],
    );
    const reason = failures
      .map(({ artworkId, reason: why }) => `artwork ${artworkId}: ${why}`)
      .join("; ");
    return flag(db, order, reason, failures);
  }

  const printKeys = print.lines.flatMap((line) => (line.ok ? [line.printKey] : []));

  // Emails go before the transition, so the row only claims "sent_to_printer"
  // once we have actually tried to send it. Neither result can stop the
  // transition below: the print files exist, and losing them to a mailbox
  // outage would be the expensive mistake.
  const jobSheet = await sendJobSheet(order, items, await artworksFor(db, items));
  await record(
    db,
    orderId,
    "job-sheet",
    jobSheet.ok ? "ok" : "failed",
    jobSheet.ok ? jobSheet.id : jobSheet.error.message,
  );
  if (!jobSheet.ok) {
    // Loud on purpose. The print files are safe and the order is intact, but
    // nobody in Cape Town knows this job exists until someone re-sends it.
    console.error(
      `[fulfillment] order ${orderRef(orderId)} has print files but the job sheet did not send. The print shop has NOT been told. Re-send it from the admin queue.`,
    );
  }

  const confirmation = await sendOrderConfirmation(order, items);
  await record(
    db,
    orderId,
    "order-confirmation",
    confirmation.ok ? "ok" : "failed",
    confirmation.ok ? confirmation.id : confirmation.error.message,
  );

  await db
    .update(orders)
    .set({ status: "sent_to_printer" })
    .where(and(eq(orders.id, orderId), eq(orders.status, "paid")));

  await record(db, orderId, "fulfil", "ok", `${printKeys.length} print file(s)`);

  return { status: "sent_to_printer", orderId, printKeys, jobSheet, confirmation };
}

/** What a re-send did. Same shape of honesty as FulfillmentResult. */
export type JobSheetResendResult =
  | { status: "sent"; orderId: string; jobSheet: EmailResult }
  | { status: "refused"; orderId: string; reason: string };

/**
 * Sends the job sheet again for an order that already has print files.
 *
 * WHY THIS IS HERE and not in S8's admin action. The admin could hold sendJobSheet
 * itself; the reason it does not is that every other thing that mails the print
 * shop leaves a fulfillment_events row behind, and an order's timeline is the
 * only answer to "was Cape Town ever told about this one?". A re-send that
 * reached past this module would be the one job sheet in the shop's history with
 * no breadcrumb, which is precisely the job sheet someone will later need to
 * find.
 *
 * It sends NOTHING when there are no print files. There is nothing to print, so
 * a sheet would send the shop a job it cannot do, and the fix for that order is
 * a retry, not a re-send.
 *
 * It does not change the order's status. A re-send is a message about an order,
 * not a step in it: an order at `printed` whose sheet went astray is still
 * printed, and dragging it backwards to sent_to_printer would lose that.
 *
 * @param orderId the order whose sheet should go again.
 * @returns the send result, or a refusal. Never throws for an expected failure.
 */
export async function resendJobSheet(
  orderId: string,
): Promise<JobSheetResendResult> {
  const db = await getDb();
  const order = await loadOrder(db, orderId);

  if (!order) return { status: "refused", orderId, reason: "order-not-found" };

  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  if (items.length === 0) {
    return { status: "refused", orderId, reason: "no-lines" };
  }

  const art = await artworksFor(db, items);
  // Every line needs its file: a sheet that links three garments and two files
  // is a sheet the shop has to ring us about.
  const missing = art.filter((artwork) => !artwork.printKey).length;
  if (art.length < items.length || missing > 0) {
    return { status: "refused", orderId, reason: "no-print-files" };
  }

  const jobSheet = await sendJobSheet(order, items, art);
  await record(
    db,
    orderId,
    "job-sheet",
    jobSheet.ok ? "ok" : "failed",
    jobSheet.ok ? `re-sent: ${jobSheet.id}` : `re-send failed: ${jobSheet.error.message}`,
  );

  if (!jobSheet.ok) {
    console.error(
      `[fulfillment] order ${orderRef(orderId)}: job sheet re-send failed. The print shop has still NOT been told.`,
    );
  }

  return { status: "sent", orderId, jobSheet };
}

/**
 * The admin retry entry point. S8's flagged queue calls this; the UI is S8's.
 *
 * Allowed from `flagged` and from `paid` (an order whose fulfilment never fired
 * at all, because the process died between the ITN and the after() callback).
 * Anything already at the printer comes back "already-fulfilled". Only what is
 * missing is regenerated: generatePrintFile skips any artwork that already has
 * a key, so a three-line order with one bad line costs one generation, not three.
 *
 * THE GUARD THAT MATTERS. `flagged` has two meanings in this shop. Fulfilment
 * flags an order that was paid and could not be printed. The ITN webhook also
 * flags an order whose notification did not reconcile, and THAT order was never
 * paid. Retrying the second kind would mark an unpaid order paid and print it,
 * which is a free garment for whoever posted the notification. The two are told
 * apart by payfastPaymentId: the webhook only writes it on the transition that
 * actually pays an order, so an unreconciled flag has none, and the guarded
 * UPDATE below refuses to un-flag it.
 *
 * @param orderId the order to retry.
 * @returns the same result shape as fulfillPaidOrder.
 */
export async function retryFulfillment(
  orderId: string,
): Promise<FulfillmentResult> {
  const db = await getDb();
  const order = await loadOrder(db, orderId);

  if (!order) return { status: "refused", orderId, reason: "order-not-found" };

  if (order.status === "flagged") {
    const restored = await db
      .update(orders)
      .set({ status: "paid" })
      .where(
        and(
          eq(orders.id, orderId),
          eq(orders.status, "flagged"),
          // Never invent a payment. See the note above: no payment id means the
          // webhook flagged this before it ever paid, and it stays flagged.
          isNotNull(orders.payfastPaymentId),
        ),
      )
      .returning();

    if (restored.length === 0) {
      return {
        status: "refused",
        orderId,
        reason: "flagged-without-payment",
      };
    }

    await record(db, orderId, "fulfil", "ok", "retry: flagged back to paid");
  } else if (order.status !== "paid" && !FULFILLED_STATES.has(order.status)) {
    return { status: "refused", orderId, reason: `not-retryable:${order.status}` };
  }

  return fulfillPaidOrder(orderId);
}
