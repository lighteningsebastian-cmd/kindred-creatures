/**
 * The admin's read-only window on the newsletter list: the two counts the
 * dashboard panel shows, and the CSV the owner exports. There is no write here
 * by design. Subsystem A is the capture side; the admin only ever reads it, and
 * Resend owns sending, so nothing in this module can change a subscriber.
 *
 * The CSV is built by a pure function (`subscribersToCsv`) that takes plain rows
 * and returns a string, with escaping (`escapeCsvField`) split out beside it.
 * Keeping the formatting free of HTTP and the database is what lets a comma or a
 * quote inside an email or source be tested directly, without a request or a
 * seeded row, because a broken escape is a data-integrity bug, not a cosmetic
 * one: one unescaped comma silently shifts every following column.
 */

import { count, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { subscribers } from "@/lib/db/schema";

/** The active/unsubscribed split the dashboard panel shows. */
export interface SubscriberCounts {
  active: number;
  unsubscribed: number;
}

/**
 * The two headline numbers, each from its own cheap aggregate. A COUNT with a
 * WHERE never loads a row into memory, which is the right shape even though this
 * list will be small for a long time.
 */
export async function getSubscriberCounts(): Promise<SubscriberCounts> {
  const db = await getDb();

  const [[active], [unsubscribed]] = await Promise.all([
    db
      .select({ n: count() })
      .from(subscribers)
      .where(eq(subscribers.status, "active")),
    db
      .select({ n: count() })
      .from(subscribers)
      .where(eq(subscribers.status, "unsubscribed")),
  ]);

  return {
    active: active?.n ?? 0,
    unsubscribed: unsubscribed?.n ?? 0,
  };
}

/** One line of the export, in the exact columns the header promises. */
export interface SubscriberExportRow {
  email: string;
  source: string;
  status: string;
  consentAt: Date;
}

/**
 * Every subscriber, oldest first, as the rows the CSV is built from. Read-only:
 * the export is a snapshot the owner takes to Resend or a spreadsheet, not an
 * edit surface.
 */
export async function listSubscribersForExport(): Promise<SubscriberExportRow[]> {
  const db = await getDb();
  const rows = await db
    .select({
      email: subscribers.email,
      source: subscribers.source,
      status: subscribers.status,
      consentAt: subscribers.consentAt,
    })
    .from(subscribers)
    .orderBy(subscribers.createdAt);
  return rows;
}

/** The header row, named once so the route and the tests cannot drift apart. */
export const CSV_HEADER = "email,source,status,consentAt";

/**
 * Escapes one field to RFC 4180. A field that holds a comma, a double quote, or
 * a line break is wrapped in double quotes, and any double quote inside it is
 * doubled. Everything else is returned untouched, so a plain address stays
 * readable. This is the whole reason the CSV cannot be broken by a hostile or
 * merely unusual `source` or `email`.
 */
export function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Builds the full CSV: the header, then one escaped line per subscriber, joined
 * with CRLF and terminated with one (again, RFC 4180). `consentAt` is rendered
 * as an ISO 8601 timestamp so it round-trips into any tool unambiguously.
 */
export function subscribersToCsv(rows: SubscriberExportRow[]): string {
  const lines = [CSV_HEADER];
  for (const row of rows) {
    lines.push(
      [
        escapeCsvField(row.email),
        escapeCsvField(row.source),
        escapeCsvField(row.status),
        escapeCsvField(row.consentAt.toISOString()),
      ].join(","),
    );
  }
  return lines.join("\r\n") + "\r\n";
}
