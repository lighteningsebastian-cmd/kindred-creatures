import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import * as schema from "./schema";
import { CREATE_TABLES_SQL } from "./schema";

/**
 * A Drizzle client bound to our schema. The concrete driver (PGlite for
 * dev/test, node-postgres for prod) is chosen at runtime; both expose the same
 * query surface for our purposes, so callers type against this.
 */
export type Db = Awaited<ReturnType<typeof createDb>>;

const USE_PROD_DB =
  process.env.NODE_ENV === "production" &&
  !!process.env.DATABASE_URL &&
  process.env.MOCK_SERVICES !== "true";

const isTest =
  process.env.NODE_ENV === "test" || process.env.VITEST === "true";

/** Location of the persistent dev database (gitignored). */
const DEV_DB_DIR = resolve(process.cwd(), ".data", "pgdata");

async function createPgliteDb() {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");

  // In-memory for tests (fast, isolated per test file); persisted on disk for
  // dev so uploads and artworks survive across requests and restarts.
  let client;
  if (isTest) {
    client = new PGlite();
  } else {
    mkdirSync(DEV_DB_DIR, { recursive: true });
    client = new PGlite(DEV_DB_DIR);
  }

  await client.exec(CREATE_TABLES_SQL);
  return drizzle(client, { schema });
}

async function createNodePgDb() {
  const { drizzle } = await import("drizzle-orm/node-postgres");
  // Non-literal specifier so bundlers do not try to resolve `pg` in dev/test
  // where it is intentionally not installed. Only reached in production.
  const pgSpecifier = "pg";
  const pg = await import(/* @vite-ignore */ pgSpecifier);
  const Pool = pg.Pool ?? pg.default?.Pool;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });
  await pool.query(CREATE_TABLES_SQL);
  return db;
}

function createDb() {
  return USE_PROD_DB ? createNodePgDb() : createPgliteDb();
}

/**
 * THE CACHE HANGS OFF globalThis, AND IT HAS TO.
 *
 * A module-level variable is one instance per MODULE REGISTRY, not one per
 * process, and in dev Next compiles server actions and route handlers into
 * separate bundles with registries of their own. Each one therefore built its
 * own client, and in dev that client is PGlite opening `.data/pgdata` a second
 * time: the route handler then read a snapshot taken before the action wrote,
 * and reported that a row saved seconds earlier did not exist.
 *
 * It cost an afternoon. The cart thumbnail rendered from a profile written by
 * `saveArtworkDetails`, the route serving it could not see that profile, and
 * everything looked like a bug in the thumbnail. It came right after a server
 * restart, which is the tell: the data was on disk the whole time.
 *
 * Two PGlite handles on one directory is also a good way to lose writes, so
 * this is not only about a stale read.
 *
 * Production was never affected (one bundle, and node-postgres pools against a
 * shared server see each other's commits), but "works in production, lies in
 * dev" is worse than a plain bug: it is only ever met while somebody is trying
 * to check their own work.
 */
const DB_KEY = Symbol.for("kindred.db");
type DbGlobal = typeof globalThis & { [DB_KEY]?: Promise<Db> };

/**
 * Returns the shared database client, initialising it (and creating tables) on
 * first use. Cached across requests, and across module registries, within a
 * process. In dev/test this is a local PGlite database that needs no external
 * service.
 */
export function getDb(): Promise<Db> {
  // One path, every environment. Tests still get a database each, because
  // vitest isolates a worker per test file and the global goes with it.
  const store = globalThis as DbGlobal;
  if (!store[DB_KEY]) store[DB_KEY] = createDb();
  return store[DB_KEY];
}

/**
 * Creates a fresh, isolated in-memory database with the schema applied. Handy
 * for tests that want a clean slate without touching the shared client.
 */
export async function createTestDb(): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const client = new PGlite();
  await client.exec(CREATE_TABLES_SQL);
  return drizzle(client, { schema });
}
