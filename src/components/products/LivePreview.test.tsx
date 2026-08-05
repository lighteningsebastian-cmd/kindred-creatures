import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LivePreview } from "./LivePreview";
import { emptyProfile, type CompanionProfile } from "@/lib/companion";
import { PLACEMENT } from "@/lib/garments";
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
        profile={profile({ breedId: "one-of-one-dog-brown" })}
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

  /**
   * The front opens zoomed in, because at full-garment zoom a 110mm print on a
   * 600mm garment is a smudge and the customer has just spent five questions
   * building it (owner, 5 August).
   */
  describe("the zoomed front", () => {
    const renderPlates = () =>
      vi.fn().mockResolvedValue({ front: plate, back: plate, stockUrl: null });

    async function showFront() {
      const user = userEvent.setup();
      const { container } = render(
        <LivePreview
          profile={profile()}
          product={product}
          color={color}
          render={renderPlates()}
        />,
      );
      await user.click(screen.getByRole("button", { name: "front" }));
      return { user, container };
    }

    /** The single element the garment and the plate are transformed inside. */
    const stage = (container: HTMLElement) =>
      container.querySelector<HTMLElement>('div[style*="aspect-ratio"] > div');

    it("opens zoomed in, and offers the whole garment", async () => {
      const { container } = await showFront();
      expect(
        screen.getByRole("button", { name: /whole garment/i }),
      ).toBeVisible();
      expect(stage(container)!.style.transform).toMatch(/scale\(/);
    });

    it("toggles between two states and nothing in between", async () => {
      const { user, container } = await showFront();

      await user.click(screen.getByRole("button", { name: /whole garment/i }));
      expect(stage(container)!.style.transform).toBe("");
      expect(screen.getByRole("button", { name: /zoom in/i })).toBeVisible();

      await user.click(screen.getByRole("button", { name: /zoom in/i }));
      expect(stage(container)!.style.transform).toMatch(/scale\(/);
      // No slider: a range input would be a continuum, which is not the ask.
      expect(screen.queryByRole("slider")).toBeNull();
    });

    // THE ONE THAT MATTERS. The plate is placed as a percentage of the
    // PHOTOGRAPH, so the two have to be scaled by the same transform from the
    // same origin. Transform the image alone and the portrait lands on the
    // sleeve, which is a defect no assertion about the scale factor would find.
    it("scales the garment and the plate as one element", async () => {
      const { container } = await showFront();
      const transformed = stage(container)!;

      expect(transformed.style.transform).toMatch(/scale\(/);

      // The plate arrives from a debounced server render, so wait for it: an
      // absent plate would pass a containment check vacuously, which is the
      // one way this test could claim to prove something and prove nothing.
      await waitFor(() =>
        expect(
          container.querySelector("img[src^='data:image/svg']"),
        ).not.toBeNull(),
      );
      const garment = container.querySelector("img[alt*='front']")!;
      const plateImg = container.querySelector("img[src^='data:image/svg']")!;

      expect(transformed.contains(garment)).toBe(true);
      expect(transformed.contains(plateImg)).toBe(true);
      // And nothing else carries a transform of its own to fight it.
      const others = [...container.querySelectorAll<HTMLElement>("[style]")]
        .filter((el) => el !== transformed && el.style.transform);
      expect(others).toHaveLength(0);
    });

    it("derives the scale from the placement rather than hard-coding it", async () => {
      const { container } = await showFront();
      const { transform, transformOrigin } = stage(container)!.style;

      // Half the box width for a print placed at 13% of it.
      const scale = Number(/scale\(([\d.]+)\)/.exec(transform)![1]);
      expect(scale).toBeCloseTo(50 / PLACEMENT.hoodie.front.width, 3);
      // Centred on the print, then carried to the middle of the box.
      const ox = PLACEMENT.hoodie.front.left + PLACEMENT.hoodie.front.width / 2;
      expect(transformOrigin).toContain(`${ox}%`);
      expect(transform).toContain(`translate(${50 - ox}%`);
    });

    it("never zooms the back, whose whole point is the whole plate", async () => {
      const { container } = render(
        <LivePreview
          profile={profile()}
          product={product}
          color={color}
          render={renderPlates()}
        />,
      );
      // Opens on the back.
      expect(screen.queryByRole("button", { name: /whole garment/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /zoom in/i })).toBeNull();
      expect(stage(container)!.style.transform).toBe("");
    });
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
