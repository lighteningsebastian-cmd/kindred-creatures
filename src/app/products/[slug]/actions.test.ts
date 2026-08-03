// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { breedRequests } from "@/lib/db/schema";
import { emptyProfile } from "@/lib/companion";
import {
  checkCreatureName,
  logBreedRequest,
  previewPlates,
} from "./actions";

const { getBytes } = vi.hoisted(() => ({ getBytes: vi.fn() }));
vi.mock("@/lib/storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/storage")>()),
  getStorage: () => ({
    getBytes,
    getSignedUrl: async () => "/api/asset/stub",
    put: async () => {},
  }),
}));

async function rowsFor(query: string) {
  const db = await getDb();
  return db.select().from(breedRequests).where(eq(breedRequests.query, query));
}

describe("logBreedRequest", () => {
  it("records a miss so the list can grow by demand", async () => {
    await logBreedRequest("shiba inu", "dog");
    expect(await rowsFor("shiba inu")).toHaveLength(1);
  });

  it("ignores blank searches", async () => {
    await logBreedRequest("   ", "dog");
    expect(await rowsFor("")).toHaveLength(0);
  });

  it("drops a species it does not offer", async () => {
    // Arrives from a browser, so it is not trusted.
    await logBreedRequest("dragon", "wyvern" as never);
    expect(await rowsFor("dragon")).toHaveLength(0);
  });

  it("never throws, whatever it is handed", async () => {
    // A failed log must not interrupt somebody buying a hoodie.
    await expect(
      logBreedRequest("x".repeat(500), "cat"),
    ).resolves.toBeUndefined();
  });
});

describe("checkCreatureName", () => {
  it("accepts ordinary and accented names", async () => {
    for (const name of ["Francis", "Zoë", "Mr O'Hara", "Jean-Luc"]) {
      expect(await checkCreatureName(name), name).toEqual({ ok: true });
    }
  });

  it("refuses a character the font cannot print", async () => {
    // The failure this prevents: a blank space on a garment already paid for.
    const emoji = await checkCreatureName("Rex 🐕");
    expect(emoji.ok).toBe(false);

    const cjk = await checkCreatureName("小白");
    expect(cjk.ok).toBe(false);
  });

  it("refuses what we would rather not print", async () => {
    expect((await checkCreatureName("Sir Shitface")).ok).toBe(false);
  });

  it("allows an empty name, which simply omits the line", async () => {
    expect(await checkCreatureName("   ")).toEqual({ ok: true });
  });
});

describe("previewPlates", () => {
  const aspect = { width: 900, height: 1125 };
  const profile = {
    ...emptyProfile("dog"),
    name: "Francis",
    breedId: "yorkshire-terrier",
    temperament: ["confident", "affectionate", "spirited"] as never,
    togetherSince: 2021,
  };

  // The type is composited as outlined paths, so the name is never a substring
  // of the SVG. That the profile reached the plate is shown by the plate
  // CHANGING when the profile does.
  async function svgFor(patch: Partial<typeof profile>) {
    const result = await previewPlates({ ...profile, ...patch }, aspect);
    return result.back.svg;
  }

  it("still renders the plate when the illustration is missing", async () => {
    // The normal case for most breeds: the 113-image library is still being
    // drawn, so there is nothing under the key yet.
    getBytes.mockResolvedValue(null);

    const result = await previewPlates(profile, aspect);
    expect(result.stockUrl).toBeNull();
    expect(result.back.svg).toContain("<path");
    expect(await svgFor({ name: "Bartholomew" })).not.toEqual(result.back.svg);
  });

  it("still renders the plate when storage throws", async () => {
    // THE BUG THIS PINS: a rejected action means the client's setResult never
    // runs, so the last good plate stays frozen on screen and every later
    // answer is silently dropped. The plate is typeset text and owes the
    // picture nothing, so it must render regardless.
    getBytes.mockRejectedValue(new Error("blob store unreachable"));

    const result = await previewPlates(profile, aspect);
    expect(result.stockUrl).toBeNull();
    expect(result.back.svg).toContain("<path");
    // The breed is the answer that froze the plate in production, so it is the
    // one that has to be shown travelling all the way through.
    expect(await svgFor({ breedId: "border-collie" })).not.toEqual(
      result.back.svg,
    );
  });

  it("puts a breed written in the customer's own words on the plate", async () => {
    getBytes.mockResolvedValue(null);
    const typed = { ...profile, breedId: null, otherBreed: "Boerboel cross" };

    const withWords = await previewPlates(typed, aspect);
    const withoutWords = await previewPlates(
      { ...typed, otherBreed: null },
      aspect,
    );
    expect(withWords.back.svg).not.toEqual(withoutWords.back.svg);

    // And the words are what changed it, not merely that something did.
    const otherWords = await previewPlates(
      { ...typed, otherBreed: "Africanis mix" },
      aspect,
    );
    expect(withWords.back.svg).not.toEqual(otherWords.back.svg);
  });

  it("shows the illustration when there is one", async () => {
    getBytes.mockResolvedValue(new Uint8Array([1, 2, 3]));

    const result = await previewPlates(profile, aspect);
    expect(result.stockUrl).toBe("/api/asset/stub");
  });
});
