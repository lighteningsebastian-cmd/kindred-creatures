// @vitest-environment node
import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { findOrderByRefAndEmail } from "./order-lookup";
import { generatePublicRef } from "./order-ref";
import { getDb } from "@/lib/db/client";
import { orders } from "@/lib/db/schema";

beforeEach(() => {
  vi.stubEnv("MOCK_SERVICES", "true");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const EMAIL = "Thandi@Example.co.za";

/**
 * Seeds one order and returns its id and reference. The test database persists
 * across cases, so each seed mints a fresh unique reference rather than reusing
 * a constant that would collide on the unique index.
 */
async function seedOrder(
  email: string = EMAIL,
): Promise<{ id: string; ref: string }> {
  const db = await getDb();
  const id = randomUUID();
  const ref = generatePublicRef();
  await db.insert(orders).values({
    id,
    status: "paid",
    publicRef: ref,
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
  });
  return { id, ref };
}

/** A reference with the KC- prefix dropped, spaced and lower-cased. */
function messyForm(ref: string): string {
  const body = ref.replace(/^KC-/, "").replace("-", " ");
  return `  ${body.toLowerCase()}  `;
}

describe("findOrderByRefAndEmail", () => {
  it("matches on the exact reference and email", async () => {
    const { id, ref } = await seedOrder();
    const result = await findOrderByRefAndEmail(ref, EMAIL);
    expect(result).toEqual({ matched: true, orderId: id });
  });

  it("matches through normalisation of both halves", async () => {
    const { id, ref } = await seedOrder();
    // Lower-cased, spaced, prefix dropped reference; differently-cased email.
    const result = await findOrderByRefAndEmail(messyForm(ref), "thandi@example.co.za");
    expect(result).toEqual({ matched: true, orderId: id });
  });

  it("misses when the reference is right but the email is wrong", async () => {
    const { ref } = await seedOrder();
    const result = await findOrderByRefAndEmail(ref, "someone.else@example.co.za");
    expect(result).toEqual({ matched: false });
  });

  it("misses when the email is right but the reference is wrong", async () => {
    await seedOrder();
    const result = await findOrderByRefAndEmail("KC-9912-ZZZZZ", EMAIL);
    expect(result).toEqual({ matched: false });
  });

  it("misses when neither matches", async () => {
    await seedOrder();
    const result = await findOrderByRefAndEmail("KC-9901-BBBBB", "nobody@example.com");
    expect(result).toEqual({ matched: false });
  });

  it("returns the identical miss shape for every failure mode", async () => {
    const { ref } = await seedOrder();
    const wrongEmail = await findOrderByRefAndEmail(ref, "wrong@example.com");
    const wrongRef = await findOrderByRefAndEmail("KC-9912-ZZZZZ", EMAIL);
    const neither = await findOrderByRefAndEmail("KC-9901-BBBBB", "no@example.com");
    // No field distinguishes one failure from another: no enumeration.
    expect(wrongEmail).toEqual({ matched: false });
    expect(wrongRef).toEqual(wrongEmail);
    expect(neither).toEqual(wrongEmail);
  });
});
