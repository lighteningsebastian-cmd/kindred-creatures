import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import AboutPage, { metadata } from "./page";

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

    // The load-bearing, honest facts: Jeffreys Bay printing and approval-first.
    expect(screen.getByText(/Printed in Jeffreys Bay/)).toBeInTheDocument();
    expect(
      screen.getByText(
        /couriered anywhere in South Africa within 7 to 10 working days/,
      ),
    ).toBeInTheDocument();

    // The hero photo slot is a hatched PhotoFrame placeholder pending the real
    // shoot; its caption is the visible shot description, by design.
    expect(
      screen.getByText(/a person sitting on the floor with their dog/i),
    ).toBeInTheDocument();
  });

  it("offers a way to start a portrait", () => {
    render(<AboutPage />);
    const starts = screen.getAllByRole("link", { name: /Start your portrait/ });
    expect(starts.length).toBeGreaterThan(0);
    expect(starts[0]).toHaveAttribute("href", "/products/hoodie");
  });
});
