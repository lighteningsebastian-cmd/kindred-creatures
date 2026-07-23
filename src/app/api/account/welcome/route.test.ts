// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { customers, orders } from "@/lib/db/schema";
import {
  issueLoginToken,
  issueWelcomeToken,
} from "@/lib/account/login-tokens";

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
import { signOrderToken } from "@/lib/order-token";

/**
 * The welcome handler is the cookie-setting half of D3: the order page bounces
 * ?welcome=<raw> here, and this spends it. The tests pin the security matrix:
 * a valid token signs in and claims exactly once; every kind of miss (unknown,
 * replayed, or a magic-link token in the wrong slot) takes the identical
 * redirect with no cookie, so nothing here leaks whether a token was real.
 */

const ORDER_PARAM = "some-order-token";

async function follow(
  token: string | null,
  order: string | null = ORDER_PARAM,
): Promise<string> {
  const url = new URL("http://test/api/account/welcome");
  if (token !== null) url.searchParams.set("token", token);
  if (order !== null) url.searchParams.set("order", order);
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
  return `welcome.${seq}.${Date.now()}@example.co.za`;
}

async function seedGuestOrder(email: string): Promise<string> {
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

describe("GET /api/account/welcome", () => {
  it("signs in, claims the guest order, and lands back on the order page", async () => {
    const email = freshEmail();
    const orderId = await seedGuestOrder(email);
    const raw = await issueWelcomeToken(email);

    const to = await follow(raw);

    expect(to).toBe(`/order/${ORDER_PARAM}`);
    expect(cookieSet).toHaveBeenCalledWith(
      CUSTOMER_COOKIE,
      expect.any(String),
      expect.objectContaining({ httpOnly: true }),
    );

    const db = await getDb();
    // The account exists...
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.email, email));
    expect(customer).toBeDefined();
    // ...and the guest order now belongs to it.
    const [row] = await db.select().from(orders).where(eq(orders.id, orderId));
    expect(row.customerId).toBe(customer.id);
  });

  it("takes the identical redirect, with no cookie, for a token that was never minted", async () => {
    const to = await follow("never-a-real-token");
    expect(to).toBe(`/order/${ORDER_PARAM}`);
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("is single-use: the replayed return_url gets the page but no login", async () => {
    const email = freshEmail();
    const raw = await issueWelcomeToken(email);

    expect(await follow(raw)).toBe(`/order/${ORDER_PARAM}`);
    cookieSet.mockReset();

    expect(await follow(raw)).toBe(`/order/${ORDER_PARAM}`);
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("refuses an expired token, silently", async () => {
    const email = freshEmail();
    const raw = await issueWelcomeToken(email, Date.now() - 31 * 60 * 1000);
    expect(await follow(raw)).toBe(`/order/${ORDER_PARAM}`);
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("never accepts a magic-link token in the welcome slot", async () => {
    const email = freshEmail();
    const issued = await issueLoginToken(email);
    if (!issued.ok) throw new Error("expected issue");

    expect(await follow(issued.rawToken)).toBe(`/order/${ORDER_PARAM}`);
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("never accepts the signed order-status token as a login", async () => {
    const email = freshEmail();
    const orderId = await seedGuestOrder(email);

    // The URL anyone might hold: the emailed status link's token. It grants a
    // status page, never a session, even fed straight into this handler.
    expect(await follow(signOrderToken(orderId))).toBe(
      `/order/${ORDER_PARAM}`,
    );
    expect(cookieSet).not.toHaveBeenCalled();

    const db = await getDb();
    const [row] = await db.select().from(orders).where(eq(orders.id, orderId));
    expect(row.customerId).toBeNull();
  });

  it("only ever redirects inside /order/, and home with no order param", async () => {
    // A crafted order parameter cannot break out of the /order/ path.
    expect(await follow("whatever", "https://evil.example/phish")).toBe(
      `/order/${encodeURIComponent("https://evil.example/phish")}`,
    );
    expect(await follow("whatever", null)).toBe("/");
  });
});
