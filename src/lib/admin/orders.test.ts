// @vitest-environment node
import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  concernFor,
  getAdminOrder,
  listAdminOrders,
  needsAttention,
  parseFilter,
  shortRef,
} from "./orders";
import { getDb } from "@/lib/db/client";
import { artworks, orderItems, orders, type OrderStatus } from "@/lib/db/schema";

/**
 * The reading half of the dashboard, and mostly one question: does this screen
 * ever let an order that was never paid look like an order whose print failed?
 * Both are "flagged" in the database. Only one of them is owed a garment.
 */

beforeEach(() => {
  vi.stubEnv("MOCK_SERVICES", "true");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

async function seedOrder(options: {
  status: OrderStatus;
  payfastPaymentId?: string | null;
  trackingNumber?: string | null;
  createdAt?: Date;
  withPrintFile?: boolean;
  qty?: number;
}): Promise<string> {
  const db = await getDb();
  const orderId = randomUUID();
  const artworkId = randomUUID();

  await db.insert(artworks).values({
    id: artworkId,
    uploadKey: `uploads/${artworkId}.jpg`,
    style: "watercolor",
    previewKey: `previews/${artworkId}/1.svg`,
    status: "ready",
    productSlug: "hoodie",
  });

  await db.insert(orders).values({
    id: orderId,
    status: options.status,
    payfastPaymentId:
      options.payfastPaymentId === undefined ? "1000001" : options.payfastPaymentId,
    trackingNumber: options.trackingNumber ?? null,
    ...(options.createdAt ? { createdAt: options.createdAt } : {}),
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

  await db.insert(orderItems).values({
    orderId,
    productSlug: "hoodie",
    color: "Stone",
    size: "M",
    qty: options.qty ?? 1,
    unitPriceZar: 899,
    artworkId,
    // The print file is per garment now (B3): its key lives on the order_item.
    printKey: options.withPrintFile ? `prints/${artworkId}.png` : null,
  });

  return orderId;
}

describe("concernFor: telling the two flags apart", () => {
  it("calls a flagged order WITH a payment id a print failure", () => {
    // Money arrived, the print file did not. We owe them a garment.
    expect(concernFor({ status: "flagged", payfastPaymentId: "1000001" })).toBe(
      "print-failed",
    );
  });

  it("calls a flagged order WITHOUT a payment id never-paid", () => {
    // Only the verified ITN writes payfastPaymentId, and only on the transition
    // that actually pays. No id on a flagged order means nobody ever paid.
    expect(concernFor({ status: "flagged", payfastPaymentId: null })).toBe(
      "never-paid",
    );
  });

  it("never returns the same concern for the two kinds of flag", () => {
    expect(concernFor({ status: "flagged", payfastPaymentId: "1000001" })).not.toBe(
      concernFor({ status: "flagged", payfastPaymentId: null }),
    );
  });

  it("treats paid as waiting on a print file", () => {
    expect(concernFor({ status: "paid", payfastPaymentId: "1000001" })).toBe(
      "awaiting-print",
    );
  });

  it.each<OrderStatus>(["pending", "sent_to_printer", "printed", "shipped"])(
    "leaves %s alone: nobody needs to do anything",
    (status) => {
      expect(concernFor({ status, payfastPaymentId: "1000001" })).toBeNull();
    },
  );
});

describe("needsAttention", () => {
  it("catches both kinds of flag and the unfulfilled paid order", () => {
    expect(
      needsAttention({ status: "flagged", payfastPaymentId: null, emailBouncedAt: null }),
    ).toBe(true);
    expect(
      needsAttention({ status: "flagged", payfastPaymentId: "1", emailBouncedAt: null }),
    ).toBe(true);
    expect(
      needsAttention({ status: "paid", payfastPaymentId: "1", emailBouncedAt: null }),
    ).toBe(true);
  });

  it("catches a bounced order email on any status: the fix is a phone call", () => {
    expect(
      needsAttention({
        status: "shipped",
        payfastPaymentId: "1",
        emailBouncedAt: new Date(),
      }),
    ).toBe(true);
    expect(
      needsAttention({
        status: "sent_to_printer",
        payfastPaymentId: "1",
        emailBouncedAt: new Date(),
      }),
    ).toBe(true);
  });

  it("a bounce is not a Concern: the lifecycle story stays untouched", () => {
    // The bounce must never dress up as a money/print problem: concernFor
    // keeps narrating the order exactly as before.
    expect(
      concernFor({ status: "sent_to_printer", payfastPaymentId: "1" }),
    ).toBeNull();
  });

  it("ignores the orders that are simply in flight", () => {
    expect(
      needsAttention({ status: "shipped", payfastPaymentId: "1", emailBouncedAt: null }),
    ).toBe(false);
    expect(
      needsAttention({ status: "pending", payfastPaymentId: null, emailBouncedAt: null }),
    ).toBe(false);
  });
});

describe("parseFilter", () => {
  it("defaults to needs-attention: the list is a work queue", () => {
    expect(parseFilter(undefined)).toBe("attention");
    expect(parseFilter("nonsense")).toBe("attention");
    expect(parseFilter(["all"])).toBe("attention");
  });

  it("honours all", () => {
    expect(parseFilter("all")).toBe("all");
  });
});

describe("shortRef", () => {
  it("matches the reference the print shop quotes", () => {
    expect(shortRef("abcdef12-3456-7890-abcd-ef1234567890")).toBe("ABCDEF12");
  });
});

describe("listAdminOrders", () => {
  it("returns newest first", async () => {
    const older = await seedOrder({
      status: "flagged",
      createdAt: new Date("2026-01-01T10:00:00Z"),
    });
    const newer = await seedOrder({
      status: "flagged",
      createdAt: new Date("2026-06-01T10:00:00Z"),
    });

    const rows = await listAdminOrders("all");
    const positions = rows.map((row) => row.id);
    expect(positions.indexOf(newer)).toBeLessThan(positions.indexOf(older));
  });

  it("carries the concern onto every row, so no component has to work it out", async () => {
    const neverPaid = await seedOrder({ status: "flagged", payfastPaymentId: null });
    const printFailed = await seedOrder({ status: "flagged" });

    const rows = await listAdminOrders("all");

    expect(rows.find((row) => row.id === neverPaid)?.concern).toBe("never-paid");
    expect(rows.find((row) => row.id === printFailed)?.concern).toBe("print-failed");
  });

  it("shows only the orders needing a human under the attention filter", async () => {
    const flagged = await seedOrder({ status: "flagged" });
    const shipped = await seedOrder({ status: "shipped", trackingNumber: "TCG1" });

    const rows = await listAdminOrders("attention");
    const ids = rows.map((row) => row.id);

    expect(ids).toContain(flagged);
    expect(ids).not.toContain(shipped);
  });

  it("shows everything under the all filter", async () => {
    const shipped = await seedOrder({ status: "shipped", trackingNumber: "TCG1" });

    const rows = await listAdminOrders("all");

    expect(rows.map((row) => row.id)).toContain(shipped);
  });

  it("counts items by quantity, not by line", async () => {
    const id = await seedOrder({ status: "flagged", qty: 3 });

    const rows = await listAdminOrders("all");

    expect(rows.find((row) => row.id === id)?.itemCount).toBe(3);
  });

  it("reports the total in whole rands, untouched", async () => {
    const id = await seedOrder({ status: "flagged" });

    const rows = await listAdminOrders("all");

    // Whole rands. If this ever reads 99800 someone has introduced cents.
    expect(rows.find((row) => row.id === id)?.totalZar).toBe(998);
  });

  it("surfaces the tracking number when there is one", async () => {
    const id = await seedOrder({ status: "shipped", trackingNumber: "TCG123" });

    const rows = await listAdminOrders("all");

    expect(rows.find((row) => row.id === id)?.trackingNumber).toBe("TCG123");
  });
});

describe("getAdminOrder", () => {
  it("returns the order, its lines, and the concern", async () => {
    const id = await seedOrder({ status: "flagged", payfastPaymentId: null });

    const detail = await getAdminOrder(id);

    expect(detail).not.toBeNull();
    expect(detail!.order.id).toBe(id);
    expect(detail!.lines).toHaveLength(1);
    expect(detail!.concern).toBe("never-paid");
  });

  it("signs the artwork preview rather than exposing a bare key", async () => {
    const id = await seedOrder({ status: "paid" });

    const detail = await getAdminOrder(id);

    expect(detail!.lines[0].previewUrl).toBeTruthy();
  });

  it("offers no print link before a print file exists", async () => {
    const id = await seedOrder({ status: "paid", withPrintFile: false });

    const detail = await getAdminOrder(id);

    expect(detail!.lines[0].printUrl).toBeNull();
  });

  it("links the print file once there is one", async () => {
    const id = await seedOrder({ status: "sent_to_printer", withPrintFile: true });

    const detail = await getAdminOrder(id);

    expect(detail!.lines[0].printUrl).toBeTruthy();
  });

  it("returns null for an unknown order", async () => {
    await expect(getAdminOrder(randomUUID())).resolves.toBeNull();
  });

  it("returns null for a malformed id rather than throwing", async () => {
    await expect(getAdminOrder("not-a-uuid")).resolves.toBeNull();
  });
});
