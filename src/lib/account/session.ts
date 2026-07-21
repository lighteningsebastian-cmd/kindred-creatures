/**
 * The customer session: a signed, expiring cookie that carries a customerId,
 * and the crypto that mints and checks it. This is the account-holder twin of
 * lib/admin/session.ts, and it is the same node:crypto HMAC pattern used there
 * and in order-token.ts. There is deliberately no Auth.js: the shop already
 * signs order links and admin sessions with HMACs, and a second session format
 * would be one more thing to reconcile for no gain.
 *
 * WHAT THE COOKIE IS. `<customerId>.<exp>.<hmac>`, where the HMAC covers
 * `<customerId>.<exp>`. Unlike the admin cookie (one identity, so it carries no
 * id) this one names WHICH customer, because there are many. The id is a random
 * uuid that reveals nothing on its own; holding a valid signature over it is
 * what proves the bearer signed in. It is httpOnly so a stray script cannot read
 * it, SameSite=Lax so it does not ride along on a cross-site POST, and secure in
 * production so it never crosses plain HTTP.
 *
 * WHERE THE SIGNING KEY COMES FROM. A dedicated SESSION_SECRET if set, otherwise
 * ORDER_TOKEN_SECRET (the spec allows either; both are server-only HMAC secrets
 * of the same shape), passed through HMAC-SHA256 with a fixed label so the
 * signing key is domain-separated from raw order-token signatures: a session
 * cookie can never be replayed as an order token or vice versa. In production a
 * missing secret throws rather than signing with a public constant, exactly like
 * order-token.ts; in dev a repo constant keeps the shop running with an empty
 * .env.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/** Cookie name. Scoped to "/" because account pages and the account API sit at
 * different path roots and all need to read it. */
export const CUSTOMER_COOKIE = "kc_customer_session";

/**
 * Thirty days. A returning customer should not have to re-request a link every
 * visit; this is a convenience login for viewing your own creatures and re-order
 * history, not a bank, so a month-long session is the right trade. Single-use
 * magic tokens (15 min) are the tight part; the session they mint is the loose
 * part on purpose.
 */
export const CUSTOMER_SESSION_TTL_SEC = 30 * 24 * 60 * 60;

/**
 * Local-only fallback so the shop runs end to end with an empty .env, matching
 * order-token.ts and the mock service paths. In the repository, so forgeable:
 * production refuses it.
 */
const DEV_SECRET = "kindred-dev-customer-session-secret-not-for-production";

/**
 * The raw secret. SESSION_SECRET wins if set (the spec's dedicated option),
 * else ORDER_TOKEN_SECRET (reused). Read fresh on every call, never cached at
 * module load, so tests can stub the env per case.
 */
function secret(): string {
  const configured =
    process.env.SESSION_SECRET?.trim() || process.env.ORDER_TOKEN_SECRET?.trim();
  if (configured) return configured;

  if (process.env.NODE_ENV === "production") {
    // Failing to boot beats handing out forgeable sessions. Anyone who had read
    // this file could otherwise mint a session for any customerId.
    throw new Error(
      "Neither SESSION_SECRET nor ORDER_TOKEN_SECRET is set. Customer sessions cannot be signed.",
    );
  }
  return DEV_SECRET;
}

/** The signing key: the secret run through a labelled HMAC, so it is not the raw
 * order-token secret and cannot be walked back to it. */
function signingKey(): string {
  return createHmac("sha256", secret())
    .update("kc.customer.session.v1")
    .digest("hex");
}

function signatureFor(payload: string): string {
  return createHmac("sha256", signingKey()).update(payload).digest("base64url");
}

/**
 * Mints a session value for `customerId` that expires CUSTOMER_SESSION_TTL_SEC
 * from now. The customerId is expected to be a uuid (no dots); the format relies
 * on neither it nor the base64url signature containing a dot.
 */
export function createCustomerSessionValue(
  customerId: string,
  now: number = Date.now(),
): string {
  const exp = Math.floor(now / 1000) + CUSTOMER_SESSION_TTL_SEC;
  const payload = `${customerId}.${exp}`;
  return `${payload}.${signatureFor(payload)}`;
}

/**
 * Checks a cookie value and returns the customerId it vouches for, or null.
 *
 * @param value whatever arrived in the cookie. Any type: this is
 * attacker-controlled input and "there was no cookie" is the common case.
 * @returns the customerId for a well-formed, correctly signed, unexpired value;
 * null for everything else, with no distinction between the failures (missing,
 * malformed, expired, forged, edited). A caller must not be able to tell a
 * forged cookie from a stale one.
 */
export function verifyCustomerSessionValue(
  value: unknown,
  now: number = Date.now(),
): string | null {
  if (typeof value !== "string" || value === "") return null;

  // The signature is everything after the LAST dot; the payload is everything
  // before it, and the payload itself is `<customerId>.<exp>`.
  const seam = value.lastIndexOf(".");
  if (seam <= 0 || seam === value.length - 1) return null;

  const payload = value.slice(0, seam);
  const given = value.slice(seam + 1);

  const mid = payload.indexOf(".");
  if (mid <= 0 || mid === payload.length - 1) return null;
  const customerId = payload.slice(0, mid);
  const rawExp = payload.slice(mid + 1);

  // Expiry is checked before the HMAC only because it is cheaper; the signature
  // still has to hold, so an edited expiry buys nothing.
  const exp = Number(rawExp);
  if (!Number.isInteger(exp) || exp * 1000 <= now) return null;

  const expected = signatureFor(payload);
  // timingSafeEqual throws on a length mismatch and a hostile cookie is any
  // length it likes. The length of an HMAC is not a secret.
  if (given.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(given), Buffer.from(expected))) return null;

  return customerId;
}

/** The cookie attributes, in one place so the set and clear paths agree. Path is
 * "/" (not /admin) because the whole site reads this session. */
export function customerSessionCookieOptions(
  maxAge: number = CUSTOMER_SESSION_TTL_SEC,
) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    // Only over TLS in production. Left off locally so http://localhost works.
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}
