import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ShopPage, { metadata } from "./page";
import {
  PRODUCTS,
  fromPriceZar,
  formatZar,
  fitsFor,
  getProduct,
  hasFitChoice,
} from "@/lib/products";

describe("shop page, one card per garment and fit", () => {
  /*
   * A CARD IS A GARMENT IN A FIT, not a product. The men's and the women's
   * crewneck are different garments at different prices behind different
   * photographs, so one card for both would have to choose whose picture to
   * show and whose price to quote. Today every product has one fit and this
   * renders exactly what it rendered before.
   */
  it("renders one card per product and fit", () => {
    render(<ShopPage />);
    const cards = screen.getAllByRole("link", { name: "Personalise" });
    expect(cards).toHaveLength(
      PRODUCTS.flatMap((product) => fitsFor(product)).length,
    );
  });

  it("states a fit on every garment, and none on the tote", () => {
    // A bag has no cut. "Unisex fit" under "Sizes One size" is a line that
    // decides nothing, and the card used to leave it off.
    render(<ShopPage />);
    expect(screen.getAllByText("Unisex fit")).toHaveLength(
      PRODUCTS.filter(
        (product) =>
          product.slug !== "tote" && fitsFor(product).includes("unisex"),
      ).length,
    );
  });

  it("carries the fit in the link only where a product has a choice", () => {
    // No point in a query parameter that can only have one value, and every
    // one of them is a URL that has to be worth indexing.
    render(<ShopPage />);
    for (const link of screen.getAllByRole("link", { name: "Personalise" })) {
      const href = link.getAttribute("href")!;
      const slug = href.split("?")[0]!.replace("/products/", "");
      expect(href.includes("?fit="), href).toBe(
        hasFitChoice(getProduct(slug)!),
      );
    }
  });
});

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

  it("shows real photography for the three shot garments, several aspects each", () => {
    render(<ShopPage />);
    // The hoodie leads on its Blue back, which is the plate: the product.
    expect(
      screen.getByAltText(
        "The Kindred hoodie in Blue from the back, printed with a companion profile plate",
      ),
    ).toBeInTheDocument();

    // One aspect group per photographed garment, each named after the garment
    // so that three sets of dots on one page are told apart.
    for (const name of ["Hoodie", "Tee", "Crewneck"]) {
      expect(
        screen.getByRole("group", {
          name: `Which aspect of The Kindred ${name} to show`,
        }),
        name,
      ).toBeInTheDocument();
    }
  });

  it("has a photograph for every card, with no hatched frame left", () => {
    render(<ShopPage />);
    // The tote was the last placeholder on this page; its shoot landed on
    // 11 September. The frame is kept in CatalogueCard as the guard for a
    // product added ahead of its photography, so this asserts the ABSENCE of
    // the caption rather than its removal from the component.
    expect(
      screen.queryByText(/flatlay: the natural canvas kindred tote/i),
    ).not.toBeInTheDocument();
  });

  it("names the demo companion as a stand-in, once, beneath the grid", () => {
    render(<ShopPage />);
    // Every card shows the same example dog. Saying so four times is noise;
    // not saying it is a claim about an animal that is not the customer's.
    const disclosures = screen.getAllByText(
      /The illustration shown is a German Shepherd example/i,
    );
    expect(disclosures).toHaveLength(1);
  });

  it("never nests a button inside an anchor", () => {
    // GarmentShots' aspect dots are <button>s. If a card's photo ever moved
    // back inside its <Link>, this would be invalid HTML and the dots would
    // stop working: the anchor swallows the click before the button sees it.
    const { container } = render(<ShopPage />);
    expect(container.querySelector("a button")).toBeNull();
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

describe("shop page zoom", () => {
  it("lets every photographed card open its print", () => {
    // All four now. The tote was the exception until its shoot landed.
    render(<ShopPage />);
    expect(screen.getAllByRole("button", { name: /enlarge/i })).toHaveLength(4);
  });

  it("opens on the back plate, which is the view a card leads with", async () => {
    const user = userEvent.setup();
    render(<ShopPage />);

    await user.click(
      screen.getAllByRole("button", { name: /enlarge/i })[0]!,
    );

    expect(screen.getByRole("dialog")).toHaveAccessibleName(
      /from the back, printed with a companion profile plate/i,
    );
  });
});
