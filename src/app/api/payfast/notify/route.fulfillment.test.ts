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
}> {
  const db = await getDb();
  const orderId = randomUUID();
  const artworkId = randomUUID();

  await db.insert(artworks).values({
    id: artworkId,
    uploadKey: `uploads/${artworkId}.jpg`,
    style: "classic-portrait",
    previewKey: `previews/${artworkId}/1.svg`,
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

  return { orderId, artworkId };
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
  it("pays the order, prints it, and mails the shop a working link", async () => {
    const { orderId, artworkId } = await pendingOrderWithLine();

    const response = await notify(post(itn(orderId)));
    expect(response.status).toBe(200);

    // The 200 goes out on the payment, not on the printing: at this instant the
    // order is paid and nothing has been generated yet. This is the property
    // that keeps a slow provider from becoming a PayFast retry storm.
    expect((await readOrder(orderId)).status).toBe("paid");
    const [artworkBefore] = await (await getDb())
      .select()
      .from(artworks)
      .where(eq(artworks.id, artworkId));
    expect(artworkBefore.printKey).toBeNull();

    await flushAfter();

    expect((await readOrder(orderId)).status).toBe("sent_to_printer");

    const [artwork] = await (await getDb())
      .select()
      .from(artworks)
      .where(eq(artworks.id, artworkId));
    expect(artwork.printKey).toMatch(new RegExp(`^prints/${artworkId}/\\d+\\.`));

    // The file is really there, not just a key on a row.
    const bytes = await getStorage().getBytes(artwork.printKey!);
    expect(bytes?.length).toBeGreaterThan(0);

    const jobSheet = logged.find((line) => line.includes("press@example.co.za"));
    expect(jobSheet).toBeTruthy();
    // A signed, time-limited link to the file we just made. A job sheet without
    // one is a print shop with nothing to print.
    expect(jobSheet).toContain(`/api/asset/${artwork.printKey}`);
    expect(jobSheet).toMatch(/sig=[0-9a-f]{64}/);
    // And the size they cut against: the hoodie print area at 300 DPI.
    expect(jobSheet).toContain("3307");

    // The customer hears about it too.
    expect(
      logged.some((line) => line.includes("thandi@example.co.za")),
    ).toBeTruthy();
  });

  it("does not fulfil twice when PayFast delivers the same ITN again", async () => {
    const { orderId } = await pendingOrderWithLine();
    const fields = itn(orderId);

    await notify(post(fields));
    await flushAfter();

    // The retry. Stopped by the unique key on pf_payment_id long before it can
    // schedule a second generation.
    expect((await notify(post(fields))).status).toBe(200);
    expect(afterTasks).toHaveLength(0);

    expect((await readOrder(orderId)).status).toBe("sent_to_printer");
    // One job sheet in the print shop's inbox, not two.
    expect(
      logged.filter((line) => line.includes("press@example.co.za")),
    ).toHaveLength(1);
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
  });
});
