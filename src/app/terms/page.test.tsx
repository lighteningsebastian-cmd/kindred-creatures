import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import TermsPage, { metadata } from "./page";
import {
  FREE_SHIPPING_THRESHOLD_ZAR,
  SHIPPING_FLAT_ZAR,
} from "@/lib/checkout";
import { PRODUCTS, formatZar, fromPriceZar } from "@/lib/products";

const text = () => render(<TermsPage />).container.textContent ?? "";

describe("terms page metadata", () => {
  it("has a title, description and its own canonical", () => {
    expect(metadata.title).toBe("Terms of sale");
    expect(typeof metadata.description).toBe("string");
    expect(metadata.alternates?.canonical).toBe("/terms");
  });
});

describe("terms page content", () => {
  it("states every price from the catalogue rather than a typed copy of it", () => {
    const body = text();
    for (const product of PRODUCTS) {
      expect(body).toContain(product.name);
      expect(body).toContain(formatZar(fromPriceZar(product)));
    }
  });

  it("states the shipping figures the checkout actually charges", () => {
    const body = text();
    expect(body).toContain(formatZar(SHIPPING_FLAT_ZAR));
    expect(body).toContain(formatZar(FREE_SHIPPING_THRESHOLD_ZAR));
  });

  it("describes the order as an agreement formed on payment, with approval before print", () => {
    const body = text();
    expect(body).toMatch(/Nothing is printed until you say yes/);
    expect(body).toMatch(/We accept your order when we confirm your payment/);
  });

  it("leaves the section 43 supplier disclosures as a visible gap", () => {
    const body = text();
    expect(body).toContain("TODO(owner)");
    expect(body).toMatch(/Electronic Communications and Transactions Act/);
    expect(body).toMatch(/registration number/i);
    expect(body).toMatch(/VAT/);
  });

  it("sends delivery and cancellation to the page that owns them", () => {
    const { container } = render(<TermsPage />);
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) =>
      a.getAttribute("href"),
    );
    expect(hrefs).toContain("/shipping-and-returns");
  });
});
