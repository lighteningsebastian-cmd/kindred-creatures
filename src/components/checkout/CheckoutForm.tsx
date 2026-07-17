"use client";

import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatZar, getProduct, type ProductSlug } from "@/lib/products";
import { subtotalZar, useCartHydrated, useCartItems } from "@/lib/cart-store";
import {
  CUSTOMER_FIELDS,
  SA_PROVINCES,
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

/**
 * Marks the end of what this step owns. The order exists and is priced; taking
 * the money is the next step's job, and this panel is the seam it replaces.
 */
function PaymentPending({
  orderId,
  totalZar,
}: {
  orderId: string;
  totalZar: number;
}) {
  return (
    <div
      className="flex flex-col items-start gap-4 rounded-lg border border-line bg-surface p-8"
      role="status"
    >
      <p className="eyebrow text-xs text-accent">Order held</p>
      <h2 className="font-display text-2xl leading-[1.2] text-ink">
        Your order is saved and waiting for payment.
      </h2>
      <p className="max-w-lg leading-relaxed text-muted">
        We have put {formatZar(totalZar)} of portraits aside under reference{" "}
        <span className="font-medium text-ink">{orderId}</span>. Nothing has been
        charged yet.
      </p>
      <p className="rounded-md border border-line bg-surface-alt px-4 py-3 text-sm text-muted">
        Placeholder: the payment step is still being wired up. This panel is
        where the card handover will appear.
      </p>
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
  const [placed, setPlaced] = useState<{
    orderId: string;
    totalZar: number;
  } | null>(null);

  const subtotal = subtotalZar(items);
  const { shippingZar, totalZar } = orderTotals(subtotal);

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

      // TODO(S4): hand off to PayFast here. The order is open and priced;
      // swap this panel for the redirect using json.orderId. The cart is
      // deliberately left intact until payment is confirmed, so someone who
      // abandons the gateway comes back to a cart that still holds their
      // portraits.
      setPlaced({ orderId: json.orderId, totalZar: json.totalZar });
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
            <PaymentPending orderId={placed.orderId} totalZar={placed.totalZar} />
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
                      {formatZar(shippingZar)}
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
                  Placeholder: courier rates are still being confirmed with our
                  print shop, so shipping is a flat {formatZar(shippingZar)} for
                  now.
                </p>
              </aside>
            </div>
          )}
        </div>
      </Container>
    </div>
  );
}
