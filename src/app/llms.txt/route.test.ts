import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PRODUCTS } from "@/lib/products";
import { GET } from "./route";

const BASE = "https://kindredcreatures.co.za";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", BASE);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const read = async () => {
  const response = GET();
  return { response, text: await response.text() };
};

describe("GET /llms.txt", () => {
  it("responds 200 as plain text", async () => {
    const { response } = await read();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "text/plain; charset=utf-8",
    );
  });

  it("says who we are and what we sell", async () => {
    const { text } = await read();
    expect(text).toContain("# Kindred Creatures");
    expect(text).toContain("custom pet portrait apparel");
  });

  it("says where we print and how long delivery takes", async () => {
    const { text } = await read();
    expect(text).toContain("Jeffreys Bay");
    expect(text).toContain("7 to 10 working days");
    expect(text).toContain("South Africa");
  });

  it("quotes real prices in rands, read from the catalogue", async () => {
    const { text } = await read();
    // The full range, cheapest to dearest, plus a per-product "from" price.
    expect(text).toContain("R 349 to R 999");
    for (const product of PRODUCTS) {
      expect(text).toContain(product.name);
    }
  });

  it("states the real shipping rule", async () => {
    const { text } = await read();
    expect(text).toContain("R 99");
    expect(text).toContain("R 1 000");
  });

  it("links to the homepage and every product page", async () => {
    const { text } = await read();
    expect(text).toContain(`(${BASE})`);
    for (const product of PRODUCTS) {
      expect(text).toContain(`${BASE}/products/${product.slug}`);
    }
  });

  it("links to no private route", async () => {
    const { text } = await read();
    for (const path of ["/admin", "/order/", "/cart", "/checkout", "/dev/"]) {
      expect(text).not.toContain(`${BASE}${path}`);
    }
  });

  it("invents no reviews or ratings", async () => {
    const { text } = await read();
    expect(text.toLowerCase()).not.toContain("rating");
    expect(text.toLowerCase()).not.toContain("5 stars");
  });

  it("contains no em or en dashes", async () => {
    const { text } = await read();
    // Escaped rather than literal so this assertion does not itself trip the
    // repo-wide grep for en/em dashes in src.
    expect(text).not.toMatch(/[\u2013\u2014]/);
  });
});
