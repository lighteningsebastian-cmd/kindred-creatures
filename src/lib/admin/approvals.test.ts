// @vitest-environment node
import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { artworks, breedRequests, orderItems, orders } from "@/lib/db/schema";
import { listAwaitingApproval, listBreedRequests } from "./approvals";
import { approveArtworkById } from "@/lib/artwork-approval";
import { AUTOMATED_ROUNDS } from "@/lib/revision";

let seq = 0;

async function seedOrder(status: "paid" | "pending" = "paid") {
  seq += 1;
  const db = await getDb();
  const [order] = await db
    .insert(orders)
    .values({
      status,
      email: `queue.${seq}.${Date.now()}@example.co.za`,
      firstName: "Thandi",
      lastName: "N",
      phone: "0821234567",
      addressLine1: "1 Road",
      suburb: "S",
      city: "Jeffreys Bay",
      province: "Eastern Cape",
      postalCode: "6330",
      subtotalZar: 899,
      shippingZar: 99,
      totalZar: 998,
    })
    .returning();

  const [artwork] = await db
    .insert(artworks)
    .values({
      uploadKey: `uploads/${seq}.png`,
      productSlug: "hoodie",
      creatureName: "Fenn",
    })
    .returning();

  await db.insert(orderItems).values({
    orderId: order!.id,
    artworkId: artwork!.id,
    productSlug: "hoodie",
    color: "Stone",
    size: "M",
    qty: 1,
    unitPriceZar: 899,
  });

  return { orderId: order!.id, artworkId: artwork!.id };
}

describe("the approval queue", () => {
  it("lists a paid order nobody has approved", async () => {
    const { artworkId } = await seedOrder();
    const rows = await listAwaitingApproval();
    const row = rows.find((r) => r.artworkId === artworkId);

    expect(row).toBeDefined();
    expect(row!.creatureName).toBe("Fenn");
    expect(row!.needsPerson).toBe(false);
  });

  it("drops it once it is approved", async () => {
    const { artworkId } = await seedOrder();
    await approveArtworkById(artworkId);
    const rows = await listAwaitingApproval();
    expect(rows.find((r) => r.artworkId === artworkId)).toBeUndefined();
  });

  it("ignores an order that has not been paid for", async () => {
    // An unpaid order is not waiting on a person, it is waiting on a payment.
    const { artworkId } = await seedOrder("pending");
    const rows = await listAwaitingApproval();
    expect(rows.find((r) => r.artworkId === artworkId)).toBeUndefined();
  });

  it("flags the ones a person has to deal with", async () => {
    const { artworkId } = await seedOrder();
    const db = await getDb();
    await db
      .update(artworks)
      .set({ revisionCount: AUTOMATED_ROUNDS })
      .where(eq(artworks.id, artworkId));

    const rows = await listAwaitingApproval();
    expect(rows.find((r) => r.artworkId === artworkId)!.needsPerson).toBe(true);
  });

  it("approving twice does not move the timestamp", async () => {
    const { artworkId } = await seedOrder();
    const first = await approveArtworkById(artworkId);
    const again = await approveArtworkById(artworkId);
    expect(again!.approvedAt).toEqual(first!.approvedAt);
  });
});

describe("breeds people wanted", () => {
  it("groups by demand, folding case and spacing together", async () => {
    const db = await getDb();
    const query = `shiba inu ${Date.now()}`;
    await db.insert(breedRequests).values([
      { query, species: "dog" },
      { query: `  ${query.toUpperCase()}  `, species: "dog" },
      { query, species: "dog" },
    ]);

    const rows = await listBreedRequests();
    const row = rows.find((r) => r.query === query);
    // Three asks for the same breed, however it was typed.
    expect(row?.count).toBe(3);
  });
});
