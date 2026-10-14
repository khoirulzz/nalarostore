import { loadLocalEnv, databaseClient } from "./env";
loadLocalEnv();
const db = await databaseClient();
try {
  const tables = (
    await db.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
    )
  ).rows;
  const migrations = tables.some((t) => t.tablename === "schema_migrations")
    ? (
        await db.query(
          "SELECT name,applied_at FROM schema_migrations ORDER BY name",
        )
      ).rows
    : [];
  console.log(
    JSON.stringify(
      { connected: true, tables: tables.map((t) => t.tablename), migrations },
      null,
      2,
    ),
  );
} finally {
  await db.end();
}
