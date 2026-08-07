import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import PrivacyPage, { metadata } from "./page";
import { BRAND_EMAIL } from "@/lib/seo/site";

const text = () => render(<PrivacyPage />).container.textContent ?? "";

describe("privacy page metadata", () => {
  it("has a title, description and its own canonical", () => {
    expect(metadata.title).toBe("Privacy");
    expect(typeof metadata.description).toBe("string");
    expect(metadata.alternates?.canonical).toBe("/privacy");
  });
});

describe("privacy page content", () => {
  it("answers the four POPIA questions: what, why, how long, and who else", () => {
    const body = text();
    expect(body).toContain("Protection of Personal Information Act");
    expect(body).toMatch(/What we collect, and why/);
    expect(body).toMatch(/Who else sees it/);
    expect(body).toMatch(/How long we keep it/);
    expect(body).toMatch(/What you can ask us for/);
  });

  it("names every recipient the code actually hands data to", () => {
    const body = text();
    // job-sheet.ts sends name, address and phone to the print shop; PayFast
    // takes the money; the courier delivers; email, storage and the image
    // service are the operators behind the rest of the pipeline.
    expect(body).toContain("PayFast");
    expect(body).toMatch(/print shop in Jeffreys Bay/);
    expect(body).toMatch(/courier/i);
    expect(body).toMatch(/outside South Africa/);
  });

  it("says plainly that we never hold a card", () => {
    expect(text()).toMatch(/never see your card/i);
  });

  it("gives one address for every request, correction and deletion", () => {
    const { container } = render(<PrivacyPage />);
    const mailto = Array.from(container.querySelectorAll("a")).filter((a) =>
      a.getAttribute("href")?.startsWith("mailto:"),
    );
    expect(mailto.length).toBeGreaterThan(0);
    for (const link of mailto) {
      expect(link).toHaveAttribute("href", `mailto:${BRAND_EMAIL}`);
    }
  });

  it("leaves the unanswerable questions as visible gaps, not as invented facts", () => {
    const body = text();
    expect(body).toContain("TODO(owner)");
    // The four that must not be guessed. If a later pass fills these in with
    // something plausible-looking, this is the test that should have to change.
    expect(body).toMatch(/registration number/i);
    expect(body).toMatch(/Information Officer/);
  });
});
