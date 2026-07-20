import { pgTable, text, integer, uuid, timestamp } from "drizzle-orm/pg-core";
import type { ArtStyle } from "@/lib/images/provider";

/** Lifecycle of an artwork as it moves through the customizer pipeline. */
export type ArtworkStatus =
  | "uploaded"
  | "generating"
  | "ready"
  | "failed"
  | "rejected";

/**
 * One customer upload and the AI portrait we derive from it. Rows are created
 * at upload time (status "uploaded", no style yet) and updated as the customer
 * picks a style and we generate a preview. The high-res print file is produced
 * later (post-payment, Task 6), so printKey stays null through this flow.
 */
export const artworks = pgTable("artworks", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Storage key of the original photo the customer uploaded.
  uploadKey: text("upload_key").notNull(),
  // Chosen art style. Null until the customer picks one on the generate step.
  style: text("style").$type<ArtStyle>(),
  // Storage key of the watermarked, screen-res preview (set once ready).
  previewKey: text("preview_key"),
  // Storage key of the print-res file (produced post-payment, Task 6).
  printKey: text("print_key"),
  // How many previews we have generated. Capped at 3 by the generate route.
  regenCount: integer("regen_count").notNull().default(0),
  status: text("status").$type<ArtworkStatus>().notNull().default("uploaded"),
  // The garment the portrait is being made for (products.ts slug).
  productSlug: text("product_slug").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Artwork = typeof artworks.$inferSelect;
export type NewArtwork = typeof artworks.$inferInsert;

/**
 * Lifecycle of an order. "pending" is written at checkout, before payment; the
 * PayFast ITN webhook moves it to "paid" (or "flagged" when a notification does
 * not reconcile). The printer states are driven by fulfilment, not the customer.
 */
export type OrderStatus =
  | "pending"
  | "paid"
  | "sent_to_printer"
  | "printed"
  | "shipped"
  | "flagged";

/**
 * A customer order. Money is stored in whole rands (never cents) to match
 * products.ts, and every amount here is computed server-side at checkout from
 * the catalogue: the client never gets to say what an order costs.
 *
 * Rows are created with status "pending" and no payfastPaymentId. Payment is a
 * later step, so an order sitting at "pending" is normal, not an error.
 */
export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  status: text("status").$type<OrderStatus>().notNull().default("pending"),
  email: text("email").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone").notNull(),
  addressLine1: text("address_line1").notNull(),
  // Complex, unit number, etc. Plenty of SA addresses simply do not have one.
  addressLine2: text("address_line2"),
  suburb: text("suburb").notNull(),
  city: text("city").notNull(),
  province: text("province").notNull(),
  postalCode: text("postal_code").notNull(),
  subtotalZar: integer("subtotal_zar").notNull(),
  shippingZar: integer("shipping_zar").notNull(),
  totalZar: integer("total_zar").notNull(),
  // Set by the PayFast ITN webhook once payment is confirmed (Task S5).
  payfastPaymentId: text("payfast_payment_id"),
  // Set by fulfilment once the courier has a waybill.
  trackingNumber: text("tracking_number"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * One garment on an order. Prices are snapshotted at checkout so a later
 * catalogue change cannot rewrite what someone was charged. artworkId points at
 * the portrait being printed, one row per artwork.
 */
export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id),
  productSlug: text("product_slug").notNull(),
  color: text("color").notNull(),
  size: text("size").notNull(),
  qty: integer("qty").notNull(),
  unitPriceZar: integer("unit_price_zar").notNull(),
  artworkId: uuid("artwork_id")
    .notNull()
    .references(() => artworks.id),
});

/**
 * Payment notifications we have already processed. PayFast retries an ITN until
 * it gets a 200, so the webhook (Task S5) inserts here first and treats a unique
 * violation on payfastPaymentId as "already handled" rather than doing the work
 * twice. `raw` keeps the posted body verbatim for reconciliation.
 */
export const webhookEvents = pgTable("webhook_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  payfastPaymentId: text("payfast_payment_id").notNull().unique(),
  receivedAt: timestamp("received_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  raw: text("raw").notNull(),
});

/** The steps fulfilment takes, named so a log line reads as a sentence. */
export type FulfillmentStep =
  | "generate-print-file"
  | "job-sheet"
  | "order-confirmation"
  | "fulfil";

/** How a step went. "skipped" is for work a previous run had already done. */
export type FulfillmentOutcome = "ok" | "failed" | "skipped";

/**
 * The breadcrumb trail behind a fulfilled or flagged order (Task S7).
 *
 * A flagged order is a question a human asks days later ("why is this one
 * sitting here?"), and the answer has to survive the process that knew it. One
 * row per step, so the story of an order reads in `created_at` order: which
 * artwork, which step, and the error text in `detail`. Nothing secret reaches
 * this table: `detail` carries provider error messages and storage keys, never
 * a key or a signed URL.
 */
export const fulfillmentEvents = pgTable("fulfillment_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id),
  // Null for steps that are about the whole order rather than one portrait.
  artworkId: uuid("artwork_id").references(() => artworks.id),
  step: text("step").$type<FulfillmentStep>().notNull(),
  outcome: text("outcome").$type<FulfillmentOutcome>().notNull(),
  detail: text("detail"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type FulfillmentEvent = typeof fulfillmentEvents.$inferSelect;
export type NewFulfillmentEvent = typeof fulfillmentEvents.$inferInsert;

/** Where a subscriber joined the list. Drives nothing yet but is worth keeping. */
export type SubscriberSource = "footer" | "checkout";

/** Whether a subscriber currently wants email. Reactivation flips it back. */
export type SubscriberStatus = "active" | "unsubscribed";

/**
 * The newsletter list, owned in our own database (Resend Audiences mirror it but
 * are not the source of truth). Email is stored lowercased and trimmed and is
 * unique, so the list cannot hold the same address twice: re-subscribing an
 * active address is a no-op, and re-subscribing an unsubscribed one flips it back
 * to active with a fresh consentAt rather than inserting a second row. No account
 * is required to be here, by design (subsystem A is deliberately account-free).
 */
export const subscribers = pgTable("subscribers", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Lowercased and trimmed before it ever reaches here; unique across the list.
  email: text("email").notNull().unique(),
  source: text("source").$type<SubscriberSource>().notNull(),
  status: text("status")
    .$type<SubscriberStatus>()
    .notNull()
    .default("active"),
  // When consent was last given. Refreshed on reactivation (POPIA: prove intent).
  consentAt: timestamp("consent_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Subscriber = typeof subscribers.$inferSelect;
export type NewSubscriber = typeof subscribers.$inferInsert;

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type NewWebhookEvent = typeof webhookEvents.$inferInsert;

/**
 * Idempotent DDL for the schema above. We run this on first connection instead
 * of a generated migration so the local PGlite dev/test database is ready with
 * zero setup. For production (Neon) this same DDL is safe to run once at boot.
 */
export const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS artworks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_key text NOT NULL,
  style text,
  preview_key text,
  print_key text,
  regen_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'uploaded',
  product_slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending',
  email text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text NOT NULL,
  address_line1 text NOT NULL,
  address_line2 text,
  suburb text NOT NULL,
  city text NOT NULL,
  province text NOT NULL,
  postal_code text NOT NULL,
  subtotal_zar integer NOT NULL,
  shipping_zar integer NOT NULL,
  total_zar integer NOT NULL,
  payfast_payment_id text,
  tracking_number text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id),
  product_slug text NOT NULL,
  color text NOT NULL,
  size text NOT NULL,
  qty integer NOT NULL,
  unit_price_zar integer NOT NULL,
  artwork_id uuid NOT NULL REFERENCES artworks(id)
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payfast_payment_id text NOT NULL UNIQUE,
  received_at timestamptz NOT NULL DEFAULT now(),
  raw text NOT NULL
);

CREATE TABLE IF NOT EXISTS fulfillment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id),
  artwork_id uuid REFERENCES artworks(id),
  step text NOT NULL,
  outcome text NOT NULL,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fulfillment_events_order_id_idx
  ON fulfillment_events (order_id, created_at);

CREATE TABLE IF NOT EXISTS subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  source text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  consent_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
`;
