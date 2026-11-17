import { describe, expect, it } from "vitest";

import {
  FREE_SHIPPING_THRESHOLD_ZAR,
  SHIPPING_FLAT_ZAR,
  orderTotals,
  priceLine,
} from "./checkout";
import { getProduct, variantsForFit } from "./products";

describe("priceLine", () => {
  /*
   * THE SERVER'S PRICE, NEVER THE CLIENT'S, and now keyed on the fit as well
   * as the colour. A colour no longer names one garment: the men's and the
   * women's crewneck both come in White, at different blank costs and
   * potentially different retail prices, so a lookup on colour alone would
   * price one sweater and ship the other.
   */
  const peach = () =>
    variantsForFit(getProduct("crewneck")!, "womens").find(
      (variant) => variant.color === "Peach",
    )!;

  it("prices a line from the catalogue", () => {
    const result = priceLine({
      productSlug: "crewneck",
      color: "Peach",
      fit: "womens",
      size: "M",
      qty: 1,
      artworkId: "11111111-1111-1111-1111-111111111111",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.line.unitPriceZar).toBe(peach().priceZar);
    expect(result.line.fit).toBe("womens");
  });

  it("refuses a colour the requested fit does not offer", () => {
    const result = priceLine({
      productSlug: "crewneck",
      color: "Peach",
      fit: "mens",
      size: "M",
      qty: 1,
      artworkId: "11111111-1111-1111-1111-111111111111",
    });

    expect(result.ok).toBe(false);
  });
});

describe("orderTotals", () => {
  it("charges flat shipping below the advertised free threshold", () => {
    const totals = orderTotals(449);

    expect(totals.shippingZar).toBe(SHIPPING_FLAT_ZAR);
    expect(totals.totalZar).toBe(449 + SHIPPING_FLAT_ZAR);
  });

  // Boundary: one rand short of R1000 still pays the flat courier rate. R1000
  // exactly ships free (the test below); R999 does not.
  it("charges flat shipping one rand below the threshold", () => {
    const justBelow = orderTotals(FREE_SHIPPING_THRESHOLD_ZAR - 1);

    expect(justBelow.shippingZar).toBe(SHIPPING_FLAT_ZAR);
    expect(justBelow.totalZar).toBe(FREE_SHIPPING_THRESHOLD_ZAR - 1 + SHIPPING_FLAT_ZAR);
  });

  // The utility bar and the cart both promise "free shipping over R1000". If this
  // fails, the site is charging for something it told the customer was free.
  it("honours the advertised free shipping promise at and above the threshold", () => {
    const atThreshold = orderTotals(FREE_SHIPPING_THRESHOLD_ZAR);
    expect(atThreshold.shippingZar).toBe(0);
    expect(atThreshold.totalZar).toBe(FREE_SHIPPING_THRESHOLD_ZAR);

    const above = orderTotals(2247);
    expect(above.shippingZar).toBe(0);
    expect(above.totalZar).toBe(2247);
  });

  it("keeps subtotal plus shipping equal to the total either way", () => {
    for (const subtotal of [349, 749, 750, 899, 1798]) {
      const totals = orderTotals(subtotal);
      expect(totals.subtotalZar + totals.shippingZar).toBe(totals.totalZar);
    }
  });
});
