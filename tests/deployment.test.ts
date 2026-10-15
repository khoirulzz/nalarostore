import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { pagesResponse } from "../worker/lib/pages";
import worker, { type RuntimeEnv } from "../worker";
import { connect, DB } from "../worker/lib/db";

vi.mock("../worker/lib/db", async (original) => ({
  ...(await original<typeof import("../worker/lib/db")>()),
  connect: vi.fn(),
}));

const env = {
  APP_ENV: "production",
  APP_ORIGIN: "https://store.nalaro.digital",
  PAGES_ORIGIN: "https://nalarostore.pages.dev",
  ROOT_DOMAIN: "store.nalaro.digital",
  OWNER_EMAIL: "owner@test.invalid",
  ENABLE_LIVE_CHECKOUT: "false",
  FIREBASE_PROJECT_ID: "nalarostore",
  FIREBASE_API_KEY: "test-key",
  EMAIL_FROM: "hello@test.invalid",
  TOKEN_SECRET: "test-secret-for-deployment-fixtures-only",
} as RuntimeEnv;
const ctx = {
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn(),
  props: {},
} as ExecutionContext;
const html = () =>
  new Response("<!doctype html><title>Pages</title>", {
    headers: { "content-type": "text/html; charset=utf-8" },
  });

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

describe("separate Pages frontend", () => {
  it("loads storefront HTML without visitor credentials or tracking query strings", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(html());
    await pagesResponse(
      new Request(env.APP_ORIGIN + "/s/batik/track/private?token=private", {
        headers: { authorization: "Bearer private", cookie: "session=private" },
      }),
      env,
      true,
    );
    const [source, init] = fetcher.mock.calls[0];
    expect(String(source)).toBe(env.PAGES_ORIGIN + "/");
    const headers = new Headers(init?.headers);
    expect(headers.get("authorization")).toBeNull();
    expect(headers.get("cookie")).toBeNull();
    expect(headers.get("accept")).toBe("text/html");
    expect(init?.redirect).toBe("manual");
  });

  it("streams tenant assets from Pages with their path, query and cache validators", async () => {
    const upstream = new Response("asset", { headers: { etag: "asset-v1" } });
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(upstream);
    const response = await pagesResponse(
      new Request(
        "https://batik.store.nalaro.digital/images/batiknalaro/hero.webp?v=2",
        {
          headers: { "if-none-match": "asset-v1", authorization: "private" },
        },
      ),
      env,
    );
    expect(response).toBe(upstream);
    expect(String(fetcher.mock.calls[0][0])).toBe(
      env.PAGES_ORIGIN + "/images/batiknalaro/hero.webp?v=2",
    );
    const headers = new Headers(fetcher.mock.calls[0][1]?.headers);
    expect(headers.get("if-none-match")).toBe("asset-v1");
    expect(headers.get("authorization")).toBeNull();
  });

  it("rejects writes, API forwarding, origin loops and invalid Pages origins before fetching", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch");
    await expect(
      pagesResponse(
        new Request(env.APP_ORIGIN + "/login", { method: "POST" }),
        env,
      ),
    ).rejects.toMatchObject({ status: 405 });
    await expect(
      pagesResponse(new Request(env.APP_ORIGIN + "/api/public/plans"), env),
    ).rejects.toMatchObject({ status: 503 });
    await expect(
      pagesResponse(new Request(env.PAGES_ORIGIN + "/login"), env),
    ).rejects.toMatchObject({ status: 503 });
    for (const origin of [
      env.APP_ORIGIN,
      "http://nalarostore.pages.dev",
      "https://nalarostore.pages.dev/path",
      "https://user:password@nalarostore.pages.dev",
    ]) {
      await expect(
        pagesResponse(new Request(env.APP_ORIGIN), {
          ...env,
          PAGES_ORIGIN: origin,
        }),
      ).rejects.toMatchObject({ status: 503 });
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects an unavailable or non-HTML frontend document", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(Response.json({ error: "not a document" }));
    for (let i = 0; i < 2; i++) {
      await expect(
        pagesResponse(new Request(env.APP_ORIGIN + "/s/batik"), env, true),
      ).rejects.toMatchObject({ status: 503 });
    }
  });

  it("does not follow redirects back to the public Worker route but allows asset revalidation", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(null, {
          status: 308,
          headers: { location: env.APP_ORIGIN },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 304 }));
    await expect(
      pagesResponse(new Request(env.APP_ORIGIN + "/s/batik"), env, true),
    ).rejects.toMatchObject({ status: 503 });
    expect(
      (
        await pagesResponse(
          new Request(env.APP_ORIGIN + "/assets/style.css"),
          env,
        )
      ).status,
    ).toBe(304);
  });

  it("supports separate local preview ports only outside production", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(html());
    const request = new Request("http://127.0.0.1:8787/login");
    const localEnv = { APP_ENV: "test", PAGES_ORIGIN: "http://127.0.0.1:8788" };
    expect((await pagesResponse(request, localEnv)).status).toBe(200);
    await expect(
      pagesResponse(request, { ...localEnv, APP_ENV: "production" }),
    ).rejects.toMatchObject({ status: 503 });
  });
});

describe("same-origin API Worker", () => {
  it("serves liveness without contacting Pages or requiring the database", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch");
    const response = await worker.fetch(
      new Request(env.APP_ORIGIN + "/api/live"),
      env,
      ctx,
    );
    expect(await response.json()).toEqual({ status: "ok" });
    expect(fetcher).not.toHaveBeenCalled();
    expect(connect).not.toHaveBeenCalled();
  });

  it("preserves frontend deep links and security/indexing headers without ASSETS", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(html());
    const response = await worker.fetch(
      new Request(env.APP_ORIGIN + "/app/products"),
      env,
      ctx,
    );
    expect(String(fetcher.mock.calls[0][0])).toBe(
      env.PAGES_ORIGIN + "/app/products",
    );
    expect(await response.text()).toContain("<title>Pages</title>");
    expect(response.headers.get("content-security-policy")).toContain(
      "connect-src 'self'",
    );
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
  });

  it("turns a failed Pages document into a controlled API error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("failed", { status: 503 }),
    );
    const response = await worker.fetch(
      new Request(env.APP_ORIGIN + "/s/batik/checkout"),
      env,
      ctx,
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: "Frontend Pages belum tersedia.",
    });
  });

  it("keeps same-origin writes allowed and foreign-origin writes denied", async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      end: vi.fn(),
    };
    vi.mocked(connect).mockResolvedValue(new DB(client));
    const configured = {
      ...env,
      HYPERDRIVE: { connectionString: "postgresql://test" },
    } as RuntimeEnv;
    for (const [origin, status] of [
      [env.APP_ORIGIN, 200],
      ["https://foreign.test", 403],
    ] as const) {
      const response = await worker.fetch(
        new Request(env.APP_ORIGIN + "/api/public/capabilities", {
          method: "POST",
          headers: { origin, "sec-fetch-site": "same-origin" },
        }),
        configured,
        ctx,
      );
      expect(response.status).toBe(status);
    }
    expect(client.end).toHaveBeenCalledTimes(2);
  });
});

describe("deployment artifacts", () => {
  it("separates frontend output from backend bindings and selects the Worker config in scripts/CI", () => {
    const read = (path: string) =>
      readFileSync(new URL("../" + path, import.meta.url), "utf8");
    const pages = read("wrangler.jsonc"),
      backend = read("wrangler.worker.jsonc");
    expect(pages).toContain('"pages_build_output_dir": "./dist"');
    expect(pages).not.toMatch(/"(?:main|assets|r2_buckets|secrets|vars)"\s*:/);
    expect(backend).not.toMatch(/"(?:assets|pages_build_output_dir)"\s*:/);
    expect(backend).toContain("store.nalaro.digital/api/*");
    expect(backend).toContain("store.nalaro.digital/s/*");
    const scripts = JSON.parse(read("package.json")).scripts;
    expect(scripts["deploy:worker"]).toContain(
      "--config wrangler.worker.jsonc",
    );
    expect(scripts["deploy:worker"]).not.toContain("npm run build");
    expect(scripts.types).toContain("--config wrangler.worker.jsonc");
    expect(read(".github/workflows/checks.yml")).toContain(
      "npm run check:worker",
    );
    expect(read("public/_headers")).toContain("Content-Security-Policy:");
  });
});

describe("database readiness", () => {
  it("reports an unconfigured database as unavailable to readiness probes", async () => {
    const response = await worker.fetch(
      new Request(env.APP_ORIGIN + "/api/health"),
      env,
      ctx,
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      status: "setup-required",
      database: "not-configured",
    });
    expect(connect).not.toHaveBeenCalled();
  });

  it("checks the application schema and closes connections on schema failure", async () => {
    const client = {
      query: vi
        .fn()
        .mockRejectedValue(
          Object.assign(new Error("missing column"), { code: "42703" }),
        ),
      end: vi.fn(),
    };
    vi.mocked(connect).mockResolvedValue(new DB(client));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await worker.fetch(
      new Request(env.APP_ORIGIN + "/api/health"),
      {
        ...env,
        HYPERDRIVE: { connectionString: "postgresql://test" },
      } as RuntimeEnv,
      ctx,
    );
    expect(response.status).toBe(503);
    expect(client.query).toHaveBeenCalled();
    expect(client.end).toHaveBeenCalledOnce();
    expect(JSON.stringify(await response.json())).not.toContain(
      "missing column",
    );
  });

  it("reports readiness only after application schema queries succeed", async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      end: vi.fn(),
    };
    vi.mocked(connect).mockResolvedValue(new DB(client));
    const response = await worker.fetch(
      new Request(env.APP_ORIGIN + "/api/health"),
      {
        ...env,
        HYPERDRIVE: { connectionString: "postgresql://test" },
      } as RuntimeEnv,
      ctx,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      database: "connected",
      liveCheckout: false,
    });
    expect(client.query).toHaveBeenCalledTimes(4);
    expect(client.end).toHaveBeenCalledOnce();
  });
});
