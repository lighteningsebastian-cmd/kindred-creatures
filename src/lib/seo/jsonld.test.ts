import { describe, it, expect } from "vitest";
import { FAQS, HOW_IT_WORKS_STEPS } from "@/lib/content";
import { PRODUCTS, getProduct } from "@/lib/products";
import {
  buildBreadcrumbList,
  buildFaqPage,
  buildHowTo,
  buildItemList,
  buildOrganization,
  buildProduct,
  buildWebSite,
  organizationId,
} from "./jsonld";
import { fromPriceZar } from "@/lib/products";

const BASE = "https://kindredcreatures.co.za";

const hoodie = getProduct("hoodie")!;

describe("buildOrganization", () => {
  it("emits the required fields and locates us in South Africa", () => {
    const org = buildOrganization({
      baseUrl: BASE,
      name: "Kindred Creatures",
      email: "hello@kindredcreatures.co.za",
    });

    expect(org["@context"]).toBe("https://schema.org");
    expect(org["@type"]).toBe("Organization");
    expect(org.name).toBe("Kindred Creatures");
    expect(org.url).toBe(BASE);
    expect(org["@id"]).toBe(`${BASE}/#organization`);
    expect(org.address).toMatchObject({
      addressLocality: "Cape Town",
      addressCountry: "ZA",
    });
    expect(org.contactPoint).toMatchObject({
      email: "hello@kindredcreatures.co.za",
    });
  });

  it("omits logo and sameAs rather than inventing them", () => {
    const org = buildOrganization({
      baseUrl: BASE,
      name: "Kindred Creatures",
      email: "hello@kindredcreatures.co.za",
    });

    expect(org).not.toHaveProperty("logo");
    expect(org).not.toHaveProperty("sameAs");
  });

  it("includes logo and sameAs once they are real", () => {
    const org = buildOrganization({
      baseUrl: BASE,
      name: "Kindred Creatures",
      email: "hello@kindredcreatures.co.za",
      logoUrl: `${BASE}/logo.png`,
      sameAs: ["https://www.instagram.com/example"],
    });

    expect(org.logo).toBe(`${BASE}/logo.png`);
    expect(org.sameAs).toEqual(["https://www.instagram.com/example"]);
  });

  it("refuses a blank name, a blank email and a relative base URL", () => {
    const valid = {
      baseUrl: BASE,
      name: "Kindred Creatures",
      email: "hello@kindredcreatures.co.za",
    };
    expect(() => buildOrganization({ ...valid, name: "  " })).toThrow(/name/);
    expect(() => buildOrganization({ ...valid, email: "" })).toThrow(/email/);
    expect(() => buildOrganization({ ...valid, baseUrl: "/site" })).toThrow(
      /absolute URL/,
    );
  });

  it("trims a trailing slash off the base URL", () => {
    const org = buildOrganization({
      baseUrl: `${BASE}/`,
      name: "Kindred Creatures",
      email: "hello@kindredcreatures.co.za",
    });
    expect(org.url).toBe(BASE);
    expect(organizationId(`${BASE}/`)).toBe(`${BASE}/#organization`);
  });
});

describe("buildWebSite", () => {
  it("points its publisher at the organization node", () => {
    const site = buildWebSite({ baseUrl: BASE, name: "Kindred Creatures" });
    expect(site["@type"]).toBe("WebSite");
    expect(site.url).toBe(BASE);
    expect(site.inLanguage).toBe("en-ZA");
    expect(site.publisher).toEqual({ "@id": `${BASE}/#organization` });
  });
});

describe("buildProduct", () => {
  it("emits the required Product fields", () => {
    const node = buildProduct({
      baseUrl: BASE,
      product: hoodie,
      images: [`${BASE}/hoodie.jpg`],
    });

    expect(node["@context"]).toBe("https://schema.org");
    expect(node["@type"]).toBe("Product");
    expect(node.name).toBe(hoodie.name);
    expect(node.description).toBe(hoodie.blurb);
    expect(node.image).toEqual([`${BASE}/hoodie.jpg`]);
    expect(node.url).toBe(`${BASE}/products/hoodie`);
    expect(node.brand).toEqual({ "@id": `${BASE}/#organization` });
  });

  it("quotes an Offer in whole rands, defaulting to the cheapest variant", () => {
    const node = buildProduct({
      baseUrl: BASE,
      product: hoodie,
      images: [`${BASE}/hoodie.jpg`],
    });
    const offer = node.offers as Record<string, unknown>;

    expect(offer["@type"]).toBe("Offer");
    expect(offer.priceCurrency).toBe("ZAR");
    expect(offer.price).toBe(899);
    expect(typeof offer.price).toBe("number");
    expect(offer.availability).toBe("https://schema.org/InStock");
  });

  it("quotes the variant it is handed", () => {
    const tee = getProduct("tee")!;
    const node = buildProduct({
      baseUrl: BASE,
      product: tee,
      images: [`${BASE}/tee.jpg`],
      variant: tee.variants[0],
    });
    const offer = node.offers as Record<string, unknown>;
    expect(offer.price).toBe(tee.variants[0].priceZar);
    expect(offer.priceCurrency).toBe("ZAR");
  });

  it("prices every product in the catalogue in ZAR at its 'from' price", () => {
    for (const product of PRODUCTS) {
      const node = buildProduct({
        baseUrl: BASE,
        product,
        images: [`${BASE}/${product.slug}.jpg`],
      });
      const offer = node.offers as Record<string, unknown>;
      const cheapest = Math.min(...product.variants.map((v) => v.priceZar));

      expect(offer.priceCurrency).toBe("ZAR");
      expect(offer.price).toBe(cheapest);
      expect(Number.isInteger(offer.price)).toBe(true);
    }
  });

  it("promises delivery to South Africa in the real five working days", () => {
    const node = buildProduct({
      baseUrl: BASE,
      product: hoodie,
      images: [`${BASE}/hoodie.jpg`],
    });
    const offer = node.offers as Record<string, unknown>;
    const shipping = offer.shippingDetails as Record<string, unknown>;
    const destination = shipping.shippingDestination as Record<string, unknown>;
    const deliveryTime = shipping.deliveryTime as Record<string, unknown>;
    const transit = deliveryTime.transitTime as Record<string, unknown>;

    expect(destination.addressCountry).toBe("ZA");
    expect(transit.minValue).toBe(5);
    expect(transit.maxValue).toBe(5);
    expect(transit.unitCode).toBe("DAY");
  });

  it("never fabricates ratings or reviews", () => {
    for (const product of PRODUCTS) {
      const node = buildProduct({
        baseUrl: BASE,
        product,
        images: [`${BASE}/${product.slug}.jpg`],
      });
      const serialised = JSON.stringify(node);

      expect(node).not.toHaveProperty("aggregateRating");
      expect(node).not.toHaveProperty("review");
      expect(serialised).not.toContain("aggregateRating");
      expect(serialised).not.toContain("Review");
      expect(serialised).not.toContain("ratingValue");
    }
  });

  it("refuses images that are not absolute URLs", () => {
    expect(() =>
      buildProduct({ baseUrl: BASE, product: hoodie, images: ["/hoodie.jpg"] }),
    ).toThrow(/absolute URL/);
  });

  it("omits the image field when no photography is supplied", () => {
    // Real product photography does not exist yet: the storefront renders
    // hatched PhotoFrame placeholders, so an honest Product omits `image`
    // rather than fabricating a URL. schema.org permits a Product with no image.
    const omitted = buildProduct({ baseUrl: BASE, product: hoodie });
    expect(omitted).not.toHaveProperty("image");

    const empty = buildProduct({ baseUrl: BASE, product: hoodie, images: [] });
    expect(empty).not.toHaveProperty("image");

    // The other required fields still ship, so absence of image is not a broken node.
    expect(omitted.name).toBe(hoodie.name);
    expect(omitted.offers).toBeDefined();
  });

  it("refuses a non-positive price", () => {
    expect(() =>
      buildProduct({
        baseUrl: BASE,
        product: { ...hoodie, variants: [{ ...hoodie.variants[0], priceZar: 0 }] },
        images: [`${BASE}/hoodie.jpg`],
      }),
    ).toThrow(/price/);
  });
});

describe("buildItemList", () => {
  it("lists every catalogue product as a ListItem, numbered from one", () => {
    const node = buildItemList({ baseUrl: BASE, products: PRODUCTS });
    const items = node.itemListElement as Array<Record<string, unknown>>;

    expect(node["@context"]).toBe("https://schema.org");
    expect(node["@type"]).toBe("ItemList");
    expect(node.numberOfItems).toBe(4);
    expect(items).toHaveLength(4);
    expect(items.map((item) => item.position)).toEqual([1, 2, 3, 4]);
  });

  it("prices each product from its cheapest variant in ZAR", () => {
    const node = buildItemList({ baseUrl: BASE, products: PRODUCTS });
    const items = node.itemListElement as Array<Record<string, unknown>>;

    items.forEach((item, index) => {
      const product = PRODUCTS[index];
      const embedded = item.item as Record<string, unknown>;
      const offer = embedded.offers as Record<string, unknown>;

      expect(embedded["@type"]).toBe("Product");
      expect(embedded.name).toBe(product.name);
      expect(embedded.url).toBe(`${BASE}/products/${product.slug}`);
      expect(offer.priceCurrency).toBe("ZAR");
      expect(offer.price).toBe(fromPriceZar(product));
      expect(Number.isInteger(offer.price)).toBe(true);
    });
  });

  it("points each product's brand at the organization node", () => {
    const node = buildItemList({ baseUrl: BASE, products: PRODUCTS });
    const items = node.itemListElement as Array<Record<string, unknown>>;
    const first = (items[0].item as Record<string, unknown>).brand;
    expect(first).toEqual({ "@id": `${BASE}/#organization` });
  });

  it("carries an optional collection name when given one", () => {
    const named = buildItemList({
      baseUrl: BASE,
      products: PRODUCTS,
      name: "The Kindred Creatures range",
    });
    expect(named.name).toBe("The Kindred Creatures range");

    const unnamed = buildItemList({ baseUrl: BASE, products: PRODUCTS });
    expect(unnamed).not.toHaveProperty("name");
  });

  it("never fabricates ratings or reviews", () => {
    const node = buildItemList({ baseUrl: BASE, products: PRODUCTS });
    const serialised = JSON.stringify(node);
    expect(serialised).not.toContain("aggregateRating");
    expect(serialised).not.toContain("Review");
    expect(serialised).not.toContain("ratingValue");
  });

  it("refuses an empty product list and a relative base URL", () => {
    expect(() => buildItemList({ baseUrl: BASE, products: [] })).toThrow(
      /products/,
    );
    expect(() =>
      buildItemList({ baseUrl: "/shop", products: PRODUCTS }),
    ).toThrow(/absolute URL/);
  });

  it("refuses a non-positive price", () => {
    const broken = {
      ...hoodie,
      variants: [{ ...hoodie.variants[0], priceZar: 0 }],
    };
    expect(() =>
      buildItemList({ baseUrl: BASE, products: [broken] }),
    ).toThrow(/price/);
  });
});

describe("buildFaqPage", () => {
  it("carries every real FAQ as a Question with an accepted Answer", () => {
    const node = buildFaqPage(FAQS);
    const questions = node.mainEntity as Array<Record<string, unknown>>;

    expect(node["@type"]).toBe("FAQPage");
    expect(questions).toHaveLength(FAQS.length);

    questions.forEach((question, index) => {
      expect(question["@type"]).toBe("Question");
      expect(question.name).toBe(FAQS[index].question);
      expect(question.acceptedAnswer).toEqual({
        "@type": "Answer",
        text: FAQS[index].answer,
      });
    });
  });

  it("answers the queries we want to be found for", () => {
    const answers = FAQS.map((faq) => faq.answer.toLowerCase()).join(" ");
    // A person or a model reading the FAQ should be able to lift where we print
    // and how long it takes without going anywhere else.
    expect(answers).toContain("cape town");
    expect(answers).toContain("five working days");
    expect(answers).toContain("hoodie");
  });

  it("refuses an empty FAQ list or a blank answer", () => {
    expect(() => buildFaqPage([])).toThrow(/faqs/);
    expect(() =>
      buildFaqPage([{ question: "Why?", answer: "" }]),
    ).toThrow(/answer/);
  });
});

describe("buildHowTo", () => {
  it("emits the real steps in order", () => {
    const node = buildHowTo({
      name: "How it works",
      description: "Upload, approve, unbox.",
      steps: HOW_IT_WORKS_STEPS,
    });
    const steps = node.step as Array<Record<string, unknown>>;

    expect(node["@type"]).toBe("HowTo");
    expect(node.totalTime).toBe("P5D");
    expect(steps).toHaveLength(3);
    expect(steps.map((step) => step.name)).toEqual([
      "Upload",
      "Approve",
      "Unbox",
    ]);
    expect(steps.map((step) => step.position)).toEqual([1, 2, 3]);
    expect(steps[0].text).toBe(HOW_IT_WORKS_STEPS[0].body);
  });

  it("refuses a nameless HowTo or an empty step list", () => {
    expect(() =>
      buildHowTo({ name: "", description: "x", steps: HOW_IT_WORKS_STEPS }),
    ).toThrow(/name/);
    expect(() =>
      buildHowTo({ name: "x", description: "x", steps: [] }),
    ).toThrow(/steps/);
  });
});

describe("buildBreadcrumbList", () => {
  it("numbers the trail from one and resolves each item absolutely", () => {
    const node = buildBreadcrumbList(BASE, [
      { name: "Kindred Creatures", path: "/" },
      { name: hoodie.name, path: "/products/hoodie" },
    ]);
    const items = node.itemListElement as Array<Record<string, unknown>>;

    expect(node["@type"]).toBe("BreadcrumbList");
    expect(items[0]).toMatchObject({ position: 1, item: `${BASE}/` });
    expect(items[1]).toMatchObject({
      position: 2,
      name: hoodie.name,
      item: `${BASE}/products/hoodie`,
    });
  });

  it("refuses an empty trail", () => {
    expect(() => buildBreadcrumbList(BASE, [])).toThrow(/items/);
  });
});
