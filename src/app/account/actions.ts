"use server";

import { redirect } from "next/navigation";
import { clearCustomerSession } from "@/lib/account/auth";

/**
 * Ends the session and returns the customer to the storefront. The signed cookie
 * is the whole of the session, so dropping it is enough; home is a friendlier
 * landing than the login page for someone who chose to sign out.
 */
export async function logout(): Promise<void> {
  await clearCustomerSession();
  redirect("/");
}
