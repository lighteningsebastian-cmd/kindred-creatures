import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { artworks, breedRequests, orderItems, orders } from "@/lib/db/schema";
import { readRevisions, type RevisionEntry } from "@/lib/artwork-approval";
import { needsHuman } from "@/lib/revision";

/**
 * The one screen the owner needs: what is waiting on somebody.
 *
 * Everything here is read-only reporting. The actions that change anything live
 * in the dashboard's server actions, where the admin session is checked.
 */

export interface AwaitingRow {
  artworkId: string;
  orderId: string;
  orderRef: string | null;
  email: string;
  firstName: string;
  creatureName: string | null;
  productSlug: string;
  revisionCount: number;
  revisions: RevisionEntry[];
  /** True once the automated rounds are used up, or the owner said so. */
  needsPerson: boolean;
  personalContactAt: Date | null;
  createdAt: Date;
}

/**
 * Paid orders whose artwork nobody has approved yet.
 *
 * Ordered by the ones a person has to deal with first, then oldest, because
 * the queue is read top down and the top is where the impatient customer is.
 */
export async function listAwaitingApproval(): Promise<AwaitingRow[]> {
  const db = await getDb();
  const rows = await db
    .select({ artwork: artworks, order: orders })
    .from(artworks)
    .innerJoin(orderItems, eq(orderItems.artworkId, artworks.id))
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    // Unpaid orders are not waiting on anybody: they are waiting on a payment.
    .where(and(isNull(artworks.approvedAt), eq(orders.status, "paid")))
    .orderBy(desc(artworks.revisionCount), artworks.createdAt);

  const seen = new Set<string>();
  const out: AwaitingRow[] = [];
  for (const { artwork, order } of rows) {
    // One line per artwork even when it appears on several order lines.
    if (seen.has(artwork.id)) continue;
    seen.add(artwork.id);
    out.push({
      artworkId: artwork.id,
      orderId: order.id,
      orderRef: order.publicRef,
      email: order.email,
      firstName: order.firstName,
      creatureName: artwork.creatureName,
      productSlug: artwork.productSlug,
      revisionCount: artwork.revisionCount,
      revisions: readRevisions(artwork),
      needsPerson:
        needsHuman(artwork.revisionCount) || artwork.personalContactAt !== null,
      personalContactAt: artwork.personalContactAt,
      createdAt: artwork.createdAt,
    });
  }
  return out;
}

export interface BreedRequestRow {
  query: string;
  species: string;
  count: number;
  lastAskedAt: Date;
}

/**
 * What people looked for and did not find, commonest first.
 *
 * This is the list that decides which breed gets drawn next, so it is grouped
 * by demand rather than shown as a raw log. Case and spacing are folded
 * together so "Shiba Inu" and "shiba  inu" count as the same ask.
 */
export async function listBreedRequests(
  limit = 50,
): Promise<BreedRequestRow[]> {
  const db = await getDb();
  const normalised = sql<string>`lower(trim(regexp_replace(${breedRequests.query}, '\\s+', ' ', 'g')))`;
  const rows = await db
    .select({
      query: normalised,
      species: breedRequests.species,
      count: sql<number>`count(*)::int`,
      lastAskedAt: sql<Date>`max(${breedRequests.createdAt})`,
    })
    .from(breedRequests)
    .groupBy(normalised, breedRequests.species)
    .orderBy(sql`count(*) desc`)
    .limit(limit);

  return rows.map((row) => ({
    query: row.query,
    species: row.species,
    count: Number(row.count),
    lastAskedAt: new Date(row.lastAskedAt),
  }));
}
