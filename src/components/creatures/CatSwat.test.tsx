import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CatSwat } from "./CatSwat";

describe("CatSwat", () => {
  it("exposes the full heading text, including the swattable word", () => {
    render(<CatSwat word="questions">Frequently asked</CatSwat>);
    expect(
      screen.getByRole("heading", { name: "Frequently asked questions" }),
    ).toBeInTheDocument();
  });

  it("renders the requested heading level", () => {
    render(
      <CatSwat as="h1" word="creature">
        Made for your
      </CatSwat>,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Made for your creature" }),
    ).toBeInTheDocument();
  });

  it("hides the paw artwork from the accessibility tree", () => {
    const { container } = render(<CatSwat word="questions">Frequently asked</CatSwat>);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });
});
