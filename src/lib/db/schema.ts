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
 * picks a style and we generate a preview.
 *
 * The reusable inputs live here: uploadKey, style and previewKey are what a
 * re-order of the same creature onto a different product replays, so they are
 * keyed on the artwork by design (retention B). The high-res PRINT file is NOT:
 * it is per garment now, because the same portrait printed on two products needs
 * two differently sized files (300 DPI of two different print areas). See
 * order_items.printKey, which is the source of truth for a printed file.
 */
export const artworks = pgTable("artworks", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Storage key of the original photo the customer uploaded.
  uploadKey: text("upload_key").notNull(),
  // Chosen art style. Null until the customer picks one on the generate step.
  style: text("style").$type<ArtStyle>(),
  // Storage key of the watermarked, screen-res preview (set once ready).
  previewKey: text("preview_key"),
  // LEGACY, no longer the source of truth for a printed file. The print file
  // moved to order_items.printKey (retention B3) because it is per garment, not
  // per artwork. Left in place so old rows are not disturbed; fulfilment, the
  // job sheet and admin no longer read it. Do not reintroduce a dependency here.
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
 * A returning customer's account. Retention subsystem B (accounts) is
 * passwordless: there is no password column here because a magic link is the
 * whole of authentication (see login_tokens below). Email is stored lowercased
 * and trimmed and is unique, so an address is one account; `name` is nullable
 * and seeded from an order's firstName the first time guest orders are claimed.
 * Guest checkout is untouched by this table: an order carries a customerId only
 * once its email has signed in, and stays null forever otherwise.
 */
export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Lowercased and trimmed (normaliseEmail) before it ever reaches here; unique.
  email: text("email").notNull().unique(),
  // Null until we learn it from a claimed order; the account works without it.
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;

/**
 * A single-use magic-link token, at rest. The raw token is never stored: only
 * its SHA-256 hash lives here, so a leak of this table cannot be replayed into a
 * login. Rows are short-lived (expiresAt ~15 min) and single-use (usedAt flips
 * once, and a fresh request supersedes any earlier outstanding token for the
 * same email). `email` is the normalised address the link will sign in.
 */
export const loginTokens = pgTable("login_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Normalised email the token authenticates. Not a fk: a token can be minted
  // for an address before its customers row is certain to exist.
  email: text("email").notNull(),
  // SHA-256 hex of the raw token. The raw token exists only in the emailed link.
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  // Null until the link is followed; set once, which is what makes it single-use.
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type LoginToken = typeof loginTokens.$inferSelect;
export type NewLoginToken = typeof loginTokens.$inferInsert;

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
  // The short, speakable customer-facing reference (see lib/order-ref.ts):
  // KC-YYMM-XXXXX. Unique. Nullable in the type only because the column was
  // added after the table existed; every order created from now on sets it at
  // checkout. It is a label, never a credential: a short ref alone unlocks
  // nothing (the lookup needs ref AND email; the status page needs a token).
  publicRef: text("public_ref").unique(),
  email: text("email").notNull(),
  // The account this order belongs to, or null for an unclaimed guest order.
  // Set when a customer signs in with a matching email (the claim on login);
  // guest checkout never sets it and never needs to. Additive only.
  customerId: uuid("customer_id").references(() => customers.id),
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
 * the portrait being printed, one row per garment.
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
  // Storage key of this garment's print-res file, generated post-payment at
  // THIS product's print area (300 DPI). Null until fulfilment makes it, and the
  // one thing fulfilment is idempotent on: a set printKey is never regenerated,
  // so we never pay to print the same garment twice. This is per order_item, not
  // per artwork, so re-ordering one creature onto two products yields two
  // correctly-sized files rather than reusing one wrong-sized one (retention B3).
  printKey: text("print_key"),
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

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS login_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS login_tokens_token_hash_idx
  ON login_tokens (token_hash);

CREATE INDEX IF NOT EXISTS login_tokens_email_idx
  ON login_tokens (email, created_at);

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending',
  public_ref text UNIQUE,
  email text NOT NULL,
  customer_id uuid REFERENCES customers(id),
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
  artwork_id uuid NOT NULL REFERENCES artworks(id),
  print_key text
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

-- Retention B, additive: a pre-existing orders table (created before accounts
-- shipped) gains the nullable account link here. IF NOT EXISTS makes this a
-- no-op on a fresh database where the CREATE TABLE above already added it.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id);

-- Retention B3, additive: the print file moved from artworks to order_items so a
-- re-order onto a different product prints at the right size. A pre-existing
-- order_items table gains the nullable per-garment print key here; IF NOT EXISTS
-- makes it a no-op where the CREATE TABLE above already added it.
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS print_key text;

-- Delivery-hardening D1, additive: the short customer-facing order reference.
-- A pre-existing orders table gains the nullable column here (pre-launch, so
-- there is nothing to backfill); IF NOT EXISTS makes it a no-op where the
-- CREATE TABLE above already added it. The unique index is created separately
-- because ADD COLUMN cannot carry a UNIQUE constraint idempotently.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS public_ref text;

CREATE UNIQUE INDEX IF NOT EXISTS orders_public_ref_idx
  ON orders (public_ref);
`;
