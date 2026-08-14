import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Customizer } from "./Customizer";
import { getProduct } from "@/lib/products";
import { emptyProfile, type CompanionProfile } from "@/lib/companion";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

// The real downscale wants canvas/createImageBitmap, neither of which jsdom
// has. The flow under test only cares that it hands back an uploadable blob.
vi.mock("./downscale", () => ({
  downscaleImage: vi.fn(async (file: File) => file),
}));

/** A profile complete enough to print, which is what the cart now requires. */
function fullProfile(): CompanionProfile {
  return {
    ...emptyProfile("dog"),
    name: "Fenn",
    breedId: "one-of-one-dog-brown",
    temperament: ["confident", "affectionate", "spirited"],
  };
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

/**
 * The standout question's props, so the five cases below stay about the
 * photograph. The question has its own tests at the bottom of this file.
 */
const standoutProps = {
  standoutDetail: null,
  onStandoutDetailChange: vi.fn(),
  saveDetail: vi.fn().mockResolvedValue({ ok: true }),
};

const fileInput = (container: HTMLElement) =>
  container.querySelector('input[type="file"]') as HTMLInputElement;

beforeEach(() => {
  push.mockClear();
  // jsdom has no object-URL support; the Customizer makes one for the preview.
  URL.createObjectURL = vi.fn(() => "blob:local-photo");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Customizer: the photograph, and nothing drawn", () => {
  it("takes a photo, saves the profile, and lets the cart have it", async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonRes(201, { artworkId: "art-1" })),
    );

    const { container } = render(
      <Customizer
        product={getProduct("hoodie")!}
        color={getProduct("hoodie")!.variants[0]}
        size="M"
        profile={fullProfile()}
        {...standoutProps}
        save={save}
      />,
    );

    // Nothing can be added before there is a photo.
    expect(screen.getByRole("button", { name: "Add to cart" })).toBeDisabled();

    await user.upload(fileInput(container), photo());

    // The profile is written to the artwork. This is what the drawing after
    // payment reads, so the cart must not take a line without it. No style
    // travels with it any more: there is one house style.
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        "art-1",
        expect.objectContaining({ name: "Fenn" }),
      ),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Add to cart" })).toBeEnabled(),
    );

    await user.click(screen.getByRole("button", { name: "Add to cart" }));
    expect(push).toHaveBeenCalledWith("/cart");
  });

  it("never asks anything to draw a portrait", async () => {
    // The point of the whole change: browsing costs us nothing. Front and back
    // at print quality is about R7, and most people are not buying.
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () => jsonRes(201, { artworkId: "art-1" }));
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(
      <Customizer
        product={getProduct("hoodie")!}
        color={getProduct("hoodie")!.variants[0]}
        size="M"
        profile={fullProfile()}
        {...standoutProps}
        save={vi.fn().mockResolvedValue({ ok: true })}
      />,
    );

    await user.upload(fileInput(container), photo());

    const called = fetchMock.mock.calls.map((call) => (call as unknown as [string])[0]);
    expect(called).toEqual(["/api/upload"]);
    expect(called).not.toContain("/api/generate");
    // And no counter, because there are no tries to count any more.
    expect(document.body.textContent).not.toMatch(/tries left/i);
  });

  it("holds the cart back until the profile is complete", async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonRes(201, { artworkId: "art-1" })),
    );

    const { container } = render(
      <Customizer
        product={getProduct("hoodie")!}
        color={getProduct("hoodie")!.variants[0]}
        size="M"
        // No breed and no words: the plate could not be set from this.
        profile={emptyProfile("dog")}
        {...standoutProps}
        save={save}
      />,
    );

    await user.upload(fileInput(container), photo());
    await waitFor(() =>
      expect(screen.getByText(/few details about them/i)).toBeVisible(),
    );

    expect(save).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Add to cart" })).toBeDisabled();
    expect(screen.getByText(/few details about them/i)).toBeVisible();
  });

  it("refuses a photo the moderator rejected, and keeps the reason", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonRes(422, { error: "Please choose a clear photo of your pet." })),
    );

    const { container } = render(
      <Customizer
        product={getProduct("hoodie")!}
        color={getProduct("hoodie")!.variants[0]}
        size="M"
        profile={fullProfile()}
        {...standoutProps}
        save={vi.fn()}
      />,
    );

    await user.upload(fileInput(container), photo());

    expect(await screen.findByText(/clear photo of your pet/i)).toBeVisible();
    expect(screen.getByRole("button", { name: "Add to cart" })).toBeDisabled();
  });

  it("offers no style choice at all", async () => {
    // Three cards used to sit beside the dropzone. One house style (owner
    // decision, 3 August), so the whole step is gone rather than reduced to a
    // single card that reads as a choice with one option.
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonRes(201, { artworkId: "art-1" })),
    );

    const { container } = render(
      <Customizer
        product={getProduct("hoodie")!}
        color={getProduct("hoodie")!.variants[0]}
        size="M"
        profile={fullProfile()}
        {...standoutProps}
        save={vi.fn().mockResolvedValue({ ok: true })}
      />,
    );

    await user.upload(fileInput(container), photo());
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Add to cart" })).toBeEnabled(),
    );

    for (const gone of [/Classic portrait/i, /Line sketch/i, /Watercolor/i, /pick a style/i]) {
      expect(screen.queryByText(gone)).not.toBeInTheDocument();
    }
  });
});

describe("Customizer: the standout detail", () => {
  const QUESTION = /one thing about them that really stands out/i;

  it("does not ask until there is a photograph to point at", () => {
    // The answer is a pointer at the photograph. Asking first makes somebody
    // describe a picture they have not chosen yet, and a description is the one
    // thing this field must not collect (spec-standout-detail section 2).
    render(
      <Customizer
        product={getProduct("hoodie")!}
        color={getProduct("hoodie")!.variants[0]}
        size="M"
        profile={fullProfile()}
        {...standoutProps}
        save={vi.fn().mockResolvedValue({ ok: true })}
      />,
    );

    expect(screen.queryByLabelText(QUESTION)).not.toBeInTheDocument();
  });

  it("asks once the photo is accepted, and saves what they type", async () => {
    const user = userEvent.setup();
    const onStandoutDetailChange = vi.fn();
    const saveDetail = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonRes(201, { artworkId: "art-1" })),
    );

    const { container } = render(
      <Customizer
        product={getProduct("hoodie")!}
        color={getProduct("hoodie")!.variants[0]}
        size="M"
        profile={fullProfile()}
        standoutDetail="One ear flops over"
        onStandoutDetailChange={onStandoutDetailChange}
        saveDetail={saveDetail}
        save={vi.fn().mockResolvedValue({ ok: true })}
      />,
    );

    await user.upload(fileInput(container), photo());

    const field = await screen.findByLabelText(QUESTION);
    expect(field).toHaveValue("One ear flops over");

    // It lands on the artwork, which is what the drawing reads after payment.
    await waitFor(() =>
      expect(saveDetail).toHaveBeenCalledWith("art-1", "One ear flops over"),
    );

    await user.type(field, "!");
    expect(onStandoutDetailChange).toHaveBeenCalled();
  });

  it("lets the cart have a line with no answer at all", async () => {
    // Optional means optional. A blank answer draws the portrait exactly as
    // every portrait was drawn before this question existed, so nothing about
    // the cart may depend on it.
    const user = userEvent.setup();
    const saveDetail = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonRes(201, { artworkId: "art-1" })),
    );

    const { container } = render(
      <Customizer
        product={getProduct("hoodie")!}
        color={getProduct("hoodie")!.variants[0]}
        size="M"
        profile={fullProfile()}
        standoutDetail={null}
        onStandoutDetailChange={vi.fn()}
        saveDetail={saveDetail}
        save={vi.fn().mockResolvedValue({ ok: true })}
      />,
    );

    await user.upload(fileInput(container), photo());

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Add to cart" })).toBeEnabled(),
    );
    expect(saveDetail).toHaveBeenCalledWith("art-1", null);
  });

  it("will not let the cart take a line whose answer has not been written yet", async () => {
    // The whole point of folding the detail into the saved key: a line that
    // reaches the cart without its answer is an order drawn without the one
    // thing the customer asked us to look at.
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonRes(201, { artworkId: "art-1" })),
    );

    const { container } = render(
      <Customizer
        product={getProduct("hoodie")!}
        color={getProduct("hoodie")!.variants[0]}
        size="M"
        profile={fullProfile()}
        standoutDetail="One ear flops over"
        onStandoutDetailChange={vi.fn()}
        saveDetail={vi.fn().mockResolvedValue({ ok: false })}
        save={vi.fn().mockResolvedValue({ ok: true })}
      />,
    );

    await user.upload(fileInput(container), photo());
    await screen.findByLabelText(QUESTION);

    expect(screen.getByRole("button", { name: "Add to cart" })).toBeDisabled();
  });
});
