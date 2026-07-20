// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * The CSV export endpoint. The escaping and counts are proven in
 * lib/admin/subscribers.test.ts against a real database; this file proves the
 * one thing only the route can prove: the gate. An unauthenticated request must
 * get a 401 and NOT a single row of the list, and an authenticated one must get
 * a CSV with the download headers. Auth is stubbed the way the dashboard action
 * tests stub it, so the assertion is about the route's behaviour, not the
 * cookie crypto (which session.test.ts owns).
 */

const { isAdminRequestMock } = vi.hoisted(() => ({
  isAdminRequestMock: vi.fn(),
}));

vi.mock("@/lib/admin/auth", () => ({ isAdminRequest: isAdminRequestMock }));

import { GET } from "./route";
import { upsertSubscriber } from "@/lib/newsletter";

beforeEach(() => {
  vi.stubEnv("MOCK_SERVICES", "true");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("GET /api/admin/subscribers/export", () => {
  it("refuses an unauthenticated request with 401 and no data", async () => {
    isAdminRequestMock.mockResolvedValue(false);

    const res = await GET();

    expect(res.status).toBe(401);
    const body = await res.text();
    expect(body).not.toContain("@");
    expect(body).not.toContain("email,source,status");
  });

  it("returns a CSV attachment for an authenticated request", async () => {
    isAdminRequestMock.mockResolvedValue(true);
    await upsertSubscriber({ email: "export.me@example.test", source: "footer" });

    const res = await GET();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toBe(
      'attachment; filename="subscribers.csv"',
    );

    const body = await res.text();
    expect(body.split("\r\n")[0]).toBe("email,source,status,consentAt");
    expect(body).toContain("export.me@example.test,footer,active,");
  });
});
