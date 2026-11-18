import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductConfigurator } from "./ProductConfigurator";
import { getProduct, type Product, type Variant } from "@/lib/products";

/**
 * A stateful harness that owns colour/size the way {@link ProductFlow} does, so
 * the controlled panel can be driven in isolation. `onSizeChange` is spied so a
 * test can assert the panel reports selections up rather than holding them.
 */
function Harness({
  product,
  onSizeChange,
}: {
  product: Product;
  onSizeChange?: (size: string) => void;
}) {
  const [color, setColor] = useState<Variant>(product.variants[0]);
  const [size, setSize] = useState<string | null>(
    product.variants[0].sizes.length === 1
      ? product.variants[0].sizes[0]
      : null,
  );
  return (
    <ProductConfigurator
      product={product}
      color={color}
      size={size}
      onColorChange={(name) => {
        const next =
          product.variants.find((v) => v.color === name) ?? product.variants[0];
        setColor(next);
        if (next.sizes.length === 1) setSize(next.sizes[0]);
        else if (size !== null && !next.sizes.includes(size)) setSize(null);
      }}
      onSizeChange={(s) => {
        onSizeChange?.(s);
        setSize(s);
      }}
    />
  );
}

describe("ProductConfigurator and a garment cut two ways", () => {
  /*
   * Invisible until the catalogue splits, and wrong the moment it does. The
   * flow's colour handler resolves within the fit the page opened on, so a
   * swatch from the other fit is a control that does nothing when clicked, and
   * two Whites would light the selected ring on both at once. The panel has to
   * offer the colours the handler can actually honour.
   */
  const crewneck = getProduct("crewneck")!;
  const twoFits: Product = {
    ...crewneck,
    variants: [
      { ...crewneck.variants[0]!, fit: "womens" },
      { ...crewneck.variants[1]!, fit: "womens" },
      {
        ...crewneck.variants[2]!,
        fit: "mens",
        color: "White",
        photoDir: "mens/white",
      },
    ],
  };

  it("offers only the colours of the fit being shown", () => {
    render(<Harness product={twoFits} />);

    const swatches = screen
      .getAllByRole("button")
      .filter((button) => button.getAttribute("aria-label") !== null)
      .filter((button) => /^(White|Peach|Grey|Olive)$/.test(button.getAttribute("aria-label")!));

    expect(swatches.map((b) => b.getAttribute("aria-label"))).toEqual([
      "White",
      "Peach",
    ]);
  });
});

describe("ProductConfigurator", () => {
  it("prompts for a size until one is chosen, then reports the selection up", async () => {
    const user = userEvent.setup();
    const onSizeChange = vi.fn();
    const hoodie = getProduct("hoodie")!;
    render(<Harness product={hoodie} onSizeChange={onSizeChange} />);

    // Before a size is picked the panel says so; it holds no CTA of its own.
    expect(
      screen.getByText("Choose a size to carry on."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Start your portrait" }),
    ).toBeNull();

    await user.click(screen.getByRole("button", { name: "M" }));
    expect(onSizeChange).toHaveBeenCalledWith("M");
    expect(
      screen.queryByText("Choose a size to carry on."),
    ).toBeNull();
  });

  it("shows the only size as settled for a one-size product", () => {
    const tote = getProduct("tote")!;
    render(<Harness product={tote} />);

    // One-size settles from the start, so the prompt never appears.
    expect(
      screen.queryByText("Choose a size to carry on."),
    ).toBeNull();
    expect(screen.getByRole("button", { name: "One size" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("updates the colour label when a swatch is chosen", async () => {
    const user = userEvent.setup();
    const hoodie = getProduct("hoodie")!;
    render(<Harness product={hoodie} />);

    await user.click(screen.getByRole("button", { name: "Lilac" }));
    expect(screen.getByText("Lilac")).toBeInTheDocument();
  });
});
