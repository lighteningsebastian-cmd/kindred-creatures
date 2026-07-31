import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { BreedPicker } from "./BreedPicker";
import type { Breed } from "@/lib/breeds";

/**
 * Drives the picker the way the flow does. The parent owns the selected id, so
 * a harness that never updates it cannot see the state this component is for.
 */
function setup(overrides: Partial<Parameters<typeof BreedPicker>[0]> = {}) {
  const onChange = vi.fn();
  const onMiss = vi.fn();

  function Harness() {
    const [value, setValue] = useState<string | null>(
      overrides.value ?? null,
    );
    return (
      <BreedPicker
        species="dog"
        value={value}
        onChange={(breed: Breed) => {
          setValue(breed.id);
          onChange(breed);
        }}
        onMiss={onMiss}
        {...overrides}
        {...(overrides.value !== undefined ? { value: overrides.value } : {})}
      />
    );
  }

  render(<Harness />);
  return { onChange, onMiss };
}

describe("BreedPicker", () => {
  it("shows nothing at all until they type", async () => {
    // Owner decision, 30 July: no shortlist. The field is quiet until it is used.
    setup();
    const listed = screen
      .queryAllByRole("button")
      .map((b) => b.textContent ?? "")
      .filter((t) => !t.includes("find them"));
    expect(listed).toEqual([]);
    // And the one permanent affordance is still there.
    expect(screen.getByRole("button", { name: /find them/i })).toBeVisible();
  });

  it("offers One of One above the pedigrees when it matches", async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByLabelText("Their breed"), "one");

    const names = screen
      .getAllByRole("button")
      .map((b) => b.textContent ?? "")
      .filter((t) => !t.includes("find them"));
    // Never buried: a crossbred dog is the commonest case in South Africa.
    expect(names[0]).toContain("One of One");
  });

  it("reads the chosen breed back and closes the list", async () => {
    // The bug this replaces: picking German Shepherd left the field saying
    // "Start typing", so a working feature looked broken.
    const user = userEvent.setup();
    const { onChange } = setup();
    const field = screen.getByLabelText("Their breed");

    await user.type(field, "german");
    await user.click(screen.getByRole("button", { name: /German Shepherd/ }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(field).toHaveValue("German Shepherd");
    // The list is gone, and there is a way back to it.
    expect(screen.queryByRole("button", { name: /German Shepherd/ })).toBeNull();
    expect(screen.getByText(/type again to change it/i)).toBeVisible();
  });

  it("reads back a breed chosen before this render", () => {
    // Coming back to the question later must not look like nothing happened.
    setup({ value: "german-shepherd" });
    expect(screen.getByLabelText("Their breed")).toHaveValue("German Shepherd");
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
