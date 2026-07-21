// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createCustomerSessionValue,
  verifyCustomerSessionValue,
  CUSTOMER_SESSION_TTL_SEC,
} from "./session";

const CID = "11111111-2222-3333-4444-555566667777";

beforeEach(() => {
  vi.stubEnv("SESSION_SECRET", "test-session-secret");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("customer session cookie", () => {
  it("round-trips a customerId", () => {
    const value = createCustomerSessionValue(CID);
    expect(verifyCustomerSessionValue(value)).toBe(CID);
  });

  it("rejects an expired session", () => {
    const now = Date.now();
    const value = createCustomerSessionValue(CID, now);
    const later = now + (CUSTOMER_SESSION_TTL_SEC + 1) * 1000;
    expect(verifyCustomerSessionValue(value, later)).toBeNull();
  });

  it("rejects a tampered customerId", () => {
    const value = createCustomerSessionValue(CID);
    const forged = value.replace(CID, "99999999-2222-3333-4444-555566667777");
    expect(verifyCustomerSessionValue(forged)).toBeNull();
  });

  it("rejects an edited expiry", () => {
    const value = createCustomerSessionValue(CID);
    const [cid, exp, sig] = value.split(".");
    const bumped = `${cid}.${Number(exp) + 999999}.${sig}`;
    expect(verifyCustomerSessionValue(bumped)).toBeNull();
  });

  it("rejects missing and malformed values", () => {
    expect(verifyCustomerSessionValue(undefined)).toBeNull();
    expect(verifyCustomerSessionValue("")).toBeNull();
    expect(verifyCustomerSessionValue("nonsense")).toBeNull();
    expect(verifyCustomerSessionValue(`${CID}.only-two`)).toBeNull();
  });

  it("cannot be verified under a different secret", () => {
    const value = createCustomerSessionValue(CID);
    vi.stubEnv("SESSION_SECRET", "a-different-secret");
    expect(verifyCustomerSessionValue(value)).toBeNull();
  });
});
