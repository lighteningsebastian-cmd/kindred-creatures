"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { markPrinted, markShipped } from "@/lib/admin/fulfillment-ops";
import {
  approveArtworkById,
  markPersonalContact,
  orderForArtwork,
} from "@/lib/artwork-approval";
import {
  releaseApprovedOrder,
  resendJobSheet,
  retryFulfillment,
  type FulfillmentResult,
  type JobSheetResendResult,
} from "@/lib/fulfillment";

/**
 * The dashboard's write surface.
 *
 * EVERY ONE OF THESE GUARDS ITSELF. A server action is a POST endpoint with a
 * generated URL, and nothing about it having been rendered inside a protected
 * layout is checked when it runs: React does not re-run the layout for an
 * action. So requireAdmin() is the first line of every one of them. The layout
 * and proxy.ts are for the browser's benefit; these lines are the boundary.
 *
 * NONE OF THESE MARKS AN ORDER PAID, and none ever may. Only a verified ITN does
 * that. See fulfillment-ops.ts.
 *
 * Each returns a plain, serialisable result rather than throwing, because the
 * form that called it has to render the outcome, and the outcomes here (a mail
 * that did not send, a retry that was refused) are things the owner needs told
 * rather than a stack trace.
 */

export type ActionState =
  | { status: "idle" }
  | { status: "ok"; message: string }
  | { status: "warn"; message: string }
  | { status: "error"; message: string };

/** Refusal copy. Plain sentences: the owner is at work, not reading marketing. */
const REFUSAL: Record<string, string> = {
  "order-not-found": "That order does not exist.",
  "tracking-required": "Add the courier tracking number first.",
  "wrong-status":
    "This order is no longer in the state that allows that. Refresh and look again.",
};

export async function markPrintedAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const orderId = String(formData.get("orderId") ?? "");
  const result = await markPrinted(orderId);

  if (!result.ok) {
    return { status: "error", message: REFUSAL[result.reason] ?? "Refused." };
  }

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin");
  return { status: "ok", message: "Marked printed." };
}

export async function markShippedAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const orderId = String(formData.get("orderId") ?? "");
  const trackingNumber = String(formData.get("trackingNumber") ?? "");
  const result = await markShipped(orderId, trackingNumber);

  if (!result.ok) {
    return { status: "error", message: REFUSAL[result.reason] ?? "Refused." };
  }

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin");

  // The order shipped either way. A failed mail is reported, not rolled back:
  // the parcel is with the courier and the status should say so.
  if (result.email && !result.email.ok) {
    return {
      status: "warn",
      message:
        "Marked shipped, but the tracking email did not send. The customer has NOT been told. Send them the number by hand.",
    };
  }

  return { status: "ok", message: "Marked shipped. The customer has the tracking number." };
}

export async function resendJobSheetAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const orderId = String(formData.get("orderId") ?? "");
  const result: JobSheetResendResult = await resendJobSheet(orderId);

  revalidatePath(`/admin/orders/${orderId}`);

  if (result.status === "refused") {
    return {
      status: "error",
      message:
        result.reason === "no-print-files"
          ? "This order has no print files yet, so there is nothing to send. Retry fulfilment instead."
          : REFUSAL[result.reason] ?? "Refused.",
    };
  }

  if (!result.jobSheet.ok) {
    return {
      status: "error",
      message: "The job sheet did not send. The print shop has still not been told.",
    };
  }

  return { status: "ok", message: "Job sheet sent to the print shop again." };
}

/**
 * The retry. Its result is rendered honestly, variant by variant, and the one
 * that matters most is "refused: flagged-without-payment": that order was never
 * paid for, and the answer is emphatically not to print it.
 */
export async function retryFulfillmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const orderId = String(formData.get("orderId") ?? "");
  const result: FulfillmentResult = await retryFulfillment(orderId);

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin");

  switch (result.status) {
    case "sent_to_printer":
      return result.jobSheet.ok
        ? {
            status: "ok",
            message: `Fulfilled. ${result.printKeys.length} print file(s) made and the job sheet is with the print shop.`,
          }
        : {
            status: "warn",
            message:
              "Print files were made, but the job sheet did not send. The print shop has NOT been told. Use re-send.",
          };

    case "awaiting-approval":
      // Drawn, and now waiting on a person outside the building. Nothing is
      // wrong and nothing prints until they say yes.
      return result.artworkReady.ok
        ? {
            status: "ok",
            message:
              "Artwork drawn and the approval link is with the customer. Nothing prints until they approve it.",
          }
        : {
            status: "warn",
            message:
              "Artwork was drawn, but the approval mail did not send. Nobody can approve it until it goes out.",
          };

    case "already-fulfilled":
      return {
        status: "ok",
        message: "Already fulfilled. Nothing to do.",
      };

    case "flagged":
      return {
        status: "error",
        message: `Still flagged: ${result.reason}`,
      };

    case "refused":
      if (result.reason === "flagged-without-payment") {
        return {
          status: "error",
          message:
            "This order was never paid. PayFast never confirmed a payment for it, so there is nothing to print and it must not be printed. Check PayFast for a matching payment before doing anything else.",
        };
      }
      return {
        status: "error",
        message: `Refused: ${result.reason}`,
      };
  }
}

/**
 * Approve a portrait on the customer's behalf.
 *
 * Used after the owner has spoken to somebody, which is the whole point of the
 * queue. It sets the same timestamp the customer's own approval sets, because
 * there is only one meaning of approved and only one thing that releases a job
 * sheet.
 */
export async function releaseToPrint(
  artworkId: string,
): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();
  const artwork = await approveArtworkById(artworkId);
  if (!artwork) return { ok: false, message: "That artwork no longer exists." };

  // Same single path to a job sheet the customer's own approval uses.
  const order = await orderForArtwork(artworkId);
  const released = order ? await releaseApprovedOrder(order.id) : null;
  revalidatePath("/admin/approvals");

  if (released?.status === "flagged") {
    return { ok: false, message: `Approved, but printing failed: ${released.reason}` };
  }
  if (released?.status === "refused") {
    return { ok: false, message: `Approved, but not released: ${released.reason}` };
  }
  return { ok: true, message: "Released to print." };
}

/** Take one off the automated path. Says a person is on it, not that it broke. */
export async function markForPersonalContact(
  artworkId: string,
): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();
  const artwork = await markPersonalContact(artworkId);
  if (!artwork) return { ok: false, message: "That artwork no longer exists." };
  revalidatePath("/admin/approvals");
  return { ok: true, message: "Marked for personal contact." };
}
