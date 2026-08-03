import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { LivePreview } from "./LivePreview";
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

describe("LivePreview", () => {
  it("says nothing about an illustration that is not there", async () => {
    // Owner flagged this (docs/flow-review-2.md). While the breed library is
    // empty the slot holds a hatched placeholder, and "the illustration shown is
    // a Yorkshire Terrier example" over it is not a disclosure, it is a claim
    // about something that is not on screen.
    const renderPlates = vi.fn().mockResolvedValue({
      front: plate,
      back: plate,
      stockUrl: null,
    });

    render(
      <LivePreview
        profile={profile()}
        product={product}
        color={color}
        render={renderPlates}
      />,
    );

    await waitFor(() => expect(renderPlates).toHaveBeenCalled());
    expect(screen.queryByText(/example/i)).toBeNull();
  });

  it("names the breed the moment there is a real illustration to name", async () => {
    const renderPlates = vi.fn().mockResolvedValue({
      front: plate,
      back: plate,
      stockUrl: "/stock/yorkshire-terrier.png",
    });

    render(
      <LivePreview
        profile={profile()}
        product={product}
        color={color}
        render={renderPlates}
      />,
    );

    expect(
      await screen.findByText(/is a Yorkshire Terrier example/i),
    ).toBeVisible();
    expect(screen.getByText(/drawn from your own photo/i)).toBeVisible();
  });

  it("drops the breed name for One of One", async () => {
    const renderPlates = vi.fn().mockResolvedValue({
      front: plate,
      back: plate,
      stockUrl: "/stock/one-of-one.png",
    });

    render(
      <LivePreview
        profile={profile({ breedId: "one-of-one-dog-large" })}
        product={product}
        color={color}
        render={renderPlates}
      />,
    );
    expect(
      await screen.findByText(/The illustration shown is an example/i),
    ).toBeVisible();
  });

  it("shows the garment from the first paint, before any plate arrives", () => {
    // The gate is gone and the preview is never blank: the owner looked at the
    // gated page twice and thought it was broken.
    const { container } = render(
      <LivePreview
        profile={profile()}
        product={product}
        color={color}
        render={() => new Promise(() => {})}
      />,
    );
    const garment = container.querySelector("img");
    expect(garment).not.toBeNull();
    // And it opens on the back, because the plate is the product.
    expect(screen.getByRole("button", { name: "back" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("renders a plate and falls back when the library is empty", async () => {
    const renderPlates = vi.fn().mockResolvedValue({
      front: plate,
      back: plate,
      stockUrl: null,
    });

    render(
      <LivePreview
        profile={profile()}
        product={product}
        color={color}
        render={renderPlates}
      />,
    );

    await waitFor(() => expect(renderPlates).toHaveBeenCalled());
    // One side at a time, with a toggle: the plate is shown ON the garment, so
    // two of them side by side would mean two garments.
    expect(screen.getByRole("button", { name: "front" })).toBeVisible();
  });

  it("asks for the plate at the garment's own print proportions", async () => {
    const renderPlates = vi.fn().mockResolvedValue({
      front: plate,
      back: plate,
      stockUrl: null,
    });

    render(
      <LivePreview
        profile={profile()}
        product={product}
        color={color}
        render={renderPlates}
      />,
    );

    await waitFor(() => expect(renderPlates).toHaveBeenCalled());
    const aspect = renderPlates.mock.calls[0]![1];
    expect(aspect.width / aspect.height).toBeCloseTo(
      product.printArea.back.widthMm / product.printArea.back.heightMm,
      2,
    );
  });
});
