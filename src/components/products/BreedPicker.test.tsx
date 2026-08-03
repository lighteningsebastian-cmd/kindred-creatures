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
  const onTypeBreed = vi.fn();

  function Harness() {
    const [value, setValue] = useState<string | null>(
      overrides.value ?? null,
    );
    // The parent owns both answers and each clears the other, so the harness
    // has to as well or the component is tested in a state the flow never has.
    const [typed, setTyped] = useState<string | null>(
      overrides.typedBreedValue ?? null,
    );
    return (
      <BreedPicker
        species="dog"
        value={value}
        onChange={(breed: Breed) => {
          setValue(breed.id);
          setTyped(null);
          onChange(breed);
        }}
        onMiss={onMiss}
        typedBreedValue={typed}
        onTypeBreed={(words: string) => {
          setTyped(words || null);
          setValue(null);
          onTypeBreed(words);
        }}
        {...overrides}
        {...(overrides.value !== undefined ? { value: overrides.value } : {})}
      />
    );
  }

  render(<Harness />);
  return { onChange, onMiss, onTypeBreed };
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
  });

  it("offers the escape hatch before they have typed anything", async () => {
    // It used to be greyed out until you had typed, which hid it from exactly
    // the people most likely to need it: someone whose dog has no breed name
    // to type does not start typing one.
    setup();
    expect(screen.getByRole("button", { name: /find them/i })).toBeEnabled();
  });

  it("prints the breed they write in their own words", async () => {
    const user = userEvent.setup();
    const { onTypeBreed } = setup();

    await user.click(screen.getByRole("button", { name: /find them/i }));
    await user.type(
      screen.getByLabelText(/what do you call their breed/i),
      "Boerboel cross",
    );

    expect(onTypeBreed).toHaveBeenLastCalledWith("Boerboel cross");
    // The loop is closed: they are told what will happen, not thanked for data.
    expect(screen.getByText(/we will print boerboel cross/i)).toBeVisible();
  });

  it("lets their own words replace a breed already picked, and back again", async () => {
    const user = userEvent.setup();
    setup();

    await user.type(screen.getByLabelText("Their breed"), "german");
    await user.click(screen.getByRole("button", { name: /German Shepherd/ }));

    await user.click(screen.getByRole("button", { name: /find them/i }));
    await user.type(
      screen.getByLabelText(/what do you call their breed/i),
      "Boerboel",
    );
    // The list is out of the way while they are writing their own.
    expect(screen.queryByLabelText("Their breed")).toBeNull();

    await user.click(screen.getByRole("button", { name: /search the list/i }));
    expect(screen.getByLabelText("Their breed")).toBeVisible();
  });

  it("reads back words written before this render", () => {
    // Coming back to the question later must not show an empty field over a
    // plate that already carries their breed.
    setup({ typedBreedValue: "Boerboel cross" });
    expect(screen.getByLabelText(/what do you call their breed/i)).toHaveValue(
      "Boerboel cross",
    );
  });
});
