/**
 * Signed order-lookup tokens.
 *
 * A confirmation page has to be reachable by someone with no account and no
 * session: PayFast redirects a browser back to us and that redirect is the
 * whole of our relationship with them. The obvious URL, /order/<orderId>, turns
 * the orders table into a public lookup keyed by a value that is sitting in the
 * payment form the customer just posted (and in any referrer or browser history
 * along the way). The token is what makes the URL unguessable while keeping it
 * a plain link, so the same link can go in the confirmation email later.
 *
 * What the token proves and what it does not:
 *   - It proves the bearer was handed this order's URL by us. That is all.
 *   - It says NOTHING about payment. A token is minted at checkout, before a
 *     cent moves, so the page it unlocks must read status out of the database.
 *     Bearer of a token != payer of an invoice.
 *   - It is not a login. There is no expiry and no revocation: the URL is the
 *     credential, exactly like an unsubscribe link. That is the right trade for
 *     a page that shows one order's status to the person who placed it, and it
 *     would be the wrong trade for anything that could change the order.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Local-only fallback so the shop runs end to end with an empty .env, matching
 * the mock paths in payfast.ts and images/. This constant is in the repository,
 * so anyone reading it could forge tokens: production refuses to use it.
 */
const DEV_SECRET = "kindred-dev-order-token-secret-not-for-production";

function secret(): string {
  const configured = process.env.ORDER_TOKEN_SECRET?.trim();
  if (configured) return configured;

  if (process.env.NODE_ENV === "production") {
    // Failing to boot beats serving forgeable order links. Anyone who had read
    // this file could otherwise mint a token for any order id they could guess.
    throw new Error(
      "ORDER_TOKEN_SECRET is not set. Order links cannot be signed.",
    );
  }
  return DEV_SECRET;
}

function signatureFor(orderId: string): string {
  return createHmac("sha256", secret()).update(orderId).digest("base64url");
}

/**
 * Mints the token for an order id. The order id stays legible in the token so a
 * support query can be traced from a URL without cracking anything; the HMAC
 * beside it is what makes the pair unguessable.
 */
export function signOrderToken(orderId: string): string {
  return `${orderId}.${signatureFor(orderId)}`;
}

/**
 * Returns the order id a token vouches for, or null. Null covers every failure
 * (malformed, truncated, wrong secret, edited id) because the caller must treat
 * them identically: a 404 that never says which of those it was.
 */
export function verifyOrderToken(token: unknown): string | null {
  if (typeof token !== "string" || token === "") return null;

  // Neither a uuid nor base64url contains a dot, so the last one is the seam.
  const seam = token.lastIndexOf(".");
  if (seam <= 0 || seam === token.length - 1) return null;

  const orderId = token.slice(0, seam);
  const given = token.slice(seam + 1);
  const expected = signatureFor(orderId);

  // timingSafeEqual throws on a length mismatch, and a hostile token can be any
  // length at all. The length itself is not a secret.
  if (given.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(given), Buffer.from(expected))) return null;

  return orderId;
}
