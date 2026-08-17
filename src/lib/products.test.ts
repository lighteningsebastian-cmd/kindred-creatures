import { describe, it, expect } from "vitest";
import { garmentImageUrl, photoAspect } from "./garments";
import {
  PRODUCTS,
  formatZar,
  printPixels,
  getProduct,
  fromPriceZar,
} from "./products";

describe("formatZar", () => {
  it("prefixes with 'R ' and no separator under a thousand", () => {
    expect(formatZar(899)).toBe("R 899");
    expect(formatZar(0)).toBe("R 0");
    expect(formatZar(349)).toBe("R 349");
  });

  it("thousands-separates with a space", () => {
    expect(formatZar(1299)).toBe("R 1 299");
    expect(formatZar(10000)).toBe("R 10 000");
    expect(formatZar(1000000)).toBe("R 1 000 000");
  });

  it("rounds non-integer inputs", () => {
    expect(formatZar(899.4)).toBe("R 899");
    expect(formatZar(899.6)).toBe("R 900");
  });
});

describe("printPixels", () => {
  it("converts the back area to px at 300 DPI, rounded", () => {
    // 280 / 25.4 * 300 = 3307.09.. -> 3307; 350 -> 4133.86 -> 4134
    expect(printPixels(getProduct("hoodie")!, "back")).toEqual({
      widthPx: 3307,
      heightPx: 4134,
    });
    // 250 -> 2952.76 -> 2953; 300 -> 3543.31 -> 3543
    expect(printPixels(getProduct("tee")!, "back")).toEqual({
      widthPx: 2953,
      heightPx: 3543,
    });
  });

  it("gives the front its own measured area, not a slice of the back", () => {
    // 110 by 150mm, the owner's measurement. The front used to be derived as a
    // third of the back's WIDTH and rendered square, so it was both the wrong
    // size and the wrong shape on every garment.
    // 110 -> 1299.2 -> 1299; 150 -> 1771.65 -> 1772
    for (const slug of ["hoodie", "tee", "crewneck"]) {
      expect(printPixels(getProduct(slug)!, "front"), slug).toEqual({
        widthPx: 1299,
        heightPx: 1772,
      });
    }
  });

  it("keeps the front and the back genuinely different shapes", () => {
    const product = getProduct("hoodie")!;
    const front = product.printArea.front;
    const back = product.printArea.back;
    expect(front.widthMm / front.heightMm).not.toBeCloseTo(
      back.widthMm / back.heightMm,
      2,
    );
  });
});

describe("getProduct", () => {
  it("returns the product for a known slug", () => {
    expect(getProduct("tote")?.slug).toBe("tote");
  });

  it("returns undefined for an unknown slug", () => {
    expect(getProduct("nope")).toBeUndefined();
  });
});

describe("catalog seed", () => {
  it("has the four expected products", () => {
    expect(PRODUCTS.map((p) => p.slug)).toEqual([
      "hoodie",
      "tee",
      "crewneck",
      "tote",
    ]);
  });

  it("exposes from-prices matching the lowest variant", () => {
    expect(fromPriceZar(getProduct("hoodie")!)).toBe(999);
    expect(fromPriceZar(getProduct("tee")!)).toBe(599);
    expect(fromPriceZar(getProduct("crewneck")!)).toBe(799);
    expect(fromPriceZar(getProduct("tote")!)).toBe(349);
  });

  it("cuts the crewneck to XL and the rest to XXL", () => {
    // The crewneck is the women's cut and does not run to XXL. A size offered
    // that the printer cannot supply is a cancelled order.
    for (const variant of getProduct("crewneck")!.variants) {
      expect(variant.sizes).toEqual(["XS", "S", "M", "L", "XL"]);
    }
    for (const slug of ["hoodie", "tee"]) {
      for (const variant of getProduct(slug)!.variants) {
        expect(variant.sizes, slug).toContain("XXL");
      }
    }
  });

  it("names the fit of everything that is worn", () => {
    expect(getProduct("hoodie")!.fit).toBe("unisex");
    expect(getProduct("tee")!.fit).toBe("unisex");
    expect(getProduct("crewneck")!.fit).toBe("womens");
    // The tote is carried, not worn, so it has no fit to state.
    expect(getProduct("tote")!.fit).toBeUndefined();
  });

  it("gives the tote a single 'One size' variant", () => {
    const tote = getProduct("tote")!;
    expect(tote.variants).toHaveLength(1);
    expect(tote.variants[0].sizes).toEqual(["One size"]);
  });

  // ProductFlow and ReorderFlow both start at variants[0], so the order of this
  // array is a product decision rather than tidying. Owner, 5 August: White on
  // every worn garment. Asserted here because a reorder for any other reason
  // would change what the customer sees on their first paint, silently.
  it("starts every worn garment on White", () => {
    for (const slug of ["hoodie", "tee", "crewneck"] as const) {
      expect(getProduct(slug)!.variants[0].color, slug).toBe("White");
    }
  });

  // photoAspect is per COLOURWAY AND PER VIEW, not per product, so the
  // default colourway also sets the SHAPE of the preview box the whole
  // profile flow renders into. LivePreview starts on the BACK side (its
  // `side` state defaults to "back"), so that is the view the customer
  // actually sees first and the view this must check. Moving the hoodie's
  // default from Blue to White would have resized that box if the two shots
  // were different ratios, and the mobile layout would have had to hold at
  // whatever it became. They are the same ratio, so it did not, and this
  // asserts that rather than trusting it.
  it("did not resize the preview box when the hoodie default moved to White", () => {
    expect(photoAspect("hoodie", "White", "back")).toBeCloseTo(
      photoAspect("hoodie", "Blue", "back"),
      4,
    );
  });

  // Every default has a photograph behind it. A default with none falls back to
  // DEFAULT_SHAPE and renders an empty frame on first paint, which reads as a
  // broken page on a R999 product.
  it("has a photograph for every default colourway", () => {
    for (const slug of ["hoodie", "tee", "crewneck"] as const) {
      const product = getProduct(slug)!;
      expect(
        garmentImageUrl(slug, product.variants[0].color, "front"),
        slug,
      ).toBeTruthy();
    }
  });
});
