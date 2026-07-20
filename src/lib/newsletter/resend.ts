import type { NewsletterProvider } from "./provider";
import type { SubscriberSource } from "@/lib/db/schema";

/**
 * Real provider: mirrors the contact in a Resend Audience so newsletters can be
 * sent from the same account as our transactional email. The SDK is imported on
 * first use and the client is built then, never at module load: importing this
 * file must stay free, because getNewsletterProvider() is called on paths that
 * mostly run in mock mode. The key is read at construction time and lives only
 * inside the client.
 *
 * FAILURE POLICY. Our own `subscribers` table is the source of truth; this is
 * the downstream mirror. A push that does not land must never lose a subscriber
 * or leak a key, so every failure is caught and reported as `{ ok: false }` with
 * a safe log line. Nothing here throws a raw provider error (which can carry the
 * request that carried the key) up to a route.
 */

interface ResendContactsClient {
  contacts: {
    create(payload: {
      email: string;
      audienceId: string;
      unsubscribed?: boolean;
    }): Promise<{ data: unknown; error: { message: string } | null }>;
    remove(payload: {
      email: string;
      audienceId: string;
    }): Promise<{ data: unknown; error: { message: string } | null }>;
  };
}

export class ResendNewsletterProvider implements NewsletterProvider {
  private clientPromise: Promise<ResendContactsClient> | null = null;

  private audienceId(): string {
    const id = process.env.RESEND_AUDIENCE_ID?.trim();
    if (!id) {
      // Unreachable through getNewsletterProvider(), which checks first.
      // Constructing this class without an audience is a bug, not a mock
      // request, and a silent no-op would hide it.
      throw new Error("RESEND_AUDIENCE_ID is not set. Cannot sync contacts.");
    }
    return id;
  }

  private client(): Promise<ResendContactsClient> {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not set. Cannot sync contacts.");
    }
    if (!this.clientPromise) {
      this.clientPromise = import("resend").then(
        ({ Resend }) => new Resend(apiKey) as unknown as ResendContactsClient,
      );
    }
    return this.clientPromise;
  }

  async subscribe({
    email,
    source,
  }: {
    email: string;
    source: SubscriberSource;
  }): Promise<{ ok: boolean }> {
    try {
      const client = await this.client();
      // create upserts within an audience and clears any prior unsubscribe, so
      // it doubles as reactivation. Our table already recorded the source.
      const result = await client.contacts.create({
        email,
        audienceId: this.audienceId(),
        unsubscribed: false,
      });
      if (result.error) {
        // Log the provider's message (safe: it names the failure, not the key)
        // and report failure without throwing, so a route can keep the row.
        console.error(
          `[newsletter] resend subscribe failed for ${email} (${source}): ${result.error.message}`,
        );
        return { ok: false };
      }
      return { ok: true };
    } catch {
      // Network, DNS, an SDK throw: never let the raw error escape, it can carry
      // the outbound request and therefore the key.
      console.error(
        `[newsletter] resend subscribe could not reach the provider for ${email}`,
      );
      return { ok: false };
    }
  }

  async unsubscribe({ email }: { email: string }): Promise<{ ok: boolean }> {
    try {
      const client = await this.client();
      const result = await client.contacts.remove({
        email,
        audienceId: this.audienceId(),
      });
      if (result.error) {
        console.error(
          `[newsletter] resend unsubscribe failed for ${email}: ${result.error.message}`,
        );
        return { ok: false };
      }
      return { ok: true };
    } catch {
      console.error(
        `[newsletter] resend unsubscribe could not reach the provider for ${email}`,
      );
      return { ok: false };
    }
  }
}
