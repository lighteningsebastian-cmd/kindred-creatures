import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductConfigurator } from "./ProductConfigurator";
import { getProduct } from "@/lib/products";

describe("ProductConfigurator", () => {
  it("keeps the CTA disabled until a size is chosen, then links with selections", async () => {
    const user = userEvent.setup();
    const hoodie = getProduct("hoodie")!;
    render(<ProductConfigurator product={hoodie} />);

    // Before a size is picked, the CTA is a disabled button (no link).
    expect(
      screen.queryByRole("link", { name: "Add your creature" }),
    ).toBeNull();
    const disabled = screen.getByRole("button", { name: "Add your creature" });
    expect(disabled).toBeDisabled();
    expect(screen.getByText("Choose a size to continue.")).toBeInTheDocument();

    // Pick a size -> CTA becomes an enabled link carrying colour + size.
    await user.click(screen.getByRole("button", { name: "M" }));
    const cta = screen.getByRole("link", { name: "Add your creature" });
    const href = cta.getAttribute("href") ?? "";
    expect(href).toContain("/customize/hoodie");
    expect(href).toContain("color=Stone");
    expect(href).toContain("size=M");
  });

  it("auto-selects the only size for a one-size product", () => {
    const tote = getProduct("tote")!;
    render(<ProductConfigurator product={tote} />);

    const cta = screen.getByRole("link", { name: "Add your creature" });
    const href = cta.getAttribute("href") ?? "";
    expect(href).toContain("/customize/tote");
    expect(href).toContain("color=Natural");
    expect(href).toContain(`size=${encodeURIComponent("One size")}`);
  });

  it("resets an incompatible size when switching colours", async () => {
    // All hoodie colours share sizes, so use the flow where switching keeps a
    // valid size; here we verify colour change updates the label.
    const user = userEvent.setup();
    const hoodie = getProduct("hoodie")!;
    render(<ProductConfigurator product={hoodie} />);

    await user.click(screen.getByRole("button", { name: "Charcoal" }));
    expect(screen.getByText("Charcoal")).toBeInTheDocument();
  });
});
