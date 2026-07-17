import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import robots from "./robots";

const BASE = "https://kindredcreatures.co.za";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", BASE);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const rules = () => {
  const rule = robots().rules;
  if (Array.isArray(rule)) throw new Error("expected a single rule block");
  return rule;
};

describe("robots", () => {
  it("lets every crawler have the public site", () => {
    expect(rules().userAgent).toBe("*");
    expect(rules().allow).toBe("/");
  });

  it("disallows the admin dashboard and its login", () => {
    const disallow = rules().disallow as string[];
    expect(disallow).toContain("/admin");
    expect(disallow).toContain("/admin/login");
    expect(disallow).toContain("/admin/orders/");
  });

  it("disallows customer order pages, which are private to one person", () => {
    expect(rules().disallow as string[]).toContain("/order/");
  });

  it("disallows the cart, the checkout, the dev pages and the API", () => {
    const disallow = rules().disallow as string[];
    expect(disallow).toContain("/cart");
    expect(disallow).toContain("/checkout");
    expect(disallow).toContain("/dev/");
    expect(disallow).toContain("/api/");
  });

  it("does not disallow the pages we want indexed", () => {
    const disallow = rules().disallow as string[];
    for (const path of ["/products", "/products/hoodie"]) {
      expect(disallow).not.toContain(path);
    }
  });

  it("leaves /customize crawlable so its noindex can be read", () => {
    // Blocking it in robots.txt would stop a crawler fetching the page, and a
    // page that is never fetched never has its noindex seen.
    expect(rules().disallow as string[]).not.toContain("/customize/");
  });

  it("points at the sitemap on the configured origin", () => {
    expect(robots().sitemap).toBe(`${BASE}/sitemap.xml`);
  });
});
