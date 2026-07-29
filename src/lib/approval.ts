import { signToken, verifyToken } from "@/lib/order-token";

/**
 * The link that lets somebody approve their portrait.
 *
 * Same HMAC and same secret as the order-status link, with one difference that
 * carries the whole security of it: the signed value is prefixed, so a token
 * minted for one job cannot do the other. An order-status link emailed with
 * every order must never be able to release a garment to the printer, and this
 * link must never do what a login does.
 *
 * VIEWING THIS LINK LOGS NOBODY IN. It authorises exactly one artwork's
 * approval and nothing else. Reachability is not identity: whoever holds the
 * link can say yes to a portrait, which is the same trust the order-status
 * link already assumes, and no more.
 */

const PURPOSE = "approve:";

export function signApprovalToken(artworkId: string): string {
  return signToken(`${PURPOSE}${artworkId}`);
}

/**
 * The artwork this token approves, or null.
 *
 * Null covers every failure identically (forged, truncated, wrong secret, a
 * token minted for something else), because the caller must not be able to
 * tell them apart.
 */
export function verifyApprovalToken(token: unknown): string | null {
  const value = verifyToken(token);
  if (value === null || !value.startsWith(PURPOSE)) return null;
  const artworkId = value.slice(PURPOSE.length);
  return artworkId || null;
}
