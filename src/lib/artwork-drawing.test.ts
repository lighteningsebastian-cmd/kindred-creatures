// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { getDb } from "@/lib/db/client";
import { artworks } from "@/lib/db/schema";
import { getStorage } from "@/lib/storage";
import { DRAW_ATTEMPTS, drawArtworkPlates } from "./artwork-drawing";

beforeEach(() => {
  vi.stubEnv("MOCK_SERVICES", "true");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

let seq = 0;

async function seedArtwork(over: Record<string, unknown> = {}) {
  seq += 1;
  const db = await getDb();
  const uploadKey = `uploads/draw-${seq}-${Date.now()}.png`;
  // A real upload has to exist: the provider reads it.
  const png = await sharp({
    create: {
      width: 64,
      height: 64,
      channels: 4,
      background: { r: 120, g: 90, b: 60, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
  await getStorage().put(uploadKey, new Uint8Array(png), "image/png");

  const [row] = await db
    .insert(artworks)
    .values({
      uploadKey,
      productSlug: "hoodie",
      style: "classic-portrait",
      creatureName: "Fenn",
      species: "dog",
      breedId: "yorkshire-terrier",
      temperament: JSON.stringify(["confident", "affectionate", "spirited"]),
      togetherSince: 2021,
      ...over,
    })
    .returning();
  return row!;
}

describe("drawing both plates", () => {
  it("stores a front, a back and a canonical portrait", async () => {
    const seeded = await seedArtwork();
    const result = await drawArtworkPlates(seeded.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { artwork } = result;
    expect(artwork.frontKey).toBeTruthy();
    expect(artwork.backKey).toBeTruthy();
    expect(artwork.canonicalKey).toBeTruthy();
    expect(artwork.status).toBe("ready");
    // Which words drew it, so a later shift in quality has an answer.
    expect(artwork.promptVersion).toBeTruthy();

    // The plates are real transparent images at the garment's print size.
    const back = await getStorage().getBytes(artwork.backKey!);
    const meta = await sharp(Buffer.from(back!)).metadata();
    expect(meta.hasAlpha).toBe(true);
    expect(meta.width).toBe(3307);
  });

  it("draws the chest plate smaller than the back", async () => {
    const seeded = await seedArtwork();
    const result = await drawArtworkPlates(seeded.id);
    if (!result.ok) throw new Error("expected a drawing");

    const front = await sharp(
      Buffer.from((await getStorage().getBytes(result.artwork.frontKey!))!),
    ).metadata();
    const back = await sharp(
      Buffer.from((await getStorage().getBytes(result.artwork.backKey!))!),
    ).metadata();

    // A left chest patch, not a second full plate.
    expect(front.width!).toBeLessThan(back.width!);
  });
});

describe("a breed with no reference illustration", () => {
  it("draws from the photograph alone rather than failing", async () => {
    // The library is drawn breed by breed, so this is the ordinary case today.
    // NOTE the breed: local storage writes into .data/ and PERSISTS between
    // runs, so this has to name a breed no test ever stores a reference for.
    // Using yorkshire-terrier here passes once and then fails for ever.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const seeded = await seedArtwork({ breedId: "beagle" });
    const result = await drawArtworkPlates(seeded.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.usedReference).toBe(false);
    expect(warn).toHaveBeenCalled();
  });

  it("expects none for One of One, and says nothing about it", async () => {
    // One of One has no reference BY DESIGN, so there is nothing to warn about.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const seeded = await seedArtwork({ breedId: "one-of-one-dog-brown" });
    const result = await drawArtworkPlates(seeded.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.usedReference).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });

  it("uses the reference once it exists", async () => {
    const seeded = await seedArtwork();
    const png = await sharp({
      create: {
        width: 32,
        height: 32,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
    await getStorage().put(
      "references/yorkshire-terrier-profile.png",
      new Uint8Array(png),
      "image/png",
    );

    const result = await drawArtworkPlates(seeded.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.usedReference).toBe(true);
  });
});

/**
 * A customer may order without a photograph and take the stock illustration of
 * their breed instead (owner, 5 August). HALF ONE ONLY: the data model and this
 * path allow it, and nothing in the interface offers it. These tests cover the
 * pipeline so half two is a gating question and not a plumbing one.
 */
describe("drawing without a photograph", () => {
  // A BREED OF ITS OWN, and this matters: the mock storage is a directory on
  // disk that survives the run, so writing a reference here writes it for
  // every future run of the whole suite. "beagle" is this file's breed with NO
  // reference and yorkshire-terrier is its breed WITH one; a third test that
  // needs a reference needs a third breed, or it silently rewrites what an
  // earlier test is asserting about.
  it("draws from the breed reference alone", async () => {
    const png = await sharp({
      create: {
        width: 32,
        height: 32,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
    await getStorage().put(
      "references/pug-profile.png",
      new Uint8Array(png),
      "image/png",
    );

    const seeded = await seedArtwork({ breedId: "pug", uploadKey: null });
    const result = await drawArtworkPlates(seeded.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.usedReference).toBe(true);
    expect(result.artwork.frontKey).toBeTruthy();
    expect(result.artwork.backKey).toBeTruthy();
  });

  it("refuses when there is neither a photograph nor a reference", async () => {
    // Nothing to draw from at all. Asking the model anyway returns a handsome
    // generic example of the breed, which is exactly what the prompt's SUBJECT
    // clause exists to prevent and is not what anybody paid R999 for.
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const images = await import("@/lib/images");
    const provider = vi.fn();
    vi.spyOn(images, "getImageProvider").mockResolvedValue({
      moderate: async () => ({ ok: true as const }),
      generatePortrait: provider,
    });

    const seeded = await seedArtwork({
      breedId: "one-of-one-dog-brown",
      uploadKey: null,
    });
    const result = await drawArtworkPlates(seeded.id);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/no photograph and no reference/i);
    // Refused BEFORE the retry loop: two attempts at an impossible drawing is
    // two API calls and four minutes to reach the same answer.
    expect(provider).not.toHaveBeenCalled();
    // Loud, and flagged, because a paid order is waiting on somebody.
    expect(error).toHaveBeenCalled();

    const db = await getDb();
    const [row] = await db
      .select()
      .from(artworks)
      .where(eq(artworks.id, seeded.id));
    expect(row!.status).toBe("failed");
  });
});

describe("when the model refuses", () => {
  it("retries once, then flags for a person instead of throwing", async () => {
    const seeded = await seedArtwork();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const images = await import("@/lib/images");
    const calls = vi.fn();
    vi.spyOn(images, "getImageProvider").mockResolvedValue({
      moderate: async () => ({ ok: true as const }),
      generatePortrait: async () => {
        calls();
        throw new Error("model said no");
      },
    });

    const result = await drawArtworkPlates(seeded.id);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("model said no");
    // One retry, not an endless loop, and not a single shot either.
    expect(calls).toHaveBeenCalledTimes(DRAW_ATTEMPTS);
    // Loud, because a paid order is waiting on somebody.
    expect(error).toHaveBeenCalled();

    const db = await getDb();
    const [row] = await db
      .select()
      .from(artworks)
      .where(eq(artworks.id, seeded.id));
    expect(row!.status).toBe("failed");
  });

  it("draws an artwork that carries no style, because there is one house style", async () => {
    // This used to refuse. The customer is no longer asked for a style (owner
    // decision, 3 August) so nothing writes artworks.style, and a guard that
    // demanded one would now refuse EVERY paid order.
    const seeded = await seedArtwork({ style: null });
    const result = await drawArtworkPlates(seeded.id);
    expect(result.ok).toBe(true);
  });
});
