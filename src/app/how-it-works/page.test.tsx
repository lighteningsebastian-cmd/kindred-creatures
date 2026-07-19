import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import HowItWorksPage, { metadata } from "./page";
import { FAQS, HOW_IT_WORKS_PAGE_STEPS } from "@/lib/content";
import { ART_STYLES, ART_STYLE_LABELS } from "@/lib/images/provider";

// next/image needs config it does not have in jsdom; the page only cares that an
// <img> (or, for the decorative shots, no accessible name) is present.
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt } = props as { src: string; alt: string };
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} />;
  },
}));

const ldNodes = (container: HTMLElement) =>
  Array.from(
    container.querySelectorAll('script[type="application/ld+json"]'),
  ).map((script) => JSON.parse(script.textContent ?? "{}"));

describe("how-it-works page metadata", () => {
  it("has a title, description and its own canonical", () => {
    expect(typeof metadata.title).toBe("string");
    expect((metadata.description as string).length).toBeGreaterThan(50);
    expect(metadata.alternates?.canonical).toBe("/how-it-works");
  });
});

describe("how-it-works trust page", () => {
  it("renders a level-1 heading and the how-it-works eyebrow", () => {
    render(<HowItWorksPage />);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getAllByText("How it works").length).toBeGreaterThan(0);
  });

  it("renders all four process steps in order, from the shared constant", () => {
    render(<HowItWorksPage />);
    expect(HOW_IT_WORKS_PAGE_STEPS).toHaveLength(4);
    for (const step of HOW_IT_WORKS_PAGE_STEPS) {
      expect(
        screen.getByRole("heading", { level: 2, name: step.title }),
      ).toBeInTheDocument();
    }
  });

  it("renders all three styles with their labels", () => {
    render(<HowItWorksPage />);
    expect(ART_STYLES).toHaveLength(3);
    for (const style of ART_STYLES) {
      expect(
        screen.getByRole("heading", { level: 3, name: ART_STYLE_LABELS[style] }),
      ).toBeInTheDocument();
    }
  });

  it("renders the three process FAQ entries verbatim from FAQS", () => {
    render(<HowItWorksPage />);
    const questions = [
      "How good does my photo need to be?",
      "What if I do not like the artwork?",
      "How long until it arrives?",
    ];
    for (const question of questions) {
      const entry = FAQS.find((faq) => faq.question === question);
      expect(entry, `FAQS is missing "${question}"`).toBeDefined();
      expect(screen.getByRole("heading", { name: question })).toBeInTheDocument();
      expect(screen.getByText(entry!.answer)).toBeInTheDocument();
    }
  });

  it("sends the primary CTA into the product flow", () => {
    render(<HowItWorksPage />);
    const cta = screen.getByRole("link", { name: "Start your portrait" });
    expect(cta).toHaveAttribute("href", "/products/hoodie");
  });

  it("emits HowTo structured data from the four page steps", () => {
    const { container } = render(<HowItWorksPage />);
    const howTo = ldNodes(container).find((n) => n["@type"] === "HowTo");
    expect(howTo).toBeDefined();
    expect(howTo.step).toHaveLength(4);
    expect(howTo.step.map((s: { name: string }) => s.name)).toEqual(
      HOW_IT_WORKS_PAGE_STEPS.map((step) => step.title),
    );
    expect(howTo.step[0].text).toBe(HOW_IT_WORKS_PAGE_STEPS[0].body);
  });

  it("emits FAQPage structured data from the same three FAQ entries", () => {
    const { container } = render(<HowItWorksPage />);
    const faqPage = ldNodes(container).find((n) => n["@type"] === "FAQPage");
    expect(faqPage).toBeDefined();
    expect(faqPage.mainEntity).toHaveLength(3);
    expect(faqPage.mainEntity.map((q: { name: string }) => q.name)).toEqual([
      "How good does my photo need to be?",
      "What if I do not like the artwork?",
      "How long until it arrives?",
    ]);
  });
});
