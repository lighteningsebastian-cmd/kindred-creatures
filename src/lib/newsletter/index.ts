import type { NewsletterProvider } from "./provider";
import { MockNewsletterProvider } from "./mock";

export * from "./provider";
export * from "./subscribers";

/**
 * True when we should use the offline mock rather than a real mailing list.
 * Both keys are required for the real path: an API key with no Audience id has
 * nowhere to put a contact, so the mock is still the correct choice.
 */
export function usingMockNewsletter(): boolean {
  return (
    process.env.MOCK_SERVICES === "true" ||
    !process.env.RESEND_API_KEY ||
    !process.env.RESEND_AUDIENCE_ID
  );
}

let cached: NewsletterProvider | null = null;

/**
 * Returns the active newsletter provider: the mock when MOCK_SERVICES is truthy
 * or either Resend key is absent, otherwise the real Resend provider. The Resend
 * class is only imported when actually selected, so the mock path stays free of
 * the `resend` dependency at import time. Mirrors getImageProvider().
 */
export async function getNewsletterProvider(): Promise<NewsletterProvider> {
  if (cached) return cached;
  if (usingMockNewsletter()) {
    cached = new MockNewsletterProvider();
  } else {
    const { ResendNewsletterProvider } = await import("./resend");
    cached = new ResendNewsletterProvider();
  }
  return cached;
}

/** Drops the memoised provider. Tests use this when they change the env. */
export function resetNewsletterProvider(): void {
  cached = null;
}
