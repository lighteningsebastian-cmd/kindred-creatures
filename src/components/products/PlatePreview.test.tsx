import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { PlatePreview } from "./PlatePreview";
import { emptyProfile, type CompanionProfile } from "@/lib/companion";
import { PRODUCTS } from "@/lib/products";

const product = PRODUCTS[0]!;
const color = product.variants[0]!;

function profile(over: Partial<CompanionProfile> = {}): CompanionProfile {
  return { ...emptyProfile("dog"), breedId: "yorkshire-terrier", ...over };
}

const plate = {
  svg: '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>',
  portrait: { x: 0.1, y: 0.2, width: 0.8, height: 0.4 },
};

describe("PlatePreview", () => {
  it("shows the honesty line before any plate has rendered", () => {
    // It must never depend on the render arriving. A stand-in illustration on
    // screen without this line is the difference between a clever preview and
    // a complaint.
    render(
      <PlatePreview
        profile={profile()}
        product={product}
        color={color}
        render={() => new Promise(() => {})}
      />,
    );

    expect(
      screen.getByText(/is a Yorkshire Terrier example/i),
    ).toBeVisible();
    expect(screen.getByText(/drawn from your own photo/i)).toBeVisible();
  });

  it("drops the breed name for One of One", () => {
    render(
      <PlatePreview
        profile={profile({ breedId: "one-of-one-dog-large" })}
        product={product}
        color={color}
        render={() => new Promise(() => {})}
      />,
    );
    expect(screen.getByText(/The illustration shown is an example/i)).toBeVisible();
  });

  it("renders both plates and falls back when the library is empty", async () => {
    const renderPlates = vi.fn().mockResolvedValue({
      front: plate,
      back: plate,
      stockUrl: null,
    });

    render(
      <PlatePreview
        profile={profile()}
        product={product}
        color={color}
        render={renderPlates}
      />,
    );

    await waitFor(() => expect(screen.getByText("Back")).toBeVisible());
    expect(screen.getByText("Left chest")).toBeVisible();
    // No stock image yet, so the kit's own placeholder stands in rather than an
    // unrelated dog.
    expect(screen.getAllByText(/breed illustration/i).length).toBeGreaterThan(0);
  });

  it("asks for the plate at the garment's own print proportions", async () => {
    const renderPlates = vi.fn().mockResolvedValue({
      front: plate,
      back: plate,
      stockUrl: null,
    });

    render(
      <PlatePreview
        profile={profile()}
        product={product}
        color={color}
        render={renderPlates}
      />,
    );

    await waitFor(() => expect(renderPlates).toHaveBeenCalled());
    const aspect = renderPlates.mock.calls[0]![1];
    expect(aspect.width / aspect.height).toBeCloseTo(
      product.printArea.widthMm / product.printArea.heightMm,
      2,
    );
  });
});
