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

function signatureFor(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/**
 * The shared core: given `<payload>.<signature>`, returns the payload the
 * signature vouches for, or null. Null covers every failure (malformed,
 * truncated, wrong secret, edited payload) because callers must treat them
 * identically. It is exported as neither: the two token families below wrap it,
 * one keeping the payload legible (order ids) and one carrying an opaque
 * base64url payload (arbitrary strings such as an email).
 *
 * The seam is the LAST dot. A base64url signature never contains a dot, so
 * whatever sits before that final dot is the whole payload, dots and all. That
 * is what lets an order id (no dots) and a base64url-encoded value (no dots)
 * and, in principle, a raw payload that does contain dots all round-trip.
 */
function verifySigned(token: unknown): string | null {
  if (typeof token !== "string" || token === "") return null;

  const seam = token.lastIndexOf(".");
  if (seam <= 0 || seam === token.length - 1) return null;

  const payload = token.slice(0, seam);
  const given = token.slice(seam + 1);
  const expected = signatureFor(payload);

  // timingSafeEqual throws on a length mismatch, and a hostile token can be any
  // length at all. The length itself is not a secret.
  if (given.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(given), Buffer.from(expected))) return null;

  return payload;
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
  return verifySigned(token);
}

/**
 * Signs an arbitrary string with the same secret and timing-safe scheme as the
 * order token, for links that carry a value which is not a uuid: the unsubscribe
 * link signs a normalised email. The payload is base64url-encoded so the token
 * is a clean two-part `<encoded>.<signature>` with no dots in either half, and
 * so the raw value (an email address) is not sitting in plain sight in the URL.
 * Encoding is not encryption: it hides nothing from anyone who base64-decodes
 * it. The security is entirely in the HMAC, which is what stops the value being
 * swapped for another.
 */
export function signToken(value: string): string {
  const encoded = Buffer.from(value, "utf8").toString("base64url");
  return `${encoded}.${signatureFor(encoded)}`;
}

/**
 * Returns the value a token minted by `signToken` vouches for, or null on any
 * failure (malformed, truncated, wrong secret, tampered payload). Null and only
 * null on the bad path: a caller must not be able to tell a forged token from a
 * merely stale one, and must never be handed a half-decoded value.
 */
export function verifyToken(token: unknown): string | null {
  const encoded = verifySigned(token);
  if (encoded === null) return null;
  try {
    return Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }
}
