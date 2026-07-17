import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Customizer } from "./Customizer";
import { getProduct } from "@/lib/products";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

// The real downscale wants canvas/createImageBitmap, neither of which jsdom
// has. The flow under test only cares that it hands back an uploadable blob.
vi.mock("./downscale", () => ({
  downscaleImage: vi.fn(async (file: File) => file),
}));

/** A promise whose resolution the test controls, to observe in-flight states. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/** Minimal stand-in for the fetch Response bits the Customizer reads. */
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

const styleButton = () => screen.getByRole("button", { name: /Classic portrait/ });

beforeEach(() => {
  push.mockClear();
  // jsdom has no object-URL support; the Customizer makes one for the preview.
  URL.createObjectURL = vi.fn(() => "blob:local-photo");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Customizer state machine", () => {
  it("walks idle -> uploading -> generating -> ready", async () => {
    const user = userEvent.setup();
    const hoodie = getProduct("hoodie")!;

    const upload = deferred<Response>();
    const generate = deferred<Response>();
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url === "/api/upload") return upload.promise;
        if (url === "/api/generate") return generate.promise;
        throw new Error(`unexpected fetch: ${url}`);
      }),
    );

    const { container } = render(
      <Customizer product={hoodie} initialColor="Stone" initialSize="M" />,
    );

    // idle: nothing uploaded, so styles and the CTA are both locked.
    expect(
      screen.getByText("Upload the photo that captures them best"),
    ).toBeInTheDocument();
    expect(styleButton()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add to cart" })).toBeDisabled();

    // uploading: the request is in flight, moderation not yet answered.
    await user.upload(fileInput(container), photo());
    expect(await screen.findByText("Checking your photo")).toBeInTheDocument();
    expect(styleButton()).toBeDisabled();

    // uploaded: photo accepted, styles unlock, nothing generated yet.
    upload.resolve(jsonRes(201, { artworkId: "art-1" }));
    await waitFor(() => expect(styleButton()).toBeEnabled());
    expect(screen.getByRole("button", { name: "Add to cart" })).toBeDisabled();

    // generating: picking a style spends a try and shows the skeleton copy.
    await user.click(styleButton());
    expect(await screen.findByText("Drawing your portrait")).toBeInTheDocument();
    expect(styleButton()).toBeDisabled();

    // ready: preview lands, tries are counted down, cart opens up.
    generate.resolve(
      jsonRes(200, {
        previewUrl: "/api/asset/previews/art-1/1.png?exp=1&sig=x",
        regenCount: 1,
        remaining: 2,
      }),
    );
    expect(await screen.findByText("2 of 3 tries left")).toBeInTheDocument();
    expect(
      screen.getByAltText("Your portrait on the The Kindred Hoodie"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add to cart" })).toBeEnabled();

    // The hand-off parks the selection and routes to the cart.
    await user.click(screen.getByRole("button", { name: "Add to cart" }));
    expect(push).toHaveBeenCalledWith("/cart");
  });

  it("disables regeneration once the three-try cap is spent", async () => {
    const user = userEvent.setup();
    const hoodie = getProduct("hoodie")!;

    let spent = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/upload") return jsonRes(201, { artworkId: "art-1" });
        if (url === "/api/generate") {
          spent += 1;
          return jsonRes(200, {
            previewUrl: `/api/asset/previews/art-1/${spent}.png`,
            regenCount: spent,
            remaining: 3 - spent,
          });
        }
        throw new Error(`unexpected fetch: ${url}`);
      }),
    );

    const { container } = render(
      <Customizer product={hoodie} initialColor="Stone" initialSize="M" />,
    );

    await user.upload(fileInput(container), photo());
    await waitFor(() => expect(styleButton()).toBeEnabled());

    // Try 1 of 3: the initial style pick.
    await user.click(styleButton());
    expect(await screen.findByText("2 of 3 tries left")).toBeInTheDocument();

    const regenerate = () => screen.getByRole("button", { name: /Regenerate/ });

    // Try 2 of 3.
    await user.click(regenerate());
    expect(await screen.findByText("1 of 3 tries left")).toBeInTheDocument();
    expect(regenerate()).toBeEnabled();

    // Try 3 of 3 exhausts the cap.
    await user.click(regenerate());
    expect(await screen.findByText("0 of 3 tries left")).toBeInTheDocument();

    // At the cap both routes back to the provider are shut, and we say why.
    expect(regenerate()).toBeDisabled();
    expect(styleButton()).toBeDisabled();
    expect(
      screen.getByText(
        "You have used every try for this photo. Upload a new photo to start fresh.",
      ),
    ).toBeInTheDocument();

    // Exactly three generate calls ever reached the API.
    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.filter(([url]) => url === "/api/generate")).toHaveLength(3);

    // The finished portrait is still purchasable after the last try.
    expect(screen.getByRole("button", { name: "Add to cart" })).toBeEnabled();
  });
});
