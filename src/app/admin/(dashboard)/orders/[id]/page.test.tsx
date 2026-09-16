import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { AdminOrderDetail } from "@/lib/admin/orders";

/**
 * The order page, set up as the first test order was: paid, drawn, the
 * approval email accepted by the provider, and the customer never answered.
 * The page used to call that "fulfilment has not run".
 */

const { getAdminOrderMock } = vi.hoisted(() => ({ getAdminOrderMock: vi.fn() }));

vi.mock("@/lib/admin/auth", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/admin/orders", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin/orders")>()),
  getAdminOrder: getAdminOrderMock,
}));
vi.mock("@/app/admin/(dashboard)/actions", () => ({
  markPrintedAction: vi.fn(),
  markShippedAction: vi.fn(),
  resendJobSheetAction: vi.fn(),
  resendArtworkReadyAction: vi.fn(),
  retryFulfillmentAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import AdminOrderDetailPage from "./page";

const ORDER_ID = "7ba079e9-cbc6-4901-a6a3-45ff17ea3659";
const at = (minute: number) => new Date(Date.UTC(2026, 8, 16, 8, minute));

function detail(overrides: { drawn?: boolean; mailed?: boolean } = {}): AdminOrderDetail {
  const { drawn = true, mailed = true } = overrides;
  const event = (step: string, detailText: string, minute: number) => ({
    id: `${step}-${minute}`,
    orderId: ORDER_ID,
    artworkId: null,
    step,
    outcome: "ok",
    detail: detailText,
    createdAt: at(minute),
  });
  return {
    order: {
      id: ORDER_ID,
      publicRef: "KC-2609-48D35",
      status: "paid",
      payfastPaymentId: "3390896",
      createdAt: at(35),
      email: "owner@example.co.za",
      firstName: "Sebastian",
      lastName: "Test",
      phone: "+27820000000",
      addressLine1: "41 Marine Drive",
      addressLine2: null,
      suburb: "Summerstrand",
      city: "Port Elizabeth",
      province: "Eastern Cape",
      postalCode: "6001",
      subtotalZar: 599,
      shippingZar: 99,
      totalZar: 698,
      trackingNumber: null,
      emailBouncedAt: null,
    },
    lines: [
      {
        id: "line-1",
        productSlug: "tee",
        productName: "The Kindred Tee",
        color: "White",
        size: "S",
        qty: 1,
        unitPriceZar: 599,
        printKey: null,
        previewUrl: drawn ? "/api/asset/plates/a/front-1.png?sig=x" : null,
        printUrl: null,
        artwork: drawn
          ? { frontKey: "plates/a/front-1.png", backKey: "plates/a/back-1.png", approvedAt: null }
          : { frontKey: null, backKey: null, approvedAt: null },
      },
    ],
    events: [
      ...(drawn ? [event("draw-artwork", "front and back plates", 37)] : []),
      ...(mailed ? [event("artwork-ready", "awaiting approval (1 drawn): abc", 37)] : []),
    ],
    concern: "awaiting-print",
    emailSummary: { status: null, sends: [] },
  } as unknown as AdminOrderDetail;
}

async function renderPage() {
  render(await AdminOrderDetailPage({ params: Promise.resolve({ id: ORDER_ID }) }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("an order drawn and waiting on the customer", () => {
  it("offers the approval email instead of a retry, and does not claim nothing ran", async () => {
    getAdminOrderMock.mockResolvedValue(detail());
    await renderPage();

    expect(screen.getByRole("button", { name: /re-send approval email/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /retry fulfilment/i })).toBeNull();
    expect(screen.queryByText(/has not run/i)).toBeNull();
  });

  it("says on the timeline whether the customer was told", async () => {
    getAdminOrderMock.mockResolvedValue(detail());
    await renderPage();

    expect(screen.getByText(/approval email sent once/i)).toBeInTheDocument();
  });

  it("says never when the approval email never went", async () => {
    getAdminOrderMock.mockResolvedValue(detail({ mailed: false }));
    await renderPage();

    expect(screen.getByText(/never sent/i)).toBeInTheDocument();
  });

  it("shows the drawn plate as the line's picture, not No art", async () => {
    getAdminOrderMock.mockResolvedValue(detail());
    await renderPage();

    expect(screen.getByRole("img", { name: /portrait for the kindred tee/i })).toHaveAttribute(
      "src",
      "/api/asset/plates/a/front-1.png?sig=x",
    );
    expect(screen.queryByText("No art")).toBeNull();
  });
});

describe("an order not drawn yet", () => {
  it("keeps the retry and says nothing about approval email", async () => {
    getAdminOrderMock.mockResolvedValue(detail({ drawn: false, mailed: false }));
    await renderPage();

    expect(screen.getByRole("button", { name: /retry fulfilment/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /re-send approval email/i })).toBeNull();
    expect(screen.queryByText(/approval email/i)).toBeNull();
  });
});
