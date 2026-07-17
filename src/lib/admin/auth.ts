/**
 * The admin Data Access Layer: the single place that answers "is this request
 * the owner?", and the guard every admin page and action calls.
 *
 * WHY THIS EXISTS SEPARATELY FROM proxy.ts. Next 16's own guidance is blunt
 * about it: proxy (what used to be middleware) runs on every route including
 * prefetches, so it is the place for an optimistic redirect and NOT the place
 * to authorise. The check that actually decides has to sit next to the data.
 * So proxy.ts bounces the logged-out browser for a clean UX, and this module
 * refuses the request for real. A bug in the matcher is then a cosmetic bug,
 * not a data breach.
 *
 * See session.ts for what the cookie is and why an unconfigured admin is a
 * closed admin.
 */

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, verifySessionValue } from "./session";

/** Where an unauthenticated request gets sent. One constant, three callers. */
export const ADMIN_LOGIN_PATH = "/admin/login";

/**
 * Whether the current request carries a valid admin session.
 *
 * Memoised per render pass with React's cache(), so a page, its layout and the
 * three components under it all cost one cookie read and one HMAC rather than
 * five. It is not cached ACROSS requests: cookies() is request-scoped, and the
 * memo dies with the render.
 */
export const isAdminRequest = cache(async (): Promise<boolean> => {
  const store = await cookies();
  return verifySessionValue(store.get(ADMIN_COOKIE)?.value);
});

/**
 * The guard. Call it first in every admin page, server action and route handler.
 *
 * @throws a Next redirect to the login page when the session is absent, expired,
 * forged, or signed under a password that has since changed. It does not return
 * a boolean on purpose: a guard whose result you can forget to check is not a
 * guard.
 */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdminRequest())) redirect(ADMIN_LOGIN_PATH);
}
