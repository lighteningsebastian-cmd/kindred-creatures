import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReorderFlow } from "./ReorderFlow";
import { useCartStore } from "@/lib/cart-store";
import { getProduct } from "@/lib/products";

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

function renderFlow() {
  return render(
    <ReorderFlow
      artworkId={ARTWORK_ID}
      styleLabel="Watercolor"
      previewUrl="https://signed.example/preview.svg"
    />,
  );
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
      color: "Stone",
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
