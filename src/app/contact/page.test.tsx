import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import ContactPage, { metadata } from "./page";
import { BRAND_EMAIL } from "@/lib/seo/site";

const text = () => render(<ContactPage />).container.textContent ?? "";

describe("contact page metadata", () => {
  it("has a title, description and its own canonical", () => {
    expect(metadata.title).toBe("Contact");
    expect(typeof metadata.description).toBe("string");
    expect(metadata.alternates?.canonical).toBe("/contact");
  });
});

describe("contact page content", () => {
  it("shows the one address a person answers", () => {
    const { container } = render(<ContactPage />);
    expect(
      container.querySelector(`a[href="mailto:${BRAND_EMAIL}"]`),
    ).toBeInTheDocument();
    expect(container.textContent).toContain(BRAND_EMAIL);
  });

  it("sends an existing order to the lookup and the account", () => {
    const { container } = render(<ContactPage />);
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) =>
      a.getAttribute("href"),
    );
    expect(hrefs).toContain("/order-lookup");
    expect(hrefs).toContain("/account");
  });

  it("says where we are, and leaves the address it cannot know as a gap", () => {
    const body = text();
    expect(body).toMatch(/Jeffreys Bay/);
    expect(body).toContain("TODO(owner)");
    expect(body).toMatch(/physical address/i);
  });
});
