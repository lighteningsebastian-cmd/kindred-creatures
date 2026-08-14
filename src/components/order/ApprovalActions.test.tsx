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

    // The fourth argument is the standout detail, untouched here because this
    // artwork never had one.
    expect(onRevise).toHaveBeenCalledWith(
      "t",
      ["too-dark"],
      "the ears are wrong",
      null,
    );
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

  it("offers the standout detail back, editable, and sends the reworded one", async () => {
    // Somebody whose detail was misread must be able to reword it. Without
    // this their only recourse is the note, which reaches a person rather than
    // the drawing (docs/spec-standout-detail.md section 7).
    const user = userEvent.setup();
    const { onRevise } = setup({ standoutDetail: "One ear flops over" });

    await user.click(
      screen.getByRole("button", { name: /something is not quite right/i }),
    );

    const field = screen.getByLabelText(
      /one thing about them that really stands out/i,
    );
    expect(field).toHaveValue("One ear flops over");

    await user.clear(field);
    await user.type(field, "His LEFT ear flops, not the right");
    await user.click(screen.getByRole("button", { name: "Wrong angle" }));
    await user.click(screen.getByRole("button", { name: /send this back/i }));

    expect(onRevise).toHaveBeenCalledWith(
      "t",
      ["wrong-angle"],
      "",
      "His LEFT ear flops, not the right",
    );
  });

  it("keeps the note and the detail as visibly different things", async () => {
    // One changes the drawing, the other reaches a person. A customer who
    // cannot tell them apart will put the important sentence in the wrong box.
    const user = userEvent.setup();
    setup({ standoutDetail: "One ear flops over" });
    await user.click(
      screen.getByRole("button", { name: /something is not quite right/i }),
    );

    expect(
      screen.getByLabelText(/one thing about them that really stands out/i),
    ).toBeVisible();
    expect(
      screen.getByLabelText(/anything else you would like us to know/i),
    ).toBeVisible();
    expect(screen.getByText(/a person reads every one of these/i)).toBeVisible();
  });

  it("asks the question even when they never answered it the first time", async () => {
    const user = userEvent.setup();
    const { onRevise } = setup({ standoutDetail: null });
    await user.click(
      screen.getByRole("button", { name: /something is not quite right/i }),
    );

    const field = screen.getByLabelText(
      /one thing about them that really stands out/i,
    );
    expect(field).toHaveValue("");

    await user.click(screen.getByRole("button", { name: "Wrong angle" }));
    await user.click(screen.getByRole("button", { name: /send this back/i }));
    // null, not undefined: they were asked and left it blank.
    expect(onRevise).toHaveBeenCalledWith("t", ["wrong-angle"], "", null);
  });
});
