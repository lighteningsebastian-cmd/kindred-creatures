import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { OrderActions } from "./OrderActions";

/**
 * What the owner is offered, and the one thing they must never be offered.
 *
 * These are not the guard: the server refuses illegal transitions whatever this
 * renders (see lib/admin/fulfillment-ops.test.ts). What is tested here is the
 * other half of the same problem. A button that looks like it might print a free
 * garment is not a thing to put in front of a tired person at 6pm and rely on
 * the backend to catch.
 */

vi.mock("@/app/admin/(dashboard)/actions", () => ({
  markPrintedAction: vi.fn(),
  markShippedAction: vi.fn(),
  resendJobSheetAction: vi.fn(),
  retryFulfillmentAction: vi.fn(),
}));

const ORDER_ID = "abcdef12-3456-7890-abcd-ef1234567890";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("an order flagged without a payment", () => {
  const neverPaid = {
    orderId: ORDER_ID,
    status: "flagged" as const,
    concern: "never-paid" as const,
    canResendJobSheet: true,
  };

  it("offers no buttons at all: not disabled ones, none", () => {
    render(<OrderActions {...neverPaid} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("offers no retry and no re-send, even though print files exist", () => {
    // canResendJobSheet is true here on purpose: an unpaid order can still have
    // artwork attached. It is still not a thing to send to the print shop.
    //
    // Asserted against controls rather than text: the copy explains there is "no
    // retry to make", so a bare /retry/ text search matches the very sentence
    // that is doing the right thing.
    render(<OrderActions {...neverPaid} />);
    expect(
      screen.queryByRole("button", { name: /retry/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /re-send/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
  });

  it("says the order was never paid, in those words", () => {
    render(<OrderActions {...neverPaid} />);
    expect(screen.getByText(/never paid/i)).toBeInTheDocument();
    expect(
      screen.getByText(/PayFast never confirmed a payment/i),
    ).toBeInTheDocument();
  });

  it("explains what printing it would cost, and where to look instead", () => {
    render(<OrderActions {...neverPaid} />);
    expect(screen.getByText(/free garment/i)).toBeInTheDocument();
    expect(screen.getByText(/find the payment in PayFast/i)).toBeInTheDocument();
  });
});

describe("an order flagged after a print failure", () => {
  const printFailed = {
    orderId: ORDER_ID,
    status: "flagged" as const,
    concern: "print-failed" as const,
    canResendJobSheet: false,
  };

  it("offers the retry: this one is genuinely owed a garment", () => {
    render(<OrderActions {...printFailed} />);
    expect(
      screen.getByRole("button", { name: /retry fulfilment/i }),
    ).toBeInTheDocument();
  });

  it("says the order is paid, so the retry is obviously safe", () => {
    render(<OrderActions {...printFailed} />);
    expect(screen.getByText(/paid and the print file failed/i)).toBeInTheDocument();
  });
});

describe("the ordinary progression", () => {
  it("offers mark printed at the printer, and not mark shipped", () => {
    render(
      <OrderActions
        orderId={ORDER_ID}
        status="sent_to_printer"
        concern={null}
        canResendJobSheet
      />,
    );

    expect(screen.getByRole("button", { name: /mark printed/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /mark shipped/i }),
    ).not.toBeInTheDocument();
  });

  it("asks for the tracking number before it will ship", () => {
    render(
      <OrderActions
        orderId={ORDER_ID}
        status="printed"
        concern={null}
        canResendJobSheet={false}
      />,
    );

    const tracking = screen.getByLabelText(/tracking number/i);
    expect(tracking).toBeRequired();
    expect(
      screen.getByRole("button", { name: /mark shipped and notify/i }),
    ).toBeInTheDocument();
  });

  it("offers nothing to do on a shipped order", () => {
    render(
      <OrderActions
        orderId={ORDER_ID}
        status="shipped"
        concern={null}
        canResendJobSheet={false}
      />,
    );

    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("offers a re-send only when there are print files", () => {
    const { rerender } = render(
      <OrderActions
        orderId={ORDER_ID}
        status="printed"
        concern={null}
        canResendJobSheet={false}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /re-send job sheet/i }),
    ).not.toBeInTheDocument();

    rerender(
      <OrderActions orderId={ORDER_ID} status="printed" concern={null} canResendJobSheet />,
    );
    expect(
      screen.getByRole("button", { name: /re-send job sheet/i }),
    ).toBeInTheDocument();
  });
});

describe("no route to paid", () => {
  it.each([
    ["flagged", "never-paid"],
    ["flagged", "print-failed"],
    ["paid", "awaiting-print"],
    ["sent_to_printer", null],
    ["printed", null],
    ["shipped", null],
  ] as const)("offers nothing that marks a %s/%s order paid", (status, concern) => {
    render(
      <OrderActions
        orderId={ORDER_ID}
        status={status}
        concern={concern}
        canResendJobSheet
      />,
    );

    // Only a verified ITN may mark an order paid. No control here ever may.
    for (const button of screen.queryAllByRole("button")) {
      expect(button.textContent ?? "").not.toMatch(/mark paid|mark as paid|reconcile/i);
    }
  });
});
