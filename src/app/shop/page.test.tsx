import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ShopPage, { metadata } from "./page";
import { PRODUCTS, fromPriceZar, formatZar } from "@/lib/products";

describe("shop page metadata", () => {
  it("has a title, description and its own canonical", () => {
    expect(typeof metadata.title).toBe("string");
    expect((metadata.description as string).length).toBeGreaterThan(50);
    expect(metadata.alternates?.canonical).toBe("/shop");
  });
});

describe("shop page catalogue", () => {
  it("renders a level-1 heading and the range eyebrow", () => {
    render(<ShopPage />);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByText("The range")).toBeInTheDocument();
  });

  it("renders all four products, each with its name and 'from' price", () => {
    render(<ShopPage />);
    expect(PRODUCTS).toHaveLength(4);

    for (const product of PRODUCTS) {
      const heading = screen.getByRole("heading", {
        level: 2,
        name: product.name,
      });
      expect(heading).toBeInTheDocument();

      const price = formatZar(fromPriceZar(product));
      expect(screen.getByText(price)).toBeInTheDocument();
    }
  });

  it("gives every product a Personalise CTA to its product page", () => {
    render(<ShopPage />);
    const ctas = screen.getAllByRole("link", { name: "Personalise" });
    expect(ctas).toHaveLength(4);

    const hrefs = ctas.map((cta) => cta.getAttribute("href")).sort();
    expect(hrefs).toEqual(
      PRODUCTS.map((p) => `/products/${p.slug}`).sort(),
    );
  });

  it("shows the colours each product comes in", () => {
    render(<ShopPage />);
    for (const product of PRODUCTS) {
      const colours = product.variants.map((v) => v.color).join(", ");
      expect(
        screen.getByRole("img", { name: `Available in ${colours}` }),
      ).toBeInTheDocument();
    }
  });

  it("offers a start-from-a-photo route into the product flow", () => {
    render(<ShopPage />);
    // One start-intent label site-wide: the start-from-photo band and the
    // closing CTA both carry "Start your portrait" into the hoodie flow.
    const starts = screen.getAllByRole("link", { name: "Start your portrait" });
    expect(starts.length).toBeGreaterThan(0);
    for (const start of starts) {
      expect(start).toHaveAttribute("href", "/products/hoodie");
    }
  });

  it("emits ItemList structured data for the four products in ZAR", () => {
    const { container } = render(<ShopPage />);
    const script = container.querySelector(
      'script[type="application/ld+json"]',
    );
    expect(script).not.toBeNull();

    const data = JSON.parse(script!.textContent ?? "{}");
    expect(data["@type"]).toBe("ItemList");
    expect(data.numberOfItems).toBe(4);
    expect(data.itemListElement).toHaveLength(4);

    const first = data.itemListElement[0].item;
    expect(first["@type"]).toBe("Product");
    expect(first.offers.priceCurrency).toBe("ZAR");
  });
});
