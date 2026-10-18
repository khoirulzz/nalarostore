import { adminStoreRoutes, deleteStoreMedia } from "./lib/admin-stores";
import { connect, type DB } from "./lib/db";
import { assert, HttpError, json } from "./lib/security";
import { authRoutes, identity, rateLimit } from "./lib/auth";
import { catalogRoutes, productList, publicStore } from "./lib/catalog";
import { billingCycle, billingRoutes, publicPlans } from "./lib/billing";
import {
  checkout,
  checkoutSchema,
  expireReservations,
  orderRoutes,
  tracking,
} from "./lib/commerce";
import { body, hash } from "./lib/security";
import { domainProof, verifyDomain } from "./lib/domains";
import { upload } from "./lib/media";
import { cleanup, deliverOutbox } from "./lib/jobs";
import { operationRoutes } from "./lib/operations";
import { storeHTML } from "./lib/seo";
import { pagesResponse } from "./lib/pages";
import {
  adminWorkspace,
  engagementRoutes,
  createConversation,
  publicChat,
} from "./lib/engagement";
// Deployment bindings are optional until provisioned. Generated base Env comes from wrangler types.
export type RuntimeEnv = Env & {
  HYPERDRIVE?: Hyperdrive;
  MEDIA?: R2Bucket;
  EMAIL?: SendEmail;
  TOKEN_SECRET?: string;
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_API_KEY?: string;
  FIREBASE_AUTH_EMULATOR_HOST?: string;
};
function isPlatform(host: string, env: RuntimeEnv) {
  return (
    host === new URL(env.APP_ORIGIN).hostname ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    (env.APP_ENV === "preview" && host.endsWith(".workers.dev"))
  );
}
export async function handleAPI(
  db: DB,
  request: Request,
  env: RuntimeEnv,
): Promise<Response> {
  const url = new URL(request.url),
    path = url.pathname,
    platform = isPlatform(url.hostname, env);
  if (request.method !== "GET" && request.method !== "HEAD") {
    assert(
      request.headers.get("origin") === url.origin,
      403,
      "Asal permintaan tidak diizinkan.",
    );
    assert(
      request.headers.get("sec-fetch-site") !== "cross-site",
      403,
      "Permintaan lintas situs ditolak.",
    );
  }
  if (path === "/api/health") {
    await db.query("SELECT firebase_uid FROM users LIMIT 0");
    await db.query("SELECT gallery FROM products LIMIT 0");
    await db.query("SELECT pilot_until,umkm_activated_at FROM stores LIMIT 0");
    await db.query("SELECT billing_mode FROM store_subscriptions LIMIT 0");
    await db.query("SELECT id FROM platform_settings WHERE id=true");
    await db.query("SELECT buyer_user_id FROM orders LIMIT 0");
    await db.query(
      "SELECT c.buyer_user_id,p.store_id FROM customer_conversations c CROSS JOIN store_responsible_profiles p LIMIT 0",
    );
    return json({
      status: "ok",
      phase: "1-3",
      database: "connected",
      schema: 7,
      liveCheckout: env.ENABLE_LIVE_CHECKOUT === "true",
    });
  }
  if (path === "/api/public/plans" && request.method === "GET")
    return json({ plans: await publicPlans(db) });
  if (path === "/api/public/capabilities")
    return json({
      merchantAuth: !!env.FIREBASE_PROJECT_ID && !!env.FIREBASE_API_KEY,
      liveCheckout: env.ENABLE_LIVE_CHECKOUT === "true",
      mediaUploads: !!env.MEDIA,
      email: !!env.EMAIL,
      subscriptionBilling: true,
      customInquiry: true,
      buyerAccounts: true,
      customerChat: true,
      productChatAttachments: true,
      dailySalesPagination: true,
      notifications: "foreground",
    });
  const newChat = path.match(
    /^\/api\/public\/(?:stores\/([a-z0-9-]+)|store)\/conversations$/,
  );
  if (newChat && request.method === "POST") {
    assert(platform || !newChat[1], 404, "Toko tidak ditemukan.");
    const store = await publicStore(
      db,
      newChat[1] || null,
      url.hostname,
      env.ROOT_DOMAIN,
    );
    return createConversation(
      db,
      request,
      store.id,
      await identity(db, request, env),
    );
  }
  if (path.startsWith("/api/public/chat/")) {
    const response = await publicChat(
      db,
      request,
      await identity(db, request, env),
    );
    if (response) return response;
  }
  const m = path.match(
    /^\/api\/public\/(?:stores\/([a-z0-9-]+)|store)(?:\/(products|checkout|track)(?:\/([a-f0-9]{64})(?:\/(qris))?)?)?$/,
  );
  if (m) {
    assert(
      request.method === "GET" ||
        (m[2] === "checkout" && request.method === "POST"),
      405,
      "Metode tidak tersedia.",
    );
    assert(platform || !m[1], 404, "Toko tidak ditemukan.");
    const store =
      m[2] === "track"
        ? m[1]
          ? (await db.query("SELECT id FROM stores WHERE slug=$1", [m[1]]))[0]
          : (
              await db.query(
                "SELECT s.id FROM store_domains d JOIN stores s ON s.id=d.store_id WHERE d.hostname=$1 AND d.verification_status='verified'",
                [url.hostname],
              )
            )[0]
        : await publicStore(db, m[1] || null, url.hostname, env.ROOT_DOMAIN);
    assert(store, 404, "Pesanan tidak ditemukan.");
    if (m[2] === "products")
      return json({ products: await productList(db, store.id, true) });
    if (m[2] === "checkout") {
      assert(
        env.ENABLE_LIVE_CHECKOUT === "true",
        503,
        "Pemesanan belum dibuka.",
      );
      await rateLimit(
        db,
        "checkout:" +
          (await hash(
            (request.headers.get("cf-connecting-ip") || "local") + store.id,
          )),
        30,
      );
      return json(
        await checkout(
          db,
          store.id,
          await body(request, checkoutSchema),
          env,
          await identity(db, request, env),
        ),
        201,
      );
    }
    if (m[2] === "track" && m[3]) {
      await rateLimit(
        db,
        "tracking:" +
          (await hash(request.headers.get("cf-connecting-ip") || "local")),
        60,
      );
      const record = await tracking(db, store.id, m[3]);
      if (m[4] === "qris") {
        const key = record.payment.qris_media_key;
        assert(
          env.MEDIA && key && key.startsWith(store.id + "/"),
          404,
          "QRIS tidak tersedia.",
        );
        const image = await env.MEDIA.get(key);
        assert(image, 404, "QRIS tidak tersedia.");
        return new Response(image.body, {
          headers: {
            "content-type": image.httpMetadata?.contentType || "image/png",
            "cache-control": "private,max-age=60",
          },
        });
      }
      return json(record);
    }
    return json({
      store: {
        id: store.id,
        slug: store.slug,
        name: store.name,
        description: store.description,
        theme_key: store.theme_key,
      },
      settings: {
        contact_phone: store.contact_phone,
        pickup_address: store.pickup_address,
        shipping_fee_idr: store.shipping_fee_idr,
        pickup_enabled: store.pickup_enabled,
        delivery_enabled: store.delivery_enabled,
        policies: store.policies,
        accent: store.accent,
        hero_title: store.hero_title,
        hero_image_url: store.hero_image_url,
        logo_url: store.logo_url,
        opening_hours: store.opening_hours,
      },
    });
  }
  const media = path.match(
    /^\/api\/media\/([a-f0-9-]{36})\/([a-f0-9-]{36})\.(png|jpeg|webp)$/,
  );
  if (media && request.method === "GET") {
    assert(env.MEDIA, 503, "Gambar belum tersedia.");
    const visible = await db.query(
      `SELECT s.id FROM stores s WHERE s.id=$1 AND s.status='published'`,
      [media[1]],
    );
    if (!visible[0]) {
      const user = await identity(db, request, env);
      const access = await db.query(
        `SELECT m.user_id FROM stores s JOIN merchant_memberships m ON m.merchant_id=s.merchant_id WHERE s.id=$1 AND m.user_id=$2`,
        [media[1], user?.id || null],
      );
      assert(
        access[0] ||
          (user?.admin &&
            (
              await db.query("SELECT id FROM stores WHERE id=$1", [media[1]])
            )[0]),
        404,
        "Gambar tidak ditemukan.",
      );
    }
    const obj = await env.MEDIA.get(path.slice("/api/media/".length));
    assert(obj, 404, "Gambar tidak ditemukan.");
    return new Response(obj.body, {
      headers: {
        "content-type":
          obj.httpMetadata?.contentType || "application/octet-stream",
        "x-content-type-options": "nosniff",
        "cache-control": "private,max-age=60",
      },
    });
  }
  assert(platform, 404, "Halaman tidak ditemukan.");
  const user = await identity(db, request, env);
  const workspace = await adminWorkspace(db, request, user);
  if (workspace) return workspace;
  const auth = await authRoutes(db, request, env, user, path);
  if (auth) return auth;
  const domainPost = path.match(
    /^\/api\/merchant\/stores\/([a-f0-9-]{36})\/domain\/verify$/,
  );
  if (domainPost && request.method === "POST")
    return verifyDomain(db, domainPost[1], user, env.ROOT_DOMAIN);
  const mediaPost = path.match(
    /^\/api\/merchant\/stores\/([a-f0-9-]{36})\/media$/,
  );
  if (mediaPost && request.method === "POST")
    return upload(db, request, user, mediaPost[1], env.MEDIA);
  for (const route of [
    () => engagementRoutes(db, request, user),
    () => adminStoreRoutes(db, request, user, path),
    () => operationRoutes(db, request, user),
    () => catalogRoutes(db, request, user, path, env.ROOT_DOMAIN),
    () => orderRoutes(db, request, user, path),
    () => billingRoutes(db, request, user, path),
  ]) {
    const response = await route();
    if (response) return response;
  }
  return json({ error: "Endpoint tidak ditemukan." }, 404);
}
const handler = {
  async fetch(
    request: Request,
    env: RuntimeEnv,
    _ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    let db: DB | undefined;
    const rid = crypto.randomUUID();
    try {
      if (url.pathname === "/api/live") return json({ status: "ok" });
      if (!url.pathname.startsWith("/api/")) {
        if (url.pathname === "/.well-known/nalarostore-domain") {
          assert(env.HYPERDRIVE, 503, "Layanan belum tersedia.");
          db = await connect(env.HYPERDRIVE.connectionString);
          return await domainProof(db, url.hostname, env.ROOT_DOMAIN);
        }

        if (
          !isPlatform(url.hostname, env) &&
          !/^\/(?:assets\/|images\/|favicon|android|apple|site\.webmanifest)/.test(
            url.pathname,
          )
        ) {
          assert(env.HYPERDRIVE, 503, "Toko belum tersedia.");
          db = await connect(env.HYPERDRIVE.connectionString);
          const store = url.pathname.startsWith("/track/")
            ? (
                await db.query(
                  "SELECT s.slug FROM store_domains d JOIN stores s ON s.id=d.store_id WHERE d.hostname=$1 AND d.verification_status='verified'",
                  [url.hostname],
                )
              )[0]
            : await publicStore(db, null, url.hostname, env.ROOT_DOMAIN);
          assert(store, 404, "Toko tidak ditemukan.");
          if (!url.pathname.startsWith("/track/"))
            return await storeHTML(db, request, env, store);
          const response = await pagesResponse(request, env, true);
          const headers = new Headers(response.headers);
          headers.set("x-store-slug", store.slug);
          headers.set("cache-control", "no-store");
          return new Response(response.body, {
            status: response.status,
            headers,
          });
        }
        const pathStore = url.pathname.match(/^\/s\/([a-z0-9-]+)(?:\/|$)/);
        if (
          pathStore &&
          env.HYPERDRIVE &&
          !/\/(track|cart|checkout)(?:\/|$)/.test(url.pathname)
        ) {
          db = await connect(env.HYPERDRIVE.connectionString);
          const store = await publicStore(
            db,
            pathStore[1],
            url.hostname,
            env.ROOT_DOMAIN,
          );
          return await storeHTML(db, request, env, store);
        }
        return await pagesResponse(request, env, !!pathStore);
      }
      if (!env.HYPERDRIVE) {
        if (url.pathname === "/api/health")
          return json(
            {
              status: "setup-required",
              database: "not-configured",
              liveCheckout: false,
            },
            503,
          );
        throw new HttpError(
          503,
          "Layanan sedang disiapkan. Coba lagi setelah konfigurasi selesai.",
        );
      }
      db = await connect(env.HYPERDRIVE.connectionString);
      const response = await handleAPI(db, request, env);
      return response;
    } catch (e) {
      if (e instanceof HttpError)
        return json({ error: e.message, request_id: rid }, e.status);
      const code = (e as { code?: string }).code;
      if (code === "23505")
        return json(
          {
            error: "Alamat, SKU atau referensi sudah digunakan.",
            request_id: rid,
          },
          409,
        );
      console.error(
        JSON.stringify({
          event: "request.failed",
          request_id: rid,
          path: url.pathname.replace(/\/track\/[a-f0-9]{64}/, "/track/[token]"),
          code: code || "internal",
        }),
      );
      return json(
        {
          error:
            "Layanan belum tersedia. Kamu bisa mencoba lagi dengan data yang sama.",
          request_id: rid,
        },
        503,
      );
    } finally {
      if (db) await db.client.end();
    }
  },
  async scheduled(_event: ScheduledController, env: RuntimeEnv) {
    if (!env.HYPERDRIVE) return;
    const db = await connect(env.HYPERDRIVE.connectionString);
    try {
      await expireReservations(db);
      await billingCycle(db);
      await deliverOutbox(db, env.EMAIL, env.EMAIL_FROM);
      await cleanup(db);
      await deleteStoreMedia(db, env.MEDIA);
    } finally {
      await db.client.end();
    }
  },
} satisfies ExportedHandler<RuntimeEnv>;

export default {
  async fetch(request: Request, env: RuntimeEnv, ctx: ExecutionContext) {
    const response = await handler.fetch(request, env, ctx);
    const headers = new Headers(response.headers);
    headers.set("x-content-type-options", "nosniff");
    headers.set("referrer-policy", "no-referrer");
    headers.set(
      "permissions-policy",
      "camera=(), microphone=(), geolocation=()",
    );
    if (request.url.startsWith("https:"))
      headers.set("strict-transport-security", "max-age=31536000");
    if ((headers.get("content-type") || "").includes("text/html")) {
      headers.set(
        "content-security-policy",
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com; frame-src https://nalarostore.firebaseapp.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
      );
      const path = new URL(request.url).pathname;
      if (
        /^\/(app|admin|account|buyer|login|register|verify|forgot-password|auth|preview|demo)(?:\/|$)/.test(
          path,
        ) ||
        /\/(cart|checkout|track)(?:\/|$)/.test(path)
      )
        headers.set("x-robots-tag", "noindex, nofollow, noarchive");
    }
    return new Response(response.body, { status: response.status, headers });
  },
  scheduled: handler.scheduled,
} satisfies ExportedHandler<RuntimeEnv>;
