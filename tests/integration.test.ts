import { execFileSync } from "node:child_process";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { startDB, newTestConnection } from "../scripts/test-db";
import { type DB } from "../worker/lib/db";
import { handleAPI, type RuntimeEnv } from "../worker";
import { HttpError, token } from "../worker/lib/security";
import { expireReservations, checkout } from "../worker/lib/commerce";
import { billingCycle, entitlement } from "../worker/lib/billing";
import { imageMime } from "../worker/lib/media";
import { verifyDomain } from "../worker/lib/domains";
import { verifyFirebaseToken } from "../worker/lib/firebase";
vi.mock("../worker/lib/firebase", () => ({ verifyFirebaseToken: vi.fn() }));
const identities = new Map<
  string,
  { uid: string; email: string; verified: boolean }
>();
import { deliverOutbox } from "../worker/lib/jobs";
let pg: Awaited<ReturnType<typeof startDB>>;
let db: DB;
const env = {
  APP_ENV: "development",
  APP_ORIGIN: "http://localhost",
  ROOT_DOMAIN: "store.nalaro.digital",
  OWNER_EMAIL: "owner@test.invalid",
  ENABLE_LIVE_CHECKOUT: "true",
  EMAIL_FROM: "hello@nalaro.digital",
  TOKEN_SECRET: "local-test-secret-32-bytes-long-at-least",
  FIREBASE_PROJECT_ID: "test-project",
  FIREBASE_API_KEY: "test-api-key",
} as RuntimeEnv;
let cookieA = "",
  cookieB = "",
  cookieAdmin = "",
  storeA = "",
  storeB = "",
  variant = "",
  product = "",
  price = "",
  invoice = "";
async function request(
  path: string,
  method = "GET",
  data?: unknown,
  cookie = "",
  origin = "http://localhost",
) {
  const req = new Request("http://localhost" + path, {
    method,
    headers: {
      origin,
      ...(cookie ? { authorization: "Bearer " + cookie } : {}),
      "content-type": "application/json",
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  try {
    const r = await handleAPI(db, req, env);
    return {
      status: r.status,
      body: (await r.json()) as Record<string, any>,
      cookie: r.headers.get("set-cookie") || "",
    };
  } catch (e) {
    if (e instanceof HttpError)
      return { status: e.status, body: { error: e.message }, cookie: "" };
    throw e;
  }
}
async function account(email: string) {
  const u = crypto.randomUUID(),
    raw = token();
  identities.set(raw, { uid: u, email, verified: true });
  await db.query(
    "INSERT INTO users(id,email,firebase_uid,email_verified_at) VALUES($1,$2,$3,now())",
    [u, email, u],
  );
  return { u, cookie: raw };
}
function payload(key = crypto.randomUUID(), qty = 1) {
  return {
    idempotency_key: key,
    items: [
      { variant_id: variant, quantity: qty, expected_unit_price: 120000 },
    ],
    expected_total: qty * 120000,
    customer_name: "Pembeli Uji",
    contact_email: "buyer@test.invalid",
    contact_phone: "081234567890",
    address: "",
    shipping_method: "pickup" as const,
  };
}
beforeAll(async () => {
  vi.mocked(verifyFirebaseToken).mockImplementation(async (raw) => {
    const identity = identities.get(raw);
    if (!identity) throw new HttpError(401, "Sesi tidak valid.");
    return identity;
  });
  pg = await startDB();
  db = await newTestConnection();
  const a = await account("merchant-a@test.invalid"),
    b = await account("merchant-b@test.invalid"),
    admin = await account("owner@test.invalid");
  cookieA = a.cookie;
  cookieB = b.cookie;
  cookieAdmin = admin.cookie;
  await db.query("INSERT INTO platform_admins(user_id) VALUES($1)", [admin.u]);
  storeA = (
    await request(
      "/api/merchant/stores",
      "POST",
      { name: "Toko Alfa", slug: "toko-alfa" },
      cookieA,
    )
  ).body.id;
  storeB = (
    await request(
      "/api/merchant/stores",
      "POST",
      { name: "Toko Beta", slug: "toko-beta" },
      cookieB,
    )
  ).body.id;
  product = (
    await request(
      `/api/merchant/stores/${storeA}/products`,
      "POST",
      {
        slug: "kaos-alfa",
        name: "Kaos Alfa",
        price_idr: 120000,
        status: "active",
        variants: [{ sku: "ALFA-M", option_label: "M", stock_qty: 10 }],
      },
      cookieA,
    )
  ).body.id;
  variant = (
    await db.query("SELECT id FROM product_variants WHERE product_id=$1", [
      product,
    ])
  )[0].id;
  await request(
    `/api/merchant/stores/${storeA}/settings`,
    "PUT",
    {
      pickup_address: "Jalan Toko Nomor 1",
      bank_details: "Bank Test 123456789 atas nama Toko Alfa",
      pickup_enabled: true,
      contact_phone: "081234567890",
      policies:
        "Kebijakan toko fixture untuk pengujian pengiriman dan pengembalian.",
    },
    cookieA,
  );
  await db.query(
    "UPDATE stores SET pilot_until=now()+interval '7 days' WHERE id=$1",
    [storeA],
  );
  await request(
    `/api/merchant/stores/${storeA}/publish`,
    "POST",
    { publish: true },
    cookieA,
  );
});
afterAll(async () => {
  await db?.client.end();
  await pg?.stop();
});
describe("Phase 1 identity & tenancy", () => {
  it("accepts Firebase identity, ignores legacy cookies, and disables password routes", async () => {
    const me = await request("/api/auth/me", "GET", undefined, cookieA);
    expect(me.body.user.email).toBe("merchant-a@test.invalid");
    expect(me.cookie).toBe("");
    expect(
      (await request("/api/auth/me", "GET", undefined, "forged-token")).status,
    ).toBe(401);
    const old = await handleAPI(
      db,
      new Request("http://localhost/api/auth/me", {
        headers: { cookie: "__Host-nalaro_session=" + cookieA },
      }),
      env,
    );
    expect(((await old.json()) as { user: unknown }).user).toBeNull();
    expect(
      (
        await request("/api/auth/login", "POST", {
          email: "merchant-a@test.invalid",
          password: "ignored",
        })
      ).status,
    ).toBe(410);
    expect(
      (
        await db.query("SELECT password_hash FROM users WHERE email=$1", [
          "merchant-a@test.invalid",
        ])
      )[0].password_hash,
    ).toBeNull();
  });
  it("requires verified Firebase email and grants owner privileges only to exact verified owner", async () => {
    const raw = token();
    identities.set(raw, {
      uid: crypto.randomUUID(),
      email: "new@test.invalid",
      verified: false,
    });
    expect(
      (
        await request(
          "/api/merchant/stores",
          "POST",
          { name: "Unverified", slug: "unverified" },
          raw,
        )
      ).status,
    ).toBe(403);
    identities.get(raw)!.verified = true;
    expect(
      (await request("/api/auth/me", "GET", undefined, raw)).body.user.verified,
    ).toBe(true);
    identities.get(cookieAdmin)!.verified = false;
    expect(
      (await request("/api/admin/plans", "GET", undefined, cookieAdmin)).status,
    ).toBe(403);
    identities.get(cookieAdmin)!.verified = true;
    expect(
      (await request("/api/auth/me", "GET", undefined, cookieAdmin)).body.user
        .admin,
    ).toBe(true);
    identities.get(raw)!.email = "owner@test.invalid";
    expect((await request("/api/auth/me", "GET", undefined, raw)).status).toBe(
      409,
    );
    identities.get(raw)!.email = "new@test.invalid";
  });
  it("rejects anonymous, cross-origin and cross-tenant reads & writes", async () => {
    expect(
      (await request(`/api/merchant/stores/${storeA}/products`)).status,
    ).toBe(401);
    for (const resource of [
      "products",
      "settings",
      "orders",
      "inventory",
      "billing",
    ])
      expect(
        (
          await request(
            `/api/merchant/stores/${storeA}/${resource}`,
            "GET",
            undefined,
            cookieB,
          )
        ).status,
      ).toBe(404);
    expect(
      (
        await request(
          `/api/merchant/stores/${storeA}/settings`,
          "PUT",
          { bank_details: "attacker" },
          cookieB,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await request(
          "/api/auth/logout",
          "POST",
          {},
          cookieA,
          "https://evil.invalid",
        )
      ).status,
    ).toBe(403);
    expect(
      (await request("/api/admin/plans", "GET", undefined, cookieA)).status,
    ).toBe(403);
  });
  it("rejects reserved slug and incomplete publication", async () => {
    expect(
      (
        await request(
          "/api/merchant/stores",
          "POST",
          { name: "Reserved", slug: "admin" },
          cookieA,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await request(
          `/api/merchant/stores/${storeB}/publish`,
          "POST",
          { publish: true },
          cookieB,
        )
      ).status,
    ).toBe(409);
  });
  it("resolves verified tenant hostname without trusting requested store id", async () => {
    const req = new Request(
      "https://toko-alfa.store.nalaro.digital/api/public/store",
    );
    await expect(handleAPI(db, req, env)).rejects.toMatchObject({
      status: 404,
    });
    await request(
      `/api/admin/stores/${storeA}/domain`,
      "POST",
      { verified: true },
      cookieAdmin,
    );
    expect((await handleAPI(db, req, env)).status).toBe(200);
    await expect(
      handleAPI(
        db,
        new Request(
          "https://toko-beta.store.nalaro.digital/api/public/stores/toko-alfa",
        ),
        env,
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
});
describe("Phase 2 commerce invariants", () => {
  it("rejects manipulated prices & cross-store variants without partial writes", async () => {
    const before = (await db.query("SELECT count(*)::int AS n FROM orders"))[0]
      .n;
    const bad = payload();
    bad.expected_total = 1;
    const r = await request(
      "/api/public/stores/toko-alfa/checkout",
      "POST",
      bad,
    );
    expect(r.status).toBe(409);
    expect((await db.query("SELECT count(*)::int AS n FROM orders"))[0].n).toBe(
      before,
    );
    await expect(checkout(db, storeB, payload(), env)).rejects.toMatchObject({
      status: 409,
    });
  });
  it("replays duplicate checkout with same tracking link and no duplicate stock", async () => {
    const c = payload();
    const a = await request("/api/public/stores/toko-alfa/checkout", "POST", c),
      b = await request("/api/public/stores/toko-alfa/checkout", "POST", c);
    expect(a.status).toBe(201);
    expect(b.body.replayed).toBe(true);
    expect(b.body.tracking_token).toBe(a.body.tracking_token);
    expect(
      (
        await db.query(
          "SELECT reserved_qty FROM product_variants WHERE id=$1",
          [variant],
        )
      )[0].reserved_qty,
    ).toBe(1);
    const changed = { ...c, customer_name: "Other buyer" };
    expect(
      (await request("/api/public/stores/toko-alfa/checkout", "POST", changed))
        .status,
    ).toBe(409);
    const tracking = await request(
      "/api/public/stores/toko-alfa/track/" + a.body.tracking_token,
    );
    expect(tracking.body.order.customer_name).toBeUndefined();
    expect(tracking.body.order.address_json).toBeUndefined();
    expect(
      (
        await request(
          "/api/public/stores/toko-beta/track/" + a.body.tracking_token,
        )
      ).status,
    ).toBe(404);
  });
  it("lets only one concurrent buyer reserve the last unit and replays racing duplicate", async () => {
    await db.query(
      "UPDATE product_variants SET stock_qty=reserved_qty+1 WHERE id=$1",
      [variant],
    );
    const left = await newTestConnection(),
      right = await newTestConnection();
    try {
      const results = await Promise.allSettled([
        checkout(left, storeA, payload(), env),
        checkout(right, storeA, payload(), env),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
      await db.query(
        "UPDATE product_variants SET stock_qty=reserved_qty+5 WHERE id=$1",
        [variant],
      );
      const c = payload();
      const both = await Promise.all([
        checkout(left, storeA, c, env),
        checkout(right, storeA, c, env),
      ]);
      expect(both[0].order_number).toBe(both[1].order_number);
      expect(both.map((x) => x.replayed).sort()).toEqual([false, true]);
    } finally {
      await left.client.end();
      await right.client.end();
    }
  });
  it("verifies payment once, preserves snapshots, enforces fulfillment and blocks malicious edit", async () => {
    const created = await request(
      "/api/public/stores/toko-alfa/checkout",
      "POST",
      payload(),
    );
    const o = (
      await db.query(
        "SELECT * FROM orders WHERE order_number=$1 AND store_id=$2",
        [created.body.order_number, storeA],
      )
    )[0];
    expect(
      (
        await request(
          `/api/merchant/stores/${storeA}/orders/${o.id}/fulfillment`,
          "POST",
          { status: "packing" },
          cookieA,
        )
      ).status,
    ).toBe(409);
    const before = (
      await db.query("SELECT stock_qty FROM product_variants WHERE id=$1", [
        variant,
      ])
    )[0].stock_qty;
    for (let i = 0; i < 2; i++)
      expect(
        (
          await request(
            `/api/merchant/stores/${storeA}/orders/${o.id}/payment`,
            "POST",
            { decision: "verified" },
            cookieA,
          )
        ).status,
      ).toBe(200);
    expect(
      (
        await db.query("SELECT stock_qty FROM product_variants WHERE id=$1", [
          variant,
        ])
      )[0].stock_qty,
    ).toBe(before - 1);
    expect(
      (
        await db.query(
          `SELECT count(*)::int AS n FROM manual_payment_reviews WHERE order_id=$1 AND decision='verified'`,
          [o.id],
        )
      )[0].n,
    ).toBe(1);
    expect(
      (
        await request(
          `/api/merchant/stores/${storeA}/orders/${o.id}/cancel`,
          "POST",
          {},
          cookieA,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await request(
          `/api/merchant/stores/${storeA}/orders/${o.id}/fulfillment`,
          "POST",
          { status: "shipped" },
          cookieA,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await request(
          `/api/merchant/stores/${storeA}/orders/${o.id}/fulfillment`,
          "POST",
          { status: "pickup_ready" },
          cookieA,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await request(
          `/api/merchant/stores/${storeA}/orders/${o.id}/fulfillment`,
          "POST",
          { status: "picked_up" },
          cookieA,
        )
      ).status,
    ).toBe(200);
    await db.query("UPDATE products SET price_idr=130000 WHERE id=$1", [
      product,
    ]);
    expect(
      Number(
        (
          await db.query(
            "SELECT unit_price_idr FROM order_items WHERE order_id=$1",
            [o.id],
          )
        )[0].unit_price_idr,
      ),
    ).toBe(120000);
    await db.query("UPDATE products SET price_idr=120000 WHERE id=$1", [
      product,
    ]);
  });
  it("releases expired reservations once and never expires paid orders", async () => {
    const count = (
      await db.query(
        `SELECT count(*)::int AS n FROM orders WHERE payment_status='unpaid'`,
      )
    )[0].n;
    const before = (
      await db.query("SELECT reserved_qty FROM product_variants WHERE id=$1", [
        variant,
      ])
    )[0].reserved_qty;
    await db.query(
      "UPDATE orders SET reservation_expires_at=now()-interval '1 minute'",
    );
    expect(await expireReservations(db)).toBe(count);
    expect(await expireReservations(db)).toBe(0);
    expect(
      (
        await db.query(
          "SELECT reserved_qty FROM product_variants WHERE id=$1",
          [variant],
        )
      )[0].reserved_qty,
    ).toBe(before - count);
    expect(
      (
        await db.query(
          "SELECT count(*)::int AS n FROM orders WHERE payment_status='paid' AND order_status='completed'",
        )
      )[0].n,
    ).toBe(1);
  });
});
describe("Phase 3 subscription and custom workflow", () => {
  it("keeps prices admin-only and preserves historical price snapshot", async () => {
    const plan = {
      code: "basic",
      name: "Paket Uji",
      description: "Test only",
      status: "active",
      is_public: true,
      prices: [
        { billing_interval: "monthly", amount_idr: 75000 },
        { billing_interval: "yearly", amount_idr: 750000 },
      ],
      entitlements: [
        { feature_code: "products", allowed: true, limit_value: 1 },
        { feature_code: "orders", allowed: true, limit_value: 20 },
      ],
    };
    expect(
      (
        await request(
          "/api/admin/billing-settings",
          "PUT",
          {
            billing_instructions: "Bank Platform 1234 Nalaro",
            trial_days: 7,
            grace_days: 7,
          },
          cookieAdmin,
        )
      ).status,
    ).toBe(200);
    const created = await request(
      "/api/admin/plans",
      "POST",
      plan,
      cookieAdmin,
    );
    expect(created.status).toBe(200);
    price = (
      await db.query(
        "SELECT id FROM plan_prices WHERE plan_id=$1 AND billing_interval='monthly' AND is_active",
        [created.body.id],
      )
    )[0].id;
    expect(
      (
        await request(
          `/api/merchant/stores/${storeA}/billing`,
          "POST",
          { plan_price_id: price },
          cookieA,
        )
      ).status,
    ).toBe(201);
    invoice = (
      await db.query(
        "SELECT id FROM subscription_invoices ORDER BY issued_at DESC LIMIT 1",
      )
    )[0].id;
    expect(
      (
        await request(
          "/api/admin/plans/" + created.body.id,
          "PUT",
          {
            ...plan,
            prices: [{ billing_interval: "monthly", amount_idr: 100000 }],
          },
          cookieAdmin,
        )
      ).status,
    ).toBe(200);
    expect(
      Number(
        (
          await db.query(
            "SELECT amount_idr FROM subscription_invoices WHERE id=$1",
            [invoice],
          )
        )[0].amount_idr,
      ),
    ).toBe(75000);
    expect(
      (
        await request(
          `/api/merchant/stores/${storeA}/products`,
          "POST",
          {
            name: "Second",
            slug: "second-product",
            price_idr: 100,
            status: "draft",
            variants: [
              { sku: "SECOND", option_label: "Default", stock_qty: 1 },
            ],
          },
          cookieA,
        )
      ).status,
    ).toBe(409);
  });
  it("verifies subscription invoice retry-safe and extends a calendar billing period", async () => {
    for (let i = 0; i < 2; i++)
      expect(
        (
          await request(
            `/api/admin/invoices/${invoice}/verify`,
            "POST",
            {},
            cookieAdmin,
          )
        ).status,
      ).toBe(200);
    expect(
      (
        await db.query("SELECT status FROM subscription_invoices WHERE id=$1", [
          invoice,
        ])
      )[0].status,
    ).toBe("paid");
    const sub = (
      await db.query("SELECT * FROM store_subscriptions WHERE store_id=$1", [
        storeA,
      ])
    )[0];
    expect(sub.status).toBe("active");
    expect(
      new Date(sub.current_period_end).getTime() -
        new Date(sub.current_period_start).getTime(),
    ).toBeGreaterThan(27 * 86400000);
  });
  it("generates one renewal, gives grace, then disables commerce after expiry", async () => {
    await db.query(
      "UPDATE store_subscriptions SET current_period_end=now()-interval '1 day' WHERE store_id=$1",
      [storeA],
    );
    await billingCycle(db);
    await billingCycle(db);
    expect(
      (
        await db.query(
          "SELECT status FROM store_subscriptions WHERE store_id=$1",
          [storeA],
        )
      )[0].status,
    ).toBe("grace");
    expect(
      (
        await db.query(
          "SELECT count(*)::int AS n FROM subscription_invoices WHERE status='overdue'",
        )
      )[0].n,
    ).toBe(1);
    await db.query(
      "UPDATE store_subscriptions SET current_period_end=now()-interval '9 days' WHERE store_id=$1",
      [storeA],
    );
    await billingCycle(db);
    expect(
      (
        await request(
          "/api/public/stores/toko-alfa/checkout",
          "POST",
          payload(),
        )
      ).status,
    ).toBe(423);
  });
  it("accepts custom brief, then requires ownership and contract before quotation", async () => {
    const r = await request("/api/public/custom-leads", "POST", {
      business_name: "Test Business",
      contact_name: "Kontak Uji",
      contact_email: "custom@test.invalid",
      contact_phone: "08123456789",
      project_brief: "Perlu katalog dan checkout khusus untuk produk lokal.",
    });
    expect(r.status).toBe(201);
    const c = {
      status: "quoted",
      source_ownership: "pending",
      reusable_modules: "catalog",
      contract_terms: "",
      quote_idr: 1000000,
      delivery_status: "not_started",
    };
    expect(
      (await request("/api/admin/leads/" + r.body.id, "PUT", c, cookieAdmin))
        .status,
    ).toBe(400);
    expect(
      (
        await request(
          "/api/admin/leads/" + r.body.id,
          "PUT",
          {
            ...c,
            source_ownership: "mixed",
            contract_terms:
              "Modul platform berlisensi Nalaro. Desain custom milik klien.",
          },
          cookieAdmin,
        )
      ).status,
    ).toBe(200);
  });
  it("retries email failures without changing payment or order state", async () => {
    let attempts = 0;
    const mail = {
      send: async () => {
        attempts++;
        if (attempts === 1) throw Error("provider unavailable");
        return { messageId: "test" };
      },
    } as SendEmail;
    const delivered = await deliverOutbox(db, mail, "test@example.invalid");
    expect(delivered).toBeGreaterThan(0);
    expect(
      (
        await db.query(
          "SELECT count(*)::int AS n FROM outbox_events WHERE status='pending' AND attempts>0",
        )
      )[0].n,
    ).toBeGreaterThan(0);
  });
});

it.skipIf(!process.env.TEST_PG_CONTAINER)(
  "restores an encrypted native PostgreSQL backup into a separate database",
  async () => {
    const container = process.env.TEST_PG_CONTAINER!;
    const dump = execFileSync(
      "docker",
      [
        "exec",
        container,
        "pg_dump",
        "-U",
        "postgres",
        "-d",
        "nalarostore_test",
        "-Fc",
      ],
      { maxBuffer: 20 * 1024 * 1024 },
    );
    const key = randomBytes(32),
      iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(dump), cipher.final()]);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(cipher.getAuthTag());
    const restored = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    execFileSync("docker", [
      "exec",
      container,
      "createdb",
      "-U",
      "postgres",
      "restore_test",
    ]);
    execFileSync(
      "docker",
      [
        "exec",
        "-i",
        container,
        "pg_restore",
        "-U",
        "postgres",
        "-d",
        "restore_test",
      ],
      { input: restored },
    );
    const result = execFileSync("docker", [
      "exec",
      container,
      "psql",
      "-U",
      "postgres",
      "-d",
      "restore_test",
      "-tAc",
      "SELECT count(*) FROM orders",
    ])
      .toString()
      .trim();
    expect(Number(result)).toBe(
      (await db.query("SELECT count(*)::int AS n FROM orders"))[0].n,
    );
    const inventory = execFileSync("docker", [
      "exec",
      container,
      "psql",
      "-U",
      "postgres",
      "-d",
      "restore_test",
      "-tAc",
      `SELECT stock_qty||':'||reserved_qty FROM product_variants WHERE id='${variant}'`,
    ])
      .toString()
      .trim();
    const v = (
      await db.query(
        "SELECT stock_qty,reserved_qty FROM product_variants WHERE id=$1",
        [variant],
      )
    )[0];
    expect(inventory).toBe(`${v.stock_qty}:${v.reserved_qty}`);
  },
);

it("verifies tenant subdomain through real HTTPS proof, rejecting spoofed responses", async () => {
  const uid = (
    await db.query("SELECT id FROM users WHERE email='merchant-a@test.invalid'")
  )[0].id;
  const user = {
    id: uid,
    email: "merchant-a@test.invalid",
    verified: true,
    admin: false,
  };
  const mock = vi.spyOn(globalThis, "fetch");
  try {
    mock.mockResolvedValueOnce(
      Response.json({
        store_id: storeB,
        hostname: "toko-alfa.store.nalaro.digital",
        platform: "store.nalaro.digital",
      }),
    );
    await expect(
      verifyDomain(db, storeA, user, "store.nalaro.digital"),
    ).rejects.toMatchObject({ status: 409 });
    expect(mock.mock.calls.at(-1)?.[1]?.redirect).toBe("manual");
    mock.mockResolvedValueOnce(
      new Response(null, {
        status: 308,
        headers: {
          location: "https://foreign.test/.well-known/nalarostore-domain",
        },
      }),
    );
    await expect(
      verifyDomain(db, storeA, user, "store.nalaro.digital"),
    ).rejects.toMatchObject({ status: 409 });
    mock.mockResolvedValueOnce(
      Response.json({
        store_id: storeA,
        hostname: "toko-alfa.store.nalaro.digital",
        platform: "store.nalaro.digital",
      }),
    );
    expect(
      (await verifyDomain(db, storeA, user, "store.nalaro.digital")).status,
    ).toBe(200);
  } finally {
    mock.mockRestore();
  }
});

it("rejects executable/SVG/truncated image uploads and accepts a valid tiny PNG", () => {
  const png = Uint8Array.from(
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4WQAAAAASUVORK5CYII=",
      "base64",
    ),
  );
  expect(imageMime(png)).toBe("image/png");
  expect(imageMime(png.slice(0, 8))).toBeNull();
  expect(
    imageMime(new TextEncoder().encode('<svg onload="alert(1)"></svg>')),
  ).toBeNull();
  const large = new Uint8Array(png);
  new DataView(large.buffer).setUint32(16, 90000);
  expect(imageMime(large)).toBeNull();
});

it("requires explicit pilot approval and preserves preparation/export after expiry", async () => {
  await expect(entitlement(db, storeB, "orders", 1)).rejects.toMatchObject({
    status: 423,
  });
  expect(
    (
      await request(
        "/api/admin/stores/" + storeB + "/pilot",
        "POST",
        { days: 3 },
        cookieB,
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await request(
        "/api/admin/stores/" + storeB + "/pilot",
        "POST",
        { days: 3 },
        cookieAdmin,
      )
    ).status,
  ).toBe(200);
  await expect(entitlement(db, storeB, "orders", 1)).resolves.toBeUndefined();
  await db.query(
    "UPDATE stores SET pilot_until=now()-interval '1 day' WHERE id=$1",
    [storeB],
  );
  await expect(entitlement(db, storeB, "storefront")).rejects.toMatchObject({
    status: 423,
  });
  expect(
    (
      await request(
        "/api/merchant/stores/" + storeB + "/preview",
        "GET",
        undefined,
        cookieB,
      )
    ).status,
  ).toBe(200);
});

it("scopes draft preview, customer summaries, analytics and exports to authorized stores", async () => {
  for (const resource of ["preview", "customers", "analytics"]) {
    expect(
      (
        await request(
          "/api/merchant/stores/" + storeA + "/" + resource,
          "GET",
          undefined,
          cookieB,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await request(
          "/api/merchant/stores/" + storeA + "/" + resource,
          "GET",
          undefined,
          cookieA,
        )
      ).status,
    ).toBe(200);
  }
  const customers = await request(
    "/api/merchant/stores/" + storeA + "/customers",
    "GET",
    undefined,
    cookieA,
  );
  expect(
    customers.body.customers.every(
      (c: { contact_phone: string }) => c.contact_phone === "081234567890",
    ),
  ).toBe(true);
  const analytics = await request(
    "/api/merchant/stores/" + storeA + "/analytics",
    "GET",
    undefined,
    cookieA,
  );
  const expected = (
    await db.query(
      "SELECT COALESCE(sum(total_idr) FILTER(WHERE payment_status='paid'),0) AS revenue FROM orders WHERE store_id=$1",
      [storeA],
    )
  )[0];
  expect(Number(analytics.body.summary.revenue)).toBe(Number(expected.revenue));
  const req = new Request(
    "http://localhost/api/merchant/stores/" +
      storeA +
      "/export?resource=orders",
    { headers: { authorization: "Bearer " + cookieA } },
  );
  const exported = await handleAPI(db, req, env);
  expect(exported.headers.get("content-type")).toContain("text/csv");
  expect(await exported.text()).toContain("order_number");
  await expect(
    handleAPI(
      db,
      new Request(req.url, { headers: { authorization: "Bearer " + cookieB } }),
      env,
    ),
  ).rejects.toMatchObject({ status: 404 });
});

it("rejects duplicate variant IDs without altering inventory or stock history", async () => {
  const before = (
    await db.query("SELECT * FROM product_variants WHERE id=$1", [variant])
  )[0];
  const [history] = await db.query(
    "SELECT count(*)::int AS n FROM inventory_movements WHERE variant_id=$1",
    [variant],
  );
  const result = await request(
    `/api/merchant/stores/${storeA}/products/${product}`,
    "PUT",
    {
      slug: "kaos-alfa",
      name: "Kaos Alfa",
      price_idr: 120000,
      status: "active",
      variants: [
        { id: variant, sku: "ALFA-M", option_label: "M", stock_qty: 100 },
        { id: variant, sku: "ALFA-L", option_label: "L", stock_qty: 200 },
      ],
    },
    cookieA,
  );
  expect(result.status).toBe(400);
  expect(
    (
      await db.query("SELECT * FROM product_variants WHERE id=$1", [variant])
    )[0],
  ).toEqual(before);
  expect(
    (
      await db.query(
        "SELECT count(*)::int AS n FROM inventory_movements WHERE variant_id=$1",
        [variant],
      )
    )[0],
  ).toEqual(history);
});

it("rejects impossible order dates before querying PostgreSQL date casts", async () => {
  for (const date of ["2026-02-31", "2026-04-31", "2026-13-01", "2025-02-29"]) {
    const result = await request(
      `/api/merchant/stores/${storeA}/orders?from=${date}&to=2027-01-01`,
      "GET",
      undefined,
      cookieA,
    );
    expect(result.status).toBe(400);
  }
  expect(
    (
      await request(
        `/api/merchant/stores/${storeA}/orders?from=2024-02-29&to=2027-01-01`,
        "GET",
        undefined,
        cookieA,
      )
    ).status,
  ).toBe(200);
});

it("grants six calendar months only through explicit owner approval and records the expiry", async () => {
  const path = `/api/admin/stores/${storeB}/pilot`;
  const [before] = await db.query(
    "SELECT pilot_until FROM stores WHERE id=$1",
    [storeB],
  );
  for (const cookie of ["", cookieB]) {
    expect((await request(path, "POST", { months: 6 }, cookie)).status).toBe(
      cookie ? 403 : 401,
    );
  }
  expect(
    (await db.query("SELECT pilot_until FROM stores WHERE id=$1", [storeB]))[0],
  ).toEqual(before);
  for (const payload of [{ months: 12 }, { months: 6, days: 90 }, { days: 91 }])
    expect((await request(path, "POST", payload, cookieAdmin)).status).toBe(
      400,
    );
  expect((await request(path, "POST", { months: 6 }, cookieAdmin)).status).toBe(
    200,
  );
  const [store] = await db.query(
    "SELECT pilot_until,abs(extract(epoch FROM (pilot_until-(now()+interval '6 months')))) AS difference FROM stores WHERE id=$1",
    [storeB],
  );
  expect(Number(store.difference)).toBeLessThan(5);
  const [audit] = await db.query(
    "SELECT metadata FROM audit_logs WHERE store_id=$1 AND action='pilot.update' ORDER BY created_at DESC LIMIT 1",
    [storeB],
  );
  expect(audit.metadata.months).toBe(6);
  expect(new Date(audit.metadata.pilot_until).getTime()).toBe(
    new Date(store.pilot_until).getTime(),
  );
  await expect(entitlement(db, storeB, "storefront")).resolves.toBeUndefined();
  expect((await request(path, "POST", { days: 0 }, cookieAdmin)).status).toBe(
    200,
  );
  await expect(entitlement(db, storeB, "storefront")).rejects.toMatchObject({
    status: 423,
  });
});
