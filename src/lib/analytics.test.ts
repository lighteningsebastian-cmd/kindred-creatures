import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  gaMeasurementId,
  isAnalyticsEnabled,
  track,
  trackAddToCart,
  trackBeginCheckout,
  trackPhotoUploaded,
  trackPurchase,
  trackViewItem,
} from "./analytics";

const ID = "G-TEST123";

/** Installs a fake gtag and hands back the mock so a test can inspect calls. */
function stubGtag() {
  const gtag = vi.fn();
  window.gtag = gtag;
  window.dataLayer = [];
  return gtag;
}

beforeEach(() => {
  delete (window as { gtag?: unknown }).gtag;
  delete (window as { dataLayer?: unknown }).dataLayer;
});

afterEach(() => {
  vi.unstubAllEnvs();
  delete (window as { gtag?: unknown }).gtag;
  delete (window as { dataLayer?: unknown }).dataLayer;
});

describe("the env gate", () => {
  it("is disabled, and reads no id, when the var is unset", () => {
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "");
    expect(gaMeasurementId()).toBeUndefined();
    expect(isAnalyticsEnabled()).toBe(false);
  });

  it("treats a whitespace-only id as unset", () => {
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "   ");
    expect(gaMeasurementId()).toBeUndefined();
    expect(isAnalyticsEnabled()).toBe(false);
  });

  it("is enabled, and trims the id, when the var is set", () => {
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", `  ${ID}  `);
    expect(gaMeasurementId()).toBe(ID);
    expect(isAnalyticsEnabled()).toBe(true);
  });
});

describe("track with no measurement id", () => {
  it("is a no-op: gtag is never called even if one exists on the page", () => {
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "");
    const gtag = stubGtag();

    track("view_item", { item_id: "hoodie", value: 650, currency: "ZAR" });
    trackPurchase({ orderRef: "ord_1", totalZar: 650 });

    expect(gtag).not.toHaveBeenCalled();
    expect(window.dataLayer).toHaveLength(0);
  });
});

describe("track with a measurement id", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", ID);
  });

  it("does not throw when gtag has not loaded yet", () => {
    expect(() =>
      track("view_item", { item_id: "tee", value: 450, currency: "ZAR" }),
    ).not.toThrow();
  });

  it("sends the event name and params straight to gtag", () => {
    const gtag = stubGtag();
    track("add_to_cart", { item_id: "tote", value: 300, currency: "ZAR" });

    expect(gtag).toHaveBeenCalledTimes(1);
    expect(gtag).toHaveBeenCalledWith("event", "add_to_cart", {
      item_id: "tote",
      value: 300,
      currency: "ZAR",
    });
  });
});

describe("the event map is a compile-time guard", () => {
  it("rejects an unknown event name at the type level", () => {
    // If track ever accepted an arbitrary string, the @ts-expect-error below
    // would become an unused-directive error and fail the type check. That is
    // the guard: a misspelled event name cannot reach a call site.
    // @ts-expect-error "made_up_event" is not a key of AnalyticsEventMap
    const call = () => track("made_up_event", {});
    expect(typeof call).toBe("function");
  });

  it("rejects wrong params for a known event at the type level", () => {
    // @ts-expect-error purchase needs transaction_id/value/currency, not this
    const call = () => track("purchase", { item_id: "hoodie" });
    expect(typeof call).toBe("function");
  });
});

describe("the named helpers", () => {
  let gtag: ReturnType<typeof stubGtag>;

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", ID);
    gtag = stubGtag();
  });

  it("view_item carries the slug and a ZAR value", () => {
    trackViewItem({ slug: "hoodie", priceZar: 650 });
    expect(gtag).toHaveBeenCalledWith("event", "view_item", {
      item_id: "hoodie",
      value: 650,
      currency: "ZAR",
    });
  });

  it("add_to_cart carries the slug and a ZAR value", () => {
    trackAddToCart({ slug: "crewneck", priceZar: 550 });
    expect(gtag).toHaveBeenCalledWith("event", "add_to_cart", {
      item_id: "crewneck",
      value: 550,
      currency: "ZAR",
    });
  });

  it("begin_checkout carries the subtotal and item count", () => {
    trackBeginCheckout({ subtotalZar: 1200, itemCount: 2 });
    expect(gtag).toHaveBeenCalledWith("event", "begin_checkout", {
      value: 1200,
      currency: "ZAR",
      item_count: 2,
    });
  });

  it("photo_uploaded carries only the product slug", () => {
    trackPhotoUploaded({ slug: "hoodie" });
    expect(gtag).toHaveBeenCalledWith("event", "photo_uploaded", {
      product: "hoodie",
    });
  });

  it("purchase carries the order ref and total, and no PII", () => {
    trackPurchase({ orderRef: "ord_abc123", totalZar: 749 });

    expect(gtag).toHaveBeenCalledTimes(1);
    const [, name, params] = gtag.mock.calls[0] as [
      string,
      string,
      Record<string, unknown>,
    ];
    expect(name).toBe("purchase");
    expect(params).toEqual({
      transaction_id: "ord_abc123",
      value: 749,
      currency: "ZAR",
    });

    // No customer-identifying field ever travels with a purchase.
    const serialised = JSON.stringify(params);
    for (const forbidden of ["email", "name", "phone", "address", "@"]) {
      expect(serialised).not.toContain(forbidden);
    }
  });
});
