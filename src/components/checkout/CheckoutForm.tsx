"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Input } from "@/components/ui/Input";
import { EmailSuggestion } from "@/components/ui/EmailSuggestion";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatZar, getProduct, type ProductSlug } from "@/lib/products";
import {
  itemCount,
  subtotalZar,
  useCartHydrated,
  useCartItems,
} from "@/lib/cart-store";
import { trackBeginCheckout, trackNewsletterSignup } from "@/lib/analytics";
import {
  CUSTOMER_FIELDS,
  FREE_SHIPPING_THRESHOLD_ZAR,
  SA_PROVINCES,
  SHIPPING_FLAT_ZAR,
  orderTotals,
  validateCustomerDetails,
  type CustomerErrors,
  type CustomerField,
} from "@/lib/checkout";

type FormValues = Record<CustomerField, string>;

const EMPTY_FORM: FormValues = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  suburb: "",
  city: "",
  province: "",
  postalCode: "",
};

function productName(slug: ProductSlug): string {
  return getProduct(slug)?.name ?? slug;
}

/**
 * A best-effort newsletter subscribe fired from the checkout opt-in. It is
 * deliberately fire-and-forget: the caller never awaits it, so a slow or failed
 * subscribe can NEVER delay or fail the order or the PayFast handoff. The order
 * is the priority; the list is a nice-to-have that rides along. The event fires
 * only on a genuine new join (source only, never the address).
 */
function subscribeAtCheckout(email: string): void {
  void fetch("/api/newsletter/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, source: "checkout" }),
  })
    .then(async (response) => {
      if (!response.ok) return;
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        alreadySubscribed?: boolean;
      } | null;
      if (json?.ok && !json.alreadySubscribed) {
        trackNewsletterSignup({ source: "checkout" });
      }
    })
    .catch(() => {
      // Swallowed on purpose. A failed subscribe must not touch the order flow.
    });
}

/** A province select styled to match Input: label above, error below. */
function ProvinceSelect({
  value,
  error,
  onChange,
}: {
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        Province
      </label>
      <select
        id={id}
        name="province"
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full rounded-md border bg-base px-3 py-2 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base ${
          error ? "border-btn" : "border-line"
        }`}
      >
        <option value="">Choose a province</option>
        {SA_PROVINCES.map((province) => (
          <option key={province} value={province}>
            {province}
          </option>
        ))}
      </select>
      {error ? (
        <p id={errorId} role="alert" className="text-sm font-medium text-btn">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function EmptyCheckout() {
  return (
    <div className="flex flex-col items-start gap-5 rounded-lg border border-line bg-surface p-8 md:p-12">
      <p className="eyebrow text-xs text-accent">Nothing to check out</p>
      <h2 className="max-w-lg font-display text-2xl leading-[1.2] text-ink md:text-3xl">
        There is no portrait here to send you.
      </h2>
      <p className="max-w-lg leading-relaxed text-muted">
        Choose a garment, upload a photo of your creature, and we will draw them
        before you part with anything.
      </p>
      <Button block href="/products/hoodie" size="md">
        Start a portrait
      </Button>
    </div>
  );
}

/** The signed payload the server hands back with a freshly opened order. */
type Placed = {
  orderId: string;
  publicRef: string | null;
  totalZar: number;
  mock: boolean;
  processUrl: string;
  fields: Record<string, string>;
  /** The address this order is being paid under, echoed back for a last check. */
  email: string;
};

/**
 * How long the real PayFast handoff waits before auto-submitting, so a human has
 * a beat to read "paying as <email>" and catch a wrong address before the
 * gateway takes over. The Continue button is the accelerator for anyone who does
 * not want to wait.
 */
const HANDOFF_AUTOSUBMIT_MS = 3500;

/**
 * The handover itself. PayFast takes a form POST, not a fetch, so the fields
 * the server signed are rendered as hidden inputs and submitted on mount. The
 * inputs carry the server's values verbatim: re-deriving anything here would
 * change the string that was signed and the payment would bounce.
 *
 * The cart is deliberately left alone. Someone who takes one look at the
 * gateway and backs out must come back to a cart that still holds their
 * portraits; the cart clears when payment is confirmed, not when it is asked for.
 */
function PayfastHandoff({
  placed,
  onEdit,
}: {
  placed: Placed;
  onEdit: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const submittedRef = useRef(false);

  // The submit is fired once, whether by the timer below or the Continue
  // button. Guarding it means a customer who taps Continue mid-pause does not
  // trigger a second submit when the timer later elapses.
  const submit = () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    formRef.current?.submit();
  };

  // A deliberate, readable pause before handing off, so "paying as <email>" can
  // actually be read. Cleared on unmount (e.g. if they tap Edit) so a timer
  // never fires against a form that is no longer on the page.
  useEffect(() => {
    const timer = setTimeout(submit, HANDOFF_AUTOSUBMIT_MS);
    return () => clearTimeout(timer);
    // Runs once on mount; submit closes over stable refs.
  }, []);

  return (
    <div
      className="flex flex-col items-start gap-4 rounded-lg border border-line bg-surface p-8"
      role="status"
    >
      <p className="eyebrow text-xs text-accent">Taking you to PayFast</p>
      <h2 className="font-display text-2xl leading-[1.2] text-ink">
        Handing you over to pay, safely.
      </h2>
      <p className="max-w-lg leading-relaxed text-muted">
        Your order for {formatZar(placed.totalZar)} is saved. In a moment we will
        send you to PayFast · use the button below to go now.
      </p>

      {placed.publicRef ? (
        <p className="text-sm text-muted">
          Your reference is{" "}
          <span className="font-mono font-medium text-ink">
            {placed.publicRef}
          </span>
          . We have emailed it to you as well.
        </p>
      ) : null}

      <p className="text-sm text-muted">
        Paying as <span className="font-medium text-ink">{placed.email}</span>.{" "}
        <button
          type="button"
          onClick={onEdit}
          className="text-accent underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base"
        >
          Edit
        </button>
      </p>

      <form ref={formRef} method="post" action={placed.processUrl}>
        {Object.entries(placed.fields).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
      </form>
      <Button size="md" type="button" onClick={submit}>
        Continue to PayFast
      </Button>
    </div>
  );
}

/**
 * Mock mode: no credentials, so nobody is handed to a gateway. The payload is
 * real and really signed, and it is laid out here to be read. The merchant key
 * is redacted server-side and never reaches this component.
 */
function PayfastMock({
  placed,
  onEdit,
}: {
  placed: Placed;
  onEdit: () => void;
}) {
  return (
    <div
      className="flex flex-col items-start gap-4 rounded-lg border border-line bg-surface p-8"
      role="status"
    >
      <p className="eyebrow text-xs text-accent">Payment is mocked</p>
      <h2 className="font-display text-2xl leading-[1.2] text-ink">
        Your order is saved. No money changed hands.
      </h2>
      <p className="max-w-lg leading-relaxed text-muted">
        This shop is running without PayFast credentials, so we built and signed
        the payment below instead of sending you to it. Your order for{" "}
        {formatZar(placed.totalZar)} is held under reference{" "}
        <span className="font-mono font-medium text-ink">
          {placed.publicRef ?? placed.orderId}
        </span>
        .
      </p>

      <p className="text-sm text-muted">
        Paying as <span className="font-medium text-ink">{placed.email}</span>.{" "}
        <button
          type="button"
          onClick={onEdit}
          className="text-accent underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base"
        >
          Edit
        </button>
      </p>

      <details className="w-full rounded-md border border-line bg-surface-alt px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium text-ink">
          Inspect the signed payload
        </summary>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          POST target: <span className="text-ink">{placed.processUrl}</span>
        </p>
        <dl className="mt-3 flex flex-col gap-2">
          {Object.entries(placed.fields).map(([name, value]) => (
            <div key={name} className="flex flex-col gap-1 sm:flex-row sm:gap-3">
              <dt className="shrink-0 font-mono text-xs text-muted sm:w-40">
                {name}
              </dt>
              <dd className="break-all font-mono text-xs text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}

/**
 * The checkout island: order summary plus shipping details, ending in a pending
 * order. Prices shown here are the cart's own snapshot; the server re-derives
 * every one of them from the catalogue before writing the order, so this panel
 * is a preview of the bill, not the bill itself.
 */
export function CheckoutForm() {
  const items = useCartItems();
  const hydrated = useCartHydrated();

  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<CustomerErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<Placed | null>(null);
  // Newsletter opt-in. Unticked by default (POPIA: no pre-ticked consent).
  const [newsletterOptIn, setNewsletterOptIn] = useState(false);
  // Set when the handoff's Edit control sends the customer back to the form, so
  // the just-mounted email field can take focus for a correction. A ref, not
  // state: it only cues an imperative focus, and must not itself cause a render.
  const refocusEmailRef = useRef(false);

  const subtotal = subtotalZar(items);
  const { shippingZar, totalZar } = orderTotals(subtotal);

  // begin_checkout fires once the persisted cart is known and holds something.
  // Gated on hydration so it never reports the empty cart the store shows on
  // the first pass, and once so a re-render cannot double-count it.
  const beginCheckoutFired = useRef(false);
  useEffect(() => {
    if (beginCheckoutFired.current) return;
    if (!hydrated || items.length === 0) return;
    beginCheckoutFired.current = true;
    trackBeginCheckout({ subtotalZar: subtotal, itemCount: itemCount(items) });
  }, [hydrated, items, subtotal]);

  // Returning from the handoff: drop the placed panel back to the editable form
  // (all values are still in state, so the form comes back filled) and cue the
  // email field to focus. The pending order simply goes unpaid and dies as
  // pending, exactly like any abandoned checkout; a corrected resubmit opens a
  // fresh one, so no order-mutation endpoint is needed.
  const returnToFormToEditEmail = () => {
    refocusEmailRef.current = true;
    setPlaced(null);
  };

  useEffect(() => {
    if (!refocusEmailRef.current || placed || !hydrated || items.length === 0)
      return;
    refocusEmailRef.current = false;
    const field = document.getElementsByName("email")[0] as
      | HTMLInputElement
      | undefined;
    field?.focus();
  }, [placed, hydrated, items.length]);

  const setField = (field: CustomerField) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    // Clear a field's error as soon as it is being addressed; re-checked on submit.
    setErrors((current) =>
      current[field] ? { ...current, [field]: undefined } : current,
    );
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Before the persisted cart is read back, the store legitimately reads
    // empty. Submitting now would post an empty order.
    if (!hydrated || submitting || items.length === 0) return;

    const details = validateCustomerDetails(values);
    if (!details.ok) {
      setErrors(details.errors);
      setFormError("Please check the highlighted details.");
      const first = CUSTOMER_FIELDS.find((field) => details.errors[field]);
      if (first) document.getElementsByName(first)[0]?.focus();
      return;
    }

    setErrors({});
    setFormError(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Identity and choices only. The server prices the order.
          items: items.map((item) => ({
            productSlug: item.productSlug,
            color: item.color,
            size: item.size,
            qty: item.qty,
            artworkId: item.artworkId,
          })),
          shipping: {
            firstName: details.value.firstName,
            lastName: details.value.lastName,
            phone: details.value.phone,
            addressLine1: details.value.addressLine1,
            addressLine2: details.value.addressLine2,
            suburb: details.value.suburb,
            city: details.value.city,
            province: details.value.province,
            postalCode: details.value.postalCode,
          },
          email: details.value.email,
        }),
      });

      const json = await response.json();

      if (!response.ok) {
        if (json?.fields) setErrors(json.fields as CustomerErrors);
        setFormError(
          typeof json?.error === "string"
            ? json.error
            : "We could not open your order. Please try again.",
        );
        return;
      }

      // The order succeeded. If they opted in, kick off the newsletter
      // subscribe now, but do NOT await it: it is fire-and-forget, so a slow or
      // failed subscribe cannot delay the handoff below or fail the order.
      if (newsletterOptIn) {
        subscribeAtCheckout(details.value.email);
      }

      // The order is open, priced and signed. Swapping this panel out mounts
      // the handoff, which posts the server's fields straight to PayFast. The
      // cart stays put until payment is confirmed (S5), so someone who
      // abandons the gateway comes back to their portraits.
      setPlaced({
        orderId: json.orderId,
        publicRef: json.publicRef ?? null,
        totalZar: json.totalZar,
        mock: json.mock === true,
        processUrl: json.processUrl,
        fields: json.fields ?? {},
        email: details.value.email,
      });
    } catch {
      setFormError(
        "We could not reach the shop. Please check your connection and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-base py-14 md:py-20">
      <Container>
        <div className="flex flex-col gap-2">
          <p className="eyebrow text-xs text-muted">Checkout</p>
          <h1 className="font-display text-3xl leading-[1.1] text-ink md:text-4xl">
            Where should they land?
          </h1>
        </div>

        <div className="mt-10">
          {!hydrated ? (
            <div className="flex flex-col gap-4" aria-hidden="true">
              <Skeleton className="h-6 w-40 rounded-md" />
              <Skeleton className="h-64 w-full rounded-lg" />
            </div>
          ) : placed ? (
            placed.mock ? (
              <PayfastMock placed={placed} onEdit={returnToFormToEditEmail} />
            ) : (
              <PayfastHandoff placed={placed} onEdit={returnToFormToEditEmail} />
            )
          ) : items.length === 0 ? (
            <EmptyCheckout />
          ) : (
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-14">
              <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-8">
                <fieldset className="flex flex-col gap-5 border-0 p-0">
                  <legend className="eyebrow mb-1 text-xs text-muted">
                    Your details
                  </legend>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Input
                      label="First name"
                      name="firstName"
                      autoComplete="given-name"
                      value={values.firstName}
                      error={errors.firstName}
                      onChange={(event) => setField("firstName")(event.target.value)}
                    />
                    <Input
                      label="Last name"
                      name="lastName"
                      autoComplete="family-name"
                      value={values.lastName}
                      error={errors.lastName}
                      onChange={(event) => setField("lastName")(event.target.value)}
                    />
                  </div>
                  <Input
                    label="Email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    helperText="Your order updates and tracking go here."
                    value={values.email}
                    error={errors.email}
                    onChange={(event) => setField("email")(event.target.value)}
                  />
                  <EmailSuggestion
                    email={values.email}
                    onAccept={setField("email")}
                  />
                  <Input
                    label="Phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    helperText="The courier calls this number on delivery day."
                    value={values.phone}
                    error={errors.phone}
                    onChange={(event) => setField("phone")(event.target.value)}
                  />
                </fieldset>

                <fieldset className="flex flex-col gap-5 border-0 p-0">
                  <legend className="eyebrow mb-1 text-xs text-muted">
                    Delivery address
                  </legend>
                  <Input
                    label="Street address"
                    name="addressLine1"
                    autoComplete="address-line1"
                    value={values.addressLine1}
                    error={errors.addressLine1}
                    onChange={(event) => setField("addressLine1")(event.target.value)}
                  />
                  <Input
                    label="Complex or unit (optional)"
                    name="addressLine2"
                    autoComplete="address-line2"
                    value={values.addressLine2}
                    error={errors.addressLine2}
                    onChange={(event) => setField("addressLine2")(event.target.value)}
                  />
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Input
                      label="Suburb"
                      name="suburb"
                      autoComplete="address-level3"
                      value={values.suburb}
                      error={errors.suburb}
                      onChange={(event) => setField("suburb")(event.target.value)}
                    />
                    <Input
                      label="City or town"
                      name="city"
                      autoComplete="address-level2"
                      value={values.city}
                      error={errors.city}
                      onChange={(event) => setField("city")(event.target.value)}
                    />
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <ProvinceSelect
                      value={values.province}
                      error={errors.province}
                      onChange={setField("province")}
                    />
                    <Input
                      label="Postal code"
                      name="postalCode"
                      inputMode="numeric"
                      autoComplete="postal-code"
                      value={values.postalCode}
                      error={errors.postalCode}
                      onChange={(event) => setField("postalCode")(event.target.value)}
                    />
                  </div>
                </fieldset>

                {formError ? (
                  <p
                    role="alert"
                    className="rounded-md border border-btn bg-surface px-4 py-3 text-sm font-medium text-btn"
                  >
                    {formError}
                  </p>
                ) : null}

                <label className="flex items-start gap-3 text-sm text-muted">
                  <input
                    type="checkbox"
                    name="newsletterOptIn"
                    checked={newsletterOptIn}
                    disabled={submitting}
                    onChange={(event) => setNewsletterOptIn(event.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded-sm border-line text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base"
                  />
                  <span className="leading-relaxed">
                    Keep me posted on new styles and the occasional story. No
                    spam, and you can leave any time.
                  </span>
                </label>

                <div className="flex flex-col items-start gap-3">
                  <Button
                    block
                    size="md"
                    type="submit"
                    disabled={submitting}
                    aria-busy={submitting}
                    className="w-full sm:w-auto"
                  >
                    {submitting ? "Saving your order" : "Continue to payment"}
                  </Button>
                  <p className="text-sm text-muted">
                    Nothing is charged on this step. We open your order first.
                  </p>
                </div>
              </form>

              <aside className="h-fit rounded-lg border border-line bg-surface p-6 lg:sticky lg:top-24">
                <h2 className="eyebrow text-xs text-muted">Order summary</h2>

                <ul className="mt-5 flex flex-col gap-4 border-b border-line pb-5">
                  {items.map((item) => (
                    <li
                      key={item.artworkId}
                      className="flex items-baseline justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink">
                          {productName(item.productSlug)}
                        </p>
                        <p className="mt-1 text-sm text-muted">
                          {item.color} · Size {item.size} · Qty {item.qty}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-medium text-ink">
                        {formatZar(item.qty * item.unitPriceZar)}
                      </p>
                    </li>
                  ))}
                </ul>

                <dl className="mt-5 flex flex-col gap-3 text-sm">
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-muted">Subtotal</dt>
                    <dd className="font-medium text-ink">{formatZar(subtotal)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-muted">Shipping</dt>
                    <dd className="font-medium text-ink">
                      {shippingZar === 0 ? "Free" : formatZar(shippingZar)}
                    </dd>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-line pt-4">
                    <dt className="font-medium text-ink">Total</dt>
                    <dd className="text-lg font-medium text-ink">
                      {formatZar(totalZar)}
                    </dd>
                  </div>
                </dl>

                <p className="mt-4 text-xs leading-relaxed text-muted">
                  {shippingZar === 0
                    ? `Your order is over ${formatZar(FREE_SHIPPING_THRESHOLD_ZAR)}, so shipping is on us.`
                    : `Courier rates are still being confirmed with our print shop, so shipping is ${formatZar(SHIPPING_FLAT_ZAR)} until your order passes ${formatZar(FREE_SHIPPING_THRESHOLD_ZAR)}.`}
                </p>
              </aside>
            </div>
          )}
        </div>
      </Container>
    </div>
  );
}
