import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Customer } from "@/lib/db/schema";
import type { ReorderableCreature } from "@/lib/account/creatures";

/**
 * The re-order page, and the two guards that stand in front of the flow.
 *
 *   1. requireCustomer runs first, so a request with no valid session is
 *      redirected before any artwork is authorized or read.
 *   2. getReorderableCreature is the authorization: when it returns null (a
 *      stranger's artwork, an unpaid artwork, an unknown id) the page redirects
 *      to /account instead of rendering the flow, leaking nothing about the id.
 */

const { requireCustomerMock, getReorderableMock, redirectMock } = vi.hoisted(
  () => ({
    requireCustomerMock: vi.fn(),
    getReorderableMock: vi.fn(),
    redirectMock: vi.fn(),
  }),
);

class RedirectError extends Error {}

vi.mock("@/lib/account/auth", () => ({
  requireCustomer: requireCustomerMock,
}));
vi.mock("@/lib/account/creatures", () => ({
  getReorderableCreature: getReorderableMock,
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    redirectMock(path);
    throw new RedirectError(path);
  },
  // The rendered flow is a client island that reads the router.
  useRouter: () => ({ push: vi.fn() }),
}));

import ReorderPage from "./page";

const CUSTOMER: Customer = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "thandi@example.co.za",
  name: "Thandi Mokoena",
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

const ARTWORK_ID = "22222222-2222-2222-2222-222222222222";

const CREATURE: ReorderableCreature = {
  artworkId: ARTWORK_ID,
  style: "watercolor",
  styleLabel: "Watercolor",
  previewUrl: "https://signed.example/preview.svg",
};

function params(artworkId: string) {
  return Promise.resolve({ artworkId });
}

beforeEach(() => {
  vi.clearAllMocks();
  requireCustomerMock.mockResolvedValue(CUSTOMER);
  getReorderableMock.mockResolvedValue(CREATURE);
});

describe("reorder page gating", () => {
  it("redirects and authorizes nothing when there is no session", async () => {
    requireCustomerMock.mockRejectedValue(new RedirectError("no-session"));

    await expect(
      ReorderPage({ params: params(ARTWORK_ID) }),
    ).rejects.toBeInstanceOf(RedirectError);

    expect(getReorderableMock).not.toHaveBeenCalled();
  });

  it("authorizes the artwork against the session customer's id", async () => {
    render(await ReorderPage({ params: params(ARTWORK_ID) }));

    expect(getReorderableMock).toHaveBeenCalledWith(CUSTOMER.id, ARTWORK_ID);
  });

  it("redirects to /account when the artwork is not the caller's paid artwork", async () => {
    getReorderableMock.mockResolvedValue(null);

    await expect(
      ReorderPage({ params: params(ARTWORK_ID) }),
    ).rejects.toBeInstanceOf(RedirectError);

    expect(redirectMock).toHaveBeenCalledWith("/account");
  });

  it("renders the re-order flow for an owned creature", async () => {
    render(await ReorderPage({ params: params(ARTWORK_ID) }));

    expect(
      screen.getByRole("heading", { name: "Put them on something new." }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Watercolor portrait" }),
    ).toHaveAttribute("src", CREATURE.previewUrl);
  });
});
