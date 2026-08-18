import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { catalogueShots, colourwayShots } from "@/lib/garment-shots";
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

describe("GarmentShots as a colour picker", () => {
  it("names each control after its colour", () => {
    render(<GarmentShots shots={colourwayShots("crewneck")} slug="crewneck" />);
    const dots = screen.getAllByRole("button");
    expect(dots.map((dot) => dot.getAttribute("aria-label"))).toEqual([
      "Peach",
      "White",
      "Grey",
      "Olive",
    ]);
  });

  it("fills the control with the colour it selects", () => {
    render(<GarmentShots shots={colourwayShots("hoodie")} slug="hoodie" />);
    const swatch = screen
      .getByRole("button", { name: "Lilac" })
      .querySelector("span");
    expect(swatch).toHaveStyle({ backgroundColor: "#A898A6" });
  });

  it("tells a screen reader it is choosing a colour, not an aspect", () => {
    render(<GarmentShots shots={colourwayShots("hoodie")} slug="hoodie" />);
    expect(screen.getByRole("group")).toHaveAccessibleName(
      "Which colour to show",
    );
  });

  it("keeps saying aspect when the shots are views", () => {
    render(<GarmentShots shots={catalogueShots("hoodie")} slug="hoodie" />);
    expect(screen.getByRole("group")).toHaveAccessibleName(
      "Which aspect to show",
    );
  });

  it("switches the photograph when a colour is pressed", async () => {
    const user = userEvent.setup();
    render(<GarmentShots shots={colourwayShots("hoodie")} slug="hoodie" />);

    await user.click(screen.getByRole("button", { name: "Lilac" }));

    expect(
      screen.getByAltText(/hoodie in Lilac from the back/i),
    ).toBeInTheDocument();
  });

  it("keeps four colourways as four distinct controls", async () => {
    // Every colourway shot is a "back", so keying the list on the view would
    // collapse all four onto one React key. This is the test for that.
    const user = userEvent.setup();
    render(<GarmentShots shots={colourwayShots("crewneck")} slug="crewneck" />);

    await user.click(screen.getByRole("button", { name: "Olive" }));

    expect(screen.getByRole("button", { name: "Olive" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Peach" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByAltText(/crewneck in Olive from the back/i)).toBeInTheDocument();
  });
});

describe("GarmentShots zoom", () => {
  it("offers no zoom at all unless asked, so the home page is unchanged", () => {
    render(<GarmentShots shots={catalogueShots("hoodie")} slug="hoodie" />);
    expect(
      screen.queryByRole("button", { name: /enlarge/i }),
    ).not.toBeInTheDocument();
  });

  it("gives the picture a real button when zoomable, not a clickable div", () => {
    render(
      <GarmentShots shots={catalogueShots("hoodie")} slug="hoodie" zoomable />,
    );
    expect(
      screen.getByRole("button", { name: /enlarge/i }),
    ).toBeInTheDocument();
  });

  it("opens the lightbox on the shot being shown", async () => {
    const user = userEvent.setup();
    render(
      <GarmentShots shots={catalogueShots("hoodie")} slug="hoodie" zoomable />,
    );

    await user.click(screen.getByRole("button", { name: /enlarge/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("enlarges whichever aspect the visitor switched to", async () => {
    const user = userEvent.setup();
    render(
      <GarmentShots shots={catalogueShots("hoodie")} slug="hoodie" zoomable />,
    );

    await user.click(screen.getByRole("button", { name: "Chest print" }));
    await user.click(screen.getByRole("button", { name: /enlarge/i }));

    expect(screen.getByRole("dialog")).toHaveAccessibleName(/chest print/i);
  });

  it("closes again, and puts focus back where it came from", async () => {
    const user = userEvent.setup();
    render(
      <GarmentShots shots={catalogueShots("hoodie")} slug="hoodie" zoomable />,
    );
    const trigger = screen.getByRole("button", { name: /enlarge/i });

    await user.click(trigger);
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("still shows the aspect dots while zoomable", () => {
    render(
      <GarmentShots shots={catalogueShots("hoodie")} slug="hoodie" zoomable />,
    );
    expect(screen.getByRole("group")).toHaveAccessibleName(
      "Which aspect to show",
    );
  });
});

describe("hover advance versus a clickable picture", () => {
  it("still nudges to the next picture on a plain tile", async () => {
    const user = userEvent.setup();
    render(<GarmentShots shots={catalogueShots("hoodie")} slug="hoodie" />);

    await user.hover(screen.getByTestId("garment-shots"));

    expect(screen.getByAltText(/chest print on/i)).toBeInTheDocument();
  });

  it("does not nudge when the picture is the thing you click", async () => {
    // Hovering is unavoidable on the way to a click. If it advanced, nobody
    // could ever enlarge the view they just selected.
    const user = userEvent.setup();
    render(
      <GarmentShots shots={catalogueShots("hoodie")} slug="hoodie" zoomable />,
    );

    await user.hover(screen.getByTestId("garment-shots"));

    expect(
      screen.getByAltText(/from the back, printed with a companion/i),
    ).toBeInTheDocument();
  });
});
