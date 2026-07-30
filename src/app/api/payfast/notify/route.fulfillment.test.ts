// @vitest-environment node
import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { POST as notify } from "./route";
import { getDb } from "@/lib/db/client";
import { artworks, orderItems, orders } from "@/lib/db/schema";
import { buildSignature } from "@/lib/payfast";
import { resetEmailTransport } from "@/lib/email";
import { getStorage } from "@/lib/storage";
import { getImageProvider } from "@/lib/images";
import { derivePrintBytes } from "@/lib/images/derive";
import { approveArtworkById } from "@/lib/artwork-approval";
import { releaseApprovedOrder } from "@/lib/fulfillment";

/**
 * The seam between S5 and S7: a verified ITN arrives, the order is paid, and the
 * print files follow it without PayFast ever waiting for them.
 *
 * Everything here runs on the real mock provider, the real local storage adapter
 * and the real mock email transport, with zero credentials. The only thing
 * stubbed is next/server's after(), because a direct call to POST has no request
 * scope for a real after() to be after; the queue below stands in for the
 * response having been flushed.
 */

const { afterTasks } = vi.hoisted(() => ({
  afterTasks: [] as (() => unknown)[],
}));

vi.mock("next/server", () => ({
  after: (task: () => unknown) => {
    afterTasks.push(task);
  },
}));

/** Runs whatever the response scheduled, the way a live server would. */
async function flushAfter(): Promise<void> {
  const tasks = [...afterTasks];
  afterTasks.length = 0;
  for (const task of tasks) await task();
}

const MERCHANT_ID = "10000100";
const PASSPHRASE = "jt7NOE43FZPn";

let logged: string[] = [];

beforeEach(() => {
  afterTasks.length = 0;
  logged = [];
  vi.stubEnv("MOCK_SERVICES", "true");
  vi.stubEnv("PAYFAST_MERCHANT_ID", MERCHANT_ID);
  vi.stubEnv("PAYFAST_MERCHANT_KEY", "46f0cd694581a");
  vi.stubEnv("PAYFAST_PASSPHRASE", PASSPHRASE);
  vi.stubEnv("PAYFAST_SANDBOX", "true");
  vi.stubEnv("PRINT_SHOP_EMAIL", "press@example.co.za");
  resetEmailTransport();
  // The mock transport prints the whole plain-text body, which is the job sheet
  // a developer with no credentials is meant to read. Capture it and assert on
  // it rather than trusting that "an email went".
  vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    logged.push(args.map(String).join(" "));
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  resetEmailTransport();
});

/** An order sitting at pending with one hoodie on it, as checkout leaves it. */
async function pendingOrderWithLine(): Promise<{
  orderId: string;
  artworkId: string;
  canonicalKey: string;
}> {
  const db = await getDb();
  const orderId = randomUUID();
  const artworkId = randomUUID();

  // The approved portrait, really drawn by the offline provider and really
  // stored, because fulfilment now RESIZES these bytes rather than asking for a
  // fresh picture. An artwork without them is an order that cannot be printed.
  const { portraitBytes, promptVersion } = await (
    await getImageProvider()
  ).generatePortrait({
    uploadKey: `uploads/${artworkId}.jpg`,
    style: "classic-portrait",
  });
  const canonicalKey = `portraits/${artworkId}/1.png`;
  await getStorage().put(canonicalKey, portraitBytes, "image/png");

  await db.insert(artworks).values({
    id: artworkId,
    uploadKey: `uploads/${artworkId}.jpg`,
    style: "classic-portrait",
    canonicalKey,
    promptVersion,
    previewKey: `previews/${artworkId}/1.png`,
    status: "ready",
    productSlug: "hoodie",
  });

  await db.insert(orders).values({
    id: orderId,
    status: "pending",
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
    qty: 1,
    unitPriceZar: 899,
    artworkId,
  });

  return { orderId, artworkId, canonicalKey };
}

let nextPaymentId = 5000000;

function itn(orderId: string): Record<string, string> {
  const fields: Record<string, string> = {
    m_payment_id: orderId,
    pf_payment_id: String((nextPaymentId += 1)),
    payment_status: "COMPLETE",
    item_name: "Kindred Creatures order",
    amount_gross: "998.00",
    amount_fee: "-22.94",
    amount_net: "975.06",
    name_first: "Thandi",
    name_last: "Mokoena",
    email_address: "thandi@example.co.za",
    merchant_id: MERCHANT_ID,
  };
  return { ...fields, signature: buildSignature(fields, PASSPHRASE) };
}

function post(fields: Record<string, string>): Request {
  return new Request("http://localhost/api/payfast/notify", {
    method: "POST",
    body: new URLSearchParams(fields).toString(),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
}

async function readOrder(id: string) {
  const db = await getDb();
  const [row] = await db.select().from(orders).where(eq(orders.id, id));
  return row;
}

describe("a verified ITN, end to end", () => {
  it("pays the order, draws it, and prints only once it is approved", async () => {
    const { orderId, artworkId } = await pendingOrderWithLine();

    const response = await notify(post(itn(orderId)));
    expect(response.status).toBe(200);

    // The 200 goes out on the payment, not on the drawing: at this instant the
    // order is paid and nothing has been drawn yet. This is the property that
    // keeps a slow provider from becoming a PayFast retry storm.
    expect((await readOrder(orderId)).status).toBe("paid");

    await flushAfter();

    // Drawn, and STILL PAID. "paid with unapproved artwork" is the
    // awaiting-approval state: no print file, and above all no job sheet.
    expect((await readOrder(orderId)).status).toBe("paid");
    const [itemBefore] = await (await getDb())
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));
    expect(itemBefore.printKey).toBeNull();
    expect(
      logged.filter((line) => line.includes("press@example.co.za")),
    ).toHaveLength(0);

    // The plates exist and the customer has been asked to look at them.
    const [drawn] = await (await getDb())
      .select()
      .from(artworks)
      .where(eq(artworks.id, artworkId));
    expect(drawn.frontKey).toBeTruthy();
    expect(drawn.backKey).toBeTruthy();
    expect(
      logged.some((line) => line.includes("thandi@example.co.za")),
    ).toBeTruthy();

    // Now they say yes. This is the only path to a job sheet.
    await approveArtworkById(artworkId);
    const released = await releaseApprovedOrder(orderId);
    expect(released.status).toBe("sent_to_printer");
    expect((await readOrder(orderId)).status).toBe("sent_to_printer");

    const [item] = await (await getDb())
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));
    expect(item.printKey).toMatch(new RegExp(`^prints/${item.id}/\\d+\\.`));
    // The legacy artwork.printKey is left untouched; it is no longer the source
    // of truth for a printed file.
    expect(drawn.printKey).toBeNull();

    // The file is really there, not just a key on a row.
    const bytes = await getStorage().getBytes(item.printKey!);
    expect(bytes?.length).toBeGreaterThan(0);

    // THE APPROVAL PROMISE, end to end and in bytes. The file the print shop is
    // linked to is the APPROVED artwork's stored bytes at the hoodie's print
    // area and nothing else. This path used to ask the model for a fresh
    // picture here, and image models are not deterministic, so what arrived was
    // a different animal on a non-returnable garment.
    const approvedBytes = await getStorage().getBytes(drawn.canonicalKey!);
    const expected = await derivePrintBytes(approvedBytes!, 3307, 4134);
    expect(Buffer.from(bytes!).equals(Buffer.from(expected))).toBe(true);

    const jobSheet = logged.find((line) => line.includes("press@example.co.za"));
    expect(jobSheet).toBeTruthy();
    // A signed, time-limited link to the file we just made. A job sheet without
    // one is a print shop with nothing to print.
    expect(jobSheet).toContain(`/api/asset/${item.printKey}`);
    expect(jobSheet).toMatch(/sig=[0-9a-f]{64}/);
    // And the size they cut against: the hoodie print area at 300 DPI.
    expect(jobSheet).toContain("3307");
  });

  it("does not draw twice when PayFast delivers the same ITN again", async () => {
    const { orderId } = await pendingOrderWithLine();
    const fields = itn(orderId);

    await notify(post(fields));
    await flushAfter();

    // The retry. Stopped by the unique key on pf_payment_id long before it can
    // schedule a second drawing, which would be a second API call and a
    // portrait the customer may already have approved.
    expect((await notify(post(fields))).status).toBe(200);
    expect(afterTasks).toHaveLength(0);

    expect((await readOrder(orderId)).status).toBe("paid");
    // ONE approval link in the customer's inbox, not two. Matched on the
    // subject rather than the address, because phase A also sends the receipt
    // and both go to the same person.
    expect(
      logged.filter((line) => /ready to see/i.test(line)),
    ).toHaveLength(1);
    expect(
      logged.filter((line) => line.includes("press@example.co.za")),
    ).toHaveLength(0);
  });

  it("survives a fulfilment that runs late against an already-moved order", async () => {
    const { orderId } = await pendingOrderWithLine();
    await notify(post(itn(orderId)));

    // The shop has already picked it up by hand before the callback ran. The
    // late fulfilment must not drag it backwards or re-mail anybody.
    await (await getDb())
      .update(orders)
      .set({ status: "printed" })
      .where(eq(orders.id, orderId));

    await flushAfter();

    expect((await readOrder(orderId)).status).toBe("printed");
    expect(logged.filter((line) => line.includes("press@example.co.za"))).toHaveLength(
      0,
    );
    // And nothing was drawn for it either: an order already at the press is
    // past the point where drawing means anything.
    expect(
      logged.filter((line) => line.includes("thandi@example.co.za")),
    ).toHaveLength(0);
  });
});
