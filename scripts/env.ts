import { loadEnv } from "vite";
import { readFile } from "node:fs/promises";
import { Client } from "pg";

export function loadLocalEnv() {
  if (process.env.NALARO_TEST_MODE === "true") return;
  const values = loadEnv("development", process.cwd(), "");
  for (const [name, value] of Object.entries(values))
    if (process.env[name] === undefined) process.env[name] = value;
}
export function databaseURL() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (!process.env.PGHOST || !process.env.PGUSER || !process.env.PGPASSWORD)
    throw Error(
      "Isi DATABASE_URL atau PGHOST, PGUSER, PGPASSWORD pada .env.local.",
    );
  const url = new URL("postgresql://localhost");
  url.hostname = process.env.PGHOST;
  url.port = process.env.PGPORT || "5432";
  url.pathname = "/" + (process.env.PGDATABASE || "defaultdb");
  url.username = process.env.PGUSER;
  url.password = process.env.PGPASSWORD;
  return url.toString();
}
export async function databaseClient() {
  let url: URL;
  try {
    url = new URL(databaseURL());
  } catch {
    throw Error(
      "Konfigurasi database belum valid. Isi DATABASE_URL atau PGHOST/PGUSER/PGPASSWORD.",
    );
  }
  if (!["postgresql:", "postgres:"].includes(url.protocol))
    throw Error("DATABASE_URL harus memakai protokol postgresql.");
  for (const key of ["sslmode", "sslrootcert", "sslcert", "sslkey"])
    url.searchParams.delete(key);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  const ca = process.env.PG_CA_CERT_BASE64
    ? Buffer.from(process.env.PG_CA_CERT_BASE64, "base64").toString()
    : process.env.PG_CA_CERT_FILE
      ? await readFile(process.env.PG_CA_CERT_FILE, "utf8")
      : undefined;
  if (!local && !ca)
    throw Error("Isi PG_CA_CERT_FILE atau PG_CA_CERT_BASE64 untuk TLS Aiven.");
  const client = new Client({
    connectionString: url.toString(),
    ssl: local ? false : { ca, rejectUnauthorized: true },
    connectionTimeoutMillis: 5000,
    query_timeout: 10000,
  });
  await client.connect();
  return client;
}
