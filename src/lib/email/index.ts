/**
 * The three emails this shop sends, composed from a template and handed to the
 * transport. Everything here is server-side and free of React and route
 * imports, so a webhook, a server action or a script can all call it.
 *
 * WHO OWNS WHAT. These helpers do not touch the database. They take the rows
 * they need as arguments, because the callers (the ITN webhook in S7, the admin
 * tracking action in S8) are already holding those rows inside the transaction
 * that decided the mail should go at all. A helper that fetched its own would
 * be reading state its caller may not have committed yet.
 *
 * HOW FAILURE SURFACES. Every helper returns EmailResult and does not throw for
 * a send failure, so the caller decides what a bounced mail means. It never
 * means "lose the order": S7 marks the order paid and then sends. The one thing
 * that does throw is a caller passing data that cannot make sense (an order
 * with no tracking number for a shipping mail), because that is a bug in the
 * caller, not an outage, and it should be loud in development.
 */

import type { Artwork, Order, OrderItem } from "@/lib/db/schema";
import { signOrderToken } from "@/lib/order-token";
import { getProduct, printPixels } from "@/lib/products";
import { getStorage } from "@/lib/storage";
import { addressLines, formatOrderDate, orderRef } from "./layout";
import {
  EmailSendError,
  emailReplyTo,
  getEmailTransport,
  type EmailMessage,
} from "./send";
import {
  orderConfirmationEmail,
  type ConfirmationLine,
} from "./templates/order-confirmation";
import { shippingNotificationEmail } from "./templates/shipping-notification";
import { jobSheetEmail, type JobSheetLine } from "./templates/job-sheet";

export * from "./send";
export { orderRef } from "./layout";
export type { RenderedEmail } from "./layout";

/**
 * The outcome of a helper. A discriminated union rather than a throw: the
 * callers are payment and fulfilment paths where "the mail did not go" is a
 * thing to log and move past, not a thing to unwind an order over.
 */
export type EmailResult =
  | { ok: true; id: string }
  | { ok: false; error: Error };

/**
 * How long a print-file link in a job sheet stays valid. Seven days covers the
 * five working day turnaround with a weekend in it; past that the shop replies
 * and we mint a fresh one, which is the right default for a link that grants
 * anyone holding it a customer's artwork.
 */
export const PRINT_LINK_TTL_SEC = 7 * 24 * 60 * 60;

function siteUrl(): string {
  // Same fallback as payfast.ts: local dev has no site URL and should still run.
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return (configured || "http://localhost:3000").replace(/\/+$/, "");
}

/** The customer-facing status link for an order: signed, unguessable, plain. */
export function orderStatusUrl(orderId: string): string {
  return `${siteUrl()}/order/${signOrderToken(orderId)}`;
}

/** Storage may hand back a site-relative URL; an email needs an absolute one. */
function absolute(url: string): string {
  return url.startsWith("http") ? url : `${siteUrl()}${url}`;
}

async function deliver(message: EmailMessage): Promise<EmailResult> {
  try {
    const { id } = await getEmailTransport().send(message);
    return { ok: true, id };
  } catch (cause) {
    const error =
      cause instanceof EmailSendError
        ? cause
        : new EmailSendError(message, "an unexpected error", { cause });
    // Safe to log: EmailSendError carries recipient and subject only, and no
    // secret ever reaches this layer.
    console.error(`[email] ${error.message}`);
    return { ok: false, error };
  }
}

function productName(slug: string): string {
  return getProduct(slug)?.name ?? slug;
}

function toConfirmationLines(items: OrderItem[]): ConfirmationLine[] {
  return items.map((item) => ({
    productName: productName(item.productSlug),
    color: item.color,
    size: item.size,
    qty: item.qty,
    unitPriceZar: item.unitPriceZar,
  }));
}

/**
 * The receipt plus what-happens-next mail, sent once an order is paid.
 *
 * @param order the orders row, after it was marked paid.
 * @param items its order_items rows.
 * @returns ok with the provider's id, or ok:false with the error. Never throws.
 */
export async function sendOrderConfirmation(
  order: Order,
  items: OrderItem[],
): Promise<EmailResult> {
  const rendered = orderConfirmationEmail({
    firstName: order.firstName,
    orderRef: orderRef(order.id),
    lines: toConfirmationLines(items),
    subtotalZar: order.subtotalZar,
    shippingZar: order.shippingZar,
    totalZar: order.totalZar,
    orderUrl: orderStatusUrl(order.id),
  });

  return deliver({
    to: order.email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    replyTo: emailReplyTo(),
  });
}

/**
 * The tracking mail, sent when fulfilment puts a waybill on an order.
 *
 * @param order the orders row, with trackingNumber already set.
 * @returns ok with the provider's id, or ok:false with the error.
 * @throws {TypeError} if the order has no tracking number. That is a caller
 * bug: there is no version of this mail worth sending without the number.
 */
export async function sendShippingNotification(
  order: Order,
): Promise<EmailResult> {
  const trackingNumber = order.trackingNumber?.trim();
  if (!trackingNumber) {
    throw new TypeError(
      `Order ${orderRef(order.id)} has no tracking number; there is nothing to notify about.`,
    );
  }

  const rendered = shippingNotificationEmail({
    firstName: order.firstName,
    orderRef: orderRef(order.id),
    trackingNumber,
    orderUrl: orderStatusUrl(order.id),
  });

  return deliver({
    to: order.email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    replyTo: emailReplyTo(),
  });
}

async function toJobSheetLines(
  items: OrderItem[],
  artworks: Artwork[],
): Promise<JobSheetLine[]> {
  const byId = new Map(artworks.map((artwork) => [artwork.id, artwork]));
  const storage = getStorage();

  return Promise.all(
    items.map(async (item) => {
      const product = getProduct(item.productSlug);
      const artwork = byId.get(item.artworkId);
      // Links are signed and short-lived (PRINT_LINK_TTL_SEC, 7 days): the file
      // is a customer's artwork, so the mail carries a lease on it, not a
      // permanent public URL. An artwork with no printKey yet gets no link and
      // the sheet says so.
      const printFileUrl = artwork?.printKey
        ? absolute(
            await storage.getSignedUrl(artwork.printKey, PRINT_LINK_TTL_SEC),
          )
        : null;

      return {
        productName: product?.name ?? item.productSlug,
        color: item.color,
        size: item.size,
        qty: item.qty,
        printAreaMm: product?.printArea ?? { widthMm: 0, heightMm: 0 },
        // The print file is generated to the product's print area at 300 DPI,
        // so these are its dimensions. Unknown product slug, unknown size.
        printPx: product ? printPixels(product) : null,
        printFileUrl,
      };
    }),
  );
}

/**
 * The print shop's job sheet. Goes to PRINT_SHOP_EMAIL, never to the customer.
 *
 * @param order the orders row.
 * @param items its order_items rows.
 * @param artworks the artworks the items point at, for the print files.
 * @returns ok with the provider's id, or ok:false with the error, including the
 * case where PRINT_SHOP_EMAIL is not configured. Never throws.
 */
export async function sendJobSheet(
  order: Order,
  items: OrderItem[],
  artworks: Artwork[],
): Promise<EmailResult> {
  const to = process.env.PRINT_SHOP_EMAIL?.trim();
  if (!to) {
    // Not a throw: an unset env var must not take down the webhook that just
    // banked a payment. It is loud in the log and the order survives.
    const error = new Error(
      `PRINT_SHOP_EMAIL is not set; job sheet for order ${orderRef(order.id)} was not sent.`,
    );
    console.error(`[email] ${error.message}`);
    return { ok: false, error };
  }

  const rendered = jobSheetEmail({
    orderRef: orderRef(order.id),
    orderDate: formatOrderDate(order.createdAt),
    lines: await toJobSheetLines(items, artworks),
    shipTo: addressLines(order),
    customerEmail: order.email,
    linkTtlHours: PRINT_LINK_TTL_SEC / 3600,
  });

  return deliver({
    to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    // The shop replies to us, not into a no-reply void: a query about a job is
    // a query for a human on our side.
    replyTo: emailReplyTo(),
  });
}
