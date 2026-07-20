import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewsletterSignup } from "./NewsletterSignup";
import * as analytics from "@/lib/analytics";

/** A 201 as the subscribe route answers it. */
function okBody(overrides: Record<string, unknown> = {}) {
  return { ok: true, alreadySubscribed: false, ...overrides };
}

function stubFetchResolving(body: unknown, ok = true) {
  const fetchSpy = vi.fn().mockResolvedValue({
    ok,
    json: async () => body,
  });
  vi.stubGlobal("fetch", fetchSpy);
  return fetchSpy;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("NewsletterSignup", () => {
  it("posts the email to the subscribe route with source footer", async () => {
    const fetchSpy = stubFetchResolving(okBody());
    const user = userEvent.setup();
    render(<NewsletterSignup />);

    await user.type(screen.getByLabelText("Email"), "reader@example.co.za");
    await user.click(screen.getByRole("button", { name: /sign up/i }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledOnce());
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/newsletter/subscribe");
    expect(JSON.parse(init.body)).toEqual({
      email: "reader@example.co.za",
      source: "footer",
    });
  });

  it("shows the warm success state and fires the analytics event on a new join", async () => {
    stubFetchResolving(okBody({ alreadySubscribed: false }));
    const spy = vi.spyOn(analytics, "trackNewsletterSignup");
    const user = userEvent.setup();
    render(<NewsletterSignup />);

    await user.type(screen.getByLabelText("Email"), "reader@example.co.za");
    await user.click(screen.getByRole("button", { name: /sign up/i }));

    expect(await screen.findByText(/you are on the list/i)).toBeInTheDocument();
    expect(spy).toHaveBeenCalledWith({ source: "footer" });
  });

  it("shows the already-subscribed state and does NOT fire the event", async () => {
    stubFetchResolving(okBody({ alreadySubscribed: true }));
    const spy = vi.spyOn(analytics, "trackNewsletterSignup");
    const user = userEvent.setup();
    render(<NewsletterSignup />);

    await user.type(screen.getByLabelText("Email"), "again@example.co.za");
    await user.click(screen.getByRole("button", { name: /sign up/i }));

    expect(
      await screen.findByText(/you are already on the list/i),
    ).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  it("surfaces a retryable inline error when the server rejects", async () => {
    stubFetchResolving({ error: "Please enter a valid email address." }, false);
    const user = userEvent.setup();
    render(<NewsletterSignup />);

    // A syntactically valid address gets past the client check and reaches the
    // server, which is what returns the error here.
    await user.type(screen.getByLabelText("Email"), "server@example.co.za");
    await user.click(screen.getByRole("button", { name: /sign up/i }));

    expect(
      await screen.findByText("Please enter a valid email address."),
    ).toBeInTheDocument();
    // Still retryable: the field and button are back.
    expect(screen.getByRole("button", { name: /sign up/i })).toBeEnabled();
  });

  it("does not post an empty or malformed email", async () => {
    const fetchSpy = stubFetchResolving(okBody());
    const spy = vi.spyOn(analytics, "trackNewsletterSignup");
    const user = userEvent.setup();
    render(<NewsletterSignup />);

    // Empty submit.
    await user.click(screen.getByRole("button", { name: /sign up/i }));
    // Malformed.
    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.click(screen.getByRole("button", { name: /sign up/i }));

    expect(
      await screen.findByText("Please enter a valid email address."),
    ).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalled();
  });
});
