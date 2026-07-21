// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { loginTokens } from "@/lib/db/schema";
import { issueLoginToken, consumeLoginToken } from "./login-tokens";

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
