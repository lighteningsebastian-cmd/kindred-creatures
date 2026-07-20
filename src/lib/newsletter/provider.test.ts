import { describe, it, expect, afterEach, vi } from "vitest";
import { MockNewsletterProvider } from "./mock";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.resetModules();
});

describe("mock newsletter provider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("subscribe logs a legible summary and succeeds", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await new MockNewsletterProvider().subscribe({
      email: "sam@example.test",
      source: "footer",
    });
    expect(result.ok).toBe(true);
    const summary = log.mock.calls[0][0] as string;
    expect(summary).toContain("sam@example.test");
    expect(summary).toContain("footer");
  });

  it("unsubscribe succeeds", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await new MockNewsletterProvider().unsubscribe({
      email: "sam@example.test",
    });
    expect(result.ok).toBe(true);
  });
});

describe("provider selection", () => {
  it("selects the mock when MOCK_SERVICES is true even with keys set", async () => {
    vi.resetModules();
    process.env.MOCK_SERVICES = "true";
    process.env.RESEND_API_KEY = "re_should_be_ignored";
    process.env.RESEND_AUDIENCE_ID = "aud_should_be_ignored";
    const { getNewsletterProvider, usingMockNewsletter } = await import(
      "./index"
    );
    expect(usingMockNewsletter()).toBe(true);
    const provider = await getNewsletterProvider();
    // resetModules gives the imported class a fresh identity, so compare by name.
    expect(provider.constructor.name).toBe("MockNewsletterProvider");
  });

  it("selects the mock when no keys are set", async () => {
    vi.resetModules();
    delete process.env.MOCK_SERVICES;
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_AUDIENCE_ID;
    const { usingMockNewsletter } = await import("./index");
    expect(usingMockNewsletter()).toBe(true);
  });

  it("stays on the mock when the audience id is missing", async () => {
    vi.resetModules();
    delete process.env.MOCK_SERVICES;
    process.env.RESEND_API_KEY = "re_real";
    delete process.env.RESEND_AUDIENCE_ID;
    const { usingMockNewsletter } = await import("./index");
    expect(usingMockNewsletter()).toBe(true);
  });

  it("selects resend when both keys are set and mock is off", async () => {
    vi.resetModules();
    delete process.env.MOCK_SERVICES;
    process.env.RESEND_API_KEY = "re_real";
    process.env.RESEND_AUDIENCE_ID = "aud_real";
    const { getNewsletterProvider, usingMockNewsletter } = await import(
      "./index"
    );
    expect(usingMockNewsletter()).toBe(false);
    // Construction/selection only: no network, the SDK client is built lazily.
    const provider = await getNewsletterProvider();
    expect(provider.constructor.name).toBe("ResendNewsletterProvider");
  });
});
