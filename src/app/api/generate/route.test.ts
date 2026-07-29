// @vitest-environment node
import { randomUUID } from "node:crypto";
import { describe, it, expect, vi } from "vitest";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { POST as generate } from "./route";
import { POST as upload } from "../upload/route";
import { getDb } from "@/lib/db/client";
import { artworks, orderItems, orders } from "@/lib/db/schema";
import { generatePrintFilesForOrder } from "@/lib/fulfillment";
import { getImageProvider } from "@/lib/images";
import { MockImageProvider } from "@/lib/images/mock";
import { derivePrintBytes } from "@/lib/images/derive";
import { getProduct, printPixels } from "@/lib/products";
import { getStorage } from "@/lib/storage";

// No provider mock here: the real offline mock provider runs end to end against
// an in-memory test database.

async function createArtwork(): Promise<string> {
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const form = new FormData();
  form.set("file", new File([bytes], "pet.png", { type: "image/png" }));
  form.set("productSlug", "tee");
  const res = await upload(
    new Request("http://localhost/api/upload", { method: "POST", body: form }),
  );
  expect(res.status).toBe(201);
  const { artworkId } = await res.json();
  return artworkId;
}

function generateRequest(artworkId: string, style: string): Request {
  return new Request("http://localhost/api/generate", {
    method: "POST",
    body: JSON.stringify({ artworkId, style }),
    headers: { "Content-Type": "application/json" },
  });
}

/** A transparent PNG standing in for what a model would hand back. */
async function pngFixture(width = 180, height = 270): Promise<Uint8Array> {
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <circle cx="${width / 2}" cy="${height / 2}" r="${width / 3}" fill="#a97f4d"/>
    </svg>`,
  );
  return new Uint8Array(await sharp(svg).png().toBuffer());
}

async function readArtwork(id: string) {
  const db = await getDb();
  const [row] = await db.select().from(artworks).where(eq(artworks.id, id));
  return row;
}

async function readItem(id: string) {
  const db = await getDb();
  const [row] = await db.select().from(orderItems).where(eq(orderItems.id, id));
  return row;
}

/**
 * A paid order with one line pointing at this artwork, the way the ITN webhook
 * leaves one. Returns the order_item id, which is where the print file lands.
 */
async function paidOrderFor(
  artworkId: string,
  productSlug: string,
): Promise<string> {
  const db = await getDb();
  const orderId = randomUUID();
  const orderItemId = randomUUID();

  await db.insert(orders).values({
    id: orderId,
    status: "paid",
    payfastPaymentId: "9000001",
    email: "thandi@example.co.za",
    firstName: "Thandi",
    lastName: "Mokoena",
    phone: "082 123 4567",
    addressLine1: "14 Loop Street",
    suburb: "Gardens",
    city: "Cape Town",
    province: "Western Cape",
    postalCode: "8001",
    subtotalZar: 649,
    shippingZar: 99,
    totalZar: 748,
  });

  await db.insert(orderItems).values({
    id: orderItemId,
    orderId,
    productSlug,
    color: "Stone",
    size: "M",
    qty: 1,
    unitPriceZar: 649,
    artworkId,
  });

  return orderItemId;
}

describe("POST /api/generate", () => {
  it("produces a preview and counts down remaining tries", async () => {
    const artworkId = await createArtwork();
    const res = await generate(generateRequest(artworkId, "classic-portrait"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.previewUrl).toContain("/api/asset/");
    expect(json.regenCount).toBe(1);
    expect(json.remaining).toBe(2);
  });

  it("caps at three generations and refuses the fourth with 429", async () => {
    const artworkId = await createArtwork();

    for (let i = 1; i <= 3; i++) {
      const res = await generate(generateRequest(artworkId, "watercolor"));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.regenCount).toBe(i);
      expect(json.remaining).toBe(3 - i);
    }

    const fourth = await generate(generateRequest(artworkId, "watercolor"));
    expect(fourth.status).toBe(429);
    const json = await fourth.json();
    expect(json.error).toMatch(/tries/i);
  });

  it("rejects an unknown style with 400", async () => {
    const artworkId = await createArtwork();
    const res = await generate(generateRequest(artworkId, "oil-pastel"));
    expect(res.status).toBe(400);
  });

  it("rejects an unknown artwork with 404", async () => {
    const res = await generate(
      generateRequest("00000000-0000-0000-0000-000000000000", "watercolor"),
    );
    expect(res.status).toBe(404);
  });

  it("stores the canonical portrait and derives the preview from it", async () => {
    const artworkId = await createArtwork();
    await generate(generateRequest(artworkId, "line-sketch"));

    const artwork = await readArtwork(artworkId);
    expect(artwork.canonicalKey).toMatch(
      new RegExp(`^portraits/${artworkId}/\\d+\\.png$`),
    );
    expect(artwork.previewKey).toMatch(
      new RegExp(`^previews/${artworkId}/\\d+\\.png$`),
    );

    const canonical = await getStorage().getBytes(artwork.canonicalKey!);
    const preview = await getStorage().getBytes(artwork.previewKey!);
    expect(canonical!.length).toBeGreaterThan(0);

    // The preview is a smaller copy of the canonical bytes, not its own picture.
    const canonicalMeta = await sharp(Buffer.from(canonical!)).metadata();
    const previewMeta = await sharp(Buffer.from(preview!)).metadata();
    expect(canonicalMeta.width).toBeGreaterThan(previewMeta.width!);
    // And transparency survives the trip: this is what prints onto the garment.
    expect(previewMeta.hasAlpha).toBe(true);
  });

  it("records which prompt drew every portrait", async () => {
    const artworkId = await createArtwork();
    await generate(generateRequest(artworkId, "watercolor"));
    expect((await readArtwork(artworkId)).promptVersion).toBeTruthy();

    // Every generation, not just the first: a "try another" that leaves the old
    // version on the row would attribute the new portrait to the wrong words.
    const spy = vi
      .spyOn(MockImageProvider.prototype, "generatePortrait")
      .mockResolvedValue({
        portraitBytes: await pngFixture(),
        promptVersion: "2099-01-01.7",
      });
    await generate(generateRequest(artworkId, "watercolor"));
    expect((await readArtwork(artworkId)).promptVersion).toBe("2099-01-01.7");
    spy.mockRestore();
  });

  it("try another replaces the canonical portrait: the last one is the one that ships", async () => {
    const artworkId = await createArtwork();
    await generate(generateRequest(artworkId, "classic-portrait"));
    const first = await readArtwork(artworkId);

    // A visibly different second portrait, the way a real model would answer.
    const secondBytes = await pngFixture(220, 330);
    const spy = vi
      .spyOn(MockImageProvider.prototype, "generatePortrait")
      .mockResolvedValue({ portraitBytes: secondBytes, promptVersion: "mock" });

    await generate(generateRequest(artworkId, "classic-portrait"));
    const second = await readArtwork(artworkId);
    spy.mockRestore();

    expect(second.canonicalKey).not.toBe(first.canonicalKey);
    const stored = await getStorage().getBytes(second.canonicalKey!);
    expect(Buffer.from(stored!).equals(Buffer.from(secondBytes))).toBe(true);
  });
});

describe("the approval promise: one portrait, one model call", () => {
  it("prints the exact bytes that were approved, and never draws twice", async () => {
    /**
     * The automated stand-in for the manual check in
     * docs/spec-portrait-prompting.md section 1: approve a preview, run
     * fulfilment, and confirm the print file is the same picture apart from
     * scale and watermark.
     *
     * This is the most expensive defect this codebase has had. generatePreview
     * drew at 1024 and generatePrintFile drew again at print size, and image
     * models are not deterministic, so the customer approved one animal and a
     * different one was printed onto a garment that cannot be returned.
     */
    const drawn = vi.spyOn(MockImageProvider.prototype, "generatePortrait");
    // The provider is cached across the module; make sure it is the mock class
    // the spy is attached to.
    expect((await getImageProvider()).constructor.name).toBe("MockImageProvider");

    const artworkId = await createArtwork();
    const res = await generate(generateRequest(artworkId, "watercolor"));
    expect(res.status).toBe(200);

    // ONE call to the model for this portrait. That is the whole fix.
    expect(drawn).toHaveBeenCalledTimes(1);

    const artwork = await readArtwork(artworkId);
    const orderItemId = await paidOrderFor(artworkId, "tee");

    const result = await generatePrintFilesForOrder(
      (await readItem(orderItemId)).orderId,
    );
    expect(result.ok).toBe(true);

    // STILL one call. Fulfilment did not go near the model.
    expect(drawn).toHaveBeenCalledTimes(1);
    drawn.mockRestore();

    // And the file the print shop gets is the approved bytes, resized. Compared
    // byte for byte against the canonical image at the tee's print area.
    const printKey = (await readItem(orderItemId)).printKey!;
    const printed = await getStorage().getBytes(printKey);
    const canonical = await getStorage().getBytes(artwork.canonicalKey!);
    const { widthPx, heightPx } = printPixels(getProduct("tee")!);
    const expected = await derivePrintBytes(canonical!, widthPx, heightPx);

    expect(Buffer.from(printed!).equals(Buffer.from(expected))).toBe(true);

    // Same picture, print size, and still transparent where it must be.
    const meta = await sharp(Buffer.from(printed!)).metadata();
    expect({ width: meta.width, height: meta.height }).toEqual({
      width: widthPx,
      height: heightPx,
    });
    expect(meta.hasAlpha).toBe(true);
  });
});
