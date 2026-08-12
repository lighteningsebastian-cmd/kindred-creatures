// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { getDb } from "./client";

describe("getDb", () => {
  it("hands every caller the same client", async () => {
    const [first, second] = await Promise.all([getDb(), getDb()]);
    expect(first).toBe(second);
  });

  it("survives a second copy of the module and stays one database", async () => {
    // WHAT THIS GUARDS, and it cost an afternoon to find. A module-level cache
    // is one instance per module REGISTRY, not one per process, and in dev
    // Next compiles server actions and route handlers into separate bundles
    // with registries of their own. Each built its own client, which in dev is
    // PGlite opening `.data/pgdata` a second time: a route handler could not
    // see a row a server action had written seconds earlier, and the bug
    // looked like it lived in the feature reading the row.
    //
    // resetModules is the closest a test runner gets to a second registry: the
    // module is evaluated again, while the process (and its globals) carries on.
    const db = await getDb();
    await db.execute("CREATE TABLE IF NOT EXISTS registry_probe (id int)");
    await db.execute("INSERT INTO registry_probe (id) VALUES (1)");

    vi.resetModules();
    const reimported = await import("./client");
    expect(reimported.getDb).not.toBe(getDb);

    const again = await reimported.getDb();
    expect(again).toBe(db);
    // The row a "different bundle" wrote is visible, which is the whole point.
    const rows = await again.execute("SELECT id FROM registry_probe");
    expect(rows.rows).toHaveLength(1);
  });
});
