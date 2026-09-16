import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { AwaitingRow } from "@/lib/admin/approvals";

/**
 * The approvals queue lists exactly the orders an approval email is about, so
 * it is where the re-send lives and where "was the customer told?" is answered.
 */

const { listAwaitingMock } = vi.hoisted(() => ({ listAwaitingMock: vi.fn() }));

vi.mock("@/lib/admin/auth", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/admin/approvals", () => ({
  listAwaitingApproval: listAwaitingMock,
  listBreedRequests: vi.fn(async () => []),
}));
// One module, reached by the page as "../actions" and by OrderActions by alias.
vi.mock("@/app/admin/(dashboard)/actions", () => ({
  releaseToPrint: vi.fn(),
  markForPersonalContact: vi.fn(),
  markPrintedAction: vi.fn(),
  markShippedAction: vi.fn(),
  resendJobSheetAction: vi.fn(),
  resendArtworkReadyAction: vi.fn(),
  retryFulfillmentAction: vi.fn(),
}));

import ApprovalsPage from "./page";

function row(overrides: Partial<AwaitingRow>): AwaitingRow {
  return {
    artworkId: "art-1",
    orderId: "7ba079e9-cbc6-4901-a6a3-45ff17ea3659",
    orderRef: "KC-2609-48D35",
    email: "owner@example.co.za",
    firstName: "Sebastian",
    creatureName: "Bob",
    standoutDetail: null,
    productSlug: "tee",
    revisionCount: 0,
    revisions: [],
    needsPerson: false,
    personalContactAt: null,
    createdAt: new Date(Date.UTC(2026, 8, 16, 8, 35)),
    drawn: true,
    approvalMail: { sentCount: 0, lastSentAt: null, lastFailure: null },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("the approvals queue", () => {
  it("offers the re-send on a drawn portrait and says whether the customer was told", async () => {
    listAwaitingMock.mockResolvedValue([
      row({
        approvalMail: {
          sentCount: 1,
          lastSentAt: new Date(Date.UTC(2026, 8, 16, 8, 37)),
          lastFailure: null,
        },
      }),
    ]);

    render(await ApprovalsPage());

    const item = screen.getByRole("listitem");
    expect(
      within(item).getByRole("button", { name: /re-send approval email/i }),
    ).toBeInTheDocument();
    expect(within(item).getByText(/sent once/i)).toBeInTheDocument();
    // Release and personal contact are still there beside it.
    expect(within(item).getByRole("button", { name: /release to print/i })).toBeInTheDocument();
  });

  it("says never, beside the button, when no approval email ever went", async () => {
    listAwaitingMock.mockResolvedValue([row({})]);

    render(await ApprovalsPage());

    expect(screen.getByText(/never sent/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /re-send approval email/i })).toBeInTheDocument();
  });

  it("offers no re-send for a portrait still being drawn", async () => {
    listAwaitingMock.mockResolvedValue([row({ drawn: false })]);

    render(await ApprovalsPage());

    expect(screen.getByText(/still drawing/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /re-send approval email/i }),
    ).not.toBeInTheDocument();
  });
});
