import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "./LoginForm";

/**
 * A failure on our side must not look like a problem with the address. The
 * form used to paint the email field red for a server error.
 */

vi.mock("@/lib/analytics", () => ({ trackAccountLoginRequested: vi.fn() }));

afterEach(() => {
  vi.unstubAllGlobals();
});

async function submit(status: number) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: status < 300, status, json: async () => ({}) }),
  );
  const user = userEvent.setup();
  render(<LoginForm expired={false} />);
  await user.type(screen.getByLabelText("Email"), "thandi@example.co.za");
  await user.click(screen.getByRole("button", { name: /email me a link/i }));
}

describe("LoginForm", () => {
  it("says a server failure is ours, and leaves the address alone", async () => {
    await submit(503);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /on our side, not with your address/,
    );
    expect(screen.getByLabelText("Email")).not.toHaveAttribute("aria-invalid", "true");
  });

  it("marks the address only when the server rejected the address", async () => {
    await submit(400);

    expect(await screen.findByText("Please enter a valid email address.")).toBeInTheDocument();
    expect(screen.queryByText(/on our side/)).toBeNull();
  });

  it("confirms a sent link", async () => {
    await submit(200);
    expect(await screen.findByText("Check your inbox.")).toBeInTheDocument();
  });
});
