import { z } from "zod";
import type { DB } from "./db";
import { assert, body, id, json, money, safeURL, slug } from "./security";
import { audit, requireUser, storeAccess, type Identity } from "./auth";
import { entitlement, incrementUsage } from "./billing";
const variantSchema = z.object({
  id: id.optional(),
  sku: z.string().min(1).max(80),
  option_label: z.string().min(1).max(120),
  price_override_idr: money.nullable().default(null),
  stock_qty: z.number().int().min(0).max(100000),
  status: z.enum(["active", "inactive"]).default("active"),
  image_url: safeURL.nullable().default(null),
});
const productSchema = z
  .object({
    slug,
    name: z.string().min(2).max(160),
    description: z.string().max(10000).default(""),
    price_idr: money,
    category: z.string().min(1).max(80).default("Produk"),
    primary_image_url: safeURL.nullable().default(null),
    gallery: z
      .array(z.object({ url: safeURL, alt: z.string().max(300).default("") }))
      .max(12)
      .default([]),
    status: z.enum(["draft", "active", "archived"]).default("draft"),
    variants: z.array(variantSchema).min(1).max(100),
  })
  .refine(
    (p) => new Set(p.variants.map((v) => v.sku)).size === p.variants.length,
    "SKU harus unik.",
  )
  .refine((p) => {
    const ids = p.variants.flatMap((v) => (v.id ? [v.id] : []));
    return new Set(ids).size === ids.length;
  }, "Setiap varian harus memiliki ID yang berbeda.");
export const settingsSchema = z.object({
  store_name: z.string().trim().min(2).max(120).optional(),
  store_description: z.string().max(10000).optional(),
  contact_phone: z.string().max(30).default(""),
  pickup_address: z.string().max(2000).default(""),
  shipping_fee_idr: money.default(0),
  pickup_enabled: z.boolean().default(true),
  delivery_enabled: z.boolean().default(false),
  bank_details: z.string().max(2000).default(""),
  qris_media_key: z.string().max(200).nullable().default(null),
  policies: z.string().max(10000).default(""),
  accent: z
    .string()
    .regex(/^#[a-fA-F0-9]{6}$/)
    .default("#171715"),
  hero_title: z.string().max(200).default(""),
  hero_image_url: safeURL.nullable().default(null),
  logo_url: safeURL.nullable().default(null),
  opening_hours: z.string().max(500).default(""),
  low_stock_threshold: z.number().int().min(0).max(1000).default(5),
});
export async function publicStore(
  db: DB,
  slugValue: string | null,
  hostname: string,
  rootDomain: string,
) {
  const rows = slugValue
    ? await db.query(
        `SELECT s.*,ss.* FROM stores s JOIN store_settings ss ON ss.store_id=s.id WHERE s.slug=$1 AND s.status='published'`,
        [slugValue],
      )
    : await db.query(
        `SELECT s.*,ss.* FROM store_domains d JOIN stores s ON s.id=d.store_id JOIN store_settings ss ON ss.store_id=s.id WHERE d.hostname=$1 AND d.verification_status='verified' AND s.status='published'`,
        [hostname],
      );
  assert(rows[0], 404, "Toko tidak ditemukan atau belum menerima pesanan.");
  if (hostname.endsWith("." + rootDomain))
    assert(
      !slugValue || hostname === `${rows[0].slug}.${rootDomain}`,
      404,
      "Toko tidak ditemukan.",
    );
  await entitlement(db, rows[0].id, "storefront");
  return rows[0];
}
export async function productList(db: DB, storeId: string, published = false) {
  const rows = await db.query(
    `SELECT p.*,COALESCE((SELECT jsonb_agg(jsonb_build_object('id',v.id,'sku',v.sku,'option_label',v.option_label,'price_override_idr',v.price_override_idr,'image_url',v.image_url,'stock_qty',v.stock_qty,'reserved_qty',v.reserved_qty,'available_stock',v.stock_qty-v.reserved_qty,'status',v.status) ORDER BY v.option_label) FROM product_variants v WHERE v.store_id=p.store_id AND v.product_id=p.id ${published ? "AND v.status='active'" : ""}),'[]') AS variants FROM products p WHERE p.store_id=$1 ${published ? "AND p.status='active'" : ""} ORDER BY p.position,p.created_at DESC LIMIT 1000`,
    [storeId],
  );
  return rows;
}
export async function catalogRoutes(
  db: DB,
  request: Request,
  user: Identity | null,
  path: string,
  rootDomain: string,
): Promise<Response | undefined> {
  if (path === "/api/merchant/slug" && request.method === "GET") {
    requireUser(user);
    const value = new URL(request.url).searchParams.get("slug") || "";
    const valid = slug.safeParse(value);
    const existing = valid.success
      ? (await db.query("SELECT id FROM stores WHERE slug=$1", [value]))[0]
      : null;
    return json({ available: valid.success && !existing });
  }
  if (path === "/api/merchant/stores" && request.method === "GET") {
    requireUser(user);
    return json({
      stores: await db.query(
        `SELECT s.*,m.role FROM stores s JOIN merchant_memberships m ON m.merchant_id=s.merchant_id WHERE m.user_id=$1 ORDER BY s.created_at`,
        [user.id],
      ),
    });
  }
  if (path === "/api/merchant/stores" && request.method === "POST") {
    requireUser(user);
    const c = await body(
      request,
      z.object({ name: z.string().min(2).max(120), slug }),
    );
    const storeId = crypto.randomUUID();
    await db.tx(async (tx) => {
      await tx.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [user.id]);
      const count = await tx.query(
        `SELECT count(*)::int AS n FROM stores s JOIN merchant_memberships m ON m.merchant_id=s.merchant_id WHERE m.user_id=$1`,
        [user.id],
      );
      assert(count[0].n < 10, 409, "Batas pembuatan toko akun telah tercapai.");
      const mid = crypto.randomUUID();
      await tx.query(
        "INSERT INTO merchants(id,business_name,owner_user_id) VALUES($1,$2,$3)",
        [mid, c.name, user.id],
      );
      await tx.query(
        `INSERT INTO merchant_memberships(user_id,merchant_id,role) VALUES($1,$2,'owner')`,
        [user.id, mid],
      );
      await tx.query(
        "INSERT INTO stores(id,merchant_id,slug,name) VALUES($1,$2,$3,$4)",
        [storeId, mid, c.slug, c.name],
      );
      await tx.query("INSERT INTO store_settings(store_id) VALUES($1)", [
        storeId,
      ]);
      await tx.query(
        `INSERT INTO store_domains(id,store_id,hostname,kind,verification_status) VALUES($1,$2,$3,'platform','pending')`,
        [crypto.randomUUID(), storeId, `${c.slug}.${rootDomain}`],
      );
      await audit(tx, user.id, storeId, "store.create", "store", storeId);
    });
    return json({ id: storeId }, 201);
  }
  const match = path.match(
    /^\/api\/merchant\/stores\/([a-f0-9-]{36})(?:\/(products|settings|publish|overview|inventory|preview)(?:\/([a-f0-9-]{36}))?)?$/,
  );
  if (!match) return;
  const [, sid, resource, pid] = match;
  await storeAccess(db, user, sid, request.method !== "GET");
  requireUser(user);
  if (resource === "preview" && request.method === "GET")
    return json({
      store: (
        await db.query(
          "SELECT id,slug,name,description,status,theme_key FROM stores WHERE id=$1",
          [sid],
        )
      )[0],
      settings: (
        await db.query("SELECT * FROM store_settings WHERE store_id=$1", [sid])
      )[0],
      products: (await productList(db, sid)).filter(
        (p) => p.status !== "archived",
      ),
    });
  if (!resource && request.method === "GET")
    return json({
      store: (await db.query("SELECT * FROM stores WHERE id=$1", [sid]))[0],
    });
  if (resource === "settings" && request.method === "GET")
    return json({
      settings: (
        await db.query("SELECT * FROM store_settings WHERE store_id=$1", [sid])
      )[0],
    });
  if (resource === "settings" && request.method === "PUT") {
    const { store_name, store_description, ...c } = await body(
      request,
      settingsSchema,
    );
    for (const value of [c.logo_url, c.hero_image_url])
      if (value?.startsWith("/api/media/"))
        assert(
          value.startsWith(`/api/media/${sid}/`),
          400,
          "Media bukan milik toko ini.",
        );
    if (c.qris_media_key)
      assert(
        c.qris_media_key.startsWith(sid + "/"),
        400,
        "QRIS bukan milik toko ini.",
      );
    await db.tx(async (tx) => {
      if (store_name !== undefined || store_description !== undefined)
        await tx.query(
          "UPDATE stores SET name=COALESCE($2,name),description=COALESCE($3,description),updated_at=now() WHERE id=$1",
          [sid, store_name ?? null, store_description ?? null],
        );
      const columns = Object.keys(c);
      await tx.query(
        `UPDATE store_settings SET ${columns.map((k, i) => `${k}=$${i + 2}`).join(",")} WHERE store_id=$1`,
        [sid, ...Object.values(c)],
      );
      await audit(tx, user.id, sid, "settings.update", "store", sid);
    });
    return json({ ok: true });
  }
  if (resource === "publish" && request.method === "POST") {
    const c = await body(request, z.object({ publish: z.boolean() }));
    await db.tx(async (tx) => {
      await tx.query("SELECT id FROM stores WHERE id=$1 FOR UPDATE", [sid]);
      if (c.publish) {
        const settings = (
          await tx.query("SELECT * FROM store_settings WHERE store_id=$1", [
            sid,
          ])
        )[0];
        const products = await tx.query(
          `SELECT count(*)::int AS n FROM products p JOIN product_variants v ON v.product_id=p.id AND v.store_id=p.store_id WHERE p.store_id=$1 AND p.status='active' AND v.status='active' AND v.stock_qty>v.reserved_qty`,
          [sid],
        );
        assert(
          products[0].n > 0,
          409,
          "Terbitkan minimal satu produk dengan stok tersedia.",
        );
        assert(
          settings.bank_details || settings.qris_media_key,
          409,
          "Isi rekening atau QRIS pembayaran.",
        );
        assert(
          settings.contact_phone.trim().length >= 8,
          409,
          "Isi kontak toko agar pembeli dapat mengonfirmasi pembayaran.",
        );
        assert(
          settings.policies.trim().length >= 20,
          409,
          "Lengkapi kebijakan pengiriman dan pengembalian toko.",
        );
        assert(
          settings.pickup_enabled || settings.delivery_enabled,
          409,
          "Aktifkan minimal satu metode pengiriman.",
        );
        assert(
          !settings.pickup_enabled || settings.pickup_address,
          409,
          "Isi alamat pengambilan.",
        );
        assert(
          !settings.delivery_enabled || settings.contact_phone,
          409,
          "Isi kontak pengiriman toko.",
        );
        await entitlement(tx, sid, "storefront");
      }
      await tx.query(
        "UPDATE stores SET status=$2,updated_at=now() WHERE id=$1",
        [sid, c.publish ? "published" : "paused"],
      );
      await audit(
        tx,
        user.id,
        sid,
        c.publish ? "store.publish" : "store.pause",
        "store",
        sid,
      );
    });
    return json({ ok: true });
  }
  if (resource === "products" && request.method === "GET")
    return json({ products: await productList(db, sid) });
  if (
    resource === "products" &&
    (request.method === "POST" || request.method === "PUT")
  ) {
    assert(
      request.method === "POST" ? !pid : !!pid,
      405,
      "Metode tidak tersedia.",
    );
    const c = await body(request, productSchema);
    const productId = pid || crypto.randomUUID();
    for (const url of [
      c.primary_image_url,
      ...c.gallery.map((g) => g.url),
      ...c.variants.map((v) => v.image_url),
    ])
      if (url?.startsWith("/api/media/"))
        assert(
          url.startsWith(`/api/media/${sid}/`),
          400,
          "Media bukan milik toko ini.",
        );
    await db.tx(async (tx) => {
      await tx.query("SELECT id FROM stores WHERE id=$1 FOR UPDATE", [sid]);
      if (pid) {
        const found = await tx.query(
          "SELECT id FROM products WHERE store_id=$1 AND id=$2 FOR UPDATE",
          [sid, pid],
        );
        assert(found[0], 404, "Produk tidak ditemukan.");
        await tx.query(
          "UPDATE products SET slug=$3,name=$4,description=$5,price_idr=$6,category=$7,primary_image_url=$8,status=$9,updated_at=now() WHERE store_id=$1 AND id=$2",
          [
            sid,
            pid,
            c.slug,
            c.name,
            c.description,
            c.price_idr,
            c.category,
            c.primary_image_url,
            c.status,
          ],
        );
      } else {
        await entitlement(tx, sid, "products", 1);
        await tx.query(
          "INSERT INTO products(id,store_id,slug,name,description,price_idr,category,primary_image_url,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
          [
            productId,
            sid,
            c.slug,
            c.name,
            c.description,
            c.price_idr,
            c.category,
            c.primary_image_url,
            c.status,
          ],
        );
        await incrementUsage(tx, sid, "products", 1);
      }
      const existing = await tx.query(
        "SELECT * FROM product_variants WHERE store_id=$1 AND product_id=$2 ORDER BY id FOR UPDATE",
        [sid, productId],
      );
      for (const v of c.variants) {
        const old = v.id ? existing.find((x) => x.id === v.id) : null;
        assert(!v.id || old, 400, "Varian tidak ditemukan pada produk ini.");
        assert(
          v.stock_qty >= (old?.reserved_qty || 0),
          409,
          "Stok tidak boleh lebih kecil dari jumlah yang dipesan.",
        );
        const vid = v.id || crypto.randomUUID();
        if (old)
          await tx.query(
            "UPDATE product_variants SET sku=$3,option_label=$4,price_override_idr=$5,stock_qty=$6,status=$7 WHERE store_id=$1 AND id=$2",
            [
              sid,
              vid,
              v.sku,
              v.option_label,
              v.price_override_idr,
              v.stock_qty,
              v.status,
            ],
          );
        else
          await tx.query(
            "INSERT INTO product_variants(id,store_id,product_id,sku,option_label,price_override_idr,stock_qty,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
            [
              vid,
              sid,
              productId,
              v.sku,
              v.option_label,
              v.price_override_idr,
              v.stock_qty,
              v.status,
            ],
          );
        const delta = v.stock_qty - (old?.stock_qty || 0);
        if (delta)
          await tx.query(
            `INSERT INTO inventory_movements(id,store_id,variant_id,kind,quantity_delta,actor_id) VALUES($1,$2,$3,$4,$5,$6)`,
            [
              crypto.randomUUID(),
              sid,
              vid,
              old ? "adjustment" : "initial",
              delta,
              user.id,
            ],
          );
      }
      for (const old of existing)
        if (!c.variants.some((v) => v.id === old.id)) {
          assert(
            old.reserved_qty === 0,
            409,
            "Varian masih memiliki reservasi pesanan.",
          );
          await tx.query(
            `UPDATE product_variants SET status='inactive' WHERE store_id=$1 AND id=$2`,
            [sid, old.id],
          );
        }
      await tx.query(
        "UPDATE products SET gallery=$3 WHERE store_id=$1 AND id=$2",
        [sid, productId, JSON.stringify(c.gallery)],
      );
      for (const v of c.variants)
        await tx.query(
          "UPDATE product_variants SET image_url=$3 WHERE store_id=$1 AND sku=$2",
          [sid, v.sku, v.image_url],
        );
      await audit(
        tx,
        user.id,
        sid,
        pid ? "product.update" : "product.create",
        "product",
        productId,
      );
    });
    return json({ id: productId }, pid ? 200 : 201);
  }
  if (resource === "products" && pid && request.method === "DELETE") {
    await db.tx(async (tx) => {
      const rows = await tx.query(
        `UPDATE products SET status='archived',updated_at=now() WHERE store_id=$1 AND id=$2 RETURNING id`,
        [sid, pid],
      );
      assert(rows[0], 404, "Produk tidak ditemukan.");
      await audit(tx, user.id, sid, "product.archive", "product", pid);
    });
    return json({ ok: true });
  }
  if (resource === "overview" && request.method === "GET")
    return json({
      summary: (
        await db.query(
          `SELECT count(*)::int AS orders,COALESCE(sum(total_idr) FILTER(WHERE payment_status='paid'),0) AS revenue,count(*) FILTER(WHERE order_status='pending')::int AS pending FROM orders WHERE store_id=$1 AND created_at>now()-interval '30 days'`,
          [sid],
        )
      )[0],
      lowStock: await db.query(
        `SELECT p.name,v.option_label,v.stock_qty-v.reserved_qty AS available_stock FROM product_variants v JOIN products p ON p.id=v.product_id AND p.store_id=v.store_id JOIN store_settings ss ON ss.store_id=v.store_id WHERE v.store_id=$1 AND p.status='active' AND v.status='active' AND v.stock_qty-v.reserved_qty<=ss.low_stock_threshold`,
        [sid],
      ),
    });
  if (resource === "inventory" && request.method === "GET")
    return json({
      movements: await db.query(
        `SELECT i.*,p.name,v.option_label FROM inventory_movements i JOIN product_variants v ON v.store_id=i.store_id AND v.id=i.variant_id JOIN products p ON p.store_id=v.store_id AND p.id=v.product_id WHERE i.store_id=$1 ORDER BY i.created_at DESC LIMIT 200`,
        [sid],
      ),
    });
}
