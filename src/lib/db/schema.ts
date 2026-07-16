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
`;
