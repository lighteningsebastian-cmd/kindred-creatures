import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApprovalActions } from "./ApprovalActions";

function setup(over: Partial<Parameters<typeof ApprovalActions>[0]> = {}) {
  const onApprove = vi.fn().mockResolvedValue({ state: "approved" });
  const onRevise = vi.fn().mockResolvedValue({ state: "queued" });
  render(
    <ApprovalActions
      token="t"
      approvedAt={null}
      onApprove={onApprove}
      onRevise={onRevise}
      {...over}
    />,
  );
  return { onApprove, onRevise };
}

describe("ApprovalActions", () => {
  it("leads with yes and keeps the other route quiet but reachable", () => {
    setup();
    expect(screen.getByRole("button", { name: /yes, print it/i })).toBeVisible();
    expect(
      screen.getByRole("button", { name: /something is not quite right/i }),
    ).toBeVisible();
  });

  it("never shows a revision counter", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(
      screen.getByRole("button", { name: /something is not quite right/i }),
    );
    // A visible limit turns a service into a ration.
    expect(document.body.textContent).not.toMatch(/\d\s*of\s*\d/i);
    expect(document.body.textContent).not.toMatch(/remaining|attempts left/i);
  });

  it("offers a different photo before asking what is wrong", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(
      screen.getByRole("button", { name: /something is not quite right/i }),
    );

    const text = document.body.textContent ?? "";
    // When a portrait does not look like someone's dog, the photograph is
    // usually the reason, so it is offered first.
    expect(text.indexOf("Use a different photo")).toBeLessThan(
      text.indexOf("What is not right?"),
    );
  });

  it("will not send an empty complaint", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(
      screen.getByRole("button", { name: /something is not quite right/i }),
    );
    expect(screen.getByRole("button", { name: /send this back/i })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Too dark" }));
    expect(
      screen.getByRole("button", { name: /send this back/i }),
    ).not.toBeDisabled();
  });

  it("sends the chips and the note together", async () => {
    const user = userEvent.setup();
    const { onRevise } = setup();
    await user.click(
      screen.getByRole("button", { name: /something is not quite right/i }),
    );
    await user.click(screen.getByRole("button", { name: "Too dark" }));
    await user.type(
      screen.getByLabelText(/anything else/i),
      "the ears are wrong",
    );
    await user.click(screen.getByRole("button", { name: /send this back/i }));

    expect(onRevise).toHaveBeenCalledWith("t", ["too-dark"], "the ears are wrong");
    expect(await screen.findByText(/we are on it/i)).toBeVisible();
  });

  it("speaks personally rather than counting when a person takes over", async () => {
    const user = userEvent.setup();
    setup({
      onRevise: vi.fn().mockResolvedValue({ state: "handed-over" }),
    });
    await user.click(
      screen.getByRole("button", { name: /something is not quite right/i }),
    );
    await user.click(screen.getByRole("button", { name: "Wrong angle" }));
    await user.click(screen.getByRole("button", { name: /send this back/i }));

    expect(
      await screen.findByText(/look at this one myself/i),
    ).toBeVisible();
    expect(document.body.textContent).not.toMatch(/\d\s*of\s*\d/);
  });

  it("shows an already approved artwork as settled", () => {
    setup({ approvedAt: new Date().toISOString() });
    expect(screen.getByText(/we are making it now/i)).toBeVisible();
    expect(screen.queryByRole("button", { name: /yes, print it/i })).toBeNull();
  });
});
