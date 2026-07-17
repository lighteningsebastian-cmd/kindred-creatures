import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AboutPage, { metadata } from "./page";

// next/image needs a loader/config it does not have in jsdom; the page only
// cares that an <img> with the right alt is present.
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt } = props as { src: string; alt: string };
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} />;
  },
}));

describe("about page metadata", () => {
  it("has a title, description and its own canonical", () => {
    expect(metadata.title).toBe("Our story");
    expect(typeof metadata.description).toBe("string");
    expect((metadata.description as string).length).toBeGreaterThan(50);
    expect(metadata.alternates?.canonical).toBe("/about");
  });
});

describe("about page content", () => {
  it("renders the story heading and the real facts", () => {
    render(<AboutPage />);

    expect(
      screen.getByRole("heading", { level: 1 }),
    ).toBeInTheDocument();

    // The load-bearing, honest facts: Cape Town printing and approval-first.
    expect(screen.getByText(/Printed in Cape Town/)).toBeInTheDocument();
    expect(
      screen.getByText(/couriered anywhere in South Africa in 5 working days/),
    ).toBeInTheDocument();

    // At least one real image slot, with descriptive alt.
    expect(
      screen.getByAltText("A person sitting with their dog, both at ease"),
    ).toBeInTheDocument();
  });

  it("offers a way to start a portrait", () => {
    render(<AboutPage />);
    const starts = screen.getAllByRole("link", { name: /Start your portrait/ });
    expect(starts.length).toBeGreaterThan(0);
    expect(starts[0]).toHaveAttribute("href", "/products/hoodie");
  });
});
