/**
 * The admin session: a signed, expiring cookie and the code that mints and
 * checks it.
 *
 * WHY NOT AUTH.JS. Auth.js earns its keep when there are many users, several
 * providers, an accounts table and a session store to reconcile. This shop has
 * exactly one identity, defined by two environment variables, and no user table
 * to adapt. Against that, Auth.js v5 is a beta whose Next 16 story is unsettled
 * (Next 16 renamed middleware to proxy, which is where its route protection
 * lives), and it would introduce a second notion of "secret" and a second
 * session format into a codebase that already signs order links and asset URLs
 * with node:crypto HMACs. This module is the same pattern as order-token.ts,
 * roughly sixty lines, and has no version to fight. If a second admin or an SSO
 * requirement ever lands, that is the moment Auth.js starts paying for itself.
 *
 * WHAT THE COOKIE IS. `<exp>.<hmac>`, where the HMAC covers the expiry. It
 * carries no identity because there is only one identity: holding a valid
 * signature IS being the admin. It is not a bearer token for anything else, it
 * is scoped to /admin by path, and it is httpOnly so a stray script cannot read
 * it.
 *
 * WHERE THE SIGNING KEY COMES FROM, and why this is the fail-closed hinge. The
 * key is derived from ADMIN_PASSWORD_HASH. Two things fall out of that, both
 * wanted:
 *
 *   1. No ADMIN_PASSWORD_HASH means no key, which means no cookie can be minted
 *      OR verified. An unconfigured admin is a closed admin, structurally,
 *      rather than because someone remembered to write an if statement.
 *   2. Changing the admin password changes the key, which invalidates every
 *      session that was live under the old one. That is the behaviour you want
 *      from a password change and it costs nothing here.
 *
 * The hash is a salted scrypt digest that never leaves the server, so it is
 * acceptable key material. It is passed through HMAC-SHA256 with a fixed label
 * rather than used raw, so the signing key is not the hash itself and cannot be
 * walked back to it.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/** Cookie name. Scoped to /admin: nothing outside the dashboard needs to see it. */
export const ADMIN_COOKIE = "kc_admin_session";

/**
 * Twelve hours. Long enough that the owner checking orders through a working day
 * does not log in twice, short enough that a forgotten session on a borrowed
 * laptop dies the same day.
 */
export const SESSION_TTL_SEC = 12 * 60 * 60;

/**
 * The signing key, or null when admin is not configured.
 *
 * Read fresh on every call rather than cached at module load: tests stub the env
 * per case, and a process that read it once at import would answer with a stale
 * key for the rest of its life.
 */
function signingKey(): string | null {
  const hash = process.env.ADMIN_PASSWORD_HASH?.trim();
  if (!hash) return null;
  return createHmac("sha256", hash).update("kc.admin.session.v1").digest("hex");
}

/**
 * True when the admin login is configured at all, i.e. both halves of the single
 * identity are present. Everything else in this module returns null or false
 * when this is false. The login page reads it to explain itself in development.
 */
export function adminConfigured(): boolean {
  return (
    !!process.env.ADMIN_EMAIL?.trim() && !!process.env.ADMIN_PASSWORD_HASH?.trim()
  );
}

function signatureFor(payload: string, key: string): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

/**
 * Mints a session value that expires SESSION_TTL_SEC from now.
 *
 * @returns the cookie value, or null when admin is not configured (in which case
 * there is nothing to log in to and nothing should be minted).
 */
export function createSessionValue(now: number = Date.now()): string | null {
  const key = signingKey();
  if (!key) return null;
  const exp = Math.floor(now / 1000) + SESSION_TTL_SEC;
  return `${exp}.${signatureFor(String(exp), key)}`;
}

/**
 * Checks a cookie value.
 *
 * @param value whatever arrived in the cookie. Any type, because this is
 * attacker-controlled input and "there was no cookie" is the common case.
 * @returns true only for a well-formed, correctly signed, unexpired value that
 * was signed by the CURRENT password hash. False for everything else, with no
 * distinction between the failures: none of them is a different answer to "may
 * this request see orders".
 */
export function verifySessionValue(
  value: unknown,
  now: number = Date.now(),
): boolean {
  if (typeof value !== "string" || value === "") return false;

  const key = signingKey();
  // Fail closed. No configured admin means no valid session exists, even if the
  // browser is holding a cookie that was valid before the env var went away.
  if (!key) return false;

  const seam = value.indexOf(".");
  if (seam <= 0 || seam === value.length - 1) return false;

  const rawExp = value.slice(0, seam);
  const given = value.slice(seam + 1);

  // Expiry is checked before the HMAC only because it is cheaper; the signature
  // still has to hold, so an edited expiry buys nothing.
  const exp = Number(rawExp);
  if (!Number.isInteger(exp) || exp * 1000 <= now) return false;

  const expected = signatureFor(rawExp, key);
  // timingSafeEqual throws on a length mismatch and a hostile cookie is any
  // length it likes. The length of an HMAC is not a secret.
  if (given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

/** The cookie attributes, in one place so the login and logout paths agree. */
export function sessionCookieOptions(maxAge: number = SESSION_TTL_SEC) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    // Only over TLS in production. Left off locally so http://localhost works.
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge,
  };
}
