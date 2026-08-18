import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { catalogueShots } from "@/lib/garment-shots";
import { GarmentShots } from "./GarmentShots";

describe("GarmentShots", () => {
  it("opens on the back, because the plate is the product", () => {
    render(<GarmentShots shots={catalogueShots("hoodie")} slug="hoodie" />);
    expect(
      screen.getByAltText(/from the back, printed with a companion profile/i),
    ).toBeInTheDocument();
  });

  it("gives one dot per aspect, naming each one", () => {
    render(<GarmentShots shots={catalogueShots("hoodie")} slug="hoodie" />);
    const dots = screen.getAllByRole("button");
    expect(dots).toHaveLength(3);
    expect(dots.map((dot) => dot.getAttribute("aria-label"))).toEqual([
      "Back",
      "Chest print",
      "Fleece",
    ]);
  });

  it("changes the picture and its alt text when a dot is pressed", async () => {
    const user = userEvent.setup();
    render(<GarmentShots shots={catalogueShots("hoodie")} slug="hoodie" />);

    await user.click(screen.getByRole("button", { name: "Fleece" }));

    expect(screen.getByAltText(/brushed fleece inside/i)).toBeInTheDocument();
    expect(
      screen.queryByAltText(/from the back, printed with/i),
    ).not.toBeInTheDocument();
  });

  it("marks the showing aspect as the pressed one, for a screen reader", async () => {
    const user = userEvent.setup();
    render(<GarmentShots shots={catalogueShots("hoodie")} slug="hoodie" />);

    expect(screen.getByRole("button", { name: "Back" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "Fleece" }));
    expect(screen.getByRole("button", { name: "Fleece" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Back" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("advances to the next aspect on hover, for a mouse", async () => {
    const user = userEvent.setup();
    render(<GarmentShots shots={catalogueShots("hoodie")} slug="hoodie" />);

    await user.hover(screen.getByTestId("garment-shots"));
    expect(screen.getByAltText(/chest print on the Kindred hoodie/i)).toBeInTheDocument();

    await user.unhover(screen.getByTestId("garment-shots"));
    expect(
      screen.getByAltText(/from the back, printed with/i),
    ).toBeInTheDocument();
  });

  it("overlays the demo plate on a printed aspect and not on a bare one", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <GarmentShots shots={catalogueShots("hoodie")} slug="hoodie" />,
    );
    expect(
      container.querySelector('img[src*="plate-back-hoodie"]'),
    ).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Fleece" }));
    expect(container.querySelector('img[src*="plate-"]')).toBeNull();
  });

  it("renders no dot row when there is only one aspect", () => {
    render(<GarmentShots shots={catalogueShots("hoodie").slice(0, 1)} slug="hoodie" />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("renders nothing at all when there are no shots", () => {
    // The tote. The caller falls back to a PhotoFrame; this must not render an
    // empty bordered box next to it.
    const { container } = render(<GarmentShots shots={[]} slug="tote" />);
    expect(container).toBeEmptyDOMElement();
  });
});
