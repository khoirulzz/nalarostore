import { createServer } from "node:http";
import { createServer as createViteServer } from "vite";
import { DB } from "../worker/lib/db";
import { startDB, newTestConnection } from "./test-db";
import { loadLocalEnv, databaseClient } from "./env";
import { localMedia } from "./local-media";
import { handleAPI, type RuntimeEnv } from "../worker";
import { HttpError, token } from "../worker/lib/security";
import { expireReservations } from "../worker/lib/commerce";
import { billingCycle } from "../worker/lib/billing";
loadLocalEnv();
const test = process.env.NALARO_TEST_MODE === "true";
const mode = test ? "pglite" : process.env.LOCAL_DATABASE_MODE || "pglite";
if (!["pglite", "aiven"].includes(mode))
  throw Error("LOCAL_DATABASE_MODE harus pglite atau aiven.");
const appOrigin = test
  ? "http://127.0.0.1:5175"
  : process.env.APP_ORIGIN || "http://localhost:5173";
const address = new URL(appOrigin);
if (
  address.protocol !== "http:" ||
  !["localhost", "127.0.0.1"].includes(address.hostname)
)
  throw Error(
    "APP_ORIGIN lokal harus http://localhost:PORT atau http://127.0.0.1:PORT.",
  );
const port = Number(address.port || 5173);
const startup = performance.now();
console.log("[dev] Menyiapkan database lokal (" + mode + ")...");
const pg = mode === "pglite" ? await startDB() : null;
const newConnection = async () =>
  mode === "pglite" ? newTestConnection() : new DB(await databaseClient());
const check = await newConnection();
try {
  await check.query("SELECT firebase_uid FROM users LIMIT 0");
  await check.query("SELECT pilot_until FROM stores LIMIT 0");
} catch {
  throw Error(
    "Skema belum diperbarui. Jalankan npm run db:migrate pada database yang dipilih.",
  );
} finally {
  await check.client.end();
}
const secret = process.env.TOKEN_SECRET || (mode === "pglite" ? token() : "");
if (!secret || secret.length < 32)
  throw Error("Isi TOKEN_SECRET minimal 32 karakter untuk database persisten.");
const env = {
  APP_ENV: test ? "test" : "development",
  APP_ORIGIN: appOrigin,
  ROOT_DOMAIN: process.env.ROOT_DOMAIN || "store.nalaro.digital",
  OWNER_EMAIL: test
    ? "owner@local.test"
    : process.env.OWNER_EMAIL || "uniquefactuhl@gmail.com",
  ENABLE_LIVE_CHECKOUT: test
    ? "true"
    : process.env.ENABLE_LIVE_CHECKOUT || "false",
  EMAIL_FROM: process.env.EMAIL_FROM || "hello@nalaro.digital",
  TOKEN_SECRET: secret,
  FIREBASE_PROJECT_ID: test
    ? "demo-nalarostore"
    : process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
  FIREBASE_API_KEY: test
    ? "fake-emulator-key"
    : process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY,
  FIREBASE_AUTH_EMULATOR_HOST: test
    ? "127.0.0.1:9099"
    : process.env.FIREBASE_AUTH_EMULATOR_HOST || undefined,
  MEDIA: localMedia(
    test ? ".local-media/test" : process.env.LOCAL_MEDIA_DIR || ".local-media",
  ),
} as RuntimeEnv;
if (test) {
  const base = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
  const signup = await fetch(base + "/accounts:signUp?key=fake-emulator-key", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "owner@local.test",
      password: "LocalTest123",
      returnSecureToken: true,
    }),
  });
  const account = (await signup.json()) as { localId?: string };
  if (account.localId)
    await fetch(base + "/accounts:update?key=fake-emulator-key", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer owner",
      },
      body: JSON.stringify({ localId: account.localId, emailVerified: true }),
    });
  process.env.VITE_FIREBASE_PROJECT_ID = "demo-nalarostore";
  process.env.VITE_FIREBASE_API_KEY = "fake-emulator-key";
  process.env.VITE_FIREBASE_AUTH_DOMAIN = "demo-nalarostore.firebaseapp.com";
  process.env.VITE_FIREBASE_APP_ID = "1:123:web:local";
  process.env.VITE_FIREBASE_AUTH_EMULATOR_URL = "http://127.0.0.1:9099";
}
console.log("[dev] Database siap. Menyiapkan frontend...");
const vite = await createViteServer({
  mode: test ? "test" : "development",
  server: { middlewareMode: true, hmr: { port: 10000 + (port % 10000) } },
  appType: "spa",
});
const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", appOrigin);
  if (!url.pathname.startsWith("/api/")) {
    vite.middlewares(req, res);
    return;
  }
  let db: DB | undefined;
  try {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 6 * 1024 * 1024)
        throw new HttpError(413, "Permintaan terlalu besar.");
      chunks.push(chunk);
    }
    db = await newConnection();
    const request = new Request(url, {
      method: req.method,
      headers: req.headers as Record<string, string>,
      body: ["GET", "HEAD"].includes(req.method || "GET")
        ? undefined
        : Buffer.concat(chunks),
    });
    const response = await handleAPI(db, request, env);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (e) {
    const code = (e as { code?: string }).code;
    res.writeHead(
      e instanceof HttpError ? e.status : code === "23505" ? 409 : 503,
      { "content-type": "application/json", "cache-control": "no-store" },
    );
    res.end(
      JSON.stringify({
        error:
          e instanceof HttpError
            ? e.message
            : code === "23505"
              ? "Alamat, SKU atau email sudah digunakan."
              : "Database belum tersedia. Periksa konfigurasi dan koneksi.",
      }),
    );
  } finally {
    if (db) await db.client.end();
  }
});
let jobsRunning = false;
const jobs = setInterval(async () => {
  if (jobsRunning) return;
  jobsRunning = true;
  let db: DB | undefined;
  try {
    db = await newConnection();
    await expireReservations(db);
    await billingCycle(db);
  } catch {
    console.error(
      "Local scheduled jobs failed; database credentials are not logged.",
    );
  } finally {
    if (db) await db.client.end();
    jobsRunning = false;
  }
}, 60000);
jobs.unref();
server.listen(port, address.hostname, () => {
  console.log(
    "\nServer siap dalam " +
      ((performance.now() - startup) / 1000).toFixed(1) +
      " detik.",
  );
  console.log("Buka di browser: " + appOrigin);
  console.log(
    "Terminal tetap aktif selama server berjalan. Tekan Ctrl+C untuk berhenti.\n",
  );
});
server.on("error", (e: NodeJS.ErrnoException) => {
  if (e.code === "EADDRINUSE")
    console.error(
      `Port ${port} sudah digunakan. Isi APP_ORIGIN dengan port lain pada .env.local.`,
    );
  else console.error("Local server could not start.");
  void stop();
});
async function stop() {
  clearInterval(jobs);
  server.close();
  await vite.close();
  await pg?.stop();
  process.exit();
}
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => void stop());
