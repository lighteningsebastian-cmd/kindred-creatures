/**
 * The seam between our newsletter flow and whatever mailing-list service backs
 * it. Routes and UI speak only to this interface, so the mock and the real
 * Resend provider are drop-in interchangeable and the whole capture flow runs
 * locally with no API keys. Swapping Resend for Klaviyo later is a change behind
 * this contract, not a change to capture UX.
 *
 * Our own `subscribers` table is the source of truth (see ./subscribers). The
 * provider is the downstream mirror: pushing a contact into a Resend Audience so
 * newsletters can be sent, and removing it on unsubscribe. A provider failure
 * must never lose a subscriber, so these return a plain `{ ok }` for the caller
 * to log-and-continue on rather than throwing.
 */

import type { SubscriberSource } from "@/lib/db/schema";

export interface NewsletterProvider {
  /** Adds or updates the contact in the mailing list. */
  subscribe(input: {
    email: string;
    source: SubscriberSource;
  }): Promise<{ ok: boolean }>;
  /** Removes or suppresses the contact in the mailing list. */
  unsubscribe(input: { email: string }): Promise<{ ok: boolean }>;
}
