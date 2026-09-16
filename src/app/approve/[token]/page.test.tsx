import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Artwork } from "@/lib/db/schema";

/**
 * The approval page shows what will be printed, and nothing we typeset on top.
 *
 * It used to build a fresh plate and drop the stored FRONT plate into its
 * portrait window on both sides, so the customer saw two names, two arcs and a
 * colour face where the graphite back belongs (docs/spec-first-real-order-16-sep.md
 * section 0). These tests pin the replacement: the two stored plates, each in
 * its own box, and no approving a picture that does not exist yet.
 */

const { artworkForApprovalMock, signedUrlMock } = vi.hoisted(() => ({
  artworkForApprovalMock: vi.fn(),
  signedUrlMock: vi.fn(),
}));

vi.mock("@/lib/artwork-approval", () => ({
  artworkForApproval: artworkForApprovalMock,
}));
vi.mock("@/lib/storage", () => ({
  getStorage: () => ({ getSignedUrl: signedUrlMock }),
}));
vi.mock("./actions", () => ({
  approveAction: vi.fn(),
  reviseAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import ApprovePage from "./page";

const ARTWORK = {
  id: "33333333-3333-3333-3333-333333333333",
  productSlug: "tee",
  creatureName: "Bob",
  standoutDetail: null,
  approvedAt: null,
  frontKey: "plates/a/front-1.png",
  backKey: "plates/a/back-1.png",
  canonicalKey: "portraits/a/1.png",
} as unknown as Artwork;

async function renderPage(artwork: Partial<Artwork> = {}) {
  artworkForApprovalMock.mockResolvedValue({ ...ARTWORK, ...artwork });
  render(await ApprovePage({ params: Promise.resolve({ token: "tok" }) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  signedUrlMock.mockImplementation(async (key: string) => `/signed/${key}`);
});

describe("the approval page", () => {
  it("shows the stored back plate as the back and the stored front plate as the front", async () => {
    await renderPage();

    expect(screen.getByRole("img", { name: "Back of your piece" })).toHaveAttribute(
      "src",
      "/signed/plates/a/back-1.png",
    );
    expect(
      screen.getByRole("img", { name: "Left chest of your piece" }),
    ).toHaveAttribute("src", "/signed/plates/a/front-1.png");
  });

  it("typesets nothing of its own over the plates", async () => {
    // The type is already in the bytes. A second layer is how the name and
    // the arc appeared twice.
    await renderPage();

    const sources = Array.from(document.querySelectorAll("img")).map((img) =>
      img.getAttribute("src"),
    );
    expect(sources).toHaveLength(2);
    expect(sources.some((src) => src?.startsWith("data:"))).toBe(false);
    // The canonical copy is the print file's source, not something to show.
    expect(signedUrlMock).not.toHaveBeenCalledWith(ARTWORK.canonicalKey, expect.anything());
  });

  it("boxes each plate at its own print area's shape", async () => {
    await renderPage();

    const back = screen.getByRole("img", { name: "Back of your piece" });
    const front = screen.getByRole("img", { name: "Left chest of your piece" });
    // The tee's back area and the shared chest patch.
    expect(back.parentElement).toHaveStyle({ aspectRatio: "250 / 300" });
    expect(front.parentElement).toHaveStyle({ aspectRatio: "110 / 150" });
  });

  it("offers the approval once both sides exist", async () => {
    await renderPage();

    expect(screen.getByRole("button", { name: "Yes, print it" })).toBeInTheDocument();
  });

  it("shows a missing plate as not ready, and offers nothing to approve", async () => {
    await renderPage({ backKey: null });

    expect(screen.queryByRole("img", { name: "Back of your piece" })).toBeNull();
    expect(screen.getByText("Still being drawn")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Yes, print it" })).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(/still finishing/i);
    // Never a stand-in: not the canonical copy, not the other side's plate.
    expect(signedUrlMock).toHaveBeenCalledTimes(1);
    expect(signedUrlMock).toHaveBeenCalledWith(ARTWORK.frontKey, expect.any(Number));
  });

  it("is a 404 for a token that does not open an artwork", async () => {
    artworkForApprovalMock.mockResolvedValue(null);

    await expect(
      ApprovePage({ params: Promise.resolve({ token: "forged" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
