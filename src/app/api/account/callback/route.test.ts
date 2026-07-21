// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { orders } from "@/lib/db/schema";
import { issueLoginToken } from "@/lib/account/login-tokens";

const { cookieSet } = vi.hoisted(() => ({ cookieSet: vi.fn() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({ set: cookieSet, get: vi.fn(), delete: vi.fn() }),
}));

class RedirectError extends Error {
  constructor(public readonly to: string) {
    super(`REDIRECT:${to}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new RedirectError(to);
  },
}));

import { GET } from "./route";
import { CUSTOMER_COOKIE } from "@/lib/account/session";

async function callback(token: string | null): Promise<string> {
  const url = token
    ? `http://test/api/account/callback?token=${encodeURIComponent(token)}`
    : "http://test/api/account/callback";
  try {
    await GET(new Request(url));
  } catch (err) {
    if (err instanceof RedirectError) return err.to;
    throw err;
  }
  throw new Error("expected a redirect");
}

let seq = 0;
function freshEmail() {
  seq += 1;
  return `cb.${seq}.${Date.now()}@example.co.za`;
}

async function seedOrder(email: string): Promise<string> {
  const db = await getDb();
  const [row] = await db
    .insert(orders)
    .values({
      status: "paid",
      email,
      firstName: "Test",
      lastName: "Buyer",
      phone: "0820000000",
      addressLine1: "1 Test Road",
      suburb: "Gardens",
      city: "Cape Town",
      province: "Western Cape",
      postalCode: "8001",
      subtotalZar: 899,
      shippingZar: 0,
      totalZar: 899,
    })
    .returning();
  return row.id;
}

beforeEach(() => {
  vi.stubEnv("MOCK_SERVICES", "true");
  vi.stubEnv("SESSION_SECRET", "test-session-secret");
  cookieSet.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("GET /api/account/callback", () => {
  it("signs in, claims the guest order, and lands on the account", async () => {
    const email = freshEmail();
    const orderId = await seedOrder(email);
    const issued = await issueLoginToken(email);
    if (!issued.ok) throw new Error("expected issue");

    const to = await callback(issued.rawToken);

    expect(to).toBe("/account");
    // A session cookie was set.
    expect(cookieSet).toHaveBeenCalledWith(
      CUSTOMER_COOKIE,
      expect.any(String),
      expect.objectContaining({ httpOnly: true }),
    );
    // The guest order was claimed.
    const db = await getDb();
    const [row] = await db.select().from(orders).where(eq(orders.id, orderId));
    expect(row.customerId).not.toBeNull();
  });

  it("sends an expired token back to login without signing anyone in", async () => {
    const to = await callback("never-a-real-token");
    expect(to).toBe("/account/login?error=expired");
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("refuses a used token on the second click", async () => {
    const email = freshEmail();
    const issued = await issueLoginToken(email);
    if (!issued.ok) throw new Error("expected issue");

    expect(await callback(issued.rawToken)).toBe("/account");
    cookieSet.mockReset();
    expect(await callback(issued.rawToken)).toBe("/account/login?error=expired");
    expect(cookieSet).not.toHaveBeenCalled();
  });
});
