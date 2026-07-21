/**
 * The customer Data Access Layer: the single place that answers "which customer
 * is this request, if any?", plus the guard account pages call and the set/clear
 * a login and logout use.
 *
 * Like the admin DAL, the deciding check sits next to the data, not in proxy.ts:
 * an optimistic redirect for logged-out UX can live in proxy, but authorisation
 * happens here. See session.ts for what the cookie is.
 */

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  CUSTOMER_COOKIE,
  createCustomerSessionValue,
  customerSessionCookieOptions,
  verifyCustomerSessionValue,
} from "./session";
import { getCustomerById } from "./customers";
import type { Customer } from "@/lib/db/schema";

/** Where an unauthenticated request to an account page gets sent. */
export const ACCOUNT_LOGIN_PATH = "/account/login";

/**
 * The customerId this request carries a valid session for, or null. Memoised per
 * render pass so a page and its children cost one cookie read and one HMAC.
 */
export const getCustomerId = cache(async (): Promise<string | null> => {
  const store = await cookies();
  return verifyCustomerSessionValue(store.get(CUSTOMER_COOKIE)?.value);
});

/**
 * The customer row for this request, or null. A valid signature over a
 * customerId whose row has since vanished resolves to null, not a crash.
 */
export const getCustomer = cache(async (): Promise<Customer | null> => {
  const id = await getCustomerId();
  return id ? getCustomerById(id) : null;
});

/**
 * The guard. Call it first in every account page and action. Redirects to login
 * when there is no valid session; returns the customer otherwise, so a caller
 * gets the identity and cannot forget to check.
 */
export async function requireCustomer(): Promise<Customer> {
  const customer = await getCustomer();
  if (!customer) redirect(ACCOUNT_LOGIN_PATH);
  return customer;
}

/** Mints and sets the session cookie for a signed-in customer. */
export async function setCustomerSession(customerId: string): Promise<void> {
  const store = await cookies();
  store.set(
    CUSTOMER_COOKIE,
    createCustomerSessionValue(customerId),
    customerSessionCookieOptions(),
  );
}

/** Clears the session cookie (logout). */
export async function clearCustomerSession(): Promise<void> {
  const store = await cookies();
  store.set(CUSTOMER_COOKIE, "", customerSessionCookieOptions(0));
}
