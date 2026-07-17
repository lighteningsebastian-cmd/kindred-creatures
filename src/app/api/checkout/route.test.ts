// @vitest-environment node
import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { POST as checkout } from "./route";
import { POST as generate } from "../generate/route";
import { POST as upload } from "../upload/route";
import { getDb } from "@/lib/db/client";
import { orderItems, orders } from "@/lib/db/schema";
import { orderTotals } from "@/lib/checkout";

// The real offline mock provider and an in-memory database, end to end. No
// network: artworks are made the same way a customer makes them.

async function uploadArtwork(productSlug = "hoodie"): Promise<string> {
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const form = new FormData();
  form.set("file", new File([bytes], "pet.png", { type: "image/png" }));
  form.set("productSlug", productSlug);
  const res = await upload(
    new Request("http://localhost/api/upload", { method: "POST", body: form }),
  );
  expect(res.status).toBe(201);
  const { artworkId } = await res.json();
  return artworkId;
}

/** An artwork that has been through the generator, so it is ready to print. */
async function readyArtwork(productSlug = "hoodie"): Promise<string> {
  const artworkId = await uploadArtwork(productSlug);
  const res = await generate(
    new Request("http://localhost/api/generate", {
      method: "POST",
      body: JSON.stringify({ artworkId, style: "classic-portrait" }),
      headers: { "Content-Type": "application/json" },
    }),
  );
  expect(res.status).toBe(200);
  return artworkId;
}

const SHIPPING = {
  firstName: "Thandi",
  lastName: "Mokoena",
  phone: "082 123 4567",
  addressLine1: "14 Loop Street",
  addressLine2: "",
  suburb: "Gardens",
  city: "Cape Town",
  province: "Western Cape",
  postalCode: "8001",
};

type Line = Record<string, unknown>;

function post(body: unknown): Request {
  return new Request("http://localhost/api/checkout", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function order(items: Line[], overrides: Record<string, unknown> = {}) {
  return post({
    items,
    shipping: SHIPPING,
    email: "thandi@example.co.za",
    ...overrides,
  });
}

function hoodieLine(artworkId: string, overrides: Line = {}): Line {
  return {
    productSlug: "hoodie",
    color: "Stone",
    size: "M",
    qty: 1,
    artworkId,
    ...overrides,
  };
}

describe("POST /api/checkout", () => {
  it("opens a pending order and prices it from the catalogue", async () => {
    const artworkId = await readyArtwork();
    const res = await checkout(order([hoodieLine(artworkId, { qty: 2 })]));

    expect(res.status).toBe(201);
    const { orderId, totalZar } = await res.json();

    // 2 x R 899 + R 99 shipping.
    expect(totalZar).toBe(orderTotals(2 * 899).totalZar);

    const db = await getDb();
    const [row] = await db.select().from(orders).where(eq(orders.id, orderId));
    expect(row.status).toBe("pending");
    expect(row.email).toBe("thandi@example.co.za");
    expect(row.city).toBe("Cape Town");
    expect(row.payfastPaymentId).toBeNull();
    expect(row.subtotalZar).toBe(1798);
    expect(row.shippingZar).toBe(orderTotals(1798).shippingZar);
    // Totals math: subtotal + shipping is the total, on the row itself.
    expect(row.subtotalZar + row.shippingZar).toBe(row.totalZar);

    const lines = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));
    expect(lines).toHaveLength(1);
    expect(lines[0].unitPriceZar).toBe(899);
    expect(lines[0].qty).toBe(2);
    expect(lines[0].artworkId).toBe(artworkId);
  });

  it("ignores a tampered client price and charges the catalogue price", async () => {
    const artworkId = await readyArtwork();
    // A cart lives in the customer's own localStorage: assume it is hostile.
    const res = await checkout(
      order([hoodieLine(artworkId, { unitPriceZar: 1, priceZar: 1, totalZar: 1 })]),
    );

    expect(res.status).toBe(201);
    const { orderId, totalZar } = await res.json();
    expect(totalZar).toBe(orderTotals(899).totalZar);

    const db = await getDb();
    const [row] = await db.select().from(orders).where(eq(orders.id, orderId));
    expect(row.totalZar).toBe(orderTotals(899).totalZar);
    expect(row.subtotalZar).toBe(899);

    const lines = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));
    expect(lines[0].unitPriceZar).toBe(899);
  });

  it("sums a multi-line cart across products", async () => {
    const hoodie = await readyArtwork("hoodie");
    const tote = await readyArtwork("tote");

    const res = await checkout(
      order([
        hoodieLine(hoodie, { qty: 1 }),
        {
          productSlug: "tote",
          color: "Natural",
          size: "One size",
          qty: 3,
          artworkId: tote,
        },
      ]),
    );

    expect(res.status).toBe(201);
    const { totalZar } = await res.json();
    // 899 + (3 x 349) + 99 shipping.
    expect(totalZar).toBe(orderTotals(899 + 1047).totalZar);
  });

  it("rejects an empty cart", async () => {
    const res = await checkout(order([]));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/empty/i);
  });

  it("rejects a colour the product is not made in", async () => {
    const artworkId = await readyArtwork();
    const res = await checkout(
      order([hoodieLine(artworkId, { color: "Fuchsia" })]),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/colour/i);
  });

  it("rejects a size that colour is not offered in", async () => {
    const artworkId = await readyArtwork("tote");
    const res = await checkout(
      order([
        {
          productSlug: "tote",
          color: "Natural",
          size: "XL",
          qty: 1,
          artworkId,
        },
      ]),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/size/i);
  });

  it("rejects an unknown product", async () => {
    const artworkId = await readyArtwork();
    const res = await checkout(
      order([hoodieLine(artworkId, { productSlug: "yacht" })]),
    );
    expect(res.status).toBe(400);
  });

  it.each([0, 11, 1.5, -1, "2", null])(
    "rejects the quantity %p",
    async (qty) => {
      const artworkId = await readyArtwork();
      const res = await checkout(order([hoodieLine(artworkId, { qty })]));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/quantit/i);
    },
  );

  it("accepts the quantity bounds", async () => {
    for (const qty of [1, 10]) {
      const artworkId = await readyArtwork();
      const res = await checkout(order([hoodieLine(artworkId, { qty })]));
      expect(res.status).toBe(201);
    }
  });

  it("refuses an artwork that was never generated with 422", async () => {
    // Uploaded but never sent to the generator: no preview exists to print.
    const artworkId = await uploadArtwork();
    const res = await checkout(order([hoodieLine(artworkId)]));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/not finished/i);
  });

  it("rejects an artwork that does not exist", async () => {
    const res = await checkout(
      order([hoodieLine("00000000-0000-0000-0000-000000000000")]),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/could not find/i);
  });

  it("rejects the same portrait appearing on two lines", async () => {
    const artworkId = await readyArtwork();
    const res = await checkout(
      order([hoodieLine(artworkId), hoodieLine(artworkId, { size: "L" })]),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/twice/i);
  });

  it.each([
    ["postalCode", "80011", /four digits/i],
    ["postalCode", "abcd", /four digits/i],
    ["province", "Atlantis", /provinces/i],
    ["phone", "call me", /phone/i],
    ["firstName", "", /first name/i],
    ["addressLine1", "", /street address/i],
  ])("rejects a bad %s of %p", async (field, value, message) => {
    const artworkId = await readyArtwork();
    const res = await checkout(
      order([hoodieLine(artworkId)], {
        shipping: { ...SHIPPING, [field]: value },
      }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.fields[field]).toMatch(message);
  });

  it("rejects a bad email", async () => {
    const artworkId = await readyArtwork();
    const res = await checkout(
      order([hoodieLine(artworkId)], { email: "thandi@example" }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).fields.email).toMatch(/email/i);
  });

  it("writes no order when validation fails", async () => {
    const db = await getDb();
    const before = await db.select().from(orders);

    await checkout(order([hoodieLine("00000000-0000-0000-0000-000000000000")]));
    await checkout(order([], { email: "nope" }));

    const after = await db.select().from(orders);
    expect(after).toHaveLength(before.length);
  });

  it("rejects a body that is not JSON", async () => {
    const res = await checkout(
      new Request("http://localhost/api/checkout", {
        method: "POST",
        body: "not json",
      }),
    );
    expect(res.status).toBe(400);
  });
});
