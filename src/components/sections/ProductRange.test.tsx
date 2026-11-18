import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
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

describe("the range, in colour", () => {
  it("offers no chest print, because it renders at 19px here", () => {
    render(<ProductRange />);
    expect(
      screen.queryByRole("button", { name: "Chest print" }),
    ).not.toBeInTheDocument();
  });

  it("gives the crewneck one control per colourway", () => {
    // Scoped to the crewneck's own group, because "White" is a colourway of
    // all three garments. That ambiguity is exactly why the group is named
    // after the product rather than after the axis.
    render(<ProductRange />);
    const group = screen.getByRole("group", {
      name: "Which colour of The Kindred Crewneck to show",
    });
    expect(
      within(group)
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    // Two, not five: a home tile shows one fit, and the crewneck leads on the
    // women's. Grey and Olive are the men's sweater and have a card of their
    // own on the shop page.
    ).toEqual(["Peach", "White"]);
  });

  it("names each garment's colour group after that garment", () => {
    // Three tiles, three sets of colour dots, and four colour names shared
    // between them. Without this a screen reader hears "White" three times on
    // one page with nothing to tell the garments apart.
    render(<ProductRange />);
    for (const name of ["Hoodie", "Tee", "Crewneck"]) {
      expect(
        screen.getByRole("group", {
          name: `Which colour of The Kindred ${name} to show`,
        }),
      ).toBeInTheDocument();
    }
  });

  it("does not offer a lightbox on a teaser tile", () => {
    render(<ProductRange />);
    expect(
      screen.queryByRole("button", { name: /enlarge/i }),
    ).not.toBeInTheDocument();
  });

  it("draws every tile square, so a landscape colourway does not resize the garment", () => {
    // The tee's White is portrait at 0.832 and its Heritage Blue is landscape
    // at 1.26. In any tall or wide tile the garment visibly changes size as the
    // colourway cycles; a square sits between the two and cuts the jump from
    // 29 points to 4.
    render(<ProductRange />);
    const frames = screen.getAllByTestId("garment-shots");
    expect(frames.length).toBeGreaterThan(0);
    for (const frame of frames) {
      expect(frame).toHaveStyle({ aspectRatio: "1 / 1" });
    }
  });
});
