"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import {
  markPrintedAction,
  markShippedAction,
  resendJobSheetAction,
  retryFulfillmentAction,
  type ActionState,
} from "@/app/admin/(dashboard)/actions";
import type { Concern } from "@/lib/admin/orders";
import type { OrderStatus } from "@/lib/db/schema";

/**
 * The buttons that move an order.
 *
 * WHAT THIS COMPONENT IS NOT. It is not the guard. Every action it calls checks
 * the session and the order's current status for itself, and refuses illegal
 * jumps in the WHERE clause of its UPDATE. What happens here is only that the
 * owner is not shown a button that cannot work: hiding "Mark shipped" on an
 * order at the printer saves a pointless click, it does not prevent anything.
 *
 * THE ONE PLACE THIS IS LOAD-BEARING: an order flagged without a payment is
 * offered no print action at all. Not a disabled one, none. The server refuses
 * it anyway (retryFulfillment returns "flagged-without-payment"), but a button
 * that looks like it might print a free garment is not a thing to put in front
 * of a tired person at 6pm and rely on the backend to catch.
 */

const INITIAL: ActionState = { status: "idle" };

function Feedback({ state }: { state: ActionState }) {
  if (state.status === "idle") return null;

  return (
    <p
      role="status"
      className={cn(
        "rounded-sm border px-3 py-2 text-sm leading-relaxed",
        state.status === "ok" && "border-signal-success text-signal-success",
        state.status === "warn" && "border-signal-hold text-signal-hold",
        state.status === "error" && "border-signal-error text-signal-error",
      )}
    >
      {state.message}
    </p>
  );
}

function MarkPrinted({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState(markPrintedAction, INITIAL);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="orderId" value={orderId} />
      <Button block size="sm" type="submit" disabled={pending}>
        {pending ? "Saving" : "Mark printed"}
      </Button>
      <Feedback state={state} />
    </form>
  );
}

function MarkShipped({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState(markShippedAction, INITIAL);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="orderId" value={orderId} />
      <Input
        label="Courier tracking number"
        name="trackingNumber"
        required
        helperText="The customer is emailed this number the moment you save."
      />
      <Button block size="sm" type="submit" disabled={pending}>
        {pending ? "Saving" : "Mark shipped and notify"}
      </Button>
      <Feedback state={state} />
    </form>
  );
}

function ResendJobSheet({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState(resendJobSheetAction, INITIAL);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="orderId" value={orderId} />
      <Button block size="sm" variant="secondary" type="submit" disabled={pending}>
        {pending ? "Sending" : "Re-send job sheet"}
      </Button>
      <Feedback state={state} />
    </form>
  );
}

function RetryFulfillment({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState(retryFulfillmentAction, INITIAL);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="orderId" value={orderId} />
      <Button block size="sm" type="submit" disabled={pending}>
        {pending ? "Retrying" : "Retry fulfilment"}
      </Button>
      <Feedback state={state} />
    </form>
  );
}

export function OrderActions({
  orderId,
  status,
  concern,
  canResendJobSheet,
}: {
  orderId: string;
  status: OrderStatus;
  concern: Concern | null;
  canResendJobSheet: boolean;
}) {
  // An order that was never paid gets no fulfilment control whatsoever. The one
  // thing on offer is the instruction to go and look at PayFast.
  if (concern === "never-paid") {
    return (
      <div className="rounded-md border border-signal-error p-4">
        <p className="eyebrow text-[11px] text-signal-error">Never paid</p>
        <p className="mt-2 text-sm leading-relaxed text-ink">
          PayFast never confirmed a payment for this order, so it has no payment
          reference. It was flagged by the payment webhook, not by a print
          failure.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          There is nothing to print here and no retry to make: printing it would
          send a free garment to whoever placed it. If you believe this order was
          genuinely paid, find the payment in PayFast first and reconcile it by
          hand.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {concern === "print-failed" || concern === "awaiting-print" ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm leading-relaxed text-muted">
            {concern === "print-failed"
              ? "This order is paid and the print file failed. Retrying only makes what is missing, so it costs nothing to try again."
              : "This order is paid and fulfilment has not run. Retrying picks it up."}
          </p>
          <RetryFulfillment orderId={orderId} />
        </div>
      ) : null}

      {status === "sent_to_printer" ? <MarkPrinted orderId={orderId} /> : null}
      {status === "printed" ? <MarkShipped orderId={orderId} /> : null}

      {canResendJobSheet ? <ResendJobSheet orderId={orderId} /> : null}
    </div>
  );
}
