import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Customer } from "@/lib/db/schema";
import type {
  CustomerCreature,
  CustomerOrderRow,
} from "@/lib/account/creatures";

/**
 * The account page, and two things about it.
 *
 *   1. It guards itself. requireCustomer runs first, so a request with no valid
 *      session is redirected before a single query touches the database. The
 *      test forces requireCustomer to redirect the way the real guard does and
 *      asserts no creature or order query ever ran (mirrors the admin action
 *      tests' requireAdmin pattern).
 *   2. A signed-in customer with nothing yet gets a warm empty state, and one
 *      with creatures gets cards that link into the (B4) re-order flow by
 *      artworkId.
 */

const {
  requireCustomerMock,
  listCreaturesMock,
  listOrdersMock,
} = vi.hoisted(() => ({
  requireCustomerMock: vi.fn(),
  listCreaturesMock: vi.fn(),
  listOrdersMock: vi.fn(),
}));

vi.mock("@/lib/account/auth", () => ({
  requireCustomer: requireCustomerMock,
}));
vi.mock("@/lib/account/creatures", () => ({
  listCreaturesForCustomer: listCreaturesMock,
  listOrdersForCustomer: listOrdersMock,
}));
vi.mock("./actions", () => ({ logout: vi.fn() }));

import AccountPage from "./page";

const CUSTOMER: Customer = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "thandi@example.co.za",
  name: "Thandi Mokoena",
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

class RedirectError extends Error {}

beforeEach(() => {
  vi.clearAllMocks();
  requireCustomerMock.mockResolvedValue(CUSTOMER);
  listCreaturesMock.mockResolvedValue([]);
  listOrdersMock.mockResolvedValue([]);
});

/** Renders the async server component by awaiting it into an element first. */
async function renderPage() {
  render(await AccountPage());
}

describe("account page gating", () => {
  it("redirects and runs no query when there is no session", async () => {
    requireCustomerMock.mockRejectedValue(new RedirectError("redirect"));

    await expect(AccountPage()).rejects.toBeInstanceOf(RedirectError);

    expect(listCreaturesMock).not.toHaveBeenCalled();
    expect(listOrdersMock).not.toHaveBeenCalled();
  });

  it("scopes both queries to the session customer's id", async () => {
    await renderPage();

    expect(listCreaturesMock).toHaveBeenCalledWith(CUSTOMER.id);
    expect(listOrdersMock).toHaveBeenCalledWith(CUSTOMER.id);
  });
});

describe("account page empty states", () => {
  it("shows the warm empty states for a customer with nothing yet", async () => {
    await renderPage();

    expect(
      screen.getByText("Your first creature will appear here."),
    ).toBeInTheDocument();
    expect(screen.getByText(/No orders yet/)).toBeInTheDocument();
  });

  it("greets the customer by their first name", async () => {
    await renderPage();
    expect(
      screen.getByRole("heading", { name: "Welcome back, Thandi." }),
    ).toBeInTheDocument();
  });
});

describe("account page with data", () => {
  const creature: CustomerCreature = {
    artworkId: "22222222-2222-2222-2222-222222222222",
    style: "watercolor",
    styleLabel: "Watercolor",
    previewUrl: "https://signed.example/preview.svg",
    firstOrderedAt: new Date("2026-03-01T10:00:00Z"),
  };
  const order: CustomerOrderRow = {
    id: "33333333-3333-3333-3333-333333333333",
    ref: "33333333",
    status: "shipped",
    statusLabel: "On its way to you",
    createdAt: new Date("2026-03-01T10:00:00Z"),
    itemCount: 2,
    totalZar: 1798,
  };

  it("renders a creature card that links to the reorder flow by artworkId", async () => {
    listCreaturesMock.mockResolvedValue([creature]);
    await renderPage();

    const cta = screen.getByRole("link", { name: "Wear this again" });
    expect(cta).toHaveAttribute(
      "href",
      `/account/reorder/${creature.artworkId}`,
    );
    expect(screen.getByText("Watercolor")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Watercolor portrait" }),
    ).toHaveAttribute("src", creature.previewUrl);
  });

  it("renders an order row with its ref, status label and total", async () => {
    listOrdersMock.mockResolvedValue([order]);
    await renderPage();

    expect(screen.getByText("Order 33333333")).toBeInTheDocument();
    expect(screen.getByText("On its way to you")).toBeInTheDocument();
    expect(screen.getByText("R 1 798")).toBeInTheDocument();
  });
});
