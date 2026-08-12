import { describe, it, expect, beforeEach } from "vitest";
import {
  CART_STORAGE_KEY,
  MAX_QTY,
  itemCount,
  subtotalZar,
  useCartStore,
  type CartItem,
} from "./cart-store";

function line(overrides: Partial<CartItem> = {}): CartItem {
  return {
    productSlug: "hoodie",
    color: "Stone",
    size: "M",
    qty: 1,
    artworkId: "art-1",
    unitPriceZar: 899,
    ...overrides,
  };
}

const items = () => useCartStore.getState().items;

beforeEach(() => {
  window.localStorage.clear();
  useCartStore.setState({ items: [] });
});

describe("cart store", () => {
  it("opens one line per artwork and raises quantity for a repeat artwork", () => {
    const { addItem } = useCartStore.getState();

    addItem(line());
    addItem(line());

    // The same portrait is the same line, never a second one.
    expect(items()).toHaveLength(1);
    expect(items()[0].qty).toBe(2);
  });

  it("keeps separate lines for separate artworks of the same garment", () => {
    const { addItem } = useCartStore.getState();

    addItem(line({ artworkId: "art-1" }));
    addItem(line({ artworkId: "art-2" }));

    expect(items().map((i) => i.artworkId)).toEqual(["art-1", "art-2"]);
    expect(itemCount(items())).toBe(2);
  });

  it("clamps quantity to the 1..10 window", () => {
    const { addItem, setQty } = useCartStore.getState();
    addItem(line());

    setQty("art-1", 4);
    expect(items()[0].qty).toBe(4);

    setQty("art-1", 99);
    expect(items()[0].qty).toBe(MAX_QTY);

    setQty("art-1", -3);
    // Nothing below one survives: a zero or less is a removal.
    expect(items()).toHaveLength(0);
  });

  it("caps an incrementing add at the maximum", () => {
    const { addItem } = useCartStore.getState();
    addItem(line({ qty: 8 }));
    addItem(line({ qty: 5 }));

    expect(items()[0].qty).toBe(MAX_QTY);
  });

  it("removes a line by artworkId and clears the whole cart", () => {
    const { addItem, removeItem, clear } = useCartStore.getState();
    addItem(line({ artworkId: "art-1" }));
    addItem(line({ artworkId: "art-2" }));

    removeItem("art-1");
    expect(items().map((i) => i.artworkId)).toEqual(["art-2"]);

    clear();
    expect(items()).toEqual([]);
  });

  it("setQty of zero removes the line", () => {
    const { addItem, setQty } = useCartStore.getState();
    addItem(line({ qty: 3 }));

    setQty("art-1", 0);
    expect(items()).toHaveLength(0);
  });

  describe("replaceLine", () => {
    const seed = (...lines: CartItem[]) => {
      for (const item of lines) useCartStore.getState().addItem(item);
    };

    it("swaps a line in place, keeping its position and their quantity", () => {
      seed(
        line({ artworkId: "art-1", qty: 3 }),
        line({ artworkId: "art-2", productSlug: "tee" }),
      );

      useCartStore
        .getState()
        .replaceLine("art-1", line({ artworkId: "art-1", color: "Lilac", size: "XL" }));

      const [first, second] = items();
      expect(first.artworkId).toBe("art-1");
      expect(first.color).toBe("Lilac");
      expect(first.size).toBe("XL");
      // The flow only ever knows about one. They asked for three.
      expect(first.qty).toBe(3);
      // And the line after it has not moved.
      expect(second.artworkId).toBe("art-2");
    });

    it("follows the line onto a new artwork when the photo was replaced", () => {
      seed(line({ artworkId: "art-1", qty: 2 }));

      // Choosing a different photograph mid-edit opens a new artwork; the line
      // has to point at it rather than at the picture they replaced.
      useCartStore
        .getState()
        .replaceLine("art-1", line({ artworkId: "art-9" }));

      expect(items()).toHaveLength(1);
      expect(items()[0].artworkId).toBe("art-9");
      expect(items()[0].qty).toBe(2);
    });

    it("re-prices from the catalogue rather than trusting the incoming line", () => {
      seed(line({ artworkId: "art-1" }));

      useCartStore
        .getState()
        .replaceLine("art-1", line({ artworkId: "art-1", color: "White", unitPriceZar: 1 }));

      // The checkout re-derives every amount server-side. A cart that
      // disagrees shows one number and charges another.
      expect(items()[0].unitPriceZar).toBe(999);
    });

    it("does nothing when the line was removed while they were editing", () => {
      seed(line({ artworkId: "art-1" }));
      useCartStore.getState().removeItem("art-1");

      useCartStore.getState().replaceLine("art-1", line({ artworkId: "art-1" }));

      // Another tab, or a Remove on the way past. Adding it back would
      // resurrect something they threw away.
      expect(items()).toHaveLength(0);
    });
  });

  it("counts quantities and sums the subtotal in whole rands", () => {
    const cart = [
      line({ artworkId: "art-1", qty: 2, unitPriceZar: 899 }),
      line({ artworkId: "art-2", qty: 3, unitPriceZar: 449, productSlug: "tee" }),
    ];

    expect(itemCount(cart)).toBe(5);
    expect(subtotalZar(cart)).toBe(2 * 899 + 3 * 449);
    expect(itemCount([])).toBe(0);
    expect(subtotalZar([])).toBe(0);
  });

  it("writes the cart to its versioned localStorage key", () => {
    useCartStore.getState().addItem(line());

    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    expect(raw).toBeTruthy();
    const saved = JSON.parse(raw!);
    expect(saved.version).toBe(1);
    expect(saved.state.items).toHaveLength(1);
    expect(saved.state.items[0].artworkId).toBe("art-1");
  });
});
