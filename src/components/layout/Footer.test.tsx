import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Footer } from "./Footer";

describe("Footer", () => {
  it("points every link at a real route, never at a placeholder", () => {
    const { container } = render(<Footer />);

    const hrefs = Array.from(container.querySelectorAll("a")).map((a) =>
      a.getAttribute("href"),
    );

    expect(hrefs.length).toBeGreaterThan(0);
    // "#" is what the policy links carried while the pages did not exist. A
    // dead link in the footer is the first thing a payment provider's reviewer
    // clicks, so this assertion is the one that must never be relaxed.
    expect(hrefs).not.toContain("#");
    for (const href of hrefs) {
      expect(href).toBeTruthy();
      expect(href).not.toMatch(/^#/);
    }
  });

  it("links the four policy pages by name", () => {
    render(<Footer />);

    const expected = [
      ["Contact", "/contact"],
      ["Shipping & returns", "/shipping-and-returns"],
      ["Terms of sale", "/terms"],
      ["Privacy", "/privacy"],
    ] as const;

    for (const [label, href] of expected) {
      expect(screen.getByRole("link", { name: label })).toHaveAttribute(
        "href",
        href,
      );
    }
  });
});
