// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { orders } from "@/lib/db/schema";
import {
  findOrCreateCustomer,
  getCustomerById,
  claimOrdersForCustomer,
} from "./customers";

beforeEach(() => {
  vi.stubEnv("MOCK_SERVICES", "true");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

let seq = 0;
function freshEmail() {
  seq += 1;
  return `cust.${seq}.${Date.now()}@example.co.za`;
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

async function customerIdOf(orderId: string): Promise<string | null> {
  const db = await getDb();
  const [row] = await db.select().from(orders).where(eq(orders.id, orderId));
  return row.customerId;
}

describe("findOrCreateCustomer", () => {
  it("creates once and returns the same row for the same email, case-insensitively", async () => {
    const email = freshEmail();
    const a = await findOrCreateCustomer(email.toUpperCase());
    const b = await findOrCreateCustomer(email.toLowerCase());
    expect(a.id).toBe(b.id);
    expect((await getCustomerById(a.id))?.email).toBe(email.toLowerCase());
  });
});

describe("claimOrdersForCustomer", () => {
  it("attaches this email's unclaimed orders and leaves others alone", async () => {
    const mine = freshEmail();
    const other = freshEmail();
    const myOrder = await seedOrder(mine.toUpperCase()); // stored mixed-case
    const otherOrder = await seedOrder(other);

    const me = await findOrCreateCustomer(mine);
    const claimed = await claimOrdersForCustomer(me.id, mine);

    expect(claimed).toBe(1);
    expect(await customerIdOf(myOrder)).toBe(me.id);
    // Another email's order is untouched.
    expect(await customerIdOf(otherOrder)).toBeNull();

    // Re-running claims nothing more.
    expect(await claimOrdersForCustomer(me.id, mine)).toBe(0);
  });
});
