// @vitest-environment node
import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
  fulfillPaidOrder,
  generatePrintFilesForOrder,
  retryFulfillment,
} from "./fulfillment";
import { getDb } from "@/lib/db/client";
import {
  artworks,
  fulfillmentEvents,
  orderItems,
  orders,
  type OrderStatus,
} from "@/lib/db/schema";
import { getProduct, printPixels } from "@/lib/products";

/**
 * The other half of the money path. The webhook decides an order was paid; this
 * decides what that costs us. Every test here is a way to spend money twice or
 * lose an order we have already been paid for.
 *
 * Nothing here touches the network: the image provider and the email helpers are
 * both stubbed, and the assertions are mostly about how many times the expensive
 * one was called.
 */

const { generatePrintFileMock, sendJobSheetMock, sendOrderConfirmationMock } =
  vi.hoisted(() => ({
    generatePrintFileMock: vi.fn(),
    sendJobSheetMock: vi.fn(),
    sendOrderConfirmationMock: vi.fn(),
  }));

vi.mock("@/lib/images", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/images")>()),
  getImageProvider: async () => ({
    moderate: async () => ({ ok: true }),
    generatePreview: async () => ({ previewBytes: new Uint8Array() }),
    generatePrintFile: generatePrintFileMock,
  }),
}));

vi.mock("@/lib/email", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email")>()),
  sendJobSheet: sendJobSheetMock,
  sendOrderConfirmation: sendOrderConfirmationMock,
}));

/** A believable print file. PNG magic, so the key gets a .png on it. */
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

beforeEach(() => {
  vi.stubEnv("MOCK_SERVICES", "true");
  generatePrintFileMock.mockResolvedValue({ printBytes: PNG_BYTES });
  sendJobSheetMock.mockResolvedValue({ ok: true, id: "job-sheet-1" });
  sendOrderConfirmationMock.mockResolvedValue({ ok: true, id: "confirmation-1" });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  generatePrintFileMock.mockReset();
  sendJobSheetMock.mockReset();
  sendOrderConfirmationMock.mockReset();
});

/** An artwork the way the customizer leaves one: uploaded, styled, previewed. */
async function readyArtwork(productSlug = "hoodie"): Promise<string> {
  const db = await getDb();
  const id = randomUUID();
  await db.insert(artworks).values({
    id,
    uploadKey: `uploads/${id}.jpg`,
    style: "watercolor",
    previewKey: `previews/${id}/1.svg`,
    status: "ready",
    productSlug,
  });
  return id;
}

/** An order the way the ITN webhook leaves one, with a line per artwork. */
async function orderWith(
  slugs: string[],
  status: OrderStatus = "paid",
  payfastPaymentId: string | null = "1000001",
): Promise<{ orderId: string; artworkIds: string[] }> {
  const db = await getDb();
  const orderId = randomUUID();

  await db.insert(orders).values({
    id: orderId,
    status,
    payfastPaymentId,
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

  const artworkIds: string[] = [];
  for (const slug of slugs) {
    const artworkId = await readyArtwork(slug);
    artworkIds.push(artworkId);
    await db.insert(orderItems).values({
      orderId,
      productSlug: slug,
      color: "Stone",
      size: "M",
      qty: 1,
      unitPriceZar: 899,
      artworkId,
    });
  }

  return { orderId, artworkIds };
}

async function readOrder(id: string) {
  const db = await getDb();
  const [row] = await db.select().from(orders).where(eq(orders.id, id));
  return row;
}

async function readArtwork(id: string) {
  const db = await getDb();
  const [row] = await db.select().from(artworks).where(eq(artworks.id, id));
  return row;
}

async function eventsFor(orderId: string) {
  const db = await getDb();
  return db
    .select()
    .from(fulfillmentEvents)
    .where(eq(fulfillmentEvents.orderId, orderId));
}

describe("fulfillPaidOrder: an order that goes through", () => {
  it("makes a print file per line at 300 DPI and sends it to the printer", async () => {
    const { orderId, artworkIds } = await orderWith(["hoodie", "tote"]);

    const result = await fulfillPaidOrder(orderId);
    expect(result.status).toBe("sent_to_printer");

    // The dimensions are the whole point of the exercise: a print file at the
    // wrong size is a garment printed at the wrong size.
    expect(generatePrintFileMock).toHaveBeenCalledTimes(2);
    for (const slug of ["hoodie", "tote"]) {
      const { widthPx, heightPx } = printPixels(getProduct(slug)!);
      expect(generatePrintFileMock).toHaveBeenCalledWith(
        expect.objectContaining({ widthPx, heightPx, style: "watercolor" }),
      );
    }

    for (const artworkId of artworkIds) {
      const artwork = await readArtwork(artworkId);
      expect(artwork.printKey).toMatch(
        new RegExp(`^prints/${artworkId}/\\d+\\.png$`),
      );
      expect(artwork.status).toBe("ready");
    }

    expect(sendJobSheetMock).toHaveBeenCalledTimes(1);
    expect(sendOrderConfirmationMock).toHaveBeenCalledTimes(1);
    expect((await readOrder(orderId)).status).toBe("sent_to_printer");
  });

  it("hands the job sheet the artworks with their print keys on them", async () => {
    const { orderId } = await orderWith(["hoodie"]);
    await fulfillPaidOrder(orderId);

    // The sheet mints its own links from these rows, so a row without a key is
    // a job sheet with a dead link on it.
    const [, items, sheetArtworks] = sendJobSheetMock.mock.calls[0];
    expect(items).toHaveLength(1);
    expect(sheetArtworks).toHaveLength(1);
    expect(sheetArtworks[0].printKey).toBeTruthy();
  });

  it("hoodie print pixels are the 300 DPI conversion, not a guess", async () => {
    // 280mm / 25.4 * 300 = 3307, 350mm / 25.4 * 300 = 4134. Pinned here because
    // this is the number the print shop cuts against.
    expect(printPixels(getProduct("hoodie")!)).toEqual({
      widthPx: 3307,
      heightPx: 4134,
    });
  });
});

describe("fulfillPaidOrder: not paying twice", () => {
  it("does not regenerate or re-send when it runs again", async () => {
    const { orderId } = await orderWith(["hoodie"]);

    const first = await fulfillPaidOrder(orderId);
    const second = await fulfillPaidOrder(orderId);

    expect(first.status).toBe("sent_to_printer");
    // The order is at the printer, so there is nothing to do and no second job
    // sheet to put in their inbox.
    expect(second.status).toBe("already-fulfilled");

    expect(generatePrintFileMock).toHaveBeenCalledTimes(1);
    expect(sendJobSheetMock).toHaveBeenCalledTimes(1);
    expect(sendOrderConfirmationMock).toHaveBeenCalledTimes(1);
  });

  it("skips an artwork that already has a print file", async () => {
    const { orderId, artworkIds } = await orderWith(["hoodie"]);
    const db = await getDb();
    await db
      .update(artworks)
      .set({ printKey: "prints/already/there.png" })
      .where(eq(artworks.id, artworkIds[0]));

    const result = await generatePrintFilesForOrder(orderId);

    expect(result.ok).toBe(true);
    expect(result.lines[0]).toMatchObject({
      ok: true,
      generated: false,
      printKey: "prints/already/there.png",
    });
    // The expensive call. Never made, because the file already exists.
    expect(generatePrintFileMock).not.toHaveBeenCalled();
  });
});

describe("fulfillPaidOrder: a generation that fails", () => {
  it("flags the order, sends no job sheet, and says why", async () => {
    const { orderId, artworkIds } = await orderWith(["hoodie"]);
    generatePrintFileMock.mockRejectedValue(new Error("provider is on fire"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await fulfillPaidOrder(orderId);

    expect(result.status).toBe("flagged");
    expect((await readOrder(orderId)).status).toBe("flagged");
    // The order is flagged BECAUSE the shop must not be told about a job whose
    // file does not exist.
    expect(sendJobSheetMock).not.toHaveBeenCalled();
    expect((await readArtwork(artworkIds[0])).printKey).toBeNull();

    // The breadcrumb: which artwork, which step, what the error said.
    const events = await eventsFor(orderId);
    const failure = events.find(
      (event) => event.step === "generate-print-file" && event.outcome === "failed",
    );
    expect(failure?.artworkId).toBe(artworkIds[0]);
    expect(failure?.detail).toContain("provider is on fire");
    expect(
      events.some((event) => event.step === "fulfil" && event.outcome === "failed"),
    ).toBe(true);
  });

  it("does not un-pay the order it could not print", async () => {
    const { orderId } = await orderWith(["hoodie"]);
    generatePrintFileMock.mockRejectedValue(new Error("nope"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await fulfillPaidOrder(orderId);

    // Flagged is a queue, not a refund. The money is still ours to answer for.
    expect((await readOrder(orderId)).payfastPaymentId).toBe("1000001");
  });

  it("flags the whole order when only one line of several fails", async () => {
    const { orderId, artworkIds } = await orderWith(["hoodie", "tote"]);
    generatePrintFileMock
      .mockResolvedValueOnce({ printBytes: PNG_BYTES })
      .mockRejectedValueOnce(new Error("second one failed"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await fulfillPaidOrder(orderId);

    expect(result.status).toBe("flagged");
    // A half-printed order is not a shipped order. The good line keeps its file
    // so the retry does not pay for it again.
    expect((await readArtwork(artworkIds[0])).printKey).toBeTruthy();
    expect((await readArtwork(artworkIds[1])).printKey).toBeNull();
    expect(sendJobSheetMock).not.toHaveBeenCalled();
  });
});

describe("fulfillPaidOrder: emails that do not send", () => {
  it("keeps the print file and the order when the job sheet bounces", async () => {
    const { orderId, artworkIds } = await orderWith(["hoodie"]);
    sendJobSheetMock.mockResolvedValue({
      ok: false,
      error: new Error("mailbox is down"),
    });
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await fulfillPaidOrder(orderId);

    // The policy, asserted. A dead mailbox does not lose a print file we have
    // already paid for, and does not drag a paid order backwards.
    expect(result.status).toBe("sent_to_printer");
    expect((await readOrder(orderId)).status).toBe("sent_to_printer");
    expect((await readOrder(orderId)).payfastPaymentId).toBe("1000001");
    expect((await readArtwork(artworkIds[0])).printKey).toBeTruthy();

    // But loud: nobody in Cape Town knows this job exists.
    expect(logged).toHaveBeenCalledWith(
      expect.stringContaining("print shop has NOT been told"),
    );
    const events = await eventsFor(orderId);
    expect(
      events.find((event) => event.step === "job-sheet")?.outcome,
    ).toBe("failed");
  });

  it("treats a bounced customer confirmation as a nuisance, not an incident", async () => {
    const { orderId } = await orderWith(["hoodie"]);
    sendOrderConfirmationMock.mockResolvedValue({
      ok: false,
      error: new Error("their inbox is full"),
    });

    const result = await fulfillPaidOrder(orderId);

    expect(result.status).toBe("sent_to_printer");
    expect((await readOrder(orderId)).status).toBe("sent_to_printer");
    // Recorded so support can re-send it, and nothing more.
    const events = await eventsFor(orderId);
    expect(
      events.find((event) => event.step === "order-confirmation")?.outcome,
    ).toBe("failed");
  });

  it("still tells the customer when the job sheet failed", async () => {
    const { orderId } = await orderWith(["hoodie"]);
    sendJobSheetMock.mockResolvedValue({ ok: false, error: new Error("down") });
    vi.spyOn(console, "error").mockImplementation(() => {});

    await fulfillPaidOrder(orderId);

    // One bad mailbox must not swallow the other mail.
    expect(sendOrderConfirmationMock).toHaveBeenCalledTimes(1);
  });
});

describe("fulfillPaidOrder: orders it will not touch", () => {
  it("refuses a pending order and never calls the provider", async () => {
    const { orderId } = await orderWith(["hoodie"], "pending", null);

    const result = await fulfillPaidOrder(orderId);

    expect(result).toMatchObject({ status: "refused", reason: "not-paid:pending" });
    // The cost principle. An unpaid order must not reach the expensive call.
    expect(generatePrintFileMock).not.toHaveBeenCalled();
    expect(sendJobSheetMock).not.toHaveBeenCalled();
    expect((await readOrder(orderId)).status).toBe("pending");
  });

  it("refuses a flagged order rather than printing it", async () => {
    const { orderId } = await orderWith(["hoodie"], "flagged");
    const result = await fulfillPaidOrder(orderId);

    // Flagged means a human has not looked yet. Retry is the way in, not this.
    expect(result).toMatchObject({ status: "refused", reason: "not-paid:flagged" });
    expect(generatePrintFileMock).not.toHaveBeenCalled();
  });

  it.each<OrderStatus>(["sent_to_printer", "printed", "shipped"])(
    "no-ops on an order already at %s",
    async (status) => {
      const { orderId } = await orderWith(["hoodie"], status);
      const result = await fulfillPaidOrder(orderId);

      expect(result.status).toBe("already-fulfilled");
      expect(sendJobSheetMock).not.toHaveBeenCalled();
      expect((await readOrder(orderId)).status).toBe(status);
    },
  );

  it("refuses an order it has never heard of", async () => {
    const result = await fulfillPaidOrder(
      "00000000-0000-0000-0000-000000000000",
    );
    expect(result).toMatchObject({ status: "refused", reason: "order-not-found" });
  });

  it("flags an order with no lines rather than mailing an empty job sheet", async () => {
    const { orderId } = await orderWith([]);
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await fulfillPaidOrder(orderId);

    expect(result.status).toBe("flagged");
    expect(sendJobSheetMock).not.toHaveBeenCalled();
  });
});

describe("retryFulfillment", () => {
  it("regenerates only the missing artwork and completes", async () => {
    const { orderId, artworkIds } = await orderWith(["hoodie", "tote"]);
    generatePrintFileMock
      .mockResolvedValueOnce({ printBytes: PNG_BYTES })
      .mockRejectedValueOnce(new Error("the second one failed"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect((await fulfillPaidOrder(orderId)).status).toBe("flagged");
    expect(generatePrintFileMock).toHaveBeenCalledTimes(2);

    generatePrintFileMock.mockResolvedValue({ printBytes: PNG_BYTES });
    const retried = await retryFulfillment(orderId);

    expect(retried.status).toBe("sent_to_printer");
    // Three calls, not four: the line that worked the first time is not paid
    // for a second time.
    expect(generatePrintFileMock).toHaveBeenCalledTimes(3);

    for (const artworkId of artworkIds) {
      const artwork = await readArtwork(artworkId);
      expect(artwork.printKey).toBeTruthy();
      expect(artwork.status).toBe("ready");
    }
    expect((await readOrder(orderId)).status).toBe("sent_to_printer");
    expect(sendJobSheetMock).toHaveBeenCalledTimes(1);
  });

  it("picks up a paid order whose fulfilment never fired", async () => {
    const { orderId } = await orderWith(["hoodie"]);
    const result = await retryFulfillment(orderId);

    expect(result.status).toBe("sent_to_printer");
    expect(generatePrintFileMock).toHaveBeenCalledTimes(1);
  });

  it("will not print an order that was flagged without ever being paid", async () => {
    // The one that would cost a garment. The ITN webhook flags an order whose
    // amount did not reconcile, and that order was never paid: it has no
    // payfast_payment_id. Retrying it must not invent one.
    const { orderId } = await orderWith(["hoodie"], "flagged", null);

    const result = await retryFulfillment(orderId);

    expect(result).toMatchObject({
      status: "refused",
      reason: "flagged-without-payment",
    });
    expect(generatePrintFileMock).not.toHaveBeenCalled();
    expect((await readOrder(orderId)).status).toBe("flagged");
  });

  it("no-ops on an order already at the printer", async () => {
    const { orderId } = await orderWith(["hoodie"], "sent_to_printer");
    expect((await retryFulfillment(orderId)).status).toBe("already-fulfilled");
    expect(sendJobSheetMock).not.toHaveBeenCalled();
  });

  it("refuses a pending order", async () => {
    const { orderId } = await orderWith(["hoodie"], "pending", null);
    expect(await retryFulfillment(orderId)).toMatchObject({
      status: "refused",
      reason: "not-retryable:pending",
    });
    expect(generatePrintFileMock).not.toHaveBeenCalled();
  });
});
