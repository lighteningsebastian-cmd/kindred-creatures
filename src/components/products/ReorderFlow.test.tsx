import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReorderFlow } from "./ReorderFlow";
import { useCartStore } from "@/lib/cart-store";
import { getProduct } from "@/lib/products";
import { photoAspect, placementFor } from "@/lib/garments";

/**
 * The re-order island. The whole point of B4 is that a saved portrait goes back
 * into a cart WITHOUT re-uploading or re-generating anything, so these tests
 * prove three things: the cart line carries the existing artworkId at the chosen
 * product/colour/size and the right price; no network call is ever made (no
 * /api/upload, no /api/generate); and creature_reordered fires with the product
 * only, no PII.
 */

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const trackCreatureReordered = vi.fn();
vi.mock("@/lib/analytics", () => ({
  trackCreatureReordered: (input: { product: string }) =>
    trackCreatureReordered(input),
}));

const ARTWORK_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

beforeEach(() => {
  push.mockClear();
  trackCreatureReordered.mockClear();
  useCartStore.setState({ items: [] });
  // Any fetch is a failure: re-order must reach neither upload nor generate.
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("re-order must not touch the network");
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const FRONT_URL = "https://signed.example/front.png";
const BACK_URL = "https://signed.example/back.png";

function renderFlow(
  urls: { frontUrl?: string | null; backUrl?: string | null } = {},
) {
  return render(
    <ReorderFlow
      artworkId={ARTWORK_ID}
      styleLabel="Watercolor"
      frontUrl={urls.frontUrl === undefined ? FRONT_URL : urls.frontUrl}
      backUrl={urls.backUrl === undefined ? BACK_URL : urls.backUrl}
    />,
  );
}

/** The garment photograph, found by the alt the shared preview gives it. */
function garment(name: string) {
  return screen.getByRole("img", { name });
}

/** The photograph-shaped box the plate is measured against. */
function photoBox(name: string) {
  return garment(name).closest<HTMLElement>("[style*='aspect-ratio']")!;
}

describe("ReorderFlow", () => {
  it("adds the existing artwork to the cart at the chosen piece, colour and size", async () => {
    const user = userEvent.setup();
    renderFlow();

    // Default piece is the hoodie (PRODUCTS[0]); its size needs a pick.
    await user.click(screen.getByRole("button", { name: "L" }));
    await user.click(screen.getByRole("button", { name: "Add to cart" }));

    const items = useCartStore.getState().items;
    expect(items).toHaveLength(1);
    const hoodie = getProduct("hoodie")!;
    expect(items[0]).toEqual({
      productSlug: "hoodie",
      // The first variant, which is White on every garment (owner, 5 August).
      color: "White",
      size: "L",
      qty: 1,
      artworkId: ARTWORK_ID,
      unitPriceZar: hoodie.variants[0].priceZar,
    });
    // The hand-off routes to the cart.
    expect(push).toHaveBeenCalledWith("/cart");
  });

  it("carries the price of the piece the customer switched to", async () => {
    const user = userEvent.setup();
    renderFlow();

    // Switch to the tote: one colour, one size, so it is immediately addable.
    await user.click(screen.getByRole("button", { name: "Kindred Tote" }));
    await user.click(screen.getByRole("button", { name: "Add to cart" }));

    const tote = getProduct("tote")!;
    const items = useCartStore.getState().items;
    expect(items[0].productSlug).toBe("tote");
    expect(items[0].artworkId).toBe(ARTWORK_ID);
    expect(items[0].unitPriceZar).toBe(tote.variants[0].priceZar);
  });

  it("holds the add until a size is chosen", async () => {
    const user = userEvent.setup();
    renderFlow();

    // Hoodie needs a size: the CTA is disabled and adds nothing.
    expect(screen.getByRole("button", { name: "Add to cart" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Add to cart" }));
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it("fires creature_reordered with the product only, and never touches the network", async () => {
    const user = userEvent.setup();
    renderFlow();

    await user.click(screen.getByRole("button", { name: "M" }));
    await user.click(screen.getByRole("button", { name: "Add to cart" }));

    expect(trackCreatureReordered).toHaveBeenCalledTimes(1);
    const payload = trackCreatureReordered.mock.calls[0][0];
    expect(payload).toEqual({ product: "hoodie" });
    // No PII rode along.
    expect(JSON.stringify(payload)).not.toContain(ARTWORK_ID);
    expect(payload).not.toHaveProperty("email");

    // Not a single fetch happened across the whole flow.
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("ReorderFlow: the portrait on the garment", () => {
  it("opens on the back of the default garment, with the back plate on it", () => {
    renderFlow();

    const photo = garment("The Kindred Hoodie in White, back");
    expect(decodeURIComponent(photo.getAttribute("src")!)).toContain(
      "/garments/hoodie/white/back.webp",
    );
    const plate = screen.getByRole("img", {
      name: "Your portrait on the back of The Kindred Hoodie",
    });
    expect(plate).toHaveAttribute("src", BACK_URL);
    expect(screen.getByRole("button", { name: "back" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("changes the photograph underneath when the piece changes, and keeps the plate", async () => {
    const user = userEvent.setup();
    renderFlow();

    await user.click(screen.getByRole("button", { name: "Kindred Tee" }));

    const photo = garment("The Kindred Tee in White, back");
    expect(decodeURIComponent(photo.getAttribute("src")!)).toContain(
      "/garments/tee/white/back.webp",
    );
    expect(
      screen.getByRole("img", { name: "Your portrait on the back of The Kindred Tee" }),
    ).toHaveAttribute("src", BACK_URL);
    expect(screen.queryByRole("img", { name: /Kindred Hoodie/ })).toBeNull();
  });

  it("changes the photograph underneath when the colour changes", async () => {
    const user = userEvent.setup();
    renderFlow();

    await user.click(screen.getByRole("button", { name: "Blue" }));

    const photo = garment("The Kindred Hoodie in Blue, back");
    expect(decodeURIComponent(photo.getAttribute("src")!)).toContain(
      "/garments/hoodie/blue/back.webp",
    );
  });

  it("draws the box at the photograph's own shape, per colourway", async () => {
    // The tee's White is portrait and its Olive landscape. A box of any other
    // shape letterboxes the photo and the plate lands beside the garment.
    const user = userEvent.setup();
    renderFlow();
    await user.click(screen.getByRole("button", { name: "Kindred Tee" }));

    expect(parseFloat(photoBox("The Kindred Tee in White, back").style.aspectRatio)).toBeCloseTo(
      photoAspect("tee", "White", "back"),
    );

    await user.click(screen.getByRole("button", { name: "Olive" }));
    expect(parseFloat(photoBox("The Kindred Tee in Olive, back").style.aspectRatio)).toBeCloseTo(
      photoAspect("tee", "Olive", "back"),
    );
  });

  it("places the plate where the customizer does, at the chosen piece's print shape", async () => {
    const user = userEvent.setup();
    renderFlow();
    await user.click(screen.getByRole("button", { name: "Kindred Tee" }));

    const plate = screen.getByRole("img", {
      name: "Your portrait on the back of The Kindred Tee",
    });
    const shape = plate.parentElement!;
    const tee = getProduct("tee")!;
    expect(shape.style.aspectRatio).toBe(
      `${tee.printArea.back.widthMm} / ${tee.printArea.back.heightMm}`,
    );
    const placed = shape.parentElement!;
    const white = placementFor("tee", "White", "back");
    expect(placed.style.top).toBe(`${white.top}%`);
    expect(placed.style.left).toBe(`${white.left}%`);
    expect(placed.style.width).toBe(`${white.width}%`);

    // And it follows the colourway: the tee's Olive shot is framed wider, so
    // the plate has a placement of its own there.
    await user.click(screen.getByRole("button", { name: "Olive" }));
    const olive = placementFor("tee", "Olive", "back");
    const moved = screen.getByRole("img", {
      name: "Your portrait on the back of The Kindred Tee",
    }).parentElement!.parentElement!;
    expect(moved.style.left).toBe(`${olive.left}%`);
    expect(moved.style.width).toBe(`${olive.width}%`);
  });

  it("offers the front, with the front plate on the front photograph", async () => {
    const user = userEvent.setup();
    renderFlow();

    await user.click(screen.getByRole("button", { name: "front" }));

    expect(garment("The Kindred Hoodie in White, front")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Your portrait on the front of The Kindred Hoodie" }),
    ).toHaveAttribute("src", FRONT_URL);
  });

  it("shows the garment with the plate's place marked when there is no plate to show", () => {
    renderFlow({ backUrl: null });

    // Still a garment, not a square with a caption.
    expect(garment("The Kindred Hoodie in White, back")).toBeInTheDocument();
    const empty = screen.getByRole("img", { name: "Where your portrait goes" });
    const hoodie = getProduct("hoodie")!;
    expect(empty.style.aspectRatio).toBe(
      `${hoodie.printArea.back.widthMm} / ${hoodie.printArea.back.heightMm}`,
    );
    expect(screen.queryByText("Your portrait")).toBeNull();
  });

  it("has no square box left over from the floating portrait", () => {
    const { container } = renderFlow();
    expect(container.querySelector(".aspect-square")).toBeNull();
  });
});
