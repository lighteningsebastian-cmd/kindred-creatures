// @vitest-environment node
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import type { Artwork, Order, OrderItem } from "@/lib/db/schema";
import { verifyOrderToken } from "@/lib/order-token";
import {
  MockEmailTransport,
  resetEmailTransport,
  type EmailMessage,
} from "./send";
import {
  PRINT_LINK_TTL_SEC,
  sendJobSheet,
  sendOrderConfirmation,
  sendShippingNotification,
  sendWelcome,
} from ".";

const ORDER_ID = "4f2a1c0d-1111-2222-3333-444455556666";
const ARTWORK_ID = "aaaa1111-1111-2222-3333-444455556666";

const ORDER: Order = {
  id: ORDER_ID,
  status: "paid",
  customerId: null,
  email: "thandi@example.test",
  firstName: "Thandi",
  lastName: "Mokoena",
  phone: "0821234567",
  addressLine1: "12 Kloof Street",
  addressLine2: null,
  suburb: "Gardens",
  city: "Cape Town",
  province: "Western Cape",
  postalCode: "8001",
  subtotalZar: 1798,
  shippingZar: 0,
  totalZar: 1798,
  payfastPaymentId: "1234567",
  trackingNumber: null,
  createdAt: new Date("2026-07-17T09:00:00Z"),
};

const ITEMS: OrderItem[] = [
  {
    id: "b1b1b1b1-1111-2222-3333-444455556666",
    orderId: ORDER_ID,
    productSlug: "hoodie",
    color: "Charcoal",
    size: "L",
    qty: 2,
    unitPriceZar: 899,
    artworkId: ARTWORK_ID,
  },
];

const ARTWORKS: Artwork[] = [
  {
    id: ARTWORK_ID,
    uploadKey: "uploads/abc.png",
    style: "classic-portrait",
    previewKey: "previews/abc.png",
    printKey: "prints/abc.png",
    regenCount: 1,
    status: "ready",
    productSlug: "hoodie",
    createdAt: new Date("2026-07-17T08:30:00Z"),
  },
];

/** Captures what the transport was handed, without printing it in test output. */
function captureSends(): EmailMessage[] {
  const sent: EmailMessage[] = [];
  vi.spyOn(MockEmailTransport.prototype, "send").mockImplementation(
    async (message: EmailMessage) => {
      sent.push(message);
      return { id: "mock-email-test" };
    },
  );
  return sent;
}

describe("email helpers", () => {
  beforeEach(() => {
    resetEmailTransport();
    vi.stubEnv("MOCK_SERVICES", "true");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://kindredcreatures.co.za");
    vi.stubEnv("ORDER_TOKEN_SECRET", "test-secret");
    vi.stubEnv("PRINT_SHOP_EMAIL", "press@printshop.test");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    resetEmailTransport();
  });

  describe("sendOrderConfirmation", () => {
    it("goes to the customer with a link that verifies back to the order", async () => {
      const sent = captureSends();
      const result = await sendOrderConfirmation(ORDER, ITEMS);

      expect(result).toEqual({ ok: true, id: "mock-email-test" });
      expect(sent).toHaveLength(1);
      expect(sent[0].to).toBe("thandi@example.test");

      const match = sent[0].text.match(
        /https:\/\/kindredcreatures\.co\.za\/order\/(\S+)/,
      );
      expect(match).not.toBeNull();
      // The link is only worth anything if the token in it survives a verify.
      expect(verifyOrderToken(match![1])).toBe(ORDER_ID);
    });

    it("resolves product names out of the catalogue", async () => {
      const sent = captureSends();
      await sendOrderConfirmation(ORDER, ITEMS);
      expect(sent[0].text).toContain("The Kindred Hoodie");
      expect(sent[0].text).not.toContain("hoodie");
    });

    it("returns ok:false rather than throwing when the send fails", async () => {
      // The contract S7 depends on: a dead mailbox must never unwind an order
      // that has already been paid for.
      vi.spyOn(MockEmailTransport.prototype, "send").mockRejectedValue(
        new Error("smtp is on fire"),
      );
      vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await sendOrderConfirmation(ORDER, ITEMS);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.name).toBe("EmailSendError");
        expect(result.error.message).toContain("thandi@example.test");
      }
    });
  });

  describe("sendShippingNotification", () => {
    it("sends the tracking number to the customer", async () => {
      const sent = captureSends();
      const result = await sendShippingNotification({
        ...ORDER,
        status: "shipped",
        trackingNumber: "AR12345678ZA",
      });

      expect(result.ok).toBe(true);
      expect(sent[0].to).toBe("thandi@example.test");
      expect(sent[0].text).toContain("AR12345678ZA");
    });

    it("refuses an order with no tracking number", async () => {
      // A caller bug, not an outage: there is no such mail to send.
      await expect(sendShippingNotification(ORDER)).rejects.toThrow(TypeError);
    });
  });

  describe("sendJobSheet", () => {
    it("goes to the print shop, never to the customer", async () => {
      const sent = captureSends();
      const result = await sendJobSheet(ORDER, ITEMS, ARTWORKS);

      expect(result.ok).toBe(true);
      expect(sent[0].to).toBe("press@printshop.test");
      expect(sent[0].to).not.toBe(ORDER.email);
      // The shop can reply to a human on our side.
      expect(sent[0].replyTo).toBeTruthy();
    });

    it("carries an absolute, signed, expiring print-file link", async () => {
      const sent = captureSends();
      await sendJobSheet(ORDER, ITEMS, ARTWORKS);

      const match = sent[0].text.match(/File: (\S+)/);
      expect(match).not.toBeNull();
      const url = new URL(match![1]);
      // Relative links are dead in an inbox, so the site URL has to be on it.
      expect(url.origin).toBe("https://kindredcreatures.co.za");
      expect(url.pathname).toBe("/api/asset/prints/abc.png");
      expect(url.searchParams.get("sig")).toBeTruthy();

      const exp = Number(url.searchParams.get("exp"));
      const ttl = exp - Math.floor(Date.now() / 1000);
      expect(ttl).toBeGreaterThan(PRINT_LINK_TTL_SEC - 60);
      expect(ttl).toBeLessThanOrEqual(PRINT_LINK_TTL_SEC);
    });

    it("carries the shipping address and print dimensions", async () => {
      const sent = captureSends();
      await sendJobSheet(ORDER, ITEMS, ARTWORKS);

      expect(sent[0].text).toContain("Thandi Mokoena");
      expect(sent[0].text).toContain("12 Kloof Street");
      expect(sent[0].text).toContain("Cape Town, Western Cape");
      expect(sent[0].text).toContain("8001");
      expect(sent[0].text).toContain("280 x 350 mm");
      expect(sent[0].text).toContain("3307 x 4134 px");
    });

    it("does not send at all when PRINT_SHOP_EMAIL is unset", async () => {
      const sent = captureSends();
      vi.spyOn(console, "error").mockImplementation(() => {});
      vi.stubEnv("PRINT_SHOP_EMAIL", "");

      const result = await sendJobSheet(ORDER, ITEMS, ARTWORKS);
      expect(result.ok).toBe(false);
      // Better a logged failure than a job sheet, with a customer's address on
      // it, sent to whatever the default recipient happened to be.
      expect(sent).toHaveLength(0);
    });
  });

  describe("the mock transport end to end", () => {
    it("logs a legible job sheet with no key configured at all", async () => {
      vi.stubEnv("MOCK_SERVICES", "");
      vi.stubEnv("RESEND_API_KEY", "");
      resetEmailTransport();
      const log = vi.spyOn(console, "log").mockImplementation(() => {});

      const result = await sendJobSheet(ORDER, ITEMS, ARTWORKS);

      expect(result.ok).toBe(true);
      const summary = log.mock.calls[0][0] as string;
      expect(summary).toContain("press@printshop.test");
      expect(summary).toContain("4F2A1C0D");
      expect(summary).toContain("Thandi Mokoena");
    });
  });

  describe("sendWelcome", () => {
    it("sends a welcome carrying a signed unsubscribe link", async () => {
      const sent = captureSends();

      const result = await sendWelcome("New.Subscriber@Example.co.za");

      expect(result.ok).toBe(true);
      expect(sent).toHaveLength(1);
      // The visible link and the List-Unsubscribe header point at the same URL.
      expect(sent[0].text).toContain("/api/newsletter/unsubscribe?token=");
      expect(sent[0].headers?.["List-Unsubscribe"]).toContain(
        "/api/newsletter/unsubscribe?token=",
      );
    });

    it("returns ok:false instead of throwing when the token cannot be signed", async () => {
      // Production with no signing secret makes unsubscribeUrl throw. sendWelcome
      // must swallow that (the subscribe request already saved the subscriber and
      // must not 500), not let it escape.
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("ORDER_TOKEN_SECRET", "");
      vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await sendWelcome("someone@example.co.za");

      expect(result.ok).toBe(false);
    });
  });
});
