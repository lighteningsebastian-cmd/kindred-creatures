// @vitest-environment node
import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { redirect } from "next/navigation";
import { lookupOrder } from "./actions";
import {
  INITIAL_LOOKUP_STATE,
  LOOKUP_MISS,
  MISS_DELAY_MS,
} from "./lookup-state";
import { verifyOrderToken } from "@/lib/order-token";
import { generatePublicRef } from "@/lib/order-ref";
import { getDb } from "@/lib/db/client";
import { orders } from "@/lib/db/schema";

// redirect() normally throws a framework signal and halts the action. We mock it
// to throw a recognisable error so a test can both prove the action stopped
// there AND inspect the URL it tried to send the browser to.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

beforeEach(() => {
  vi.stubEnv("MOCK_SERVICES", "true");
  vi.mocked(redirect).mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const EMAIL = "thandi@example.co.za";

async function seedOrder(): Promise<{ id: string; ref: string }> {
  const db = await getDb();
  const id = randomUUID();
  const ref = generatePublicRef();
  await db.insert(orders).values({
    id,
    status: "paid",
    publicRef: ref,
    email: EMAIL,
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

function form(reference: string, email: string): FormData {
  const data = new FormData();
  data.set("reference", reference);
  data.set("email", email);
  return data;
}

describe("lookupOrder", () => {
  it("redirects a full match to a status URL carrying a valid signed token", async () => {
    const { id, ref } = await seedOrder();

    await expect(
      lookupOrder(INITIAL_LOOKUP_STATE, form(ref, EMAIL)),
    ).rejects.toThrow(/^REDIRECT:/);

    const url = vi.mocked(redirect).mock.calls[0][0];
    expect(url.startsWith("/order/")).toBe(true);
    const token = url.slice("/order/".length);
    // The token in the redirect must verify back to this exact order.
    expect(verifyOrderToken(token)).toBe(id);
  });

  it("returns the one generic miss and does not redirect on a wrong email", async () => {
    const { ref } = await seedOrder();
    const state = await lookupOrder(INITIAL_LOOKUP_STATE, form(ref, "wrong@example.com"));
    expect(state.error).toBe(LOOKUP_MISS);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("returns the identical message for wrong-ref, wrong-email and neither", async () => {
    const { ref } = await seedOrder();
    const wrongEmail = await lookupOrder(INITIAL_LOOKUP_STATE, form(ref, "x@example.com"));
    const wrongRef = await lookupOrder(INITIAL_LOOKUP_STATE, form("KC-9912-ZZZZZ", EMAIL));
    const neither = await lookupOrder(INITIAL_LOOKUP_STATE, form("KC-9901-BBBBB", "no@x.com"));
    expect(wrongEmail.error).toBe(LOOKUP_MISS);
    expect(wrongRef.error).toBe(LOOKUP_MISS);
    expect(neither.error).toBe(LOOKUP_MISS);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("bumps the attempt counter on each miss so analytics can fire again", async () => {
    const { ref } = await seedOrder();
    const first = await lookupOrder(INITIAL_LOOKUP_STATE, form(ref, "wrong@example.com"));
    const second = await lookupOrder(first, form(ref, "wrong@example.com"));
    expect(first.attempt).toBe(1);
    expect(second.attempt).toBe(2);
  });

  it("does not delay the happy path: a match redirects without the miss damper", async () => {
    const { ref } = await seedOrder();
    const started = Date.now();
    await expect(
      lookupOrder(INITIAL_LOOKUP_STATE, form(ref, EMAIL)),
    ).rejects.toThrow(/^REDIRECT:/);
    // The damper is on the miss path only, so a match returns well under it.
    expect(Date.now() - started).toBeLessThan(MISS_DELAY_MS);
  });
});
