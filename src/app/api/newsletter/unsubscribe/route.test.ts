// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { subscribers } from "@/lib/db/schema";
import { normaliseEmail, upsertSubscriber } from "@/lib/newsletter";
import { signToken } from "@/lib/order-token";
import { GET } from "./route";

async function statusOf(email: string): Promise<string | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(subscribers)
    .where(eq(subscribers.email, normaliseEmail(email)));
  return rows[0]?.status ?? null;
}

// The route ends in redirect(), which throws a NEXT_REDIRECT error carrying the
// destination in its digest. Run it and hand back where it tried to send us.
async function unsubscribeVia(token: string): Promise<string> {
  const url = `http://test/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;
  try {
    await GET(new Request(url));
  } catch (err) {
    const digest = (err as { digest?: string }).digest ?? "";
    if (digest.startsWith("NEXT_REDIRECT")) return digest;
    throw err;
  }
  throw new Error("expected a redirect");
}

let seq = 0;
function freshEmail() {
  seq += 1;
  return `unsub.route.${seq}.${Date.now()}@example.co.za`;
}

beforeEach(() => {
  vi.stubEnv("MOCK_SERVICES", "true");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/newsletter/unsubscribe", () => {
  it("flips a valid token's address to unsubscribed", async () => {
    const email = freshEmail();
    await upsertSubscriber({ email, source: "footer" });

    const digest = await unsubscribeVia(signToken(normaliseEmail(email)));

    expect(digest).toContain("status=done");
    expect(await statusOf(email)).toBe("unsubscribed");
  });

  it("is idempotent", async () => {
    const email = freshEmail();
    await upsertSubscriber({ email, source: "footer" });
    const token = signToken(normaliseEmail(email));

    await unsubscribeVia(token);
    const digest = await unsubscribeVia(token);

    expect(digest).toContain("status=done");
    expect(await statusOf(email)).toBe("unsubscribed");
  });

  it("rejects a tampered token without touching anyone", async () => {
    const email = freshEmail();
    await upsertSubscriber({ email, source: "footer" });
    const tampered = signToken(normaliseEmail(email)) + "x";

    const digest = await unsubscribeVia(tampered);

    expect(digest).toContain("status=invalid");
    // The address is untouched: a forged link cannot opt anyone out.
    expect(await statusOf(email)).toBe("active");
  });

  it("treats a missing token as an invalid link", async () => {
    try {
      await GET(new Request("http://test/api/newsletter/unsubscribe"));
      throw new Error("expected a redirect");
    } catch (err) {
      const digest = (err as { digest?: string }).digest ?? "";
      expect(digest).toContain("status=invalid");
    }
  });
});
