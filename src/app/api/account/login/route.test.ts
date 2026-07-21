// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { sendMagicLinkMock } = vi.hoisted(() => ({
  sendMagicLinkMock: vi.fn(),
}));
vi.mock("@/lib/email", async (orig) => {
  const actual = await orig<typeof import("@/lib/email")>();
  return { ...actual, sendMagicLink: sendMagicLinkMock };
});

import { POST } from "./route";
import { findOrCreateCustomer } from "@/lib/account/customers";

function post(body: unknown) {
  return POST(
    new Request("http://test/api/account/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
}

let seq = 0;
function freshEmail() {
  seq += 1;
  return `acct.login.${seq}.${Date.now()}@example.co.za`;
}

beforeEach(() => {
  vi.stubEnv("MOCK_SERVICES", "true");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://kindredcreatures.co.za");
  sendMagicLinkMock.mockReset();
  sendMagicLinkMock.mockResolvedValue({ ok: true, id: "mail_1" });
});
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/account/login", () => {
  it("answers identically for a brand-new email and a known one, and sends a link", async () => {
    const unknown = freshEmail();
    const unknownRes = await post({ email: unknown });
    const unknownBody = await unknownRes.json();

    const known = freshEmail();
    await findOrCreateCustomer(known); // make it a known account
    const knownRes = await post({ email: known });
    const knownBody = await knownRes.json();

    expect(unknownRes.status).toBe(200);
    expect(knownRes.status).toBe(200);
    // No enumeration: the two responses are byte-for-byte the same.
    expect(unknownBody).toEqual(knownBody);
    expect(sendMagicLinkMock).toHaveBeenCalledTimes(2);
    // The link points at the callback with a token.
    expect(sendMagicLinkMock.mock.calls[0][1]).toContain(
      "/api/account/callback?token=",
    );
  });

  it("rejects a malformed email", async () => {
    const res = await post({ email: "nope" });
    expect(res.status).toBe(400);
    expect(sendMagicLinkMock).not.toHaveBeenCalled();
  });

  it("still answers generically when the email cannot be sent", async () => {
    sendMagicLinkMock.mockResolvedValue({ ok: false, error: new Error("down") });
    const res = await post({ email: freshEmail() });
    expect(res.status).toBe(200);
  });
});
