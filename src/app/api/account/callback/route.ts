import { redirect } from "next/navigation";
import { consumeLoginToken } from "@/lib/account/login-tokens";
import {
  findOrCreateCustomer,
  claimOrdersForCustomer,
} from "@/lib/account/customers";
import { setCustomerSession, ACCOUNT_LOGIN_PATH } from "@/lib/account/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Follows a magic link. Spends the token (single-use), signs the customer in,
 * claims any of their unclaimed guest orders, and lands them on their account.
 * Any failure, an unknown, expired, used, or edited token, redirects to the
 * login page with a neutral expired state that reveals nothing about the address.
 */
async function handle(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  const email = await consumeLoginToken(token);

  if (email === null) {
    redirect(`${ACCOUNT_LOGIN_PATH}?error=expired`);
  }

  const customer = await findOrCreateCustomer(email);
  await claimOrdersForCustomer(customer.id, email);
  await setCustomerSession(customer.id);

  redirect("/account");
}

export async function GET(request: Request) {
  return handle(request);
}

// Mail clients that prefetch or POST a link hit the same single-use handler.
export async function POST(request: Request) {
  return handle(request);
}
