// @vitest-environment node
import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getDb } from "@/lib/db/client";
import {
  artworks,
  customers,
  orderItems,
  orders,
  type OrderStatus,
} from "@/lib/db/schema";
import {
  customerOwnsArtwork,
  getReorderableCreature,
  listCreaturesForCustomer,
  listOrdersForCustomer,
} from "./creatures";

/**
 * The account read layer, and the one question that matters most: can a customer
 * ever see a portrait or an order that is not theirs? Every case here proves the
 * scoping holds, in both directions (I see mine, I never see yours), and that an
 * unpaid order is not ownership.
 */

beforeEach(() => {
  vi.stubEnv("MOCK_SERVICES", "true");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

let seq = 0;
function freshEmail() {
  seq += 1;
  return `creature.${seq}.${Date.now()}@example.co.za`;
}

async function seedCustomer(): Promise<string> {
  const db = await getDb();
  const [row] = await db
    .insert(customers)
    .values({ email: freshEmail() })
    .returning();
  return row.id;
}

/**
 * An artwork as the pipeline actually writes one TODAY: frontKey and backKey
 * set by artwork-drawing.ts, and previewKey null, because nothing has written
 * previewKey since generation moved to after payment.
 *
 * This seeder used to write previewKey and nothing else, which is precisely how
 * "My Creatures" came to show a paw print on every card while every test here
 * passed: the fixture described a row shape the product had stopped producing.
 * Pass `legacy` for a row from before the change.
 */
async function seedArtwork(shape: "current" | "legacy" = "current"): Promise<string> {
  const db = await getDb();
  const id = randomUUID();
  await db.insert(artworks).values({
    id,
    uploadKey: `uploads/${id}.jpg`,
    style: "watercolor",
    ...(shape === "legacy"
      ? { previewKey: `previews/${id}/1.svg` }
      : {
          frontKey: `plates/${id}/front-1.png`,
          backKey: `plates/${id}/back-1.png`,
        }),
    status: "ready",
    productSlug: "hoodie",
  });
  return id;
}

/** Seeds an order for a customer (or a guest when customerId is null) with one
 * line pointing at artworkId, and returns the order id. */
async function seedOrder(options: {
  customerId: string | null;
  artworkId: string;
  status: OrderStatus;
  createdAt?: Date;
  qty?: number;
  totalZar?: number;
}): Promise<string> {
  const db = await getDb();
  const orderId = randomUUID();
  await db.insert(orders).values({
    id: orderId,
    status: options.status,
    email: freshEmail(),
    customerId: options.customerId,
    firstName: "Test",
    lastName: "Buyer",
    phone: "0820000000",
    addressLine1: "1 Test Road",
    suburb: "Gardens",
    city: "Cape Town",
    province: "Western Cape",
    postalCode: "8001",
    subtotalZar: options.totalZar ?? 899,
    shippingZar: 0,
    totalZar: options.totalZar ?? 899,
    ...(options.createdAt ? { createdAt: options.createdAt } : {}),
  });
  await db.insert(orderItems).values({
    orderId,
    productSlug: "hoodie",
    color: "Stone",
    size: "M",
    qty: options.qty ?? 1,
    unitPriceZar: 899,
    artworkId: options.artworkId,
  });
  return orderId;
}

describe("listCreaturesForCustomer", () => {
  it("returns the artworks from this customer's paid orders", async () => {
    const customerId = await seedCustomer();
    const artworkId = await seedArtwork();
    await seedOrder({ customerId, artworkId, status: "paid" });

    const creatures = await listCreaturesForCustomer(customerId);

    expect(creatures.map((c) => c.artworkId)).toContain(artworkId);
    const mine = creatures.find((c) => c.artworkId === artworkId)!;
    expect(mine.styleLabel).toBe("Watercolor");
    expect(mine.previewUrl).toBeTruthy();
  });

  // The card falls back to a paw print when previewUrl is null, and previewKey
  // is null on every artwork drawn since generation moved after payment. Both
  // row shapes have to produce a picture.
  it("shows the front plate now, and the old preview for historic rows", async () => {
    for (const shape of ["current", "legacy"] as const) {
      const customerId = await seedCustomer();
      const artworkId = await seedArtwork(shape);
      await seedOrder({ customerId, artworkId, status: "paid" });

      const [creature] = await listCreaturesForCustomer(customerId);
      expect(creature.previewUrl, `${shape} artwork has no picture`).toBeTruthy();

      const reorderable = await getReorderableCreature(customerId, artworkId);
      expect(reorderable?.previewUrl, `${shape} reorder has no picture`).toBeTruthy();
    }
  });

  it("counts sent_to_printer, printed and shipped as owned too", async () => {
    for (const status of [
      "sent_to_printer",
      "printed",
      "shipped",
    ] as OrderStatus[]) {
      const customerId = await seedCustomer();
      const artworkId = await seedArtwork();
      await seedOrder({ customerId, artworkId, status });

      const creatures = await listCreaturesForCustomer(customerId);
      expect(creatures.map((c) => c.artworkId)).toContain(artworkId);
    }
  });

  it("never returns an artwork from another customer's order", async () => {
    const mine = await seedCustomer();
    const stranger = await seedCustomer();
    const strangerArtwork = await seedArtwork();
    await seedOrder({
      customerId: stranger,
      artworkId: strangerArtwork,
      status: "paid",
    });

    const creatures = await listCreaturesForCustomer(mine);

    expect(creatures.map((c) => c.artworkId)).not.toContain(strangerArtwork);
    expect(creatures).toHaveLength(0);
  });

  it("does not surface an artwork from an unpaid order", async () => {
    const customerId = await seedCustomer();
    const artworkId = await seedArtwork();
    await seedOrder({ customerId, artworkId, status: "pending" });
    await seedOrder({ customerId, artworkId, status: "flagged" });

    const creatures = await listCreaturesForCustomer(customerId);

    expect(creatures).toHaveLength(0);
  });

  it("collapses an artwork ordered twice into one creature, dated earliest", async () => {
    const customerId = await seedCustomer();
    const artworkId = await seedArtwork();
    await seedOrder({
      customerId,
      artworkId,
      status: "shipped",
      createdAt: new Date("2026-06-01T10:00:00Z"),
    });
    await seedOrder({
      customerId,
      artworkId,
      status: "paid",
      createdAt: new Date("2026-01-01T10:00:00Z"),
    });

    const creatures = await listCreaturesForCustomer(customerId);
    const mine = creatures.filter((c) => c.artworkId === artworkId);

    expect(mine).toHaveLength(1);
    expect(mine[0].firstOrderedAt.toISOString()).toBe(
      new Date("2026-01-01T10:00:00Z").toISOString(),
    );
  });

  it("orders creatures newest first", async () => {
    const customerId = await seedCustomer();
    const older = await seedArtwork();
    const newer = await seedArtwork();
    await seedOrder({
      customerId,
      artworkId: older,
      status: "paid",
      createdAt: new Date("2026-01-01T10:00:00Z"),
    });
    await seedOrder({
      customerId,
      artworkId: newer,
      status: "paid",
      createdAt: new Date("2026-06-01T10:00:00Z"),
    });

    const creatures = await listCreaturesForCustomer(customerId);
    const ids = creatures.map((c) => c.artworkId);

    expect(ids.indexOf(newer)).toBeLessThan(ids.indexOf(older));
  });
});

describe("customerOwnsArtwork", () => {
  it("is true for an artwork from the customer's paid order", async () => {
    const customerId = await seedCustomer();
    const artworkId = await seedArtwork();
    await seedOrder({ customerId, artworkId, status: "paid" });

    expect(await customerOwnsArtwork(customerId, artworkId)).toBe(true);
  });

  it("is false for another customer's artwork", async () => {
    const mine = await seedCustomer();
    const stranger = await seedCustomer();
    const strangerArtwork = await seedArtwork();
    await seedOrder({
      customerId: stranger,
      artworkId: strangerArtwork,
      status: "paid",
    });

    expect(await customerOwnsArtwork(mine, strangerArtwork)).toBe(false);
  });

  it("is false for an artwork whose only order is unpaid", async () => {
    const customerId = await seedCustomer();
    const artworkId = await seedArtwork();
    await seedOrder({ customerId, artworkId, status: "pending" });

    expect(await customerOwnsArtwork(customerId, artworkId)).toBe(false);
  });

  it("is false, not a throw, for a malformed artwork id", async () => {
    const customerId = await seedCustomer();
    await expect(
      customerOwnsArtwork(customerId, "not-a-uuid"),
    ).resolves.toBe(false);
  });
});

describe("getReorderableCreature", () => {
  it("returns the creature for an artwork from the customer's paid order", async () => {
    const customerId = await seedCustomer();
    const artworkId = await seedArtwork();
    await seedOrder({ customerId, artworkId, status: "paid" });

    const creature = await getReorderableCreature(customerId, artworkId);

    expect(creature).not.toBeNull();
    expect(creature!.artworkId).toBe(artworkId);
    expect(creature!.style).toBe("watercolor");
    expect(creature!.styleLabel).toBe("Watercolor");
    expect(creature!.previewUrl).toBeTruthy();
  });

  it("counts sent_to_printer, printed and shipped as reorderable too", async () => {
    for (const status of [
      "sent_to_printer",
      "printed",
      "shipped",
    ] as OrderStatus[]) {
      const customerId = await seedCustomer();
      const artworkId = await seedArtwork();
      await seedOrder({ customerId, artworkId, status });

      const creature = await getReorderableCreature(customerId, artworkId);
      expect(creature?.artworkId).toBe(artworkId);
    }
  });

  it("refuses another customer's artwork", async () => {
    const mine = await seedCustomer();
    const stranger = await seedCustomer();
    const strangerArtwork = await seedArtwork();
    await seedOrder({
      customerId: stranger,
      artworkId: strangerArtwork,
      status: "paid",
    });

    await expect(
      getReorderableCreature(mine, strangerArtwork),
    ).resolves.toBeNull();
  });

  it("refuses an artwork whose only order is unpaid", async () => {
    const customerId = await seedCustomer();
    const artworkId = await seedArtwork();
    await seedOrder({ customerId, artworkId, status: "pending" });
    await seedOrder({ customerId, artworkId, status: "flagged" });

    await expect(
      getReorderableCreature(customerId, artworkId),
    ).resolves.toBeNull();
  });

  it("refuses an unknown artwork id", async () => {
    const customerId = await seedCustomer();
    await expect(
      getReorderableCreature(customerId, randomUUID()),
    ).resolves.toBeNull();
  });

  it("refuses, not throws, on a malformed artwork id", async () => {
    const customerId = await seedCustomer();
    await expect(
      getReorderableCreature(customerId, "not-a-uuid"),
    ).resolves.toBeNull();
  });
});

describe("listOrdersForCustomer", () => {
  it("returns only this customer's orders, newest first", async () => {
    const customerId = await seedCustomer();
    const artworkId = await seedArtwork();
    const older = await seedOrder({
      customerId,
      artworkId,
      status: "paid",
      createdAt: new Date("2026-01-01T10:00:00Z"),
    });
    const newer = await seedOrder({
      customerId,
      artworkId,
      status: "shipped",
      createdAt: new Date("2026-06-01T10:00:00Z"),
    });

    const rows = await listOrdersForCustomer(customerId);
    const ids = rows.map((r) => r.id);

    expect(ids).toEqual([newer, older]);
  });

  it("never includes another customer's order", async () => {
    const mine = await seedCustomer();
    const stranger = await seedCustomer();
    const strangerArtwork = await seedArtwork();
    const strangerOrder = await seedOrder({
      customerId: stranger,
      artworkId: strangerArtwork,
      status: "paid",
    });

    const rows = await listOrdersForCustomer(mine);

    expect(rows.map((r) => r.id)).not.toContain(strangerOrder);
  });

  it("carries a short ref, a customer-facing status label and a qty count", async () => {
    const customerId = await seedCustomer();
    const artworkId = await seedArtwork();
    const orderId = await seedOrder({
      customerId,
      artworkId,
      status: "shipped",
      qty: 3,
      totalZar: 1497,
    });

    const [row] = await listOrdersForCustomer(customerId);

    expect(row.id).toBe(orderId);
    expect(row.ref).toBe(orderId.slice(0, 8).toUpperCase());
    expect(row.statusLabel).toBe("On its way to you");
    expect(row.itemCount).toBe(3);
    expect(row.totalZar).toBe(1497);
  });

  it("returns an empty list for a customer with no orders", async () => {
    const customerId = await seedCustomer();
    await expect(listOrdersForCustomer(customerId)).resolves.toEqual([]);
  });
});
