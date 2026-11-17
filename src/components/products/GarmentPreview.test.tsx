import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GarmentPreview, photoBoxWidth } from "./GarmentPreview";
import { PLACEMENT, photoAspect, placementFor } from "@/lib/garments";
import { getProduct } from "@/lib/products";

/**
 * The shared garment view. Its layout rule is what keeps a plate on the
 * garment: the box must be the photograph's shape whichever side of the space
 * runs out first. jsdom does no layout and drops container units, so what is
 * pinned here is the rule itself; the rendered ratios were measured in a
 * browser at 375px and 1280px.
 */

const tee = getProduct("tee")!;
const olive = tee.variants.find((variant) => variant.color === "Olive")!;

function box() {
  return screen
    .getByRole("img", { name: "The Kindred Tee in Olive, back" })
    .closest<HTMLElement>("[style*='aspect-ratio']")!;
}

describe("GarmentPreview", () => {
  it("sizes the box by width and height, so a landscape photo keeps its shape", () => {
    // Olive is landscape. Sized by height alone, a narrow column capped the
    // width and the box came out 0.86 for a 1.25 photograph.
    render(<GarmentPreview product={tee} color={olive} side="back" />);

    const aspect = photoAspect("tee", "olive", "back");
    expect(photoBoxWidth(aspect)).toBe("min(100cqw, calc(100cqh * 1.25))");
    expect(parseFloat(box().style.aspectRatio)).toBeCloseTo(aspect);
    // The units only mean something inside a size container.
    expect(box().parentElement!.className).toContain("[container-type:size]");
  });

  it("draws nothing over the garment when it is given no plate", () => {
    render(<GarmentPreview product={tee} color={olive} side="back" />);
    expect(screen.getAllByRole("img")).toHaveLength(1);
  });

  it("places whatever plate it is given inside the placement box", () => {
    render(
      <GarmentPreview product={tee} color={olive} side="back">
        <span>the plate</span>
      </GarmentPreview>,
    );
    const placed = screen.getByText("the plate").parentElement!;
    expect(placed.style.width).toMatch(/%$/);
    expect(box().contains(placed)).toBe(true);
  });

  it("places the plate by the colourway's own placement, not the product's", () => {
    // Olive is landscape and the tee fills less of it than it fills White, so
    // the product's placement drew the back plate out toward the shoulders.
    render(
      <GarmentPreview product={tee} color={olive} side="back">
        <span>the plate</span>
      </GarmentPreview>,
    );
    const olivePlacement = placementFor("tee", "olive", "back");
    expect(olivePlacement).not.toEqual(PLACEMENT.tee.back);

    const placed = screen.getByText("the plate").parentElement!;
    expect(placed.style.top).toBe(`${olivePlacement.top}%`);
    expect(placed.style.left).toBe(`${olivePlacement.left}%`);
    expect(placed.style.width).toBe(`${olivePlacement.width}%`);
  });

  it("zooms the front onto the colourway's own placement", () => {
    // The camera follows the print. Framed on the product's placement, the
    // zoom on Olive would centre on the fabric beside the badge.
    render(
      <GarmentPreview product={tee} color={olive} side="front">
        <span>the plate</span>
      </GarmentPreview>,
    );
    const front = placementFor("tee", "olive", "front");
    const stage = screen.getByText("the plate").parentElement!.parentElement!;
    const ox = front.left + front.width / 2;
    expect(stage.style.transform).toContain(`scale(${50 / front.width})`);
    expect(stage.style.transform).toContain(`translate(${50 - ox}%`);
    expect(stage.style.transformOrigin).toContain(`${ox}%`);
  });
});
