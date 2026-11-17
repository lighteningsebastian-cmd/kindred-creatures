import { describe, it, expect } from "vitest";
import { parseGarmentFile } from "./garment-import";

/*
 * THE BUG THIS FILE EXISTS FOR.
 *
 * The importer kept a list of filename words that carry no meaning, and it
 * contained "men" and "women". So it stripped the fit out of every name before
 * deciding where the picture went, and "Crewneck - Men - Grey-front.jpeg"
 * landed beside "Crewneck - peach - back.png": the men's and the women's
 * sweater merged into one garment with four colours, and the shop sold a Grey
 * "Women's fit" crewneck over a photograph of the men's one.
 *
 * A filename rule that decides which garment a photograph is of belongs under
 * test, which is why this parser lives in src/ rather than in the script.
 */
describe("parseGarmentFile", () => {
  it("takes the fit from the filename", () => {
    expect(parseGarmentFile("Crewneck - Men - Grey-front.jpeg")).toEqual({
      product: "crewneck",
      fit: "mens",
      colour: "grey",
      views: ["front"],
    });
    expect(parseGarmentFile("Womens - Tee - Peach- back.jpeg")).toEqual({
      product: "tee",
      fit: "womens",
      colour: "peach",
      views: ["back"],
    });
  });

  it("falls back to the source folder when the filename carries no fit", () => {
    // The men's tees are the reason this fallback is not a nicety: their
    // filenames say nothing about fit at all, so without the folder they would
    // collide with the women's tees exactly as the crewnecks did.
    expect(
      parseGarmentFile("Tees Men/Tee - White/Tee - White - front.jpeg"),
    ).toEqual({ product: "tee", fit: "mens", colour: "white", views: ["front"] });
    expect(
      parseGarmentFile("Crewneck - Woman/Crewneck - peach - back.png"),
    ).toEqual({
      product: "crewneck",
      fit: "womens",
      colour: "peach",
      views: ["back"],
    });
  });

  it("defaults to unisex, and keeps the tote's one file for two views", () => {
    expect(
      parseGarmentFile("Hoodies - Unisex/Hoodie - Premium - Blue/Hoodie-Blue-back.png"),
    ).toEqual({
      product: "hoodie",
      fit: "unisex",
      colour: "blue",
      views: ["back"],
    });
    // A tote's two faces are the same blank canvas panel, so the shoot produced
    // one frame where every garment produced three.
    expect(parseGarmentFile("Tote/tote-beige.png")).toEqual({
      product: "tote",
      fit: "unisex",
      colour: "beige",
      views: ["front", "back"],
    });
  });

  it("keeps a multi-word colour whole", () => {
    expect(
      parseGarmentFile("Tees Men/Tee - Heritage Blue - front.jpeg"),
    ).toEqual({
      product: "tee",
      fit: "mens",
      colour: "heritage-blue",
      views: ["front"],
    });
  });

  it("returns null for a name it cannot read", () => {
    // The women's tee Blue set arrived from WhatsApp named like this. Null is
    // the honest answer: the script warns and skips rather than inventing a
    // view, because guessing front from back puts the large plate on the chest.
    expect(
      parseGarmentFile("Tees Women/WhatsApp Image 2026-07-30 at 13.45.32.jpeg"),
    ).toBeNull();
  });
});
