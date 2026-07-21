/**
 * Reading orders for the dashboard, and the one distinction the whole screen
 * turns on.
 *
 * FLAGGED MEANS TWO DIFFERENT THINGS and conflating them costs real money.
 *
 *   1. The order was PAID and the print file could not be made. The payment
 *      stands, the garment is owed, and a retry is exactly the right button.
 *   2. The order's payment NEVER RECONCILED. The ITN webhook flags these, and
 *      such an order has never been paid for. retryFulfillment refuses it with
 *      "flagged-without-payment" and will not un-flag it.
 *
 * They are told apart by payfastPaymentId, which only the verified ITN writes,
 * and only on the transition that actually pays an order. So: a payment id means
 * money arrived. No payment id on a flagged order means nobody paid.
 *
 * The screen must never let the second kind look like the first. Printing one is
 * a free garment couriered to whoever posted a bad notification, and the person
 * clicking is tired and it is 6pm. So the two get different words, different
 * colours, and different buttons, and that decision is made HERE, once, rather
 * than in each component that might forget.
 */

import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  artworks,
  fulfillmentEvents,
  orderItems,
  orders,
  type Artwork,
  type FulfillmentEvent,
  type Order,
  type OrderItem,
  type OrderStatus,
} from "@/lib/db/schema";
import { getProduct } from "@/lib/products";
import { getStorage } from "@/lib/storage";

/** How long an artwork link on the dashboard stays good. One working session. */
const ADMIN_LINK_TTL_SEC = 60 * 60;

/** What each status is called on screen. Plain and operational, not marketing. */
export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Awaiting payment",
  paid: "Paid",
  sent_to_printer: "At printer",
  printed: "Printed",
  shipped: "Shipped",
  flagged: "Flagged",
};

/**
 * What, if anything, this order needs a human to do. Null means it is fine where
 * it is (pending is waiting on PayFast, shipped is done).
 */
export type Concern =
  /** Paid, print failed. Retryable, and we owe them a garment. */
  | "print-failed"
  /** Never paid. NOT retryable, and must never be printed. */
  | "never-paid"
  /** Paid and fulfilment has not run yet. Usually seconds; hours means trouble. */
  | "awaiting-print";

/**
 * The single place that reads payfastPaymentId to tell the two flags apart.
 *
 * @param order the row.
 * @returns the concern, or null when nothing is owed.
 */
export function concernFor(order: Pick<Order, "status" | "payfastPaymentId">): Concern | null {
  if (order.status === "flagged") {
    return order.payfastPaymentId ? "print-failed" : "never-paid";
  }
  if (order.status === "paid") return "awaiting-print";
  return null;
}

/** True for the orders the "needs attention" filter shows. */
export function needsAttention(
  order: Pick<Order, "status" | "payfastPaymentId">,
): boolean {
  return concernFor(order) !== null;
}

/** The short order reference the shop quotes. Matches the emails' orderRef. */
export function shortRef(orderId: string): string {
  return orderId.slice(0, 8).toUpperCase();
}

export type OrderFilter = "attention" | "all";

export function parseFilter(value: unknown): OrderFilter {
  return value === "all" ? "all" : "attention";
}

export type OrderListRow = {
  id: string;
  status: OrderStatus;
  createdAt: Date;
  customerName: string;
  email: string;
  itemCount: number;
  totalZar: number;
  trackingNumber: string | null;
  concern: Concern | null;
};

/**
 * The order list, newest first.
 *
 * @param filter "attention" for the orders needing a human, "all" for everything.
 * @returns the rows the list renders. Filtering happens in JS rather than SQL
 * because "needs attention" is the payfastPaymentId distinction above, and that
 * rule lives in one function rather than being half-expressed in a WHERE clause.
 * A shop with one owner does not have the order volume for that to matter.
 */
export async function listAdminOrders(
  filter: OrderFilter = "attention",
): Promise<OrderListRow[]> {
  const db = await getDb();
  const rows = await db.select().from(orders).orderBy(desc(orders.createdAt));

  const wanted = filter === "all" ? rows : rows.filter(needsAttention);
  if (wanted.length === 0) return [];

  const items = await db
    .select()
    .from(orderItems)
    .where(inArray(orderItems.orderId, wanted.map((order) => order.id)));

  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item.orderId, (counts.get(item.orderId) ?? 0) + item.qty);
  }

  return wanted.map((order) => ({
    id: order.id,
    status: order.status,
    createdAt: order.createdAt,
    customerName: `${order.firstName} ${order.lastName}`.trim(),
    email: order.email,
    itemCount: counts.get(order.id) ?? 0,
    totalZar: order.totalZar,
    trackingNumber: order.trackingNumber,
    concern: concernFor(order),
  }));
}

export type AdminOrderLine = OrderItem & {
  productName: string;
  artwork: Artwork | null;
  /** Short-lived signed URL for the preview, or null. */
  previewUrl: string | null;
  /** Short-lived signed URL for the print file, or null when not made yet. */
  printUrl: string | null;
};

export type AdminOrderDetail = {
  order: Order;
  lines: AdminOrderLine[];
  events: FulfillmentEvent[];
  concern: Concern | null;
};

/**
 * One order, with everything the detail page shows.
 *
 * Artwork links are signed and expire in an hour: they grant whoever holds them
 * a customer's photo, so the page carries a lease rather than a permanent URL,
 * the same bargain the job sheet makes.
 *
 * @param orderId the order to open.
 * @returns the detail, or null when there is no such order.
 */
export async function getAdminOrder(
  orderId: string,
): Promise<AdminOrderDetail | null> {
  const db = await getDb();

  let order: Order | undefined;
  try {
    [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  } catch {
    // Malformed uuid. Not an order, not a fault.
    return null;
  }
  if (!order) return null;

  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  const art = items.length
    ? await db
        .select()
        .from(artworks)
        .where(inArray(artworks.id, items.map((item) => item.artworkId)))
    : [];
  const byId = new Map(art.map((artwork) => [artwork.id, artwork]));

  const storage = getStorage();
  const lines = await Promise.all(
    items.map(async (item) => {
      const artwork = byId.get(item.artworkId) ?? null;
      return {
        ...item,
        productName: getProduct(item.productSlug)?.name ?? item.productSlug,
        artwork,
        previewUrl: artwork?.previewKey
          ? await storage.getSignedUrl(artwork.previewKey, ADMIN_LINK_TTL_SEC)
          : null,
        // The print file is per garment now (retention B3): its key lives on the
        // order_item, not the artwork. A line with none is not yet printed.
        printUrl: item.printKey
          ? await storage.getSignedUrl(item.printKey, ADMIN_LINK_TTL_SEC)
          : null,
      };
    }),
  );

  const events = await db
    .select()
    .from(fulfillmentEvents)
    .where(eq(fulfillmentEvents.orderId, orderId))
    .orderBy(fulfillmentEvents.createdAt);

  return { order, lines, events, concern: concernFor(order) };
}

/** True when every line has a print file, which is what a re-send needs. */
export function hasPrintFiles(lines: AdminOrderLine[]): boolean {
  return lines.length > 0 && lines.every((line) => !!line.printUrl);
}
