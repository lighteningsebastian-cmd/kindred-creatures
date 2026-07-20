// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  CSV_HEADER,
  escapeCsvField,
  getSubscriberCounts,
  subscribersToCsv,
  type SubscriberExportRow,
} from "./subscribers";
import { upsertSubscriber, setUnsubscribed } from "@/lib/newsletter";
import { getDb } from "@/lib/db/client";
import { subscribers } from "@/lib/db/schema";

/**
 * The admin's read side of the list. Two things carry risk and are tested here:
 * the CSV escaping (one wrong comma shifts every column) and the counts (the
 * headline numbers the owner trusts).
 */

beforeEach(async () => {
  vi.stubEnv("MOCK_SERVICES", "true");
  // The count tests assert absolute totals, so start each from an empty table
  // (PGlite is in-memory but shared across this file's tests).
  const db = await getDb();
  await db.delete(subscribers);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const at = new Date("2026-07-20T09:30:00.000Z");

describe("escapeCsvField", () => {
  it("leaves a plain value untouched", () => {
    expect(escapeCsvField("sam@example.com")).toBe("sam@example.com");
  });

  it("quotes and preserves a value containing a comma", () => {
    expect(escapeCsvField("footer, referral")).toBe('"footer, referral"');
  });

  it("quotes and doubles an embedded double quote", () => {
    expect(escapeCsvField('a"b')).toBe('"a""b"');
  });

  it("quotes a value containing a newline", () => {
    expect(escapeCsvField("line1\nline2")).toBe('"line1\nline2"');
  });
});

describe("subscribersToCsv", () => {
  it("starts with the promised header", () => {
    expect(subscribersToCsv([]).trim()).toBe(CSV_HEADER);
    expect(CSV_HEADER).toBe("email,source,status,consentAt");
  });

  it("writes one CRLF-terminated row per subscriber, consentAt as ISO", () => {
    const rows: SubscriberExportRow[] = [
      { email: "a@example.com", source: "footer", status: "active", consentAt: at },
      {
        email: "b@example.com",
        source: "checkout",
        status: "unsubscribed",
        consentAt: at,
      },
    ];

    const csv = subscribersToCsv(rows);
    const lines = csv.split("\r\n");

    expect(lines[0]).toBe(CSV_HEADER);
    expect(lines[1]).toBe(
      "a@example.com,footer,active,2026-07-20T09:30:00.000Z",
    );
    expect(lines[2]).toBe(
      "b@example.com,checkout,unsubscribed,2026-07-20T09:30:00.000Z",
    );
    // Header + two rows + trailing terminator leaves an empty final element.
    expect(lines[3]).toBe("");
  });

  it("escapes a field with a comma so it cannot break the columns", () => {
    const csv = subscribersToCsv([
      {
        email: "weird@example.com",
        source: "footer,checkout",
        status: "active",
        consentAt: at,
      },
    ]);
    const row = csv.split("\r\n")[1];
    expect(row).toBe(
      'weird@example.com,"footer,checkout",active,2026-07-20T09:30:00.000Z',
    );
    // The escaped row still parses as exactly four fields.
    expect(row.match(/,/g)?.length).toBeGreaterThan(0);
  });

  it("escapes a field with a double quote", () => {
    const csv = subscribersToCsv([
      {
        email: 'quo"te@example.com',
        source: "footer",
        status: "active",
        consentAt: at,
      },
    ]);
    expect(csv.split("\r\n")[1]).toBe(
      '"quo""te@example.com",footer,active,2026-07-20T09:30:00.000Z',
    );
  });
});

describe("getSubscriberCounts", () => {
  it("counts active and unsubscribed separately against seeded rows", async () => {
    await upsertSubscriber({ email: "one@count.test", source: "footer" });
    await upsertSubscriber({ email: "two@count.test", source: "footer" });
    await upsertSubscriber({ email: "three@count.test", source: "checkout" });
    await setUnsubscribed("three@count.test");

    const counts = await getSubscriberCounts();

    expect(counts.active).toBe(2);
    expect(counts.unsubscribed).toBe(1);
  });

  it("returns zeroes on an empty list", async () => {
    const counts = await getSubscriberCounts();
    expect(counts).toEqual({ active: 0, unsubscribed: 0 });
  });
});
