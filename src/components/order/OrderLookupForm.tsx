"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { trackOrderLookup } from "@/lib/analytics";
import { lookupOrder } from "@/app/order-lookup/actions";
import {
  INITIAL_LOOKUP_STATE,
  type LookupState,
} from "@/app/order-lookup/lookup-state";

/**
 * The "find my order" form. It asks for the reference and the order email and
 * hands both to the server action, which either redirects to the order-status
 * page (on a full match) or comes back with one generic message. There is no
 * branching here on why a lookup missed, because the action never tells us: the
 * form cannot leak a distinction it never receives.
 *
 * Analytics fires the outcome only. A match redirects, so the only outcome this
 * component lives to report is a miss; it carries no reference and no email.
 */
export function OrderLookupForm() {
  const [state, formAction, pending] = useActionState<LookupState, FormData>(
    lookupOrder,
    INITIAL_LOOKUP_STATE,
  );

  // Fire once per miss. Keyed on the attempt counter so a second identical miss
  // still counts, and a re-render on its own never does.
  const reported = useRef(0);
  useEffect(() => {
    if (state.attempt > reported.current) {
      reported.current = state.attempt;
      trackOrderLookup({ outcome: "miss" });
    }
  }, [state.attempt]);

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <Input
        id="order-reference"
        label="Order reference"
        name="reference"
        autoComplete="off"
        helperText="It looks like KC-2607-K4M9P and is on your confirmation email."
        required
      />
      <Input
        id="order-email"
        label="Email"
        type="email"
        name="email"
        autoComplete="email"
        helperText="The address you placed the order with."
        required
      />

      {state.error ? (
        <p
          role="alert"
          className="rounded-md border border-btn bg-surface px-4 py-3 text-sm font-medium text-btn"
        >
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Looking" : "Find my order"}
      </Button>
    </form>
  );
}
