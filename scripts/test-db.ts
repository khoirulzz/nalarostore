import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { DB, connect } from "../worker/lib/db";
let local: PGlite;
let queue = Promise.resolve();
class LocalDB extends DB {
  constructor() {
    super({
      query: async (text, values) =>
        values.length
          ? local.query(text, values)
          : (await local.exec(text)).at(-1) || { rows: [] },
      end: async () => {},
    });
  }
  override async tx<T>(fn: (db: DB) => Promise<T>): Promise<T> {
    const previous = queue;
    let release: () => void = () => {};
    queue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await super.tx(fn);
    } finally {
      release();
    }
  }
}
export async function newTestConnection() {
  return process.env.TEST_DATABASE_URL
    ? connect(process.env.TEST_DATABASE_URL)
    : new LocalDB();
}
export async function startDB() {
  if (!process.env.TEST_DATABASE_URL) {
    local = new PGlite();
    await local.waitReady;
  }
  const db = await newTestConnection();
  for (const file of (await readdir(new URL("../db/", import.meta.url)))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.query(
      await readFile(new URL("../db/" + file, import.meta.url), "utf8"),
    );
  await db.client.end();
  return {
    stop: async () => {
      if (local) await local.close();
    },
  };
}
export async function snapshotLocal() {
  return local.dumpDataDir();
}
