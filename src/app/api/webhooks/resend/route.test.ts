// @vitest-environment node
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { POST as webhook } from "./route";
import { getDb } from "@/lib/db/client";
import { emailEvents, orderEmails, orders } from "@/lib/db/schema";
import { needsAttention } from "@/lib/admin/orders";
import { MockEmailTransport } from "@/lib/email/send";

/**
 * The delivery webhook end to end: a stranger cannot write to our tables, a
 * genuine event lands keyed to its order, a bounce marks the order for a
 * human and NEVER re-sends anything, and a database hiccup on a genuine
 * event still answers 200 (Svix retrying into a struggling database is a
 * storm, not a fix).
 */

const state = vi.hoisted(() => ({ dbDown: false }));

vi.mock("@/lib/db/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/client")>();
  return {
    ...actual,
    getDb: async () => {
      if (state.dbDown) throw new Error("database is down");
      return actual.getDb();
    },
  };
});

const KEY = randomBytes(24);
const SECRET = `whsec_${KEY.toString("base64")}`;

beforeEach(() => {
  vi.stubEnv("RESEND_WEBHOOK_SECRET", SECRET);
});

afterEach(() => {
  state.dbDown = false;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/** A request signed the way Svix signs one, or deliberately not. */
function post(
  payload: string,
  options: {
    sign?: boolean;
    timestampSec?: number;
    signature?: string;
    headers?: Record<string, string>;
  } = {},
): Request {
  const { sign = true } = options;
  const headers: Record<string, string> = { ...options.headers };

  if (sign) {
    const id = `msg_${randomUUID()}`;
    const ts = options.timestampSec ?? Math.floor(Date.now() / 1000);
    const mac = createHmac("sha256", KEY)
      .update(`${id}.${ts}.${payload}`)
      .digest("base64");
    headers["svix-id"] = id;
    headers["svix-timestamp"] = String(ts);
    headers["svix-signature"] = options.signature ?? `v1,${mac}`;
  }

  return new Request("http://localhost/api/webhooks/resend", {
    method: "POST",
    headers,
    body: payload,
  });
}

function event(
  type: string,
  messageId: string,
  to = "thandi@example.co.za",
): string {
  return JSON.stringify({
    type,
    created_at: new Date().toISOString(),
    data: { email_id: messageId, to: [to], subject: "Your Kindred order" },
  });
}

/** An order with a recorded confirmation send, the way fulfilment leaves one. */
async function orderWithSend(
  messageId: string,
  email = "thandi@example.co.za",
): Promise<string> {
  const db = await getDb();
  const id = randomUUID();
  await db.insert(orders).values({
    id,
    status: "sent_to_printer",
    email,
    firstName: "Thandi",
    lastName: "Mokoena",
    phone: "082 123 4567",
    addressLine1: "14 Loop Street",
    suburb: "Gardens",
    city: "Cape Town",
    province: "Western Cape",
    postalCode: "8001",
    subtotalZar: 899,
    shippingZar: 99,
    totalZar: 998,
    payfastPaymentId: `pf-${id.slice(0, 8)}`,
  });
  await db.insert(orderEmails).values({
    orderId: id,
    kind: "confirmation",
    recipient: email,
    messageId,
  });
  return id;
}

async function readOrder(orderId: string) {
  const db = await getDb();
  const [row] = await db.select().from(orders).where(eq(orders.id, orderId));
  return row;
}

async function eventsFor(messageId: string) {
  const db = await getDb();
  return db
    .select()
    .from(emailEvents)
    .where(eq(emailEvents.messageId, messageId));
}

describe("POST /api/webhooks/resend", () => {
  it("rejects an unsigned request", async () => {
    const response = await webhook(
      post(event("email.delivered", "msg-x"), { sign: false }),
    );
    expect(response.status).toBe(401);
    expect(await eventsFor("msg-x")).toHaveLength(0);
  });

  it("rejects a bad signature", async () => {
    const response = await webhook(
      post(event("email.delivered", "msg-x"), {
        signature: `v1,${randomBytes(32).toString("base64")}`,
      }),
    );
    expect(response.status).toBe(401);
    expect(await eventsFor("msg-x")).toHaveLength(0);
  });

  it("rejects a stale timestamp: yesterday's capture buys nothing today", async () => {
    const response = await webhook(
      post(event("email.delivered", "msg-x"), {
        timestampSec: Math.floor(Date.now() / 1000) - 24 * 60 * 60,
      }),
    );
    expect(response.status).toBe(401);
  });

  it("without the secret set, fails closed on everything and logs", async () => {
    vi.stubEnv("RESEND_WEBHOOK_SECRET", "");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Even a request that WOULD verify against our key is rejected: with no
    // secret configured there is nothing legitimate to verify against.
    const response = await webhook(post(event("email.delivered", "msg-x")));
    expect(response.status).toBe(401);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("RESEND_WEBHOOK_SECRET"),
    );
    expect(await eventsFor("msg-x")).toHaveLength(0);
  });

  it("records a delivered event keyed to its order", async () => {
    const messageId = `msg-${randomUUID()}`;
    const orderId = await orderWithSend(messageId);

    const response = await webhook(post(event("email.delivered", messageId)));
    expect(response.status).toBe(200);

    const recorded = await eventsFor(messageId);
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({
      type: "delivered",
      orderId,
      recipient: "thandi@example.co.za",
    });
    // Delivered mail is good news: the order is untouched.
    const order = await readOrder(orderId);
    expect(order?.emailBouncedAt).toBeNull();
  });

  it("a bounce marks the order and puts it in needs-attention", async () => {
    const messageId = `msg-${randomUUID()}`;
    const orderId = await orderWithSend(messageId);

    const before = await readOrder(orderId);
    expect(needsAttention(before!)).toBe(false);

    const response = await webhook(post(event("email.bounced", messageId)));
    expect(response.status).toBe(200);

    const after = await readOrder(orderId);
    expect(after?.emailBouncedAt).toBeInstanceOf(Date);
    expect(needsAttention(after!)).toBe(true);
    // The bounce is a note for a human, never a lifecycle change: the order
    // is still printing, and `flagged` keeps meaning money/print trouble.
    expect(after?.status).toBe("sent_to_printer");
  });

  it("NEVER auto-resends on a bounce", async () => {
    const send = vi
      .spyOn(MockEmailTransport.prototype, "send")
      .mockResolvedValue({ id: "should-never-happen" });

    const messageId = `msg-${randomUUID()}`;
    await orderWithSend(messageId);
    const response = await webhook(post(event("email.bounced", messageId)));

    expect(response.status).toBe(200);
    expect(send).not.toHaveBeenCalled();
  });

  it("records a complaint the same way", async () => {
    const messageId = `msg-${randomUUID()}`;
    await orderWithSend(messageId);
    const response = await webhook(post(event("email.complained", messageId)));
    expect(response.status).toBe(200);
    const recorded = await eventsFor(messageId);
    expect(recorded[0]?.type).toBe("complained");
  });

  it("acknowledges and drops event types we do not track", async () => {
    const messageId = `msg-${randomUUID()}`;
    const response = await webhook(post(event("email.opened", messageId)));
    expect(response.status).toBe(200);
    expect(await eventsFor(messageId)).toHaveLength(0);
  });

  it("a Svix retry of the same event does not double-record", async () => {
    const messageId = `msg-${randomUUID()}`;
    await orderWithSend(messageId);

    await webhook(post(event("email.delivered", messageId)));
    const retry = await webhook(post(event("email.delivered", messageId)));

    expect(retry.status).toBe(200);
    expect(await eventsFor(messageId)).toHaveLength(1);
  });

  it("still answers 200 when a genuine event cannot be persisted", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    state.dbDown = true;

    const response = await webhook(
      post(event("email.bounced", `msg-${randomUUID()}`)),
    );
    expect(response.status).toBe(200);
    expect(error).toHaveBeenCalled();
  });

  it("takes a verified but unreadable payload with a note, not a retry loop", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await webhook(post("this is not json"));
    expect(response.status).toBe(200);
    expect(error).toHaveBeenCalled();
  });
});
