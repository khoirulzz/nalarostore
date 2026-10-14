import { readFile, mkdir, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { X509Certificate } from "node:crypto";
import dns from "node:dns/promises";
import { getServers } from "node:dns";
import net from "node:net";
import tls from "node:tls";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Client } from "pg";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const settings = {
  envFile: resolve(root, ".env.local"),
  caFile: resolve(root, "ca.pem"),
  reportFile: resolve(root, "test-results/aiven-diagnostics.json"),
  timeoutMs: 8000,
};
const flags = {
  "--env-file": "envFile",
  "--ca": "caFile",
  "--report": "reportFile",
  "--timeout-ms": "timeoutMs",
};
if (args.includes("--help")) {
  console.log(
    "node scripts/aiven-diagnostics.mjs [--env-file PATH] [--ca PATH] [--report PATH] [--timeout-ms 8000]\nDefault: .env.local, ca.pem, test-results/aiven-diagnostics.json. PostgreSQL diperiksa secara read-only. Node >=20.12 diperlukan.",
  );
  process.exit(0);
}
for (let i = 0; i < args.length; i += 2) {
  const key = flags[args[i]];
  if (!key || !args[i + 1]) {
    console.error("Argumen tidak valid. Gunakan --help.");
    process.exit(2);
  }
  settings[key] =
    key === "timeoutMs" ? Number(args[i + 1]) : resolve(args[i + 1]);
}
if (
  !Number.isInteger(settings.timeoutMs) ||
  settings.timeoutMs < 100 ||
  settings.timeoutMs > 30000
) {
  console.error("Timeout harus 100 sampai 30000 ms.");
  process.exit(2);
}
const report = {
  checkedAt: new Date().toISOString(),
  checks: [],
  connected: false,
  runtime: { node: process.version, platform: process.platform },
};
function errorInfo(error) {
  // Never serialize raw error messages, URLs, usernames, passwords or certificates.
  const reasons = {
    ENOTFOUND: "Host tidak ditemukan oleh DNS.",
    EAI_AGAIN: "DNS sementara tidak tersedia.",
    ECONNREFUSED: "Koneksi ke endpoint/resolver ditolak.",
    ETIMEDOUT: "Tidak ada respons sebelum batas waktu.",
    ECONNRESET: "Sambungan diputus oleh jaringan/server.",
    EHOSTUNREACH: "Host tidak dapat dijangkau.",
    ENETUNREACH: "Tidak ada jalur jaringan.",
    ENOENT: "File konfigurasi/sertifikat tidak ditemukan.",
    DATABASE_URL_MISSING: "DATABASE_URL belum diisi di file env.",
    DATABASE_URL_INVALID:
      "DATABASE_URL tidak valid atau kredensial/nama database belum lengkap.",
    ERR_OSSL_PEM_NO_START_LINE: "File CA bukan sertifikat PEM yang valid.",
    CERT_HAS_EXPIRED: "Sertifikat kedaluwarsa.",
    CERT_NOT_YET_VALID: "Sertifikat belum berlaku.",
    SELF_SIGNED_CERT_IN_CHAIN:
      "CA tidak cocok dengan rantai sertifikat server.",
    DEPTH_ZERO_SELF_SIGNED_CERT:
      "Sertifikat server tidak dipercaya oleh CA yang dipilih.",
    UNABLE_TO_VERIFY_LEAF_SIGNATURE: "Sertifikat server gagal diverifikasi.",
    ERR_TLS_CERT_ALTNAME_INVALID:
      "Nama host tidak cocok dengan sertifikat server.",
    "28P01": "Username/password PostgreSQL ditolak.",
    28000: "Otorisasi PostgreSQL ditolak.",
    "3D000": "Nama database tidak ditemukan.",
    53300: "Batas koneksi PostgreSQL tercapai.",
    42501: "Akun tidak memiliki izin untuk pemeriksaan read-only.",
    SSL_REFUSED: "Endpoint menolak SSLRequest PostgreSQL.",
    INVALID_SSL_RESPONSE: "Respons endpoint bukan protokol SSL PostgreSQL.",
  };
  const raw = error?.code;
  const code =
    typeof raw === "string" &&
    /^(?:[A-Z][A-Z0-9_]{1,79}|[0-9A-Z]{5})$/.test(raw)
      ? raw
      : "UNKNOWN";
  return {
    code,
    reason:
      reasons[code] ||
      (error?.message?.includes("timeout")
        ? "Koneksi/query timeout."
        : "Pemeriksaan gagal; detail sensitif tidak dicetak."),
  };
}
function coded(code) {
  return Object.assign(new Error(code), { code });
}
function record(stage, status, details = {}) {
  const item = { stage, status, ...details };
  report.checks.push(item);
  console.log(JSON.stringify(item));
  return item;
}
async function bounded(promise) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(coded("ETIMEDOUT")),
          settings.timeoutMs,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
async function tcp(host, port) {
  const start = performance.now();
  return new Promise((res) => {
    const socket = net.createConnection({ host, port });
    const timer = setTimeout(
      () => finish({ status: "failed", ...errorInfo(coded("ETIMEDOUT")) }),
      settings.timeoutMs,
    );
    let done = false;
    function finish(result) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      socket.destroy();
      res({ ...result, elapsedMs: Math.round(performance.now() - start) });
    }
    socket.once("connect", () => finish({ status: "passed" }));
    socket.once("error", (e) => finish({ status: "failed", ...errorInfo(e) }));
  });
}
async function postgresTLS(host, port, ca) {
  return new Promise((res) => {
    const start = performance.now();
    let socket = net.createConnection({ host, port });
    let phase = "tcp";
    let done = false;
    const timer = setTimeout(
      () => finish({ status: "failed", ...errorInfo(coded("ETIMEDOUT")) }),
      settings.timeoutMs,
    );
    function finish(result) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      socket.destroy();
      res({
        ...result,
        phase,
        elapsedMs: Math.round(performance.now() - start),
      });
    }
    const onError = (e) => finish({ status: "failed", ...errorInfo(e) });
    socket.once("error", onError);
    socket.once("close", () => {
      if (!done && phase !== "tls")
        finish({ status: "failed", ...errorInfo(coded("ECONNRESET")) });
    });
    socket.once("connect", () => {
      phase = "ssl-request";
      // PostgreSQL SSLRequest: length 8, protocol request code 80877103.
      const request = Buffer.alloc(8);
      request.writeInt32BE(8, 0);
      request.writeInt32BE(80877103, 4);
      socket.write(request);
    });
    socket.once("data", (data) => {
      socket.pause();
      if (data[0] !== 83 || data.length !== 1) {
        finish({
          status: "failed",
          ...errorInfo(
            coded(data[0] === 78 ? "SSL_REFUSED" : "INVALID_SSL_RESPONSE"),
          ),
        });
        return;
      }
      phase = "tls";
      socket.removeListener("error", onError);
      socket = tls.connect({
        socket,
        servername: host,
        ca,
        rejectUnauthorized: true,
      });
      socket.once("error", onError);
      socket.once("close", () => {
        if (!done)
          finish({ status: "failed", ...errorInfo(coded("ECONNRESET")) });
      });
      socket.once("secureConnect", () =>
        finish({
          status: "passed",
          authorized: socket.authorized,
          protocol: socket.getProtocol(),
          cipher: socket.getCipher()?.name,
        }),
      );
      socket.resume();
    });
  });
}
let firstFailure;
let currentStage = "configuration";
try {
  // Read only this file: independent of Vite, application server and process env overrides.
  const env = parseEnv(await readFile(settings.envFile, "utf8"));
  if (!env.DATABASE_URL) throw coded("DATABASE_URL_MISSING");
  let url;
  try {
    url = new URL(env.DATABASE_URL);
  } catch {
    throw coded("DATABASE_URL_INVALID");
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !url.hostname ||
    !url.username ||
    !url.password ||
    !url.pathname.slice(1)
  )
    throw coded("DATABASE_URL_INVALID");
  const host = url.hostname;
  const port = Number(url.port || 5432);
  const database = decodeURIComponent(url.pathname.slice(1));
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  )
    throw coded("DATABASE_URL_INVALID");
  record("configuration", "passed", {
    source: ".env file",
    host,
    port,
    database,
    credentialsPresent: true,
    localDatabaseMode: env.LOCAL_DATABASE_MODE || null,
  });
  record("network-context", "info", {
    dnsServers: getServers(),
    proxyConfigured: Object.fromEntries(
      ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NODE_USE_ENV_PROXY"].map(
        (k) => [k, !!process.env[k]],
      ),
    ),
    note: "Sambungan PostgreSQL memakai TCP langsung; konfigurasi proxy HTTP tidak otomatis meneruskannya.",
  });
  currentStage = "ca-file";
  const ca = await readFile(settings.caFile, "utf8");
  const cert = new X509Certificate(ca);
  const valid =
    Date.now() >= Date.parse(cert.validFrom) &&
    Date.now() <= Date.parse(cert.validTo);
  record("ca-file", valid ? "passed" : "failed", {
    validFrom: cert.validFrom,
    validTo: cert.validTo,
    fingerprint256: cert.fingerprint256,
  });
  if (!valid)
    throw coded(
      Date.now() < Date.parse(cert.validFrom)
        ? "CERT_NOT_YET_VALID"
        : "CERT_HAS_EXPIRED",
    );
  if (env.PG_CA_CERT_BASE64) {
    let matches = false;
    try {
      matches =
        new X509Certificate(Buffer.from(env.PG_CA_CERT_BASE64, "base64"))
          .fingerprint256 === cert.fingerprint256;
    } catch {}
    record("ca-env-comparison", matches ? "passed" : "warning", {
      matchesRootCA: matches,
      note: "Tes ini memakai ca.pem; perbedaan env dapat memengaruhi aplikasi.",
    });
  }
  let addresses;
  currentStage = "dns";
  try {
    addresses = await bounded(dns.lookup(host, { all: true }));
    record("dns-system", "passed", { addresses });
  } catch (e) {
    record("dns-system", "failed", errorInfo(e));
    firstFailure = "dns";
  }
  try {
    const direct = await bounded(
      Promise.allSettled([dns.resolve4(host), dns.resolve6(host)]),
    );
    record(
      "dns-records",
      direct.some((r) => r.status === "fulfilled") ? "passed" : "warning",
      {
        note: "DNS langsung dapat gagal pada resolver lokal meski resolusi sistem berhasil; ini bukan bukti host database tidak ditemukan.",
        records: direct.map((r, i) =>
          r.status === "fulfilled"
            ? { family: i ? 6 : 4, addresses: r.value }
            : { family: i ? 6 : 4, ...errorInfo(r.reason) },
        ),
      },
    );
  } catch (e) {
    record("dns-records", "warning", errorInfo(e));
  }
  const probes = await Promise.all([
    tcp(host, port),
    tcp("www.cloudflare.com", 443),
    ...(addresses || []).slice(0, 4).map((a) => tcp(a.address, port)),
  ]);
  const target = record("tcp-database", probes[0].status, probes[0]);
  const control = record("tcp-https-control", probes[1].status, {
    ...probes[1],
    host: "www.cloudflare.com",
    port: 443,
  });
  (addresses || []).slice(0, 4).forEach((a, i) =>
    record("tcp-database-ip", probes[i + 2].status, {
      address: a.address,
      family: a.family,
      ...probes[i + 2],
    }),
  );
  if (target.status !== "passed") {
    firstFailure ||= "tcp";
    record("postgresql-tls", "skipped", {
      reason: "TCP belum tersambung; sertifikat server belum dapat diuji.",
    });
    record("postgresql-login", "skipped", {
      reason: "Tidak mengirim kredensial karena TCP belum tersambung.",
    });
    report.conclusion = probes.slice(2).some((p) => p.status === "passed")
      ? "TCP menggunakan hostname gagal, tetapi IP langsung berhasil. Periksa perbedaan hasil DNS/jalur IPv4 dan IPv6 sebelum menyimpulkan port diblokir."
      : control.status === "passed"
        ? "Kegagalan terjadi sebelum TLS/login. HTTPS pembanding tersambung, tetapi port database tidak. Periksa jalur ISP/VPN/firewall, akses IP Aiven, dan endpoint layanan. Bukti ini belum menentukan perangkat yang memblokir."
        : "TCP database dan HTTPS pembanding gagal. Periksa konektivitas atau aturan jaringan untuk proses terminal. Penyebab spesifik belum dapat dipastikan.";
  } else {
    const ssl = await postgresTLS(host, port, ca);
    record("postgresql-tls", ssl.status, ssl);
    if (ssl.status !== "passed") {
      firstFailure = ssl.phase;
      record("postgresql-login", "skipped", {
        reason: "Verifikasi TLS gagal; kredensial tidak dikirim.",
      });
      report.conclusion =
        "TCP terbuka, tetapi negosiasi PostgreSQL/TLS gagal. Lihat kode kegagalan TLS; login belum diuji.";
    } else {
      const client = new Client({
        host,
        port,
        database,
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        ssl: { ca, rejectUnauthorized: true },
        connectionTimeoutMillis: settings.timeoutMs,
        query_timeout: settings.timeoutMs,
        options: "-c default_transaction_read_only=on",
        application_name: "nalarostore-diagnostics",
      });
      let phase = "postgresql-login";
      client.on("error", () => {});
      try {
        const start = performance.now();
        await client.connect();
        record(phase, "passed", {
          elapsedMs: Math.round(performance.now() - start),
        });
        phase = "read-only-query";
        await client.query("BEGIN READ ONLY");
        const info = (
          await client.query(
            "SELECT current_database() AS database,current_setting('server_version') AS version,current_setting('transaction_read_only') AS read_only",
          )
        ).rows[0];
        const tables = (
          await client.query(
            "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
          )
        ).rows.map((r) => r.tablename);
        const migrations = tables.includes("schema_migrations")
          ? (
              await client.query(
                "SELECT name,applied_at FROM schema_migrations ORDER BY name",
              )
            ).rows
          : [];
        await client.query("COMMIT");
        record(phase, "passed", { ...info, tables, migrations });
        report.connected = true;
        report.conclusion =
          "DNS, TCP, TLS, login dan query read-only berhasil. Hasil ini membuktikan koneksi terminal, belum koneksi Worker/Hyperdrive.";
      } catch (e) {
        firstFailure = phase;
        record(phase, "failed", errorInfo(e));
        report.conclusion =
          phase === "postgresql-login"
            ? "TLS valid; koneksi/login PostgreSQL gagal. Periksa kode autentikasi, nama database, atau batas koneksi."
            : "Login berhasil, tetapi query pemeriksaan gagal. Periksa hak akses atau kondisi database.";
      } finally {
        await client.end().catch(() => {});
      }
    }
  }
} catch (e) {
  firstFailure ||= currentStage;
  record(firstFailure, "failed", errorInfo(e));
  report.conclusion =
    "Konfigurasi URL atau file CA belum valid. Pemeriksaan jaringan/login belum selesai.";
}
report.firstFailure = firstFailure || null;
console.log(`\n${report.conclusion}`);
try {
  await mkdir(dirname(settings.reportFile), { recursive: true });
  await writeFile(settings.reportFile, JSON.stringify(report, null, 2) + "\n", {
    mode: 0o600,
  });
  console.log(`Laporan: ${settings.reportFile}`);
} catch {
  console.error("Laporan tidak dapat disimpan.");
  process.exitCode = 1;
}
if (!report.connected) process.exitCode = 1;
