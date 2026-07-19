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

describe("ProductConfigurator", () => {
  it("prompts for a size until one is chosen, then reports the selection up", async () => {
    const user = userEvent.setup();
    const onSizeChange = vi.fn();
    const hoodie = getProduct("hoodie")!;
    render(<Harness product={hoodie} onSizeChange={onSizeChange} />);

    // Before a size is picked the panel says so; it holds no CTA of its own.
    expect(
      screen.getByText("Choose a size to start their portrait."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Start your portrait" }),
    ).toBeNull();

    await user.click(screen.getByRole("button", { name: "M" }));
    expect(onSizeChange).toHaveBeenCalledWith("M");
    expect(
      screen.queryByText("Choose a size to start their portrait."),
    ).toBeNull();
  });

  it("shows the only size as settled for a one-size product", () => {
    const tote = getProduct("tote")!;
    render(<Harness product={tote} />);

    // One-size settles from the start, so the prompt never appears.
    expect(
      screen.queryByText("Choose a size to start their portrait."),
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

    await user.click(screen.getByRole("button", { name: "Charcoal" }));
    expect(screen.getByText("Charcoal")).toBeInTheDocument();
  });
});
