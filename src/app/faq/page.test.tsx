import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import FaqPage, { metadata } from "./page";
import { FAQS } from "@/lib/content";

describe("faq page metadata", () => {
  it("has a title, description and its own canonical", () => {
    expect(metadata.title).toBe("FAQ");
    expect(typeof metadata.description).toBe("string");
    expect(metadata.alternates?.canonical).toBe("/faq");
  });
});

describe("faq page content", () => {
  it("renders every shared FAQ question and answer, not a fork of the copy", () => {
    render(<FaqPage />);
    for (const { question, answer } of FAQS) {
      expect(screen.getByText(question)).toBeInTheDocument();
      expect(screen.getByText(answer)).toBeInTheDocument();
    }
  });

  it("emits FAQPage JSON-LD built from the same FAQS", () => {
    const { container } = render(<FaqPage />);
    const scripts = container.querySelectorAll(
      'script[type="application/ld+json"]',
    );

    const faqPage = Array.from(scripts)
      .map((el) => JSON.parse(el.textContent ?? "{}"))
      .find((node) => node["@type"] === "FAQPage");

    expect(faqPage).toBeDefined();
    expect(faqPage.mainEntity).toHaveLength(FAQS.length);
    expect(faqPage.mainEntity[0].name).toBe(FAQS[0].question);
    expect(faqPage.mainEntity[0].acceptedAnswer.text).toBe(FAQS[0].answer);
  });
});
