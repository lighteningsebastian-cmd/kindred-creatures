import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CartView } from "./CartView";
import { useCartStore, type CartItem } from "@/lib/cart-store";

// next/image needs config it does not have in jsdom; the thumbnail assertions
// below only care which photograph was asked for.
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt } = props as { src: string; alt: string };
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} />;
  },
}));

// A REAL colourway, because the thumbnail is now the garment photograph and a
// colour with no shot behind it would prove nothing.
function line(overrides: Partial<CartItem> = {}): CartItem {
  return {
    productSlug: "hoodie",
    color: "White",
    size: "M",
    qty: 1,
    artworkId: "art-1",
    unitPriceZar: 899,
    ...overrides,
  };
}

const seed = (...lines: CartItem[]) => {
  for (const item of lines) useCartStore.getState().addItem(item);
};

beforeEach(() => {
  window.localStorage.clear();
  useCartStore.setState({ items: [] });
});

describe("CartView", () => {
  it("renders a line per portrait with its thumbnail, meta and line total", async () => {
    seed(
      line({ artworkId: "art-1", qty: 2 }),
      line({
        artworkId: "art-2",
        productSlug: "tee",
        color: "Olive",
        size: "L",
        unitPriceZar: 449,
      }),
    );

    render(<CartView />);

    expect(
      await screen.findByRole("heading", { name: "The Kindred Hoodie" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "The Kindred Tee" }),
    ).toBeInTheDocument();

    // The thumbnail is the plate they built, drawn from their own profile.
    expect(
      screen.getByAltText("Your design for The Kindred Hoodie in White"),
    ).toHaveAttribute("src", "/api/artwork/art-1/plate");

    expect(screen.getByText("White · Size M")).toBeInTheDocument();
    expect(screen.getByText("Olive · Size L")).toBeInTheDocument();

    // Line totals: 2 x R 899, and 1 x R 449.
    expect(screen.getByText("R 1 798")).toBeInTheDocument();
    expect(screen.getAllByText("R 449").length).toBeGreaterThan(0);

    // Subtotal and total both read 1798 + 449, shipping still uncosted.
    expect(screen.getAllByText("R 2 247")).toHaveLength(2);
    expect(screen.getByText("Added at checkout")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Checkout" })).toHaveAttribute(
      "href",
      "/checkout",
    );
  });

  it("draws each line's own plate, so two creatures are two pictures", async () => {
    seed(
      line({ artworkId: "art-1", color: "White" }),
      line({ artworkId: "art-2", color: "Lilac" }),
    );

    render(<CartView />);

    expect(
      await screen.findByAltText("Your design for The Kindred Hoodie in White"),
    ).toHaveAttribute("src", "/api/artwork/art-1/plate");
    expect(
      screen.getByAltText("Your design for The Kindred Hoodie in Lilac"),
    ).toHaveAttribute("src", "/api/artwork/art-2/plate");
  });

  it("falls back to the garment photograph when the plate cannot be drawn", async () => {
    // What the route returns for an artwork whose profile was never finished.
    // A half-empty plate reads as a fault, so the line shows something real.
    seed(line({ artworkId: "art-1", color: "Lilac" }));

    render(<CartView />);

    const plate = await screen.findByAltText(
      "Your design for The Kindred Hoodie in Lilac",
    );
    fireEvent.error(plate);

    expect(screen.getByAltText("The Kindred Hoodie in Lilac")).toHaveAttribute(
      "src",
      "/garments/hoodie/lilac/front.webp",
    );
  });

  it("steps quantity and reprices the line and the total", async () => {
    const user = userEvent.setup();
    seed(line({ qty: 1 }));

    render(<CartView />);

    const increase = await screen.findByRole("button", {
      name: "Increase quantity of The Kindred Hoodie, White, size M",
    });
    const decrease = screen.getByRole("button", {
      name: "Decrease quantity of The Kindred Hoodie, White, size M",
    });

    // At one, there is nowhere to step down to: removal is its own control.
    expect(decrease).toBeDisabled();

    await user.click(increase);
    expect(screen.getByText("2")).toBeInTheDocument();
    // Line total and cart total both follow the stepper.
    expect(screen.getAllByText("R 1 798")).toHaveLength(3);

    await user.click(decrease);
    expect(screen.getByText("1")).toBeInTheDocument();
    // Line total, subtotal and total all fall back to a single hoodie.
    expect(screen.getAllByText("R 899")).toHaveLength(3);
  });

  it("shows the empty state once the last portrait is removed", async () => {
    const user = userEvent.setup();
    seed(line());

    render(<CartView />);

    await user.click(
      await screen.findByRole("button", {
        name: "Remove The Kindred Hoodie, White, size M from your cart",
      }),
    );

    expect(
      screen.getByText("Your cart is waiting for a face it knows."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Start a portrait" }),
    ).toHaveAttribute("href", "/products/hoodie");
    expect(screen.queryByRole("heading", { name: "The Kindred Hoodie" })).toBeNull();
  });

  it("reads a cart back out of localStorage on load", async () => {
    // Stand in for a refresh: state is gone, only the persisted copy remains.
    seed(line({ qty: 3 }));
    useCartStore.setState({ items: [] });
    window.localStorage.setItem(
      "kindred-cart-v1",
      JSON.stringify({ state: { items: [line({ qty: 3 })] }, version: 1 }),
    );
    useCartStore.persist.rehydrate();

    render(<CartView />);

    expect(
      await screen.findByRole("heading", { name: "The Kindred Hoodie" }),
    ).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});
