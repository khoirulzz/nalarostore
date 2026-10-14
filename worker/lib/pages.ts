import { assert } from "./security";

type PagesConfig = { PAGES_ORIGIN: string; APP_ENV: string };

/** Fetch the separately deployed frontend without forwarding visitor credentials. */
export async function pagesResponse(
  request: Request,
  env: PagesConfig,
  document = false,
): Promise<Response> {
  assert(
    request.method === "GET" || request.method === "HEAD",
    405,
    "Metode tidak tersedia.",
  );
  const source = new URL(env.PAGES_ORIGIN);
  const local =
    ["development", "test"].includes(env.APP_ENV) &&
    source.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(source.hostname);
  assert(
    (source.protocol === "https:" && source.hostname.endsWith(".pages.dev")) ||
      local,
    503,
    "Sumber frontend Pages belum dikonfigurasi.",
  );
  assert(
    !source.username &&
      !source.password &&
      source.pathname === "/" &&
      !source.search &&
      !source.hash,
    503,
    "PAGES_ORIGIN harus berupa origin Pages.",
  );
  const incoming = new URL(request.url);
  assert(
    incoming.origin !== source.origin && !incoming.pathname.startsWith("/api/"),
    503,
    "Routing Pages tidak valid.",
  );
  // Pages redirects /index.html to /; fetch its canonical root directly.
  source.pathname = document ? "/" : incoming.pathname;
  source.search = document ? "" : incoming.search;
  const headers = new Headers();
  for (const name of [
    "accept",
    "if-none-match",
    "if-modified-since",
    "range",
  ]) {
    const value = request.headers.get(name);
    if (value && !document) headers.set(name, value);
  }
  if (document) headers.set("accept", "text/html");
  const response = await fetch(source, {
    method: request.method,
    headers,
    redirect: "manual",
    signal: AbortSignal.timeout(10000),
  });
  assert(
    response.status < 300 || response.status >= 400 || response.status === 304,
    503,
    "Sumber frontend Pages tidak boleh mengalihkan permintaan.",
  );
  if (document) {
    assert(
      response.ok &&
        (response.headers.get("content-type") || "").includes("text/html"),
      503,
      "Frontend Pages belum tersedia.",
    );
  }
  return response;
}
