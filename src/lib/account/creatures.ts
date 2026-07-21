/**
 * The read side of a customer's account: the creatures they own and the orders
 * they have placed. Server-only, and every query is scoped by the session
 * customerId the caller passes in. Nothing here takes an artworkId or orderId on
 * its own authority: a portrait or an order is only ever reached THROUGH the
 * customer's own paid orders, so one customer can never read another's data even
 * by guessing an id.
 *
 * "Your creatures" is derived, never duplicated. A creature is any DISTINCT
 * artwork reachable from one of this customer's PAID-or-later orders. The card
 * shows the artwork's watermarked preview (via a short-lived signed URL) and its
 * style; the high-res print file is never exposed here. See the design spec's
 * "Derived data" section.
 *
 * This module reads storage keys and signs URLs; it is imported only by server
 * components and server actions, never by client code (matching the admin DAL,
 * which relies on the same discipline rather than the server-only package the
 * repo does not depend on).
 */

import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  artworks,
  orderItems,
  orders,
  type OrderStatus,
} from "@/lib/db/schema";
import {
  ART_STYLE_LABELS,
  type ArtStyle,
} from "@/lib/images/provider";
import { getStorage } from "@/lib/storage";

/**
 * The statuses that mean "the customer owns this portrait": payment has settled
 * and the order is somewhere on the fulfilment path. A pending or flagged order
 * has not been paid for, so its artwork is NOT a creature the customer owns and
 * must never appear or be reorderable. Mirrors the spec exactly.
 */
export const OWNED_ORDER_STATUSES: OrderStatus[] = [
  "paid",
  "sent_to_printer",
  "printed",
  "shipped",
];

/** How long a creature thumbnail link stays good. One browsing session. */
const CREATURE_LINK_TTL_SEC = 60 * 60;

/** How each order status reads in the compact account order list. Warmer than
 * the operational admin labels; this is the customer's own history. */
export const CUSTOMER_ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Awaiting payment",
  paid: "Paid, off to be printed",
  sent_to_printer: "At the print shop",
  printed: "Printed and packed",
  shipped: "On its way to you",
  flagged: "We are checking this one",
};

export type CustomerCreature = {
  artworkId: string;
  style: ArtStyle | null;
  /** Human style label, or a gentle fallback when the style is somehow unset. */
  styleLabel: string;
  /** Short-lived signed URL for the watermarked preview, or null if we have none. */
  previewUrl: string | null;
  /** When this portrait was first ordered (earliest owning order). */
  firstOrderedAt: Date;
};

/**
 * The DISTINCT artworks this customer owns, newest creature first.
 *
 * Reachability IS the authorization: the query starts at the customer's own
 * owned orders and walks to artworks, so a row can only come back if it belongs
 * to this customer. There is no id path in from the outside. An artwork ordered
 * on two orders collapses to one creature, dated by the earliest of them.
 *
 * @param customerId the session customer. Callers pass their OWN id, never one
 * taken from the request.
 */
export async function listCreaturesForCustomer(
  customerId: string,
): Promise<CustomerCreature[]> {
  const db = await getDb();

  const rows = await db
    .select({
      artworkId: artworks.id,
      style: artworks.style,
      previewKey: artworks.previewKey,
      orderedAt: orders.createdAt,
    })
    .from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .innerJoin(artworks, eq(artworks.id, orderItems.artworkId))
    .where(
      and(
        eq(orders.customerId, customerId),
        inArray(orders.status, OWNED_ORDER_STATUSES),
      ),
    );

  // Collapse to one entry per artwork, keeping the earliest owning order date.
  // Dedup in JS: a single-owner shop has nowhere near the volume to need a
  // window function, and the DISTINCT-with-min reads clearer here.
  const byArtwork = new Map<
    string,
    { style: ArtStyle | null; previewKey: string | null; firstOrderedAt: Date }
  >();
  for (const row of rows) {
    const existing = byArtwork.get(row.artworkId);
    if (!existing) {
      byArtwork.set(row.artworkId, {
        style: row.style,
        previewKey: row.previewKey,
        firstOrderedAt: row.orderedAt,
      });
    } else if (row.orderedAt < existing.firstOrderedAt) {
      existing.firstOrderedAt = row.orderedAt;
    }
  }

  const storage = getStorage();
  const creatures = await Promise.all(
    [...byArtwork.entries()].map(async ([artworkId, v]) => ({
      artworkId,
      style: v.style,
      styleLabel: v.style ? ART_STYLE_LABELS[v.style] : "Your portrait",
      previewUrl: v.previewKey
        ? await storage.getSignedUrl(v.previewKey, CREATURE_LINK_TTL_SEC)
        : null,
      firstOrderedAt: v.firstOrderedAt,
    })),
  );

  // Newest creature first: the last portrait they made is the one they are most
  // likely to want on something new.
  creatures.sort(
    (a, b) => b.firstOrderedAt.getTime() - a.firstOrderedAt.getTime(),
  );
  return creatures;
}

/**
 * Whether `artworkId` is one of this customer's owned creatures, i.e. reachable
 * from one of their PAID-or-later orders. This is the authorization check the
 * re-order flow (B4) calls before letting anyone put a saved portrait back in a
 * cart: it must refuse an artwork from someone else's order, and an artwork from
 * this customer's own UNPAID order too.
 *
 * @returns true only when the customer owns the artwork; false for a stranger's
 * artwork, an unpaid artwork, or a nonexistent/malformed id (never throws on a
 * bad uuid, so a probe cannot tell a refusal from an error).
 */
export async function customerOwnsArtwork(
  customerId: string,
  artworkId: string,
): Promise<boolean> {
  const db = await getDb();
  try {
    const [hit] = await db
      .select({ id: orderItems.id })
      .from(orders)
      .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
      .where(
        and(
          eq(orders.customerId, customerId),
          eq(orderItems.artworkId, artworkId),
          inArray(orders.status, OWNED_ORDER_STATUSES),
        ),
      )
      .limit(1);
    return !!hit;
  } catch {
    // Malformed uuid: not owned, not a fault.
    return false;
  }
}

export type CustomerOrderRow = {
  id: string;
  /** The short reference the shop quotes, matching the emails' orderRef. */
  ref: string;
  status: OrderStatus;
  statusLabel: string;
  createdAt: Date;
  /** Items counted by quantity, not by line. */
  itemCount: number;
  totalZar: number;
};

/**
 * This customer's orders, newest first. Every status is included (a pending or
 * flagged order is still the customer's own history and they should see it),
 * scoped strictly to their customerId.
 */
export async function listOrdersForCustomer(
  customerId: string,
): Promise<CustomerOrderRow[]> {
  const db = await getDb();

  const rows = await db
    .select()
    .from(orders)
    .where(eq(orders.customerId, customerId))
    .orderBy(desc(orders.createdAt));
  if (rows.length === 0) return [];

  const items = await db
    .select()
    .from(orderItems)
    .where(
      inArray(
        orderItems.orderId,
        rows.map((order) => order.id),
      ),
    );
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item.orderId, (counts.get(item.orderId) ?? 0) + item.qty);
  }

  return rows.map((order) => ({
    id: order.id,
    ref: order.id.slice(0, 8).toUpperCase(),
    status: order.status,
    statusLabel: CUSTOMER_ORDER_STATUS_LABEL[order.status],
    createdAt: order.createdAt,
    itemCount: counts.get(order.id) ?? 0,
    totalZar: order.totalZar,
  }));
}
