// @vitest-environment node
import { randomUUID } from "node:crypto";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { eq } from "drizzle-orm";
import OrderPage from "./page";
import { getDb } from "@/lib/db/client";
import { orders, type OrderStatus } from "@/lib/db/schema";
import { signOrderToken } from "@/lib/order-token";

/**
 * The confirmation page's one job is to be honest. It is reached by a redirect
 * from PayFast, which anyone can imitate by typing a URL, so nothing about
 * arriving here is evidence of anything. These tests pin the two halves of
 * that: the token decides WHICH order, and the database decides WHAT IT SAYS.
 */

async function orderWithStatus(status: OrderStatus): Promise<string> {
  const db = await getDb();
  const id = randomUUID();
  await db.insert(orders).values({
    id,
    status,
    email: "thandi@example.co.za",
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
  });
  return id;
}

async function renderToken(token: string): Promise<string> {
  const element = await OrderPage({ params: Promise.resolve({ token }) });
  return renderToStaticMarkup(element);
}

describe("the order page: which order", () => {
  it("resolves an order from a valid token", async () => {
    const orderId = await orderWithStatus("paid");
    const html = await renderToken(signOrderToken(orderId));

    expect(html).toContain(orderId);
    expect(html).toContain("thandi@example.co.za");
  });

  it("is not found for a token with an edited signature", async () => {
    const orderId = await orderWithStatus("paid");
    const token = signOrderToken(orderId);
    const forged = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");

    await expect(renderToken(forged)).rejects.toThrow();
  });

  it("is not found for a bare order id with no signature", async () => {
    const orderId = await orderWithStatus("paid");
    // The whole point of the token: knowing an order id is not enough, and an
    // order id is not a secret. It was in the payment form.
    await expect(renderToken(orderId)).rejects.toThrow();
  });

  it("never serves another order on a re-pointed token", async () => {
    const mine = await orderWithStatus("paid");
    const theirs = await orderWithStatus("paid");

    // My valid signature, their order id.
    const [, signature] = signOrderToken(mine).split(".");
    await expect(renderToken(`${theirs}.${signature}`)).rejects.toThrow();
  });

  it.each(["nonsense", "", "..", "a".repeat(3000)])(
    "is not found for the junk token %p",
    async (token) => {
      await expect(renderToken(token)).rejects.toThrow();
    },
  );

  it("is not found for a well-signed token to an order that does not exist", async () => {
    const token = signOrderToken("00000000-0000-0000-0000-000000000000");
    await expect(renderToken(token)).rejects.toThrow();
  });

  it("survives a well-signed token whose order id is not a uuid", async () => {
    await expect(renderToken(signOrderToken("hello"))).rejects.toThrow();
  });
});

describe("the order page: what it says", () => {
  it("confirms a paid order and says what happens next", async () => {
    const html = await renderToken(signOrderToken(await orderWithStatus("paid")));

    expect(html).toContain("Payment confirmed");
    expect(html).toMatch(/Cape Town/);
    expect(html).toMatch(/5 working days/);
  });

  it("does not claim success on an order PayFast has not confirmed", async () => {
    const orderId = await orderWithStatus("pending");
    const html = await renderToken(signOrderToken(orderId));

    // The customer has just paid and been redirected here. From their side it
    // worked. The ITN has not arrived, so we say so rather than congratulating
    // them on a payment we cannot see.
    expect(html).toContain("Waiting on PayFast");
    expect(html).not.toContain("Payment confirmed");
    expect(html).not.toMatch(/Thank you/);
    // Reassurance, not alarm.
    expect(html).toMatch(/safe|saved/i);
  });

  it("tells someone with a flagged order that we are on it, without alarm", async () => {
    const html = await renderToken(
      signOrderToken(await orderWithStatus("flagged")),
    );

    expect(html).toContain("We are checking this one");
    expect(html).toMatch(/nothing you need to do/i);
    // No accusations, no fraud language, no shouting.
    expect(html).not.toMatch(/fraud|suspicious|error|failed|invalid/i);
  });

  it("keeps reporting the real state after an order ships", async () => {
    const html = await renderToken(
      signOrderToken(await orderWithStatus("shipped")),
    );
    // A customer coming back to their bookmark must not be told their paid,
    // shipped order is still waiting on payment.
    expect(html).toContain("On the road");
    expect(html).not.toContain("Waiting on PayFast");
  });

  it("prices the order from the row, not from anything in the URL", async () => {
    const orderId = await orderWithStatus("paid");
    const html = await renderToken(signOrderToken(orderId));

    const db = await getDb();
    const [row] = await db.select().from(orders).where(eq(orders.id, orderId));
    expect(row.totalZar).toBe(998);
    expect(html).toMatch(/R.?998/);
  });
});
