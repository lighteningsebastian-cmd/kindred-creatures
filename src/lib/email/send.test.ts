// @vitest-environment node
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import {
  MockEmailTransport,
  ResendEmailTransport,
  emailFrom,
  getEmailTransport,
  resetEmailTransport,
  usingMockEmail,
  type EmailMessage,
} from "./send";

const MESSAGE: EmailMessage = {
  to: "shop@example.test",
  subject: "Print job 4F2A1C0D · 1 item(s)",
  html: "<p>hello</p>",
  text: "PRINT JOB 4F2A1C0D",
  replyTo: "hello@kindredcreatures.co.za",
};

describe("transport selection", () => {
  beforeEach(() => {
    resetEmailTransport();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetEmailTransport();
  });

  it("uses the mock when no key is configured", () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("MOCK_SERVICES", "");
    expect(usingMockEmail()).toBe(true);
    expect(getEmailTransport()).toBeInstanceOf(MockEmailTransport);
  });

  it("uses the mock when MOCK_SERVICES is on, key or no key", () => {
    // The point of the flag: a developer with real credentials in their env
    // still gets logs rather than mail to a real person.
    vi.stubEnv("RESEND_API_KEY", "re_live_key");
    vi.stubEnv("MOCK_SERVICES", "true");
    expect(usingMockEmail()).toBe(true);
    expect(getEmailTransport()).toBeInstanceOf(MockEmailTransport);
  });

  it("uses Resend once a key appears, with no code change", () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("MOCK_SERVICES", "");
    expect(usingMockEmail()).toBe(false);
    expect(getEmailTransport()).toBeInstanceOf(ResendEmailTransport);
  });

  it("memoises the choice", () => {
    vi.stubEnv("RESEND_API_KEY", "");
    expect(getEmailTransport()).toBe(getEmailTransport());
  });
});

describe("from address", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to our own address", () => {
    vi.stubEnv("EMAIL_FROM", "");
    expect(emailFrom()).toBe(
      "Kindred Creatures <hello@kindredcreatures.co.za>",
    );
  });

  it("takes EMAIL_FROM when set", () => {
    vi.stubEnv("EMAIL_FROM", "Test <test@example.test>");
    expect(emailFrom()).toBe("Test <test@example.test>");
  });
});

describe("mock transport", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs a legible summary and returns an id", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await new MockEmailTransport().send(MESSAGE);

    expect(result.id).toMatch(/^mock-email-/);
    const summary = log.mock.calls[0][0] as string;
    // What a developer with no key sees has to be worth reading: who it went
    // to, what it was, and the whole body.
    expect(summary).toContain("shop@example.test");
    expect(summary).toContain("4F2A1C0D");
    expect(summary).toContain("PRINT JOB 4F2A1C0D");
    expect(summary).toContain("hello@kindredcreatures.co.za");
  });

  it("gives every send a distinct id", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const transport = new MockEmailTransport();
    const first = await transport.send(MESSAGE);
    const second = await transport.send(MESSAGE);
    expect(first.id).not.toBe(second.id);
  });

  it("never prints the api key", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.stubEnv("RESEND_API_KEY", "re_super_secret");
    await new MockEmailTransport().send(MESSAGE);
    expect(log.mock.calls[0][0] as string).not.toContain("re_super_secret");
    vi.unstubAllEnvs();
  });
});

describe("resend transport", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("refuses to build a client without a key", async () => {
    // Constructing this directly with no key is a bug, not a mock request.
    vi.stubEnv("RESEND_API_KEY", "");
    await expect(new ResendEmailTransport().send(MESSAGE)).rejects.toThrow(
      /RESEND_API_KEY/,
    );
  });
});
