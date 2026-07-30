import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  artworks,
  orderItems,
  orders,
  type Artwork,
  type Order,
} from "@/lib/db/schema";
import { verifyApprovalToken } from "@/lib/approval";
import { isTemperament, type Temperament } from "@/lib/breeds";
import type { CompanionProfile } from "@/lib/companion";
import {
  adjustmentsFor,
  isRevisionReason,
  needsHuman,
  normaliseNote,
  type RevisionReason,
} from "@/lib/revision";

/**
 * Saying yes, and saying not quite.
 *
 * Nothing reaches the printer until `approvedAt` is set. That is the whole of
 * the promise the site has always made, and moving generation after payment
 * does not change it: the customer still sees the portrait before it is made.
 */

/** One round of "not quite", kept for a person to read. */
export interface RevisionEntry {
  reasons: RevisionReason[];
  /** The customer's own words. Read by a human, never by the model. */
  note: string | null;
  at: string;
}

export type ApprovalOutcome =
  | { status: "approved"; artwork: Artwork }
  | { status: "already-approved"; artwork: Artwork }
  | { status: "refused"; reason: "bad-token" | "not-found" };

export type RevisionOutcome =
  | { status: "queued"; artwork: Artwork; reasons: RevisionReason[] }
  /** The ladder ran out of automated rounds. A person takes it from here. */
  | { status: "handed-over"; artwork: Artwork; reasons: RevisionReason[] }
  | { status: "refused"; reason: "bad-token" | "not-found" | "already-approved" };

async function load(token: unknown): Promise<Artwork | "bad-token" | "not-found"> {
  const artworkId = verifyApprovalToken(token);
  if (!artworkId) return "bad-token";
  const db = await getDb();
  const [row] = await db.select().from(artworks).where(eq(artworks.id, artworkId));
  return row ?? "not-found";
}

export function readRevisions(artwork: Artwork): RevisionEntry[] {
  if (!artwork.revisionNotes) return [];
  try {
    const parsed = JSON.parse(artwork.revisionNotes);
    return Array.isArray(parsed) ? (parsed as RevisionEntry[]) : [];
  } catch {
    // A malformed log is not worth failing an approval over.
    return [];
  }
}

/** The artwork behind a link, for rendering the page. Never logs anyone in. */
export async function artworkForApproval(
  token: unknown,
): Promise<Artwork | null> {
  const found = await load(token);
  return typeof found === "string" ? null : found;
}

/**
 * Yes, print it.
 *
 * Idempotent: a second click, or a link opened twice, reports the approval it
 * already has rather than moving the timestamp. The timestamp is what releases
 * the job sheet, so it must mean "the moment they said yes" and not "the last
 * time they looked".
 */
export async function approveArtwork(token: unknown): Promise<ApprovalOutcome> {
  const found = await load(token);
  if (typeof found === "string") return { status: "refused", reason: found };
  if (found.approvedAt) return { status: "already-approved", artwork: found };

  const db = await getDb();
  const [row] = await db
    .update(artworks)
    .set({ approvedAt: new Date() })
    .where(eq(artworks.id, found.id))
    .returning();

  return { status: "approved", artwork: row ?? found };
}

/**
 * Something is not quite right.
 *
 * Records what they ticked and what they wrote, and counts the round. The chip
 * ids are validated here as well as at the prompt: a request body is not a
 * trust boundary, and these are the only customer input that ever influences a
 * drawing.
 *
 * The customer is never told which round they are on. A visible limit turns a
 * service into a ration; the tone simply becomes personal instead.
 */
export async function requestRevision(
  token: unknown,
  reasons: unknown,
  note: unknown,
): Promise<RevisionOutcome> {
  const found = await load(token);
  if (typeof found === "string") return { status: "refused", reason: found };
  // Approved artwork is on its way to a press. Changing it needs a person.
  if (found.approvedAt) return { status: "refused", reason: "already-approved" };

  const validReasons = (Array.isArray(reasons) ? reasons : []).filter(
    isRevisionReason,
  );
  const entry: RevisionEntry = {
    reasons: validReasons,
    note: normaliseNote(note),
    at: new Date().toISOString(),
  };

  const nextCount = found.revisionCount + 1;
  const db = await getDb();
  const [row] = await db
    .update(artworks)
    .set({
      revisionCount: nextCount,
      revisionNotes: JSON.stringify([...readRevisions(found), entry]),
    })
    .where(eq(artworks.id, found.id))
    .returning();

  const artwork = row ?? found;
  // needsHuman reads the count BEFORE this round, so a third request is the
  // one that stops.
  return needsHuman(found.revisionCount)
    ? { status: "handed-over", artwork, reasons: validReasons }
    : { status: "queued", artwork, reasons: validReasons };
}

/**
 * The prompt adjustments for the most recent round, for the regeneration that
 * follows. Our own sentences only, never the customer's.
 */
export function adjustmentsForLatest(artwork: Artwork): string[] {
  const rounds = readRevisions(artwork);
  return adjustmentsFor(rounds[rounds.length - 1]?.reasons ?? []);
}

/**
 * The companion profile as stored on an artwork row.
 *
 * The JSON columns are read defensively: a row that predates a column, or one
 * hand-edited in a console, must render a plate rather than throw. A missing
 * value simply omits its row, which is what the plate does anyway.
 */
export function profileFromArtwork(artwork: Artwork): CompanionProfile {
  const parse = <T,>(raw: string | null, fallback: T): T => {
    if (!raw) return fallback;
    try {
      const value = JSON.parse(raw);
      return Array.isArray(value) ? (value as T) : fallback;
    } catch {
      return fallback;
    }
  };

  return {
    name: artwork.creatureName,
    species: artwork.species ?? "dog",
    breedId: artwork.breedId,
    temperament: parse<Temperament[]>(artwork.temperament, []).filter(
      isTemperament,
    ),
    togetherSince: artwork.togetherSince,
    otherKind: artwork.otherKind,
    otherBreed: artwork.otherBreed,
    otherOrigin: artwork.otherOrigin,
  };
}

/**
 * The order a piece of artwork belongs to, or null.
 *
 * An artwork reaches an order through its line items, so this is the join the
 * approval flow needs to tell somebody their piece is going to print.
 */
export async function orderForArtwork(artworkId: string): Promise<Order | null> {
  const db = await getDb();
  const [row] = await db
    .select({ order: orders })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(eq(orderItems.artworkId, artworkId))
    .limit(1);
  return row?.order ?? null;
}

/**
 * Approve on the customer's behalf, from the admin queue.
 *
 * The owner does this after speaking to somebody, so there is no token: the
 * authority is the admin session, checked by the caller. Same idempotence as
 * the customer path, and the same meaning: this timestamp releases the job
 * sheet.
 */
export async function approveArtworkById(
  artworkId: string,
): Promise<Artwork | null> {
  const db = await getDb();
  const [existing] = await db
    .select()
    .from(artworks)
    .where(eq(artworks.id, artworkId));
  if (!existing) return null;
  if (existing.approvedAt) return existing;

  const [row] = await db
    .update(artworks)
    .set({ approvedAt: new Date() })
    .where(eq(artworks.id, artworkId))
    .returning();
  return row ?? existing;
}

/** Takes an artwork off the automated path so a person deals with it. */
export async function markPersonalContact(
  artworkId: string,
): Promise<Artwork | null> {
  const db = await getDb();
  const [row] = await db
    .update(artworks)
    .set({ personalContactAt: new Date() })
    .where(eq(artworks.id, artworkId))
    .returning();
  return row ?? null;
}
