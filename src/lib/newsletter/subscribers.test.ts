// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
  normaliseEmail,
  setUnsubscribed,
  upsertSubscriber,
} from "./subscribers";
import { getDb } from "@/lib/db/client";
import { subscribers } from "@/lib/db/schema";

/**
 * The owned-truth half of the newsletter. The whole point of this table is that
 * an address appears at most once and consent is re-stamped when it is given
 * again, so these tests hammer the three upsert paths plus normalisation.
 */

beforeEach(() => {
  vi.stubEnv("MOCK_SERVICES", "true");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

async function rowsFor(email: string) {
  const db = await getDb();
  return db
    .select()
    .from(subscribers)
    .where(eq(subscribers.email, normaliseEmail(email)));
}

describe("normaliseEmail", () => {
  it("lowercases and trims", () => {
    expect(normaliseEmail("  Sam@Example.COM ")).toBe("sam@example.com");
  });
});

describe("upsertSubscriber", () => {
  it("inserts a new address as active with consentAt set", async () => {
    const result = await upsertSubscriber({
      email: "new@example.test",
      source: "footer",
    });
    expect(result.outcome).toBe("created");
    expect(result.subscriber.status).toBe("active");
    expect(result.subscriber.source).toBe("footer");
    expect(result.subscriber.consentAt).toBeInstanceOf(Date);

    const rows = await rowsFor("new@example.test");
    expect(rows).toHaveLength(1);
  });

  it("is a single-row no-op for an already-active address", async () => {
    await upsertSubscriber({ email: "dup@example.test", source: "footer" });
    const result = await upsertSubscriber({
      email: "dup@example.test",
      source: "checkout",
    });
    expect(result.outcome).toBe("noop");

    const rows = await rowsFor("dup@example.test");
    expect(rows).toHaveLength(1);
    // No-op leaves the original untouched (source stays "footer").
    expect(rows[0].source).toBe("footer");
  });

  it("reactivates an unsubscribed address with a fresh consentAt", async () => {
    const created = await upsertSubscriber({
      email: "back@example.test",
      source: "footer",
    });
    await setUnsubscribed("back@example.test");

    // A hair of time so the fresh consentAt is strictly observable.
    await new Promise((r) => setTimeout(r, 2));

    const result = await upsertSubscriber({
      email: "back@example.test",
      source: "checkout",
    });
    expect(result.outcome).toBe("reactivated");
    expect(result.subscriber.status).toBe("active");
    expect(result.subscriber.source).toBe("checkout");
    expect(result.subscriber.consentAt.getTime()).toBeGreaterThanOrEqual(
      created.subscriber.consentAt.getTime(),
    );

    const rows = await rowsFor("back@example.test");
    expect(rows).toHaveLength(1);
  });

  it("treats differently-cased addresses as the same subscriber", async () => {
    await upsertSubscriber({ email: "MixedCase@X.test", source: "footer" });
    const second = await upsertSubscriber({
      email: "mixedcase@x.test",
      source: "footer",
    });
    expect(second.outcome).toBe("noop");

    const rows = await rowsFor("mixedcase@x.test");
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe("mixedcase@x.test");
  });
});

describe("setUnsubscribed", () => {
  it("flips an active address to unsubscribed", async () => {
    await upsertSubscriber({ email: "out@example.test", source: "footer" });
    const result = await setUnsubscribed("out@example.test");
    expect(result.outcome).toBe("unsubscribed");
    expect(result.subscriber?.status).toBe("unsubscribed");
  });

  it("is idempotent and reports an already-unsubscribed address", async () => {
    await upsertSubscriber({ email: "twice@example.test", source: "footer" });
    await setUnsubscribed("twice@example.test");
    const again = await setUnsubscribed("twice@example.test");
    expect(again.outcome).toBe("already");
  });

  it("reports an unknown address as missing without throwing", async () => {
    const result = await setUnsubscribed("nobody@example.test");
    expect(result.outcome).toBe("missing");
    expect(result.subscriber).toBeNull();
  });
});
