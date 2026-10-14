import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { databaseClient, loadLocalEnv } from "./env";
export async function migrationClient() {
  loadLocalEnv();
  return databaseClient();
}
export async function migrate() {
  const db = await migrationClient();
  try {
    await db.query(
      "SELECT pg_advisory_lock(hashtext('nalarostore-migrations'))",
    );
    await db.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz DEFAULT now())",
    );
    for (const name of (await readdir(new URL("../db/", import.meta.url)))
      .filter((n) => n.endsWith(".sql"))
      .sort()) {
      const sql = await readFile(
        new URL("../db/" + name, import.meta.url),
        "utf8",
      );
      const checksum = createHash("sha256").update(sql).digest("hex");
      const existing = (
        await db.query("SELECT checksum FROM schema_migrations WHERE name=$1", [
          name,
        ])
      ).rows[0];
      if (existing) {
        if (existing.checksum !== checksum)
          throw Error("Migration changed after application: " + name);
        continue;
      }
      await db.query("BEGIN");
      try {
        await db.query(
          sql.replace(/^BEGIN;\s*$/gm, "").replace(/^COMMIT;\s*$/gm, ""),
        );
        await db.query(
          "INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)",
          [name, checksum],
        );
        await db.query("COMMIT");
        console.log("Applied " + name);
      } catch (e) {
        await db.query("ROLLBACK");
        throw e;
      }
    }
  } finally {
    await db.end();
  }
}
if (process.argv[1]?.endsWith("migrate.ts"))
  migrate().catch(() => {
    console.error(
      "Migration failed. Check target database, permissions, and TLS. Credentials are not logged.",
    );
    process.exitCode = 1;
  });
