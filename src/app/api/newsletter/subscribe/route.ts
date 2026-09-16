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
 * What the customer is told when WE are the problem. It must never read like
 * the one for a mistyped address: "We could not sign you up" said both, and it
 * sent two debugging sessions after the wrong system.
 */
const OUR_SIDE =
  "Something went wrong on our side, not with your address. Please try again in a few minutes.";

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

  let joined: Awaited<ReturnType<typeof upsertSubscriber>>;
  try {
    joined = await upsertSubscriber({
      email,
      source: source as SubscriberSource,
    });
  } catch (error) {
    // The database, not the customer. Logged in full, answered as a 503 so
    // neither the form nor anyone reading the logs mistakes it for a rejection.
    console.error("[newsletter] could not save a subscriber:", error);
    return bad(OUR_SIDE, 503);
  }
  const { outcome, subscriber } = joined;

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
