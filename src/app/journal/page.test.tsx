import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import JournalPage, { metadata } from "./page";

describe("journal page metadata", () => {
  it("has a title, description and its own canonical", () => {
    expect(metadata.title).toBe("Journal");
    expect(typeof metadata.description).toBe("string");
    expect(metadata.alternates?.canonical).toBe("/journal");
  });
});

describe("journal page content", () => {
  it("renders an honest empty state, no invented posts", () => {
    render(<JournalPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: /Stories are on their way/ }),
    ).toBeInTheDocument();
    // It should say plainly there is nothing here yet.
    expect(screen.getByText(/nothing here yet/)).toBeInTheDocument();
  });

  it("links onward to a real portrait and the story page", () => {
    render(<JournalPage />);
    expect(
      screen.getByRole("link", { name: /Start your portrait/ }),
    ).toHaveAttribute("href", "/products/hoodie");
    expect(
      screen.getByRole("link", { name: /Read our story/ }),
    ).toHaveAttribute("href", "/about");
  });
});
