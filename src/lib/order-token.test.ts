// @vitest-environment node
import { describe, it, expect, afterEach, vi } from "vitest";
import { signOrderToken, verifyOrderToken } from "./order-token";

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
