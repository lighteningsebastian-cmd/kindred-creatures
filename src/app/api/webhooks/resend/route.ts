import { recordEmailEvent } from "@/lib/email/monitoring";
import { verifyResendWebhook } from "@/lib/email/resend-webhook";
import type { EmailEventType } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The Resend delivery webhook: how this shop learns that a mail it sent
 * arrived, bounced, or was reported as spam.
 *
 * VERIFY FIRST, ALWAYS. Nothing in the body is read before the Svix signature
 * over it has checked out (see lib/email/resend-webhook.ts). Without
 * RESEND_WEBHOOK_SECRET set there is nothing to verify against, so the
 * endpoint fails closed: every request is rejected with a log line saying
 * why, rather than an unauthenticated writer into our tables. That matches
 * every other seam in this codebase: mock mode is a safe default, never an
 * open door.
 *
 * STATUS CODES ARE FOR SVIX. It retries a delivery until it gets a 2xx, so
 * 200 means "recorded (or already had it), stop"; 401 means "not yours to
 * send"; and a verified event we could not persist STILL answers 200. The
 * event was genuine, our database was the problem, and a retry storm against
 * a struggling database helps nobody; the miss is in the logs. Rejections
 * carry no reason on the wire: a webhook that explains its checks to a
 * hostile caller is a tuning oracle.
 *
 * WHAT A BOUNCE NEVER DOES: trigger a re-send. recordEmailEvent marks the
 * order so admin says "phone the customer" (the number is on the order, D2);
 * mailing an address that just proved undeliverable again is not a retry, it
 * is reputation damage on a loop. Nothing in this route imports a send.
 */

/** The Resend event types we act on, mapped to what the ledger stores. */
const TRACKED: Record<string, EmailEventType> = {
  "email.delivered": "delivered",
  "email.bounced": "bounced",
  "email.complained": "complained",
};

function ok(): Response {
  return new Response("OK", { status: 200 });
}

function unauthorized(): Response {
  return new Response("Unauthorized", { status: 401 });
}

/**
 * The payload fields we read, pulled out defensively: the body is verified as
 * Resend's, but their schema is theirs to evolve and a webhook that throws on
 * a new optional field would take delivery monitoring down with it.
 */
function parseEvent(payload: string): {
  type: string;
  messageId: string;
  recipient: string;
} | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;

  const event = parsed as {
    type?: unknown;
    data?: { email_id?: unknown; to?: unknown };
  };
  if (typeof event.type !== "string") return null;

  const messageId =
    typeof event.data?.email_id === "string" ? event.data.email_id.trim() : "";

  // `to` is an array of addresses; the first is the one we sent to. Kept for
  // the ledger so a bounce reads without opening the raw payload.
  const to = event.data?.to;
  const recipient =
    Array.isArray(to) && typeof to[0] === "string" ? to[0] : "";

  return { type: event.type, messageId, recipient };
}

export async function POST(request: Request) {
  let payload: string;
  try {
    payload = await request.text();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret) {
    // Mock mode: the endpoint exists and fails closed. Logged every time,
    // because the one way this bites is Resend being configured to deliver
    // here before the secret was set, and this line is how that is noticed.
    console.warn(
      "[email] resend webhook received but RESEND_WEBHOOK_SECRET is not set; rejecting. Set the secret from the Resend dashboard to enable delivery monitoring.",
    );
    return unauthorized();
  }

  const verified = verifyResendWebhook(
    payload,
    {
      id: request.headers.get("svix-id"),
      timestamp: request.headers.get("svix-timestamp"),
      signature: request.headers.get("svix-signature"),
    },
    secret,
  );
  if (!verified) return unauthorized();

  const event = parseEvent(payload);
  if (!event) {
    // Signed by Resend and yet unreadable. Retrying cannot fix it, so take
    // it with a note rather than teaching Svix to hammer us with it.
    console.error("[email] verified resend webhook with an unreadable payload");
    return ok();
  }

  const type = TRACKED[event.type];
  if (!type || !event.messageId) {
    // email.sent, email.opened, a type they add next year, or an event with
    // no message id to key. Not ours to store; acknowledged and dropped.
    return ok();
  }

  const result = await recordEmailEvent(
    type,
    event.messageId,
    event.recipient,
    payload,
  );

  if (result.flaggedBounce) {
    console.warn(
      `[email] ${type} for order ${result.orderId}: marked for a human. Phone the customer; never auto-resend a bounced address.`,
    );
  }

  return ok();
}
