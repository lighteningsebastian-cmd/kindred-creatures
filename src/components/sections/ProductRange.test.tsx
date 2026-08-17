import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProductRange } from "./ProductRange";

describe("ProductRange", () => {
  it("shows the hoodie tile's back photograph, by alt text", () => {
    // The bento used to hold a hatched PhotoFrame placeholder per tile
    // (see the deleted tileShot map). Now the hoodie leads with its real
    // catalogue photography, wired through GarmentShots/catalogueShots.
    render(<ProductRange />);
    expect(
      screen.getByAltText(
        /Kindred hoodie in Blue from the back, printed with a companion profile plate/i,
      ),
    ).toBeInTheDocument();
  });
});
