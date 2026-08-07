// @vitest-environment node
import { describe, it, expect } from "vitest";
import { GET } from "./route";
import { getDb } from "@/lib/db/client";
import { artworks, type NewArtwork } from "@/lib/db/schema";

const params = (id: string) => ({ params: Promise.resolve({ id }) });
const request = () => new Request("http://localhost/api/artwork/x/plate");

async function seedArtwork(overrides: Partial<NewArtwork> = {}) {
  const db = await getDb();
  const [row] = await db
    .insert(artworks)
    .values({
      productSlug: "hoodie",
      creatureName: "Francis",
      species: "dog",
      breedId: "border-collie",
      temperament: JSON.stringify(["loyal", "spirited"]),
      togetherSince: 2019,
      ...overrides,
    })
    .returning();
  return row;
}

describe("GET /api/artwork/[id]/plate", () => {
  it("draws the plate from the profile the customer saved", async () => {
    const row = await seedArtwork();

    const res = await GET(request(), params(row.id));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("image/svg+xml");
    const svg = await res.text();
    expect(svg.startsWith("<svg")).toBe(true);
    // Outlined type: the words are paths, so the test proves the plate has
    // real content and a shape rather than looking for a string of letters.
    expect(svg).toContain("<path");
    expect(svg).toMatch(/viewBox="0 0 900 \d+"/);
  });

  it("keeps a pet's name out of any shared cache", async () => {
    const row = await seedArtwork();
    const res = await GET(request(), params(row.id));
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("shapes the plate to the garment's back print area", async () => {
    // Tee back is 250 x 300mm; hoodie back is 280 x 350mm. Different plates.
    const tee = await seedArtwork({ productSlug: "tee" });
    const hoodie = await seedArtwork({ productSlug: "hoodie" });

    const teeSvg = await (await GET(request(), params(tee.id))).text();
    const hoodieSvg = await (await GET(request(), params(hoodie.id))).text();

    expect(teeSvg).toContain('viewBox="0 0 900 1080"');
    expect(hoodieSvg).toContain('viewBox="0 0 900 1125"');
  });

  it("404s on a profile that is not finished, so the cart shows the garment", async () => {
    // No breed and no temperament: an artwork that was opened but never
    // answered. A half-empty plate reads as a fault, so it is not drawn.
    const row = await seedArtwork({
      creatureName: null,
      breedId: null,
      temperament: null,
      togetherSince: null,
    });

    const res = await GET(request(), params(row.id));
    expect(res.status).toBe(404);
  });

  it("404s on an unknown artwork and on anything that is not a uuid", async () => {
    const missing = await GET(
      request(),
      params("11111111-2222-3333-4444-555555555555"),
    );
    expect(missing.status).toBe(404);

    const nonsense = await GET(request(), params("../../etc/passwd"));
    expect(nonsense.status).toBe(404);
  });
});
