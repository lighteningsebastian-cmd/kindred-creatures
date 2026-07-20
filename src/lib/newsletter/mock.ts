import type { NewsletterProvider } from "./provider";
import type { SubscriberSource } from "@/lib/db/schema";

/**
 * Local, key-free provider. It logs what it would have pushed to the mailing
 * list and always succeeds. This is the whole of what a developer without a
 * Resend Audience sees, so the log is written to be read: who, and from which
 * surface. Good enough for the whole capture flow to run end to end offline;
 * swap in the Resend provider once an Audience id exists.
 */
export class MockNewsletterProvider implements NewsletterProvider {
  async subscribe({
    email,
    source,
  }: {
    email: string;
    source: SubscriberSource;
  }): Promise<{ ok: boolean }> {
    console.log(
      `[newsletter] (mock, nothing was pushed) subscribe ${email} from ${source}`,
    );
    return { ok: true };
  }

  async unsubscribe({ email }: { email: string }): Promise<{ ok: boolean }> {
    console.log(
      `[newsletter] (mock, nothing was pushed) unsubscribe ${email}`,
    );
    return { ok: true };
  }
}
