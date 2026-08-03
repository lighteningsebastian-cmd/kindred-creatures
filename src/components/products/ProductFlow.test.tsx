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
  it("opens on the first question, with the garment already showing", () => {
    // The profile is the commission and comes first; colour and size are
    // shopping and come last. And the preview is never gated.
    const hoodie = getProduct("hoodie")!;
    const { container } = render(<ProductFlow product={hoodie} />);

    expect(screen.getByLabelText(/what is their name/i)).toBeEnabled();
    expect(container.querySelector('img[alt*="hoodie" i]')).not.toBeNull();

    // Not a size or a swatch in sight until the questions are done.
    expect(screen.queryByRole("button", { name: "M" })).toBeNull();
  });

  it("asks one question at a time, which is what fits beside a preview", async () => {
    // Six stacked fields cannot live in the space left beside a sticky preview
    // on a phone; one question comfortably can.
    const user = userEvent.setup();
    render(<ProductFlow product={getProduct("hoodie")!} />);

    expect(screen.getByLabelText(/what is their name/i)).toBeVisible();
    // The next question is not merely below the fold, it is not rendered.
    expect(screen.queryByText("What are they?")).toBeNull();

    await user.type(screen.getByLabelText(/what is their name/i), "Fenn");
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText("What are they?")).toBeVisible();
    expect(screen.queryByLabelText(/what is their name/i)).toBeNull();
  });

  it("answers back with what was just given, and never a counter", async () => {
    const user = userEvent.setup();
    render(<ProductFlow product={getProduct("hoodie")!} />);

    await user.type(screen.getByLabelText(/what is their name/i), "Fenn");
    expect(screen.getByText(/getting to know fenn/i)).toBeVisible();

    // Dots, not "1 of 5". A number makes it a form.
    expect(document.body.textContent).not.toMatch(/\b\d\s*of\s*\d\b/);
  });

  it("reaches colour and size only after the profile, then adds to cart", async () => {
    const user = userEvent.setup();
    const hoodie = getProduct("hoodie")!;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/upload") return jsonRes(201, { artworkId: "art-1" });
        throw new Error(`unexpected fetch: ${url}`);
      }),
    );

    const { container } = render(<ProductFlow product={hoodie} />);

    await user.type(screen.getByLabelText(/what is their name/i), "Fenn");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" })); // species: dog
    await user.type(screen.getByLabelText("Their breed"), "one");
    await user.click(
      screen.getAllByRole("button", { name: /One of One/ })[0]!,
    );
    await user.click(screen.getByRole("button", { name: "Next" }));
    for (const word of ["Confident", "Affectionate", "Spirited"]) {
      await user.click(screen.getByRole("button", { name: word }));
    }
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: /see their piece/i }));

    // The reveal, then the shopping.
    expect(screen.getByText(/here is fenn's piece/i)).toBeVisible();
    await user.click(screen.getByRole("button", { name: /choose a colour/i }));

    const src = () =>
      container.querySelector('img[alt*="hoodie" i]')?.getAttribute("src") ?? "";
    const before = src();
    await user.click(screen.getByRole("button", { name: "Lilac" }));
    // Five versions of THEIR plate, not five empty garments.
    expect(src()).not.toBe(before);

    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "M" }));
    await user.click(screen.getByRole("button", { name: "Next" }));

    // And finally the photograph, which is the whole of the last step now that
    // there is no style to choose.
    await user.upload(fileInput(container), photo());

    const add = screen.getByRole("button", { name: "Add to cart" });
    await waitFor(() => expect(add).toBeEnabled());
    await user.click(add);

    expect(addItem).toHaveBeenCalledWith(
      expect.objectContaining({ artworkId: "art-1", color: "Lilac", size: "M" }),
    );
  });
});
