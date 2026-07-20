// @vitest-environment node
import { describe, it, expect, afterEach, vi } from "vitest";
import {
  signOrderToken,
  signToken,
  verifyOrderToken,
  verifyToken,
} from "./order-token";

const ORDER_A = "11111111-1111-1111-1111-111111111111";
const ORDER_B = "22222222-2222-2222-2222-222222222222";

describe("order tokens", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("round-trips an order id", () => {
    expect(verifyOrderToken(signOrderToken(ORDER_A))).toBe(ORDER_A);
  });

  it("keeps the order id readable in the token", () => {
    // Support can trace a URL back to a row without cracking anything. The
    // secrecy is meant to live in the HMAC, not in hiding the id.
    expect(signOrderToken(ORDER_A).startsWith(`${ORDER_A}.`)).toBe(true);
  });

  it("gives different orders different signatures", () => {
    const a = signOrderToken(ORDER_A).split(".")[1];
    const b = signOrderToken(ORDER_B).split(".")[1];
    expect(a).not.toBe(b);
  });

  it("refuses a token whose order id was swapped for another", () => {
    // The attack this exists to stop: take your own perfectly valid token and
    // point it at somebody else's order.
    const [, signature] = signOrderToken(ORDER_A).split(".");
    expect(verifyOrderToken(`${ORDER_B}.${signature}`)).toBeNull();
  });

  it("refuses a token with an edited signature", () => {
    const token = signOrderToken(ORDER_A);
    const flipped = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");
    expect(verifyOrderToken(flipped)).toBeNull();
  });

  it("refuses a bare order id with no signature at all", () => {
    expect(verifyOrderToken(ORDER_A)).toBeNull();
    expect(verifyOrderToken(`${ORDER_A}.`)).toBeNull();
  });

  it.each([
    ["", "empty"],
    [".", "just the seam"],
    [".abc", "no order id"],
    ["not-a-token", "no seam"],
    ["a".repeat(5000), "very long"],
    [null, "null"],
    [undefined, "undefined"],
    [42, "a number"],
    [{}, "an object"],
  ])("refuses %p (%s) without throwing", (token) => {
    expect(verifyOrderToken(token)).toBeNull();
  });

  it("refuses a token minted under a different secret", () => {
    vi.stubEnv("ORDER_TOKEN_SECRET", "one-secret");
    const token = signOrderToken(ORDER_A);
    expect(verifyOrderToken(token)).toBe(ORDER_A);

    // Rotating the secret invalidates outstanding links. That is the intended
    // behaviour of a rotation, and the test that proves the secret is load-bearing.
    vi.stubEnv("ORDER_TOKEN_SECRET", "another-secret");
    expect(verifyOrderToken(token)).toBeNull();
  });

  it("signs with the configured secret rather than the dev fallback", () => {
    const fallback = signOrderToken(ORDER_A);
    vi.stubEnv("ORDER_TOKEN_SECRET", "a-real-secret");
    expect(signOrderToken(ORDER_A)).not.toBe(fallback);
  });

  it("never lets a token carry the secret", () => {
    vi.stubEnv("ORDER_TOKEN_SECRET", "a-real-secret");
    expect(signOrderToken(ORDER_A)).not.toContain("a-real-secret");
  });

  it("refuses to sign in production without a secret", () => {
    // A repo-visible fallback secret in production means forgeable order links
    // for anyone who has read the source. Boot loudly instead.
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ORDER_TOKEN_SECRET", "");
    expect(() => signOrderToken(ORDER_A)).toThrow(/ORDER_TOKEN_SECRET/);
  });
});

describe("arbitrary-value tokens", () => {
  const EMAIL_A = "sam@example.test";
  const EMAIL_B = "other@example.test";

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("round-trips an arbitrary string", () => {
    expect(verifyToken(signToken(EMAIL_A))).toBe(EMAIL_A);
  });

  it("round-trips a value that itself contains dots and an at-sign", () => {
    // An email is dot-heavy; the base64url payload is what keeps the seam clean.
    expect(verifyToken(signToken("first.last@sub.example.co.za"))).toBe(
      "first.last@sub.example.co.za",
    );
  });

  it("does not leave the raw value sitting in the token", () => {
    // Not a security property (base64url is trivially reversible), just tidiness:
    // the address is not in plain sight in a URL someone might glance at.
    expect(signToken(EMAIL_A)).not.toContain(EMAIL_A);
  });

  it("gives different values different signatures", () => {
    const a = signToken(EMAIL_A).split(".")[1];
    const b = signToken(EMAIL_B).split(".")[1];
    expect(a).not.toBe(b);
  });

  it("refuses a token whose payload was swapped for another", () => {
    const encodedB = Buffer.from(EMAIL_B, "utf8").toString("base64url");
    const [, signature] = signToken(EMAIL_A).split(".");
    expect(verifyToken(`${encodedB}.${signature}`)).toBeNull();
  });

  it("refuses a token with an edited signature", () => {
    const token = signToken(EMAIL_A);
    const flipped = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");
    expect(verifyToken(flipped)).toBeNull();
  });

  it("refuses a value token minted under a different secret", () => {
    vi.stubEnv("ORDER_TOKEN_SECRET", "one-secret");
    const token = signToken(EMAIL_A);
    expect(verifyToken(token)).toBe(EMAIL_A);

    vi.stubEnv("ORDER_TOKEN_SECRET", "another-secret");
    expect(verifyToken(token)).toBeNull();
  });

  it.each([
    ["", "empty"],
    [".", "just the seam"],
    [".abc", "no payload"],
    ["not-a-token", "no seam"],
    ["a".repeat(5000), "very long"],
    [null, "null"],
    [undefined, "undefined"],
    [42, "a number"],
    [{}, "an object"],
  ])("refuses %p (%s) without throwing", (token) => {
    expect(verifyToken(token)).toBeNull();
  });

  it("does not confuse the two token families", () => {
    // An order token's payload is a raw uuid, not base64url of anything sensible;
    // verifyToken would base64-decode it to bytes, so it must not be mistaken for
    // a value token that happens to verify. The signatures differ because the
    // signed payloads differ (raw uuid vs base64url(value)).
    const orderToken = signOrderToken(ORDER_A);
    // The order token verifies as an order token but is not a value token that
    // round-trips to the order id.
    expect(verifyOrderToken(orderToken)).toBe(ORDER_A);
    expect(verifyToken(signToken(ORDER_A))).toBe(ORDER_A);
    expect(signToken(ORDER_A)).not.toBe(orderToken);
  });

  it("never lets a value token carry the secret", () => {
    vi.stubEnv("ORDER_TOKEN_SECRET", "a-real-secret");
    expect(signToken(EMAIL_A)).not.toContain("a-real-secret");
  });
});
