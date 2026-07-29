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
  it("asks for the year they arrived, never a birthday", () => {
    render(<Harness />);
    // The wording is load bearing: these orders are often placed after a loss.
    expect(
      screen.getByLabelText(/what year did they come into your life/i),
    ).toBeVisible();
    expect(screen.queryByLabelText(/birth|born|date of/i)).toBeNull();
  });

  it("takes exactly three words and refuses a fourth", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    for (const word of ["Confident", "Affectionate", "Spirited"]) {
      await user.click(screen.getByRole("button", { name: word }));
    }
    expect(screen.getByText(/3 of 3 chosen/i)).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Gentle" }));
    expect(screen.getByText(/3 of 3 chosen/i)).toBeVisible();
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

  it("swaps the breed list for free text on Other", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Other" }));

    expect(screen.queryByLabelText("Their breed")).toBeNull();
    expect(screen.getByLabelText("Detail 1")).toBeVisible();
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
