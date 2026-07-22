import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CheckoutForm } from "./CheckoutForm";
import { useCartStore, type CartItem } from "@/lib/cart-store";
import * as analytics from "@/lib/analytics";

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

/**
 * A 201 as the checkout route now answers it: the order plus the signed PayFast
 * payload that pays for it. Defaults to the mock path, which is what a
 * developer with no PayFast credentials gets.
 */
function placedBody(overrides: Record<string, unknown> = {}) {
  return {
    orderId: "ord-7",
    publicRef: "KC-2607-K4M9P",
    totalZar: 998,
    mock: true,
    processUrl: "https://sandbox.payfast.co.za/eng/process",
    fields: {
      merchant_id: "10000100",
      merchant_key: "(hidden)",
      m_payment_id: "ord-7",
      amount: "998.00",
      item_name: "Kindred Creatures order",
      signature: "589ddebdc5c8bfd40d105e39918bac1a",
    },
    ...overrides,
  };
}

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
      json: async () => placedBody(),
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

    // Nothing is charged on this step: the order is held, awaiting PayFast.
    expect(
      await screen.findByText("Your order is saved. No money changed hands."),
    ).toBeInTheDocument();
    // The reference reads back to the customer, and again as m_payment_id in
    // the payload below it.
    expect(screen.getAllByText("ord-7").length).toBeGreaterThan(0);

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

    release({ ok: true, json: async () => placedBody({ orderId: "ord-8" }) });
    await waitFor(() =>
      expect(
        screen.getByText("Your order is saved. No money changed hands."),
      ).toBeInTheDocument(),
    );
  });
});

describe("CheckoutForm: the newsletter opt-in", () => {
  const OPT_IN = /keep me posted on new styles/i;

  /**
   * Routes fetch by URL: the checkout call always resolves with a placed order;
   * the subscribe call resolves (or rejects) per `subscribe`. Returns the spy
   * so a test can inspect which URLs were hit.
   */
  function routedFetch(subscribe: { ok: boolean; reject?: boolean } = { ok: true }) {
    const spy = vi.fn((url: string) => {
      if (url === "/api/newsletter/subscribe") {
        if (subscribe.reject) return Promise.reject(new Error("network"));
        return Promise.resolve({
          ok: subscribe.ok,
          json: async () => ({ ok: subscribe.ok, alreadySubscribed: false }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => placedBody() });
    });
    vi.stubGlobal("fetch", spy);
    return spy;
  }

  const subscribeCalls = (spy: ReturnType<typeof vi.fn>) =>
    spy.mock.calls.filter(([url]) => url === "/api/newsletter/subscribe");

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is unticked by default", async () => {
    routedFetch();
    seed(line());
    render(<CheckoutForm />);
    expect(await screen.findByRole("checkbox", { name: OPT_IN })).not.toBeChecked();
  });

  it("does NOT subscribe when the box is left unticked", async () => {
    const spy = routedFetch();
    const user = userEvent.setup();
    seed(line());

    render(<CheckoutForm />);
    await screen.findByLabelText("First name");
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: /continue to payment/i }));

    await screen.findByText("Your order is saved. No money changed hands.");
    expect(subscribeCalls(spy)).toHaveLength(0);
  });

  it("subscribes with source checkout on a successful order when ticked", async () => {
    const spy = routedFetch();
    const track = vi.spyOn(analytics, "trackNewsletterSignup");
    const user = userEvent.setup();
    seed(line());

    render(<CheckoutForm />);
    await screen.findByLabelText("First name");
    await fillForm(user);
    await user.click(screen.getByRole("checkbox", { name: OPT_IN }));
    await user.click(screen.getByRole("button", { name: /continue to payment/i }));

    await screen.findByText("Your order is saved. No money changed hands.");
    await waitFor(() => expect(subscribeCalls(spy)).toHaveLength(1));
    const [, init] = subscribeCalls(spy)[0];
    expect(JSON.parse(init.body)).toEqual({
      email: "thandi@example.co.za",
      source: "checkout",
    });
    await waitFor(() =>
      expect(track).toHaveBeenCalledWith({ source: "checkout" }),
    );
  });

  it("still completes the order when the subscribe call fails", async () => {
    const spy = routedFetch({ ok: false, reject: true });
    const user = userEvent.setup();
    seed(line());

    render(<CheckoutForm />);
    await screen.findByLabelText("First name");
    await fillForm(user);
    await user.click(screen.getByRole("checkbox", { name: OPT_IN }));
    await user.click(screen.getByRole("button", { name: /continue to payment/i }));

    // The order lands regardless: the rejected subscribe never touches it.
    expect(
      await screen.findByText("Your order is saved. No money changed hands."),
    ).toBeInTheDocument();
    await waitFor(() => expect(subscribeCalls(spy)).toHaveLength(1));
    expect(useCartStore.getState().items).toHaveLength(1);
  });
});

describe("CheckoutForm: the PayFast handover", () => {
  /**
   * jsdom has no navigation, so HTMLFormElement.submit() is unimplemented and
   * noisy. Standing in for it is also the only way to prove the handover fires.
   */
  function spyOnFormSubmit() {
    const submit = vi.fn();
    vi.spyOn(HTMLFormElement.prototype, "submit").mockImplementation(submit);
    return submit;
  }

  async function placeOrder(body: Record<string, unknown>) {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => body }),
    );
    const user = userEvent.setup();
    seed(line());
    render(<CheckoutForm />);
    await screen.findByLabelText("First name");
    await fillForm(user);
    await user.click(
      screen.getByRole("button", { name: /continue to payment/i }),
    );
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("posts the server's signed fields straight to PayFast", async () => {
    const submit = spyOnFormSubmit();
    await placeOrder(
      placedBody({
        mock: false,
        fields: {
          merchant_id: "10000100",
          merchant_key: "46f0cd694581a",
          amount: "998.00",
          signature: "589ddebdc5c8bfd40d105e39918bac1a",
        },
      }),
    );

    expect(
      await screen.findByText("Handing you over to pay, safely."),
    ).toBeInTheDocument();

    // A real form POST, not a fetch: PayFast will not accept anything else.
    await waitFor(() => expect(submit).toHaveBeenCalledOnce());

    const form = document.querySelector("form[method='post']");
    expect(form).toHaveAttribute(
      "action",
      "https://sandbox.payfast.co.za/eng/process",
    );

    // Every field goes over exactly as signed. Re-deriving any of them here
    // would change the base string and PayFast would reject the payment.
    const inputs = Object.fromEntries(
      [...form!.querySelectorAll("input[type='hidden']")].map((node) => [
        node.getAttribute("name"),
        node.getAttribute("value"),
      ]),
    );
    expect(inputs).toEqual({
      merchant_id: "10000100",
      merchant_key: "46f0cd694581a",
      amount: "998.00",
      signature: "589ddebdc5c8bfd40d105e39918bac1a",
    });
  });

  it("leaves the cart alone when handing off, so an abandoned payment comes back", async () => {
    spyOnFormSubmit();
    await placeOrder(placedBody({ mock: false }));

    await screen.findByText("Handing you over to pay, safely.");
    // The portraits are still here. S5 clears the cart on confirmed payment.
    expect(useCartStore.getState().items).toHaveLength(1);
  });

  it("stays on-site and never submits a form in mock mode", async () => {
    const submit = spyOnFormSubmit();
    await placeOrder(placedBody({ mock: true }));

    expect(
      await screen.findByText("Your order is saved. No money changed hands."),
    ).toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
    expect(document.querySelector("form[method='post']")).toBeNull();
  });

  it("lays the mock payload out to be read, with no merchant key in it", async () => {
    spyOnFormSubmit();
    await placeOrder(placedBody({ mock: true }));

    await screen.findByText("Your order is saved. No money changed hands.");
    expect(screen.getByText("Inspect the signed payload")).toBeInTheDocument();
    expect(screen.getByText("amount")).toBeInTheDocument();
    expect(screen.getByText("998.00")).toBeInTheDocument();
    expect(
      screen.getByText("https://sandbox.payfast.co.za/eng/process"),
    ).toBeInTheDocument();
    // Redacted server-side; the real key must never be in the document.
    expect(screen.getByText("(hidden)")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("46f0cd694581a");
  });

  it("shows the speakable public reference on the mock panel", async () => {
    spyOnFormSubmit();
    await placeOrder(placedBody({ mock: true }));

    await screen.findByText("Your order is saved. No money changed hands.");
    // The reference the customer reads is the speakable KC ref, not the uuid.
    expect(screen.getByText("KC-2607-K4M9P")).toBeInTheDocument();
  });
});
