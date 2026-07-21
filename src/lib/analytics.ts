/**
 * The analytics layer: GA4 (gtag) behind a single env gate.
 *
 * The whole thing is inert unless NEXT_PUBLIC_GA_MEASUREMENT_ID is set. With no
 * id: no script is loaded (see components/analytics/Analytics.tsx), window.gtag
 * never exists, and every track() call returns without touching the network or
 * the console. The site runs identically with or without the id; analytics is
 * an addition, never a dependency.
 *
 * PRIVACY: event params carry order references and money only. No email, no
 * name, no address, no anything that identifies a person, ever reaches GA. If
 * you add an event, keep it that way, an order ref is not PII, a customer's
 * details are.
 *
 * SSR-safe: this module reads no `window` at import time. gaMeasurementId reads
 * process.env (inlined by Next at build for a NEXT_PUBLIC_ var), and track
 * guards on `typeof window` before it looks for gtag, so importing it on the
 * server is harmless.
 */

/**
 * The event map. Its keys are the only event names track() will accept, and
 * each value is the exact param shape that event carries, so a misspelled name
 * or a wrong param is a compile error at the call site rather than a silently
 * dropped or malformed hit.
 */
export interface AnalyticsEventMap {
  /** A product page was viewed. value is the "from" price in whole rands. */
  view_item: { item_id: string; value: number; currency: "ZAR" };
  /** A configured portrait was added to the cart. */
  add_to_cart: { item_id: string; value: number; currency: "ZAR" };
  /** The checkout was reached with a non-empty cart. */
  begin_checkout: { value: number; currency: "ZAR"; item_count: number };
  /**
   * Payment confirmed by the server (never on browser return alone).
   * transaction_id is the order reference; GA dedups repeat views on it.
   */
  purchase: { transaction_id: string; value: number; currency: "ZAR" };
  /** A pet photo passed upload + moderation in the customizer. */
  photo_uploaded: { product: string };
  /** A portrait was drawn for the first time from a chosen style. */
  art_generated: { product: string; style: string };
  /** An existing portrait was redrawn (the Regenerate action). */
  art_regenerated: { product: string; style: string };
  /**
   * A new address joined the newsletter. source is the capture surface; no
   * email or other PII travels with it (the list itself is the private record).
   */
  newsletter_signup: { source: "footer" | "checkout" };
  /** A magic sign-in link was requested. No email travels with it. */
  account_login_requested: Record<string, never>;
  /** A customer session was established from a magic link. */
  account_logged_in: Record<string, never>;
  /** A saved creature was re-ordered onto a product (subsystem B4). */
  creature_reordered: { product: string };
}

export type AnalyticsEvent = keyof AnalyticsEventMap;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/** The configured measurement id, or undefined when analytics is off. */
export function gaMeasurementId(): string | undefined {
  const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
  return id ? id : undefined;
}

/** True only when a measurement id is set. The single gate for everything. */
export function isAnalyticsEnabled(): boolean {
  return gaMeasurementId() !== undefined;
}

/**
 * Send one typed event to GA4.
 *
 * A no-op, by design, when analytics is off (no id), when there is no window
 * (server render), or when gtag has not loaded yet. It never throws and never
 * logs, so a call site can fire it unconditionally.
 */
export function track<E extends AnalyticsEvent>(
  event: E,
  params: AnalyticsEventMap[E],
): void {
  if (!isAnalyticsEnabled()) return;
  if (typeof window === "undefined") return;
  if (typeof window.gtag !== "function") return;
  window.gtag("event", event, params);
}

// --- Named helpers, one per event, so call sites read like the action ------

export function trackViewItem(input: { slug: string; priceZar: number }): void {
  track("view_item", {
    item_id: input.slug,
    value: input.priceZar,
    currency: "ZAR",
  });
}

export function trackAddToCart(input: {
  slug: string;
  priceZar: number;
}): void {
  track("add_to_cart", {
    item_id: input.slug,
    value: input.priceZar,
    currency: "ZAR",
  });
}

export function trackBeginCheckout(input: {
  subtotalZar: number;
  itemCount: number;
}): void {
  track("begin_checkout", {
    value: input.subtotalZar,
    currency: "ZAR",
    item_count: input.itemCount,
  });
}

/**
 * Purchase. orderRef is the order id; totalZar is what was paid. Nothing about
 * the customer travels with it.
 */
export function trackPurchase(input: {
  orderRef: string;
  totalZar: number;
}): void {
  track("purchase", {
    transaction_id: input.orderRef,
    value: input.totalZar,
    currency: "ZAR",
  });
}

export function trackPhotoUploaded(input: { slug: string }): void {
  track("photo_uploaded", { product: input.slug });
}

export function trackArtGenerated(input: {
  slug: string;
  style: string;
}): void {
  track("art_generated", { product: input.slug, style: input.style });
}

export function trackArtRegenerated(input: {
  slug: string;
  style: string;
}): void {
  track("art_regenerated", { product: input.slug, style: input.style });
}

/**
 * A newsletter signup succeeded. source names the surface (footer form or the
 * checkout opt-in); the address is never sent, only that a join happened.
 */
export function trackNewsletterSignup(input: {
  source: "footer" | "checkout";
}): void {
  track("newsletter_signup", { source: input.source });
}

export function trackAccountLoginRequested(): void {
  track("account_login_requested", {});
}

export function trackAccountLoggedIn(): void {
  track("account_logged_in", {});
}

export function trackCreatureReordered(input: { product: string }): void {
  track("creature_reordered", { product: input.product });
}
