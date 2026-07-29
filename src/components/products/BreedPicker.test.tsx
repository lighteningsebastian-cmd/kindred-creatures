import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BreedPicker } from "./BreedPicker";

function setup(overrides: Partial<Parameters<typeof BreedPicker>[0]> = {}) {
  const onChange = vi.fn();
  const onMiss = vi.fn();
  render(
    <BreedPicker
      species="dog"
      value={null}
      onChange={onChange}
      onMiss={onMiss}
      {...overrides}
    />,
  );
  return { onChange, onMiss };
}

describe("BreedPicker", () => {
  it("offers One of One above the pedigrees", async () => {
    setup();
    const names = screen
      .getAllByRole("button")
      .map((b) => b.textContent ?? "")
      .filter((t) => !t.includes("find them"));

    // Never buried at the bottom: a crossbred dog is the commonest case.
    expect(names[0]).toContain("One of One");
  });

  it("filters by what was typed", async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByLabelText("Their breed"), "yorkshire");

    expect(screen.getByRole("button", { name: /yorkshire/i })).toBeVisible();
    expect(screen.queryByRole("button", { name: /^Beagle/ })).toBeNull();
  });

  it("returns the chosen breed, not just its id", async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    await user.type(screen.getByLabelText("Their breed"), "yorkshire");
    await user.click(screen.getByRole("button", { name: /yorkshire/i }));

    expect(onChange).toHaveBeenCalledTimes(1);
    // The parent needs origin and group to fill the plate without a second lookup.
    expect(onChange.mock.calls[0]![0]).toMatchObject({ species: "dog" });
  });

  it("reports a miss with what they actually typed", async () => {
    const user = userEvent.setup();
    const { onMiss } = setup();
    await user.type(screen.getByLabelText("Their breed"), "shiba inu");
    await user.click(screen.getByRole("button", { name: /find them/i }));

    expect(onMiss).toHaveBeenCalledWith("shiba inu");
    // And it does not just vanish: the customer is told what to do next.
    expect(screen.getByText(/noted it/i)).toBeVisible();
  });

  it("cannot report an empty search", async () => {
    setup();
    expect(screen.getByRole("button", { name: /find them/i })).toBeDisabled();
  });
});
