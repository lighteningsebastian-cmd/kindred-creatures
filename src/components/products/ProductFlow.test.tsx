import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductFlow } from "./ProductFlow";
import { getProduct } from "@/lib/products";

const { addItem } = vi.hoisted(() => ({ addItem: vi.fn() }));
const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

// Only the Customizer half touches the cart; a fake lets us read the payload.
vi.mock("@/lib/cart-store", () => ({
  useCartStore: (selector: (s: { addItem: typeof addItem }) => unknown) =>
    selector({ addItem }),
}));

// jsdom has no canvas/createImageBitmap; the flow only needs an uploadable blob.
// The flow calls server actions directly. Stubbed so this stays a component
// test: the real ones reach the database, and the fake artwork id below is not a
// uuid. Their own behaviour is covered in their own tests.
vi.mock("@/app/products/[slug]/actions", () => ({
  checkCreatureName: vi.fn(async () => ({ ok: true })),
  logBreedRequest: vi.fn(async () => {}),
  saveArtworkDetails: vi.fn(async () => ({ ok: true })),
  previewPlates: vi.fn(async () => ({
    front: { svg: "<svg/>", portrait: { x: 0, y: 0, width: 1, height: 1 } },
    back: { svg: "<svg/>", portrait: { x: 0, y: 0, width: 1, height: 1 } },
    stockUrl: null,
  })),
}));

vi.mock("@/components/customizer/downscale", () => ({
  downscaleImage: vi.fn(async (file: File) => file),
}));

function jsonRes(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

const photo = () => new File(["pretend-jpeg"], "pet.jpg", { type: "image/jpeg" });

const fileInput = (container: HTMLElement) =>
  container.querySelector('input[type="file"]') as HTMLInputElement;

const dropzone = () =>
  screen.getByRole("button", { name: "Upload a photo of your pet" });
const styleButton = () => screen.getByRole("button", { name: /Classic portrait/ });

beforeEach(() => {
  addItem.mockClear();
  push.mockClear();
  URL.createObjectURL = vi.fn(() => "blob:local-photo");
  URL.revokeObjectURL = vi.fn();
  // The flow scrolls the portrait step into view and reads reduced-motion.
  Element.prototype.scrollIntoView = vi.fn();
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as never;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ProductFlow", () => {
  it("shows the form and a garment preview with no interaction at all", () => {
    // THE GATE IS GONE (docs/spec-flow-fixes.md section 5). The owner looked at
    // the gated page twice and believed it was broken; a customer would leave.
    // Landing with no query string must show a usable page.
    const hoodie = getProduct("hoodie")!;
    const { container } = render(<ProductFlow product={hoodie} />);

    // The form is live from the first paint.
    expect(screen.getByLabelText("Their name")).toBeEnabled();
    expect(dropzone()).toHaveAttribute("aria-disabled", "false");
    expect(
      screen.queryByText(/choose a colour and size above/i),
    ).toBeNull();

    // And so is a garment, in its default colourway.
    const garment = container.querySelector('img[alt*="hoodie" i]');
    expect(garment).not.toBeNull();
  });

  it("adopts a ?color=&size= deep link on load", () => {
    const hoodie = getProduct("hoodie")!;
    render(
      <ProductFlow product={hoodie} initialColor="Charcoal" initialSize="L" />,
    );

    expect(dropzone()).toHaveAttribute("aria-disabled", "false");
    expect(screen.getByText("Charcoal")).toBeInTheDocument();
  });

  it("swaps the garment photo when the colour changes", async () => {
    const user = userEvent.setup();
    const hoodie = getProduct("hoodie")!;
    const { container } = render(
      <ProductFlow product={hoodie} initialColor="Stone" initialSize="M" />,
    );

    const src = () =>
      container.querySelector('img[alt*="hoodie" i]')?.getAttribute("src") ?? "";
    const before = src();

    await user.click(screen.getByRole("button", { name: "Charcoal" }));

    // A different photograph, and the plate is untouched: it is the same PNG
    // over a different background.
    expect(src()).not.toBe(before);
  });

  it("keeps the photo and adds to cart with the CURRENT colour after a switch", async () => {
    const user = userEvent.setup();
    const hoodie = getProduct("hoodie")!;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/upload") return jsonRes(201, { artworkId: "art-1" });
        throw new Error(`unexpected fetch: ${url}`);
      }),
    );

    const { container } = render(
      <ProductFlow product={hoodie} initialColor="Stone" initialSize="M" />,
    );
    expect(dropzone()).toHaveAttribute("aria-disabled", "false");

    // Tell us about them first: the cart will not take a line the plate cannot
    // be set from.
    // Several One of One entries (small, medium, large); any will do.
    await user.click(
      screen.getAllByRole("button", { name: /One of One/ })[0]!,
    );
    for (const word of ["Confident", "Affectionate", "Spirited"]) {
      await user.click(screen.getByRole("button", { name: word }));
    }

    await user.upload(fileInput(container), photo());
    await waitFor(() => expect(styleButton()).toBeEnabled());
    await user.click(styleButton());

    // Switch the colour AFTER the photo exists: the artwork survives and the
    // cart line is built from the new colour.
    await user.click(screen.getByRole("button", { name: "Charcoal" }));
    const addButton = screen.getByRole("button", { name: "Add to cart" });
    await waitFor(() => expect(addButton).toBeEnabled());

    await user.click(addButton);
    expect(addItem).toHaveBeenCalledTimes(1);
    expect(addItem).toHaveBeenCalledWith(
      expect.objectContaining({ artworkId: "art-1", color: "Charcoal" }),
    );
  });

});
