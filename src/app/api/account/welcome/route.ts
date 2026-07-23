import { redirect } from "next/navigation";
import { consumeWelcomeToken } from "@/lib/account/login-tokens";
import {
  findOrCreateCustomer,
  claimOrdersForCustomer,
} from "@/lib/account/customers";
import { setCustomerSession } from "@/lib/account/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Spends the one-time welcome token a buyer carries back from PayFast (D3).
 *
 * The return_url lands on /order/<token>?welcome=<raw>, but a server component
 * cannot set a cookie while it renders, so the order page bounces the welcome
 * parameter here. This handler consumes the token (single-use), finds or
 * creates the account for the email the token is bound to, claims that email's
 * guest orders, sets the session cookie, and sends the buyer straight back to
 * their order page, now signed in.
 *
 * A miss is silent by design. An unknown, expired, used or edited token takes
 * exactly the same redirect back to the order page with no cookie, no error
 * and no different copy: the page must render identically either way, so this
 * URL can never be used to probe whether a token (or an account) is real.
 */
async function handle(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const order = url.searchParams.get("order") ?? "";

  // Built here from a path segment we encode ourselves, never from a free-form
  // next/return parameter: this handler can only ever land inside /order/.
  const destination =
    order === "" ? "/" : `/order/${encodeURIComponent(order)}`;

  const email = await consumeWelcomeToken(token);
  if (email !== null) {
    const customer = await findOrCreateCustomer(email);
    await claimOrdersForCustomer(customer.id, email);
    await setCustomerSession(customer.id);
  }

  redirect(destination);
}

export async function GET(request: Request) {
  return handle(request);
}

// A client that prefetches or POSTs the URL hits the same single-use handler.
export async function POST(request: Request) {
  return handle(request);
}
