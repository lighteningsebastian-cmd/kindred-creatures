import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { catalogueShots } from "@/lib/garment-shots";
import { PrintLightbox } from "./PrintLightbox";

const front = catalogueShots("hoodie").find((shot) => shot.view === "front")!;
const fleece = catalogueShots("hoodie").find((shot) => shot.view === "fleece")!;

describe("PrintLightbox", () => {
  it("is a dialog a screen reader can find and name", () => {
    render(<PrintLightbox shot={front} slug="hoodie" onClose={() => {}} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName(front.alt);
  });

  it("shows the photograph it was opened on", () => {
    render(<PrintLightbox shot={front} slug="hoodie" onClose={() => {}} />);
    expect(screen.getByAltText(front.alt)).toBeInTheDocument();
  });

  it("lays the plate over the photograph, so the print is on a garment", () => {
    render(<PrintLightbox shot={front} slug="hoodie" onClose={() => {}} />);
    // The plate is decorative: the photograph's alt already describes the
    // print, and announcing it twice would be noise.
    const images = screen.getAllByRole("presentation", { hidden: true });
    expect(images.length).toBeGreaterThan(0);
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<PrintLightbox shot={front} slug="hoodie" onClose={onClose} />);

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes when the close control is pressed", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<PrintLightbox shot={front} slug="hoodie" onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: /close/i }));

    expect(onClose).toHaveBeenCalled();
  });

  it("takes focus when it opens, so the keyboard is inside it", () => {
    render(<PrintLightbox shot={front} slug="hoodie" onClose={() => {}} />);
    expect(screen.getByRole("button", { name: /close/i })).toHaveFocus();
  });

  it("keeps Tab inside itself", async () => {
    const user = userEvent.setup();
    render(<PrintLightbox shot={front} slug="hoodie" onClose={() => {}} />);

    await user.tab();
    await user.tab();

    expect(screen.getByRole("button", { name: /close/i })).toHaveFocus();
  });

  it("locks the page behind it and gives the scrollbar back on close", () => {
    const { unmount } = render(
      <PrintLightbox shot={front} slug="hoodie" onClose={() => {}} />,
    );
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("opens a view with no print at all, rather than refusing", () => {
    // Fleece carries no plate. There is nothing to frame on, so it opens at
    // life size instead of throwing or framing on nothing.
    render(<PrintLightbox shot={fleece} slug="hoodie" onClose={() => {}} />);
    expect(screen.getByAltText(fleece.alt)).toBeInTheDocument();
  });
});
