import { describe, it, expect } from "vitest";
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
  it("converts mm to px at 300 DPI, rounded", () => {
    // 280 / 25.4 * 300 = 3307.09.. -> 3307; 350 -> 4133.86 -> 4134
    expect(printPixels(getProduct("hoodie")!)).toEqual({
      widthPx: 3307,
      heightPx: 4134,
    });
    // 250 -> 2952.76 -> 2953; 300 -> 3543.31 -> 3543
    expect(printPixels(getProduct("tee")!)).toEqual({
      widthPx: 2953,
      heightPx: 3543,
    });
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
    expect(fromPriceZar(getProduct("hoodie")!)).toBe(899);
    expect(fromPriceZar(getProduct("tee")!)).toBe(449);
    expect(fromPriceZar(getProduct("tote")!)).toBe(349);
  });

  it("gives the tote a single 'One size' variant", () => {
    const tote = getProduct("tote")!;
    expect(tote.variants).toHaveLength(1);
    expect(tote.variants[0].sizes).toEqual(["One size"]);
  });
});
