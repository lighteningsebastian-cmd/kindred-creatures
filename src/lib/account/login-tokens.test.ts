// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { loginTokens } from "@/lib/db/schema";
import {
  issueLoginToken,
  consumeLoginToken,
  issueWelcomeToken,
  consumeWelcomeToken,
} from "./login-tokens";

beforeEach(() => {
  vi.stubEnv("MOCK_SERVICES", "true");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

let seq = 0;
function freshEmail() {
  seq += 1;
  return `login.${seq}.${Date.now()}@example.co.za`;
}

async function rowsFor(email: string) {
  const db = await getDb();
  return db.select().from(loginTokens).where(eq(loginTokens.email, email));
}

describe("issueLoginToken", () => {
  it("mints a token and stores only its hash", async () => {
    const email = freshEmail();
    const result = await issueLoginToken(email);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const rows = await rowsFor(email);
    expect(rows).toHaveLength(1);
    // The raw token is never at rest: the stored hash is not the raw token.
    expect(rows[0].tokenHash).not.toContain(result.rawToken);
    expect(rows[0].usedAt).toBeNull();
  });

  it("supersedes an earlier outstanding token and refuses a too-soon reissue", async () => {
    const email = freshEmail();
    const first = await issueLoginToken(email, 1_000_000);
    expect(first.ok).toBe(true);

    // Within the reissue window: refused.
    const soon = await issueLoginToken(email, 1_000_000 + 1_000);
    expect(soon.ok).toBe(false);

    // Well after the window: allowed, and the first token is now spent.
    const later = await issueLoginToken(email, 1_000_000 + 60_000);
    expect(later.ok).toBe(true);
    if (!first.ok) return;
    expect(await consumeLoginToken(first.rawToken, 1_000_000 + 60_001)).toBeNull();
  });
});

describe("consumeLoginToken", () => {
  it("returns the email once and refuses a second use", async () => {
    const email = freshEmail();
    const issued = await issueLoginToken(email);
    if (!issued.ok) throw new Error("expected issue");

    expect(await consumeLoginToken(issued.rawToken)).toBe(email);
    // Single use: the second attempt gets nothing.
    expect(await consumeLoginToken(issued.rawToken)).toBeNull();
  });

  it("refuses an expired token", async () => {
    const email = freshEmail();
    const issued = await issueLoginToken(email, 1_000_000);
    if (!issued.ok) throw new Error("expected issue");
    // 16 minutes later, past the 15-minute expiry.
    expect(
      await consumeLoginToken(issued.rawToken, 1_000_000 + 16 * 60 * 1000),
    ).toBeNull();
  });

  it("refuses unknown and malformed tokens", async () => {
    expect(await consumeLoginToken("never-minted")).toBeNull();
    expect(await consumeLoginToken("")).toBeNull();
    expect(await consumeLoginToken(undefined)).toBeNull();
  });
});

describe("welcome tokens (payment-return auto-login)", () => {
  it("mints, stores only the hash, and spends exactly once", async () => {
    const email = freshEmail();
    const raw = await issueWelcomeToken(email);

    const rows = await rowsFor(email);
    expect(rows).toHaveLength(1);
    expect(rows[0].purpose).toBe("welcome");
    // The raw token is never at rest.
    expect(rows[0].tokenHash).not.toContain(raw);

    expect(await consumeWelcomeToken(raw)).toBe(email);
    // Single use: a replayed return_url gets nothing.
    expect(await consumeWelcomeToken(raw)).toBeNull();
  });

  it("refuses an expired welcome token (31 minutes)", async () => {
    const email = freshEmail();
    const raw = await issueWelcomeToken(email, 1_000_000);
    expect(
      await consumeWelcomeToken(raw, 1_000_000 + 31 * 60 * 1000),
    ).toBeNull();
    // Just inside the 30-minute window it still works.
    const again = await issueWelcomeToken(email, 2_000_000);
    expect(
      await consumeWelcomeToken(again, 2_000_000 + 29 * 60 * 1000),
    ).toBe(email);
  });

  it("refuses a tampered token", async () => {
    const email = freshEmail();
    const raw = await issueWelcomeToken(email);
    const forged = raw.slice(0, -1) + (raw.endsWith("A") ? "B" : "A");
    expect(await consumeWelcomeToken(forged)).toBeNull();
    expect(await consumeWelcomeToken("")).toBeNull();
    expect(await consumeWelcomeToken(undefined)).toBeNull();
  });

  it("never crosses purposes with the magic link, in either direction", async () => {
    const email = freshEmail();
    const welcome = await issueWelcomeToken(email);
    // A welcome token pasted into the magic-link callback signs in nobody.
    expect(await consumeLoginToken(welcome)).toBeNull();
    // And it is still spendable as what it is (the miss consumed nothing).
    expect(await consumeWelcomeToken(welcome)).toBe(email);

    const issued = await issueLoginToken(email);
    if (!issued.ok) throw new Error("expected issue");
    // A magic-link token on the return_url signs in nobody.
    expect(await consumeWelcomeToken(issued.rawToken)).toBeNull();
    expect(await consumeLoginToken(issued.rawToken)).toBe(email);
  });

  it("is never rate-limited (a second checkout supersedes the first)", async () => {
    const email = freshEmail();
    const first = await issueWelcomeToken(email, 1_000_000);
    // One second later: a checkout must never fail on a token rate limit.
    const second = await issueWelcomeToken(email, 1_001_000);

    // The earlier outstanding welcome token is superseded...
    expect(await consumeWelcomeToken(first, 1_002_000)).toBeNull();
    // ...and the fresh one works.
    expect(await consumeWelcomeToken(second, 1_002_000)).toBe(email);
  });

  it("does not supersede an outstanding magic link, or be superseded by one", async () => {
    const email = freshEmail();
    const issued = await issueLoginToken(email, 1_000_000);
    if (!issued.ok) throw new Error("expected issue");

    const welcome = await issueWelcomeToken(email, 1_010_000);

    // Both are still alive: checking out must not kill an emailed link, and a
    // fresh emailed link must not kill a live return_url.
    const reissued = await issueLoginToken(email, 1_100_000);
    expect(reissued.ok).toBe(true);
    expect(await consumeWelcomeToken(welcome, 1_101_000)).toBe(email);
  });
});
