// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  markPrintedAction,
  markShippedAction,
  resendJobSheetAction,
  retryFulfillmentAction,
  type ActionState,
} from "./actions";

/**
 * The dashboard's write surface.
 *
 * TWO THINGS ARE TESTED HERE and nothing else, because the transitions
 * themselves are covered against a real database in lib/admin/fulfillment-ops.test.ts.
 *
 *   1. Every action guards itself. A server action is a POST endpoint with a
 *      generated URL; React does not re-run the protected layout when one fires.
 *      So "it rendered inside /admin" protects nothing, and each action calling
 *      requireAdmin() first is the actual boundary. The test forces requireAdmin
 *      to throw the way a redirect does, and asserts the work never happened.
 *   2. Every FulfillmentResult variant becomes an honest sentence, especially
 *      the refusal on an order that was never paid.
 */

const {
  requireAdminMock,
  markPrintedMock,
  markShippedMock,
  resendJobSheetMock,
  retryFulfillmentMock,
} = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  markPrintedMock: vi.fn(),
  markShippedMock: vi.fn(),
  resendJobSheetMock: vi.fn(),
  retryFulfillmentMock: vi.fn(),
}));

vi.mock("@/lib/admin/auth", () => ({ requireAdmin: requireAdminMock }));
vi.mock("@/lib/admin/fulfillment-ops", () => ({
  markPrinted: markPrintedMock,
  markShipped: markShippedMock,
}));
vi.mock("@/lib/fulfillment", () => ({
  resendJobSheet: resendJobSheetMock,
  retryFulfillment: retryFulfillmentMock,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const IDLE: ActionState = { status: "idle" };
const ORDER_ID = "abcdef12-3456-7890-abcd-ef1234567890";

function form(entries: Record<string, string> = {}): FormData {
  const data = new FormData();
  data.set("orderId", ORDER_ID);
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

beforeEach(() => {
  requireAdminMock.mockResolvedValue(undefined);
  markPrintedMock.mockResolvedValue({ ok: true, order: {} });
  markShippedMock.mockResolvedValue({ ok: true, order: {}, email: { ok: true, id: "e1" } });
  resendJobSheetMock.mockResolvedValue({
    status: "sent",
    orderId: ORDER_ID,
    jobSheet: { ok: true, id: "js1" },
  });
  retryFulfillmentMock.mockResolvedValue({
    status: "sent_to_printer",
    orderId: ORDER_ID,
    printKeys: ["prints/a.png"],
    jobSheet: { ok: true, id: "js1" },
    confirmation: { ok: true, id: "c1" },
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

/** Exactly the actions that exist. Adding one without a guard fails here. */
const ACTIONS: [string, (prev: ActionState, data: FormData) => Promise<ActionState>][] =
  [
    ["markPrintedAction", markPrintedAction],
    ["markShippedAction", markShippedAction],
    ["resendJobSheetAction", resendJobSheetAction],
    ["retryFulfillmentAction", retryFulfillmentAction],
  ];

describe("auth is enforced on every action", () => {
  it.each(ACTIONS)("%s refuses a request with no admin session", async (_name, action) => {
    // requireAdmin() redirects by throwing. Nothing may run past it.
    requireAdminMock.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(action(IDLE, form({ trackingNumber: "TCG1" }))).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    expect(markPrintedMock).not.toHaveBeenCalled();
    expect(markShippedMock).not.toHaveBeenCalled();
    expect(resendJobSheetMock).not.toHaveBeenCalled();
    expect(retryFulfillmentMock).not.toHaveBeenCalled();
  });

  it.each(ACTIONS)("%s checks the session before doing anything", async (_name, action) => {
    await action(IDLE, form({ trackingNumber: "TCG1" }));

    expect(requireAdminMock).toHaveBeenCalledTimes(1);
    expect(requireAdminMock).toHaveBeenCalledBefore(
      markPrintedMock.mock.calls.length
        ? markPrintedMock
        : markShippedMock.mock.calls.length
          ? markShippedMock
          : resendJobSheetMock.mock.calls.length
            ? resendJobSheetMock
            : retryFulfillmentMock,
    );
  });
});

describe("markShippedAction", () => {
  it("passes the tracking number through", async () => {
    await markShippedAction(IDLE, form({ trackingNumber: "TCG123456789" }));
    expect(markShippedMock).toHaveBeenCalledWith(ORDER_ID, "TCG123456789");
  });

  it("reports a refusal for a missing tracking number", async () => {
    markShippedMock.mockResolvedValue({ ok: false, reason: "tracking-required" });

    const state = await markShippedAction(IDLE, form({ trackingNumber: "" }));

    expect(state.status).toBe("error");
    expect(state).toHaveProperty("message", expect.stringContaining("tracking number"));
  });

  it("warns, without pretending the order did not ship, when the email fails", async () => {
    markShippedMock.mockResolvedValue({
      ok: true,
      order: {},
      email: { ok: false, error: new Error("smtp down") },
    });

    const state = await markShippedAction(IDLE, form({ trackingNumber: "TCG1" }));

    expect(state.status).toBe("warn");
    expect(state).toHaveProperty("message", expect.stringContaining("Marked shipped"));
    expect(state).toHaveProperty("message", expect.stringContaining("NOT been told"));
  });

  it("confirms plainly when the customer was notified", async () => {
    const state = await markShippedAction(IDLE, form({ trackingNumber: "TCG1" }));
    expect(state.status).toBe("ok");
  });

  it("explains a stale tab rather than blaming the owner", async () => {
    markShippedMock.mockResolvedValue({ ok: false, reason: "wrong-status" });

    const state = await markShippedAction(IDLE, form({ trackingNumber: "TCG1" }));

    expect(state.status).toBe("error");
    expect(state).toHaveProperty("message", expect.stringContaining("Refresh"));
  });
});

describe("retryFulfillmentAction renders every FulfillmentResult variant", () => {
  it("sent_to_printer: says what was made and who was told", async () => {
    const state = await retryFulfillmentAction(IDLE, form());

    expect(state.status).toBe("ok");
    expect(state).toHaveProperty("message", expect.stringContaining("print file"));
  });

  it("sent_to_printer with a failed job sheet: warns that the shop is unaware", async () => {
    retryFulfillmentMock.mockResolvedValue({
      status: "sent_to_printer",
      orderId: ORDER_ID,
      printKeys: ["prints/a.png"],
      jobSheet: { ok: false, error: new Error("smtp down") },
      confirmation: { ok: true, id: "c1" },
    });

    const state = await retryFulfillmentAction(IDLE, form());

    expect(state.status).toBe("warn");
    expect(state).toHaveProperty("message", expect.stringContaining("NOT been told"));
  });

  it("already-fulfilled: says so instead of implying work happened", async () => {
    retryFulfillmentMock.mockResolvedValue({
      status: "already-fulfilled",
      orderId: ORDER_ID,
    });

    const state = await retryFulfillmentAction(IDLE, form());

    expect(state.status).toBe("ok");
    expect(state).toHaveProperty("message", expect.stringContaining("Already fulfilled"));
  });

  it("flagged: surfaces the reason it failed again", async () => {
    retryFulfillmentMock.mockResolvedValue({
      status: "flagged",
      orderId: ORDER_ID,
      reason: "print-file-generation-failed",
      failures: [],
    });

    const state = await retryFulfillmentAction(IDLE, form());

    expect(state.status).toBe("error");
    expect(state).toHaveProperty(
      "message",
      expect.stringContaining("print-file-generation-failed"),
    );
  });

  it("refused, flagged-without-payment: says the order was never paid", async () => {
    // The one that costs a garment if it is rendered as an ordinary hiccup.
    retryFulfillmentMock.mockResolvedValue({
      status: "refused",
      orderId: ORDER_ID,
      reason: "flagged-without-payment",
    });

    const state = await retryFulfillmentAction(IDLE, form());

    expect(state.status).toBe("error");
    const message = (state as { message: string }).message;
    expect(message).toContain("never paid");
    expect(message).toContain("must not be printed");
    // It must not read as a retryable failure.
    expect(message).not.toMatch(/try again|retry/i);
  });

  it("refused, any other reason: reports it rather than swallowing it", async () => {
    retryFulfillmentMock.mockResolvedValue({
      status: "refused",
      orderId: ORDER_ID,
      reason: "not-retryable:pending",
    });

    const state = await retryFulfillmentAction(IDLE, form());

    expect(state.status).toBe("error");
    expect(state).toHaveProperty("message", expect.stringContaining("not-retryable:pending"));
  });
});

describe("resendJobSheetAction", () => {
  it("confirms a re-send", async () => {
    const state = await resendJobSheetAction(IDLE, form());
    expect(state.status).toBe("ok");
  });

  it("points at retry when there are no print files to send", async () => {
    resendJobSheetMock.mockResolvedValue({
      status: "refused",
      orderId: ORDER_ID,
      reason: "no-print-files",
    });

    const state = await resendJobSheetAction(IDLE, form());

    expect(state.status).toBe("error");
    expect(state).toHaveProperty("message", expect.stringContaining("Retry fulfilment"));
  });

  it("says the shop was not told when the mail fails", async () => {
    resendJobSheetMock.mockResolvedValue({
      status: "sent",
      orderId: ORDER_ID,
      jobSheet: { ok: false, error: new Error("smtp down") },
    });

    const state = await resendJobSheetAction(IDLE, form());

    expect(state.status).toBe("error");
    expect(state).toHaveProperty("message", expect.stringContaining("not been told"));
  });
});
