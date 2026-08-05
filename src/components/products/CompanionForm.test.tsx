import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { CompanionForm } from "./CompanionForm";
import { emptyProfile, type CompanionProfile } from "@/lib/companion";

/** Drives the form the way the flow does, so state actually moves. */
function Harness({
  checkName = async () => ({ ok: true }),
  onBreedMiss = vi.fn(),
  onProfile,
}: {
  checkName?: (name: string) => Promise<{ ok: boolean; reason?: string }>;
  onBreedMiss?: (q: string) => void;
  onProfile?: (p: CompanionProfile) => void;
}) {
  const [profile, setProfile] = useState(emptyProfile());
  return (
    <CompanionForm
      profile={profile}
      onChange={(next) => {
        setProfile(next);
        onProfile?.(next);
      }}
      checkName={checkName}
      onBreedMiss={onBreedMiss}
    />
  );
}

describe("CompanionForm", () => {
  it("asks a real question about the date, not a bare year", () => {
    render(<Harness />);
    // The wording is load bearing: these orders are often placed after a loss,
    // so it has to work for a rescue, a purchase or an animal that has died.
    expect(
      screen.getByLabelText(/when did they come into your life/i),
    ).toBeVisible();
    expect(screen.getByText(/adoption day, gotcha day, or birthday/i)).toBeVisible();
    // Never a full date, and never "date of birth" as the question itself.
    expect(screen.queryByLabelText(/date of birth|birthday/i)).toBeNull();
  });

  it("takes one word, up to three, and refuses a fourth", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // One word is a complete answer, so the counter must not read as an
    // unfinished form ("1 of 3 chosen").
    await user.click(screen.getByRole("button", { name: "Confident" }));
    expect(screen.getByText(/^1 chosen$/i)).toBeVisible();

    for (const word of ["Affectionate", "Spirited"]) {
      await user.click(screen.getByRole("button", { name: word }));
    }
    expect(screen.getByText(/^3 chosen$/i)).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Gentle" }));
    expect(screen.getByText(/^3 chosen$/i)).toBeVisible();
    expect(screen.getByRole("button", { name: "Gentle" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("drops temperament and breed when the species changes", async () => {
    const user = userEvent.setup();
    const onProfile = vi.fn();
    render(<Harness onProfile={onProfile} />);

    await user.click(screen.getByRole("button", { name: "Confident" }));
    await user.click(screen.getByRole("button", { name: "Bird" }));

    const last = onProfile.mock.calls.at(-1)![0];
    expect(last.species).toBe("bird");
    expect(last.temperament).toEqual([]);
    // A spaniel must not follow you over to a cockatiel.
    expect(last.breedId).toBeNull();
  });

  it("offers no temperament for a reptile", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Reptile" }));

    expect(screen.queryByRole("button", { name: "Confident" })).toBeNull();
  });

  it("asks three NAMED questions on Other, never a key and value grid", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Other" }));

    expect(screen.queryByLabelText("Their breed")).toBeNull();
    expect(
      screen.getByLabelText(/what kind of animal are they/i),
    ).toBeVisible();
    expect(screen.getByLabelText(/breed or type, if they have one/i)).toBeVisible();
    expect(screen.getByLabelText(/where are they from/i)).toBeVisible();
    // A customer with a horse must never be asked to invent a field name.
    expect(document.body.textContent).not.toMatch(/\bDetail\b/);
    expect(document.body.textContent).not.toMatch(/\bValue\b/);
  });

  it("still offers temperament for Other, because a horse has character too", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Other" }));
    expect(screen.getByRole("button", { name: "Confident" })).toBeVisible();
  });

  it("surfaces a name the printer cannot set", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        checkName={async () => ({ ok: false, reason: "We cannot print 🐕 yet." })}
      />,
    );

    await user.type(screen.getByLabelText("Their name"), "Rex");
    await user.tab();

    expect(await screen.findByText(/cannot print/i)).toBeVisible();
  });

  it("accepts no name at all", () => {
    render(<Harness />);
    // Blank is a real answer: the plate omits the line rather than printing one.
    expect(screen.getByLabelText("Their name")).toHaveValue("");
    expect(screen.getByText(/leave it off/i)).toBeVisible();
  });
});
