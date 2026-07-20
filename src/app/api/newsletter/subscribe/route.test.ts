// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { subscribers } from "@/lib/db/schema";
import { normaliseEmail } from "@/lib/newsletter";

// Hoisted so the vi.mock factories below can close over them.
const { subscribeMock, sendWelcomeMock } = vi.hoisted(() => ({
  subscribeMock: vi.fn(),
  sendWelcomeMock: vi.fn(),
}));

// Keep the real owned-truth helpers (upsertSubscriber writes the test DB); only
// swap the sending provider so a push can be forced to fail.
vi.mock("@/lib/newsletter", async (orig) => {
  const actual = await orig<typeof import("@/lib/newsletter")>();
  return {
    ...actual,
    getNewsletterProvider: vi.fn(async () => ({
      subscribe: subscribeMock,
      unsubscribe: vi.fn(async () => ({ ok: true })),
    })),
  };
});

// Spy the welcome so "sent on join, never on a repeat" is observable without
// reaching into the transport.
vi.mock("@/lib/email", async (orig) => {
  const actual = await orig<typeof import("@/lib/email")>();
  return { ...actual, sendWelcome: sendWelcomeMock };
});

import { POST } from "./route";

function post(body: unknown) {
  return POST(
    new Request("http://test/api/newsletter/subscribe", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
}

async function rowsFor(email: string) {
  const db = await getDb();
  return db
    .select()
    .from(subscribers)
    .where(eq(subscribers.email, normaliseEmail(email)));
}

let seq = 0;
function freshEmail() {
  seq += 1;
  return `sub.route.${seq}.${Date.now()}@example.co.za`;
}

beforeEach(() => {
  vi.stubEnv("MOCK_SERVICES", "true");
  subscribeMock.mockReset();
  subscribeMock.mockResolvedValue({ ok: true });
  sendWelcomeMock.mockReset();
  sendWelcomeMock.mockResolvedValue({ ok: true, id: "wel_test" });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/newsletter/subscribe", () => {
  it("creates one active subscriber and sends the welcome", async () => {
    const email = freshEmail();
    const res = await post({ email, source: "footer" });

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true, alreadySubscribed: false });

    const rows = await rowsFor(email);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("active");
    expect(rows[0].source).toBe("footer");
    expect(sendWelcomeMock).toHaveBeenCalledTimes(1);
    expect(subscribeMock).toHaveBeenCalledTimes(1);
  });

  it("does not re-welcome an already-active address", async () => {
    const email = freshEmail();
    await post({ email, source: "footer" });
    sendWelcomeMock.mockClear();

    const res = await post({ email, source: "checkout" });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true, alreadySubscribed: true });

    expect(await rowsFor(email)).toHaveLength(1);
    expect(sendWelcomeMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid email and writes no row", async () => {
    const res = await post({ email: "not-an-email", source: "footer" });
    expect(res.status).toBe(400);
    expect(await rowsFor("not-an-email")).toHaveLength(0);
  });

  it("rejects an unknown source", async () => {
    const res = await post({ email: freshEmail(), source: "billboard" });
    expect(res.status).toBe(400);
  });

  it("still records the subscriber when the provider push fails", async () => {
    subscribeMock.mockResolvedValue({ ok: false });
    const email = freshEmail();

    const res = await post({ email, source: "footer" });
    expect(res.status).toBe(201);

    const rows = await rowsFor(email);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("active");
    // The subscriber is the source of truth; a failed push does not undo it or
    // block the welcome.
    expect(sendWelcomeMock).toHaveBeenCalledTimes(1);
  });
});
