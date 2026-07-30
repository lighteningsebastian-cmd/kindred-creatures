"use server";

import { revalidatePath } from "next/cache";
import {
  approveArtwork,
  orderForArtwork,
  requestRevision,
} from "@/lib/artwork-approval";
import { sendApproved } from "@/lib/email";
import { releaseApprovedOrder } from "@/lib/fulfillment";

/**
 * What the approval page says back to the customer.
 *
 * Note what is NOT here: any count. The customer is never told which round they
 * are on. A visible limit turns a service into a ration and makes someone
 * adversarial about their own dog; the tone escalates into personal attention
 * instead, which reads as better service rather than as running out of chances.
 */
export type ApprovalState =
  | { state: "idle" }
  | { state: "approved" }
  | { state: "queued" }
  | { state: "handed-over" }
  | { state: "error"; message: string };

const GENERIC =
  "We could not do that just now. Please try the link in your email again.";

export async function approveAction(token: string): Promise<ApprovalState> {
  const result = await approveArtwork(token);
  if (result.status === "refused") return { state: "error", message: GENERIC };
  // Only on the transition, so a second click neither mails twice nor releases
  // twice.
  if (result.status === "approved") {
    const order = await orderForArtwork(result.artwork.id);
    if (order) {
      // THIS is what sends the garment to the press. It refuses unless every
      // artwork on the order is approved, so a two-garment order waits for both.
      await releaseApprovedOrder(order.id);
      // Best effort: a dead mailbox must never unwind an approval already given,
      // and it must certainly not unwind the release above.
      await sendApproved(order, result.artwork.creatureName);
    }
  }

  // A second click is not an error. They said yes; it is still yes.
  revalidatePath(`/approve/${token}`);
  return { state: "approved" };
}

export async function reviseAction(
  token: string,
  reasons: string[],
  note: string,
): Promise<ApprovalState> {
  const result = await requestRevision(token, reasons, note);
  if (result.status === "refused") return { state: "error", message: GENERIC };
  revalidatePath(`/approve/${token}`);
  return result.status === "handed-over"
    ? { state: "handed-over" }
    : { state: "queued" };
}
