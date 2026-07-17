"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeEqual, verifyPassword } from "@/lib/admin/password";
import {
  recordFailure,
  recordSuccess,
  sleep,
  throttleFor,
} from "@/lib/admin/rate-limit";
import {
  ADMIN_COOKIE,
  createSessionValue,
  sessionCookieOptions,
} from "@/lib/admin/session";

/**
 * The one door into the admin.
 *
 * NO ENUMERATION. Every failure returns the same sentence. Not "no such admin",
 * not "wrong password", not a different HTTP status: one string, because the
 * difference between those two answers is the difference between guessing a
 * password and knowing whose password to guess. The costly scrypt verify runs
 * even when the email did not match, so the two paths cost the same wall time as
 * well as saying the same thing.
 *
 * NOTHING IS LOGGED. Not the email offered, not the password, not the hash, not
 * a hint. A failed admin login is not interesting enough to be worth a log line
 * that could contain someone's password because they typed it in the wrong box.
 */

export type LoginState = {
  /** The message to show, or null before the first attempt. */
  error: string | null;
};

/** The only failure sentence this action knows how to say. */
const REFUSED = "Those details do not match.";

/**
 * Who is knocking, for throttling purposes. Behind a proxy the socket address is
 * the proxy, so the forwarded header is the honest answer where we have one.
 * Spoofable in principle, which only means an attacker can dodge their own
 * throttle bucket, never that they can throttle somebody else out of the shop.
 */
async function callerKey(): Promise<string> {
  const head = await headers();
  const forwarded = head.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return head.get("x-real-ip")?.trim() || "unknown";
}

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const key = await callerKey();
  const throttle = throttleFor(key);

  if (throttle.locked) {
    return {
      error: "Too many attempts. Wait fifteen minutes and try again.",
    };
  }

  // The stall for previous failures happens before any work, so a caller cannot
  // time their way to knowing whether this attempt was even considered.
  await sleep(throttle.delayMs);

  const expectedEmail = process.env.ADMIN_EMAIL?.trim();
  const expectedHash = process.env.ADMIN_PASSWORD_HASH?.trim();

  // Deliberately NOT an early return. An unconfigured admin, a wrong address and
  // a wrong password all take the same path to the same sentence. verifyPassword
  // is false for an undefined hash, so this is safe as well as uniform: with no
  // hash configured, nothing can ever match, and admin stays shut.
  const emailOk = !!expectedEmail && safeEqual(email.trim().toLowerCase(), expectedEmail.toLowerCase());
  const passwordOk = await verifyPassword(password, expectedHash);

  if (!emailOk || !passwordOk) {
    recordFailure(key);
    return { error: REFUSED };
  }

  const session = createSessionValue();
  // Belt and braces: createSessionValue is null exactly when there is no hash,
  // which passwordOk has already ruled out. If that ever stops being true, the
  // login fails rather than handing out an unsigned session.
  if (!session) return { error: REFUSED };

  recordSuccess(key);

  const store = await cookies();
  store.set(ADMIN_COOKIE, session, sessionCookieOptions());

  redirect("/admin");
}

/** Ends the session. The cookie is the whole of the session, so dropping it is enough. */
export async function logout(): Promise<void> {
  const store = await cookies();
  store.set(ADMIN_COOKIE, "", sessionCookieOptions(0));
  redirect("/admin/login");
}
