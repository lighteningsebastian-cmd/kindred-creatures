// @vitest-environment node
import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { artworks, breedRequests } from "@/lib/db/schema";

/**
 * The auto-DDL runs the ALTER statements on every boot, so the one thing worth
 * checking is that a profile actually round-trips. If a column is missing or
 * misspelled this fails at the insert, which is the whole point.
 */
describe("companion profile columns", () => {
  it("round-trips a full profile", async () => {
    const db = await getDb();
    const [row] = await db
      .insert(artworks)
      .values({
        uploadKey: "uploads/test.png",
        productSlug: "hoodie",
        creatureName: "Francis",
        species: "dog",
        breedId: "yorkshire-terrier",
        temperament: JSON.stringify(["confident", "affectionate", "spirited"]),
        togetherSince: 2021,
        frontKey: "plates/front.png",
        backKey: "plates/back.png",
      })
      .returning();

    expect(row!.creatureName).toBe("Francis");
    expect(JSON.parse(row!.temperament!)).toHaveLength(3);
    expect(row!.togetherSince).toBe(2021);
    // Defaults, not nulls: revisions start at zero and nothing is approved yet.
    expect(row!.revisionCount).toBe(0);
    expect(row!.approvedAt).toBeNull();
  });

  it("accepts a profile with no name and no year", async () => {
    // The plate omits rows it has no value for, so these must be optional all
    // the way down rather than defaulted to something printable.
    const db = await getDb();
    const [row] = await db
      .insert(artworks)
      .values({
        uploadKey: "uploads/test2.png",
        productSlug: "tee",
        species: "dog",
        breedId: "one-of-one-dog-black",
      })
      .returning();

    expect(row!.creatureName).toBeNull();
    expect(row!.togetherSince).toBeNull();
  });

  it("has no end-date column beside togetherSince", () => {
    // Two dates under a name is a headstone. This is a schema-level guarantee,
    // not a UI decision: see docs/spec-print-layout.md section 3.
    const columns = Object.keys(artworks);
    expect(columns).toContain("togetherSince");
    expect(
      columns.filter((c) => /until|end|died|passed|death/i.test(c)),
    ).toEqual([]);
  });

  it("logs a breed request", async () => {
    const db = await getDb();
    const [row] = await db
      .insert(breedRequests)
      .values({ query: "shiba inu", species: "dog" })
      .returning();

    expect(row!.query).toBe("shiba inu");
    const found = await db
      .select()
      .from(breedRequests)
      .where(eq(breedRequests.id, row!.id));
    expect(found).toHaveLength(1);
  });
});
