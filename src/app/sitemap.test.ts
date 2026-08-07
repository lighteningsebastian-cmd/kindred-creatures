import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PRODUCTS } from "@/lib/products";
import sitemap, { STATIC_ROUTES } from "./sitemap";

const BASE = "https://kindredcreatures.co.za";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", BASE);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const urls = () => sitemap().map((entry) => entry.url);

describe("sitemap", () => {
  it("lists the homepage at the origin, with no trailing slash", () => {
    expect(urls()).toContain(BASE);
  });

  it("lists all four products, generated from the catalogue", () => {
    expect(PRODUCTS).toHaveLength(4);
    for (const product of PRODUCTS) {
      expect(urls()).toContain(`${BASE}/products/${product.slug}`);
    }
  });

  it("lists the shop catalogue page", () => {
    expect(urls()).toContain(`${BASE}/shop`);
  });

  it("lists the how-it-works trust page", () => {
    // Its full page (P3) carries HowTo + FAQ structured data and earns a place.
    expect(urls()).toContain(`${BASE}/how-it-works`);
  });

  it("lists the S10 content pages", () => {
    for (const path of ["/about", "/faq", "/journal"]) {
      expect(urls()).toContain(`${BASE}${path}`);
    }
  });

  it("lists the policy pages", () => {
    for (const path of [
      "/contact",
      "/shipping-and-returns",
      "/terms",
      "/privacy",
    ]) {
      expect(urls()).toContain(`${BASE}${path}`);
    }
  });

  it("lists nothing but the homepage, shop, how-it-works, content pages, policy pages and the products", () => {
    expect(urls().sort()).toEqual(
      [
        BASE,
        `${BASE}/shop`,
        `${BASE}/how-it-works`,
        `${BASE}/about`,
        `${BASE}/faq`,
        `${BASE}/journal`,
        `${BASE}/contact`,
        `${BASE}/shipping-and-returns`,
        `${BASE}/terms`,
        `${BASE}/privacy`,
        ...PRODUCTS.map((p) => `${BASE}/products/${p.slug}`),
      ].sort(),
    );
  });

  it("excludes every private, per-visitor and internal route", () => {
    const listed = urls().join("\n");
    for (const path of [
      "/admin",
      "/order",
      "/cart",
      "/checkout",
      "/dev",
      "/api",
      "/customize",
    ]) {
      expect(listed).not.toContain(path);
    }
  });

  it("promises no page that does not exist", () => {
    // The guard on the S10 seam in sitemap.ts: adding /about, /faq or /journal
    // here before the page file lands fails this rather than teaching a crawler
    // that our sitemap 404s.
    const appDir = resolve(process.cwd(), "src/app");
    for (const route of STATIC_ROUTES) {
      const segment = route.path === "/" ? "." : `.${route.path}`;
      const dir = resolve(appDir, segment);
      const exists =
        existsSync(resolve(dir, "page.tsx")) ||
        existsSync(resolve(dir, "page.ts"));
      expect(exists, `no page file for sitemap route "${route.path}"`).toBe(
        true,
      );
    }
  });

  it("carries a lastModified and a priority on every entry", () => {
    for (const entry of sitemap()) {
      expect(entry.lastModified).toBeInstanceOf(Date);
      expect(entry.priority).toBeGreaterThan(0);
      expect(entry.changeFrequency).toBeTruthy();
    }
  });

  it("ranks the homepage above the product pages", () => {
    const home = sitemap().find((entry) => entry.url === BASE);
    const product = sitemap().find((entry) =>
      entry.url.includes("/products/"),
    );
    expect(home?.priority).toBeGreaterThan(product?.priority ?? 1);
  });
});
