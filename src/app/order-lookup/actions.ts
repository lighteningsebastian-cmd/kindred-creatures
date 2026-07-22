"use server";

import { redirect } from "next/navigation";
import { findOrderByRefAndEmail } from "@/lib/order-lookup";
import { signOrderToken } from "@/lib/order-token";
import { LOOKUP_MISS, MISS_DELAY_MS, type LookupState } from "./lookup-state";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Looks up an order from a reference and email, for use with useActionState.
 *
 * On a full match it redirects to the existing signed order-status URL (the same
 * link the confirmation email carries), which is the only thing that ever
 * exposes an order, and only to someone holding both halves. On any miss it
 * waits out the damper and returns the one generic message.
 *
 * @param prev the previous form state (carries the attempt counter).
 * @param formData the submitted form: `reference` and `email`.
 * @returns the miss state. On a match it does not return; it redirects.
 */
export async function lookupOrder(
  prev: LookupState,
  formData: FormData,
): Promise<LookupState> {
  const reference = String(formData.get("reference") ?? "");
  const email = String(formData.get("email") ?? "");

  const result = await findOrderByRefAndEmail(reference, email);

  if (result.matched) {
    // The signed token unlocks the status PAGE, never a login and never a
    // payment. This is the same URL the emails already carry.
    redirect(`/order/${signOrderToken(result.orderId)}`);
  }

  await sleep(MISS_DELAY_MS);
  return { error: LOOKUP_MISS, attempt: prev.attempt + 1 };
}
