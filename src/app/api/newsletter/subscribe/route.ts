import { getNewsletterProvider, upsertSubscriber } from "@/lib/newsletter";
import type { SubscriberSource } from "@/lib/db/schema";
import { sendWelcome } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A pragmatic address check: exactly one @, a dot in the domain, no spaces. Not
// RFC 5322 (nothing sane is); it rejects the fat-finger cases and leaves real
// verification to the fact that a welcome mail either lands or it does not.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SOURCES = new Set<SubscriberSource>(["footer", "checkout"]);

function bad(error: string, status: number) {
  return Response.json({ error }, { status });
}

/**
 * Adds an address to the newsletter list. The subscribers row is the source of
 * truth: it is written first, and a failure to push the contact to the sending
 * provider or to send the welcome mail is logged but never fails the request or
 * loses the subscriber. The welcome only goes on a genuine join (a new address
 * or a returning unsubscriber), never on a repeat of an already-active one, so
 * re-submitting the form does not re-welcome anyone.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return bad("Expected a JSON body.", 400);
  }

  const { email, source } = (body ?? {}) as {
    email?: unknown;
    source?: unknown;
  };

  if (typeof email !== "string" || !EMAIL.test(email.trim())) {
    return bad("Please enter a valid email address.", 400);
  }
  if (typeof source !== "string" || !SOURCES.has(source as SubscriberSource)) {
    return bad("Unknown signup source.", 400);
  }

  const { outcome, subscriber } = await upsertSubscriber({
    email,
    source: source as SubscriberSource,
  });

  // Best-effort side effects. Neither can undo the subscribe above.
  const provider = await getNewsletterProvider();
  const pushed = await provider.subscribe({
    email: subscriber.email,
    source: subscriber.source,
  });
  if (!pushed.ok) {
    console.error("[newsletter] provider push failed for a new subscriber");
  }

  if (outcome === "created" || outcome === "reactivated") {
    const welcomed = await sendWelcome(subscriber.email);
    if (!welcomed.ok) {
      console.error("[newsletter] welcome email failed to send");
    }
  }

  // `alreadySubscribed` lets the form say "You are already on the list" warmly
  // instead of implying a fresh signup. No PII beyond the outcome is returned.
  return Response.json(
    { ok: true, alreadySubscribed: outcome === "noop" },
    { status: 201 },
  );
}
