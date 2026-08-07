import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import ShippingAndReturnsPage, { metadata } from "./page";
import {
  FREE_SHIPPING_THRESHOLD_ZAR,
  SHIPPING_FLAT_ZAR,
} from "@/lib/checkout";
import { formatZar } from "@/lib/products";

const text = () =>
  render(<ShippingAndReturnsPage />).container.textContent ?? "";

describe("shipping and returns page metadata", () => {
  it("has a title, description and its own canonical", () => {
    expect(metadata.title).toBe("Shipping & returns");
    expect(typeof metadata.description).toBe("string");
    expect(metadata.alternates?.canonical).toBe("/shipping-and-returns");
  });
});

describe("shipping and returns page content", () => {
  it("states the delivery window, measured from approval", () => {
    const body = text();
    expect(body).toMatch(/7 to 10 working days/);
    expect(body).toMatch(/clock starts on your yes/i);
  });

  it("states the shipping figures the checkout actually charges", () => {
    const body = text();
    expect(body).toContain(formatZar(SHIPPING_FLAT_ZAR));
    expect(body).toContain(formatZar(FREE_SHIPPING_THRESHOLD_ZAR));
  });

  it("promises what we know we will do", () => {
    const body = text();
    // Approval before printing, rework without a counter, then a person, and a
    // replacement for anything that arrives damaged or wrong.
    expect(body).toMatch(/Nothing is printed until you approve/);
    expect(body).toMatch(/a person here takes it on personally/);
    expect(body).toMatch(/We replace it/);
  });

  it("never shows the customer a revision count", () => {
    const body = text();
    // docs/spec-pipeline.md section 7: a visible limit turns a service into a
    // ration. The page describes the ladder without ever numbering it.
    expect(body).not.toMatch(/two revisions|2 revisions|revisions remaining/i);
  });

  it("states no legal position on cancelling, and asks the question instead", () => {
    const body = text();
    expect(body).toContain("TODO(owner)");
    expect(body).toMatch(/cooling-off/);
    expect(body).toMatch(/South African commercial attorney/);
    // The page must not claim an outcome either way.
    expect(body).not.toMatch(/you have no right to cancel|are exempt from/i);
  });
});
