import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CheckoutForm } from "./CheckoutForm";
import { useCartStore, type CartItem } from "@/lib/cart-store";

// Rendering flushes the rehydration effect, so by the time a test can assert,
// the real store has already hydrated. This lets one test pin hydration to
// false and see what someone sees on the first paint, before their saved cart
// has been read back. The real hook is still called every render, so the rules
// of hooks hold.
const hydration = { settled: true };

vi.mock("@/lib/cart-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/cart-store")>();
  return {
    ...actual,
    useCartHydrated: () => {
      const real = actual.useCartHydrated();
      return hydration.settled ? real : false;
    },
  };
});

function line(overrides: Partial<CartItem> = {}): CartItem {
  return {
    productSlug: "hoodie",
    color: "Stone",
    size: "M",
    qty: 1,
    artworkId: "art-1",
    unitPriceZar: 899,
    ...overrides,
  };
}

const seed = (...lines: CartItem[]) => {
  for (const item of lines) useCartStore.getState().addItem(item);
};

/** Fills every field with something the validator is happy with. */
async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("First name"), "Thandi");
  await user.type(screen.getByLabelText("Last name"), "Mokoena");
  await user.type(screen.getByLabelText("Email"), "thandi@example.co.za");
  await user.type(screen.getByLabelText("Phone"), "0821234567");
  await user.type(screen.getByLabelText("Street address"), "14 Loop Street");
  await user.type(screen.getByLabelText("Suburb"), "Gardens");
  await user.type(screen.getByLabelText("City or town"), "Cape Town");
  await user.selectOptions(screen.getByLabelText("Province"), "Western Cape");
  await user.type(screen.getByLabelText("Postal code"), "8001");
}

beforeEach(() => {
  window.localStorage.clear();
  useCartStore.setState({ items: [] });
  hydration.settled = true;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CheckoutForm", () => {
  it("renders the cart lines and the priced summary", async () => {
    seed(line({ qty: 2 }));
    render(<CheckoutForm />);

    expect(
      await screen.findByRole("heading", { name: "Where should they land?" }),
    ).toBeInTheDocument();
    expect(screen.getByText("The Kindred Hoodie")).toBeInTheDocument();
    expect(screen.getByText("Stone · Size M · Qty 2")).toBeInTheDocument();

    // R 1 798 is over the R 750 free-shipping threshold the site advertises, so
    // shipping reads Free and the figure repeats as line total, subtotal, total.
    expect(screen.getAllByText("R 1 798")).toHaveLength(3);
    expect(screen.getByText("Free")).toBeInTheDocument();
  });

  it("shows a warm empty state instead of a form when the cart is empty", async () => {
    render(<CheckoutForm />);

    expect(
      await screen.findByText("There is no portrait here to send you."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start a portrait" })).toHaveAttribute(
      "href",
      "/products/hoodie",
    );
    expect(screen.queryByLabelText("First name")).toBeNull();
  });

  it("blocks submission and posts nothing while the cart is unhydrated", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    hydration.settled = false;
    seed(line());

    const { rerender } = render(<CheckoutForm />);

    // Before hydration settles there is no form to submit at all, so an empty
    // cart cannot be posted on behalf of someone who actually has one. The
    // empty state is withheld too: the cart is unknown, not known to be empty.
    expect(screen.queryByRole("button", { name: /continue to payment/i })).toBeNull();
    expect(screen.queryByText("There is no portrait here to send you.")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();

    // Once the saved cart is read back, the form and its lines appear.
    hydration.settled = true;
    rerender(<CheckoutForm />);

    expect(
      await screen.findByRole("button", { name: /continue to payment/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("The Kindred Hoodie")).toBeInTheDocument();
  });

  it("shows an inline error under each empty field and does not post", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const user = userEvent.setup();
    seed(line());

    render(<CheckoutForm />);

    await user.click(
      await screen.findByRole("button", { name: /continue to payment/i }),
    );

    expect(
      await screen.findByText("Please tell us your first name."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("We need an email address to send your order updates to."),
    ).toBeInTheDocument();
    expect(screen.getByText("Please choose your province.")).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects a postal code that is not four digits", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const user = userEvent.setup();
    seed(line());

    render(<CheckoutForm />);
    await screen.findByLabelText("First name");
    await fillForm(user);
    await user.clear(screen.getByLabelText("Postal code"));
    await user.type(screen.getByLabelText("Postal code"), "800");

    await user.click(screen.getByRole("button", { name: /continue to payment/i }));

    expect(
      await screen.findByText("A South African postal code is four digits."),
    ).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts identity and choices but never a price, then holds the order", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ orderId: "ord-7", totalZar: 998 }),
    });
    vi.stubGlobal("fetch", fetchSpy);
    const user = userEvent.setup();
    seed(line());

    render(<CheckoutForm />);
    await screen.findByLabelText("First name");
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: /continue to payment/i }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledOnce());

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/checkout");
    const body = JSON.parse(init.body);
    expect(body.email).toBe("thandi@example.co.za");
    expect(body.shipping.province).toBe("Western Cape");
    expect(body.items).toEqual([
      {
        productSlug: "hoodie",
        color: "Stone",
        size: "M",
        qty: 1,
        artworkId: "art-1",
      },
    ]);
    // The price is the server's business.
    expect(body.items[0]).not.toHaveProperty("unitPriceZar");

    // Payment is a later step: the order is held, not confirmed or charged.
    expect(
      await screen.findByText("Your order is saved and waiting for payment."),
    ).toBeInTheDocument();
    expect(screen.getByText("ord-7")).toBeInTheDocument();

    // The cart is deliberately left intact until payment is confirmed.
    expect(useCartStore.getState().items).toHaveLength(1);
  });

  it("surfaces a rejection from the server and keeps the form filled in", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        error: "One of these portraits is not finished yet.",
      }),
    });
    vi.stubGlobal("fetch", fetchSpy);
    const user = userEvent.setup();
    seed(line());

    render(<CheckoutForm />);
    await screen.findByLabelText("First name");
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: /continue to payment/i }));

    expect(
      await screen.findByText("One of these portraits is not finished yet."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("First name")).toHaveValue("Thandi");
    expect(
      screen.getByRole("button", { name: /continue to payment/i }),
    ).toBeEnabled();
  });

  it("maps server field errors back onto the fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          error: "Please check the details below and try again.",
          fields: { phone: "That phone number does not look right." },
        }),
      }),
    );
    const user = userEvent.setup();
    seed(line());

    render(<CheckoutForm />);
    await screen.findByLabelText("First name");
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: /continue to payment/i }));

    expect(
      await screen.findByText("That phone number does not look right."),
    ).toBeInTheDocument();
  });

  it("disables the button while the order is being opened", async () => {
    let release: (value: unknown) => void = () => {};
    const pending = new Promise((resolve) => {
      release = resolve;
    });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pending));
    const user = userEvent.setup();
    seed(line());

    render(<CheckoutForm />);
    await screen.findByLabelText("First name");
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: /continue to payment/i }));

    const button = await screen.findByRole("button", {
      name: /saving your order/i,
    });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");

    release({ ok: true, json: async () => ({ orderId: "ord-8", totalZar: 998 }) });
    await waitFor(() =>
      expect(
        screen.getByText("Your order is saved and waiting for payment."),
      ).toBeInTheDocument(),
    );
  });
});
