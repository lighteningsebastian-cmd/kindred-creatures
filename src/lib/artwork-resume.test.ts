// @vitest-environment node
import { describe, it, expect } from "vitest";
import { resumeArtwork } from "./artwork-resume";
import { getDb } from "@/lib/db/client";
import { artworks, type NewArtwork } from "@/lib/db/schema";

async function seedArtwork(overrides: Partial<NewArtwork> = {}) {
  const db = await getDb();
  const [row] = await db
    .insert(artworks)
    .values({
      productSlug: "hoodie",
      uploadKey: "uploads/scout.png",
      creatureName: "Scout",
      species: "dog",
      breedId: "border-collie",
      temperament: JSON.stringify(["loyal", "watchful"]),
      togetherSince: 2021,
      ...overrides,
    })
    .returning();
  return row;
}

describe("resumeArtwork", () => {
  it("hands back every answer they gave, so the flow opens filled in", async () => {
    const row = await seedArtwork();

    const resumed = await resumeArtwork(row.id, "hoodie");

    expect(resumed?.artworkId).toBe(row.id);
    expect(resumed?.profile).toMatchObject({
      name: "Scout",
      species: "dog",
      breedId: "border-collie",
      temperament: ["loyal", "watchful"],
      togetherSince: 2021,
    });
  });

  it("signs the photograph they already sent, so it is not asked for twice", async () => {
    const row = await seedArtwork();

    const resumed = await resumeArtwork(row.id, "hoodie");

    expect(resumed?.photoUrl).toBeTruthy();
    expect(resumed?.photoUrl).toContain("uploads/scout.png");
  });

  it("returns a null photo for an artwork that never had one", async () => {
    const row = await seedArtwork({ uploadKey: null });

    const resumed = await resumeArtwork(row.id, "hoodie");

    // A real state since the photo became optional: the edit still opens.
    expect(resumed).not.toBeNull();
    expect(resumed?.photoUrl).toBeNull();
  });

  it("refuses an artwork drawn for a different garment", async () => {
    const row = await seedArtwork({ productSlug: "tee" });

    // The plate is cut for one garment's print area, so a tee's answers must
    // not open behind a hoodie's shape.
    expect(await resumeArtwork(row.id, "hoodie")).toBeNull();
  });

  it("returns null for a stale link rather than throwing at somebody", async () => {
    expect(await resumeArtwork(undefined, "hoodie")).toBeNull();
    expect(await resumeArtwork("not-a-uuid", "hoodie")).toBeNull();
    expect(
      await resumeArtwork("11111111-2222-3333-4444-555555555555", "hoodie"),
    ).toBeNull();
  });
});
