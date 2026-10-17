import { z } from "zod";
import type { DB } from "./db";
import { assert, body, calendarDate, hash, id, json, token } from "./security";
import {
  audit,
  rateLimit,
  requireAdmin,
  requireUser,
  storeAccess,
  type Identity,
} from "./auth";

type ConversationRow = {
  id: string;
  store_id: string;
  buyer_user_id: string | null;
  guest_token_hash: string;
  guest_expires_at: string;
  customer_name: string;
  product_id: string | null;
};
const phone = z
  .string()
  .trim()
  .regex(/^[+0-9 ()-]{8,25}$/);
const email = z.union([z.email().max(254), z.literal("")]);
const person = z.object({
  full_name: z.string().trim().min(2).max(120),
  position: z.string().trim().min(2).max(80),
  contact_phone: phone,
  contact_email: email,
  birth_date: calendarDate
    .nullable()
    .refine(
      (v) =>
        !v || (v >= "1900-01-01" && v <= new Date().toISOString().slice(0, 10)),
      "Tanggal lahir tidak valid.",
    ),
  operational_address: z.string().trim().max(2000),
});
const address = z.object({
  label: z.string().trim().min(1).max(50),
  recipient_name: z.string().trim().min(2).max(120),
  contact_phone: phone,
  address: z.string().trim().min(12).max(2000),
  is_default: z.boolean().default(false),
});
const message = z.object({
  body: z.string().trim().min(1).max(4000),
  client_message_id: id,
});

export async function adminWorkspace(
  db: DB,
  request: Request,
  user: Identity | null,
) {
  const path = new URL(request.url).pathname;
  const match = path.match(
    /^\/api\/admin\/workspace\/stores\/([a-f0-9-]{36})$/,
  );
  if (match && request.method === "GET") {
    requireAdmin(user);
    const stores = await db.query(
      "SELECT s.*,'owner' AS role,u.email AS owner_email,'admin' AS access_mode FROM stores s JOIN merchants m ON m.id=s.merchant_id JOIN users u ON u.id=m.owner_user_id WHERE s.id=$1",
      [match[1]],
    );
    assert(stores[0], 404, "Toko tidak ditemukan.");
    await audit(
      db,
      user.id,
      match[1],
      "admin.workspace.enter",
      "store",
      match[1],
    );
    return json({ stores });
  }
  const acting = request.headers.get("x-nalaro-admin-store");
  if (acting) {
    requireAdmin(user);
    assert(
      id.safeParse(acting).success &&
        path.startsWith(`/api/merchant/stores/${acting}/`),
      403,
      "Konteks toko admin tidak sesuai.",
    );
    user.actingStoreId = acting;
    await audit(
      db,
      user.id,
      acting,
      "admin.workspace.request",
      "store",
      acting,
      { method: request.method, path },
    );
  }
}

export async function engagementRoutes(
  db: DB,
  request: Request,
  user: Identity | null,
) {
  const url = new URL(request.url),
    path = url.pathname;
  const profile = path.match(
    /^\/api\/merchant\/stores\/([a-f0-9-]{36})\/profile$/,
  );
  if (profile) {
    const sid = profile[1],
      access = await storeAccess(db, user, sid, request.method !== "GET");
    assert(
      ["owner", "manager"].includes(access.role),
      403,
      "Profil pribadi hanya untuk pemilik dan manager.",
    );
    if (request.method === "GET")
      return json({
        profile:
          (
            await db.query(
              "SELECT full_name,position,contact_phone,contact_email,to_char(birth_date,'YYYY-MM-DD') AS birth_date,operational_address,CASE WHEN birth_date IS NULL THEN NULL ELSE extract(year FROM age(current_date,birth_date))::int END AS age,updated_at FROM store_responsible_profiles WHERE store_id=$1",
              [sid],
            )
          )[0] || null,
      });
    assert(request.method === "PUT", 405, "Metode tidak tersedia.");
    const p = await body(request, person);
    await db.tx(async (tx) => {
      await tx.query(
        "INSERT INTO store_responsible_profiles(store_id,full_name,position,contact_phone,contact_email,birth_date,operational_address,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(store_id) DO UPDATE SET full_name=$2,position=$3,contact_phone=$4,contact_email=$5,birth_date=$6,operational_address=$7,updated_by=$8,updated_at=now()",
        [
          sid,
          p.full_name,
          p.position,
          p.contact_phone,
          p.contact_email,
          p.birth_date,
          p.operational_address,
          user!.id,
        ],
      );
      await audit(tx, user!.id, sid, "responsible.update", "store", sid);
    });
    return json({ ok: true });
  }
  if (path.startsWith("/api/customer/")) {
    requireUser(user);
    if (path === "/api/customer/profile") {
      if (request.method === "GET")
        return json({
          user,
          profile:
            (
              await db.query(
                "SELECT full_name,contact_phone FROM customer_profiles WHERE user_id=$1",
                [user.id],
              )
            )[0] || null,
        });
      assert(request.method === "PUT", 405, "Metode tidak tersedia.");
      const p = await body(
        request,
        z.object({
          full_name: z.string().trim().min(2).max(120),
          contact_phone: phone,
        }),
      );
      await db.query(
        "INSERT INTO customer_profiles(user_id,full_name,contact_phone) VALUES($1,$2,$3) ON CONFLICT(user_id) DO UPDATE SET full_name=$2,contact_phone=$3,updated_at=now()",
        [user.id, p.full_name, p.contact_phone],
      );
      return json({ ok: true });
    }
    const am = path.match(/^\/api\/customer\/addresses(?:\/([a-f0-9-]{36}))?$/);
    if (am) {
      if (request.method === "GET" && !am[1])
        return json({
          addresses: await db.query(
            "SELECT * FROM customer_addresses WHERE user_id=$1 ORDER BY is_default DESC,created_at",
            [user.id],
          ),
        });
      if (request.method === "DELETE" && am[1]) {
        await db.query(
          "DELETE FROM customer_addresses WHERE id=$1 AND user_id=$2",
          [am[1], user.id],
        );
        return json({ ok: true });
      }
      assert(
        (request.method === "POST" && !am[1]) ||
          (request.method === "PUT" && am[1]),
        405,
        "Metode tidak tersedia.",
      );
      const p = await body(request, address),
        aid = am[1] || crypto.randomUUID();
      await db.tx(async (tx) => {
        await tx.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [
          user.id,
        ]);
        if (am[1])
          assert(
            (
              await tx.query(
                "SELECT id FROM customer_addresses WHERE id=$1 AND user_id=$2",
                [aid, user.id],
              )
            )[0],
            404,
            "Alamat tidak ditemukan.",
          );
        else
          assert(
            Number(
              (
                await tx.query(
                  "SELECT count(*)::int AS n FROM customer_addresses WHERE user_id=$1",
                  [user.id],
                )
              )[0].n,
            ) < 10,
            409,
            "Maksimal 10 alamat tersimpan.",
          );
        if (p.is_default)
          await tx.query(
            "UPDATE customer_addresses SET is_default=false WHERE user_id=$1",
            [user.id],
          );
        await tx.query(
          "INSERT INTO customer_addresses(id,user_id,label,recipient_name,contact_phone,address,is_default) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET label=$3,recipient_name=$4,contact_phone=$5,address=$6,is_default=$7,updated_at=now()",
          [
            aid,
            user.id,
            p.label,
            p.recipient_name,
            p.contact_phone,
            p.address,
            p.is_default,
          ],
        );
      });
      return json({ id: aid });
    }
    if (path === "/api/customer/orders/claim" && request.method === "POST") {
      const p = await body(
        request,
        z.object({
          store_slug: z.string().max(48),
          tracking_token: z.string().regex(/^[a-f0-9]{64}$/),
        }),
      );
      await rateLimit(db, "order-claim:" + user.id, 30);
      const rows = await db.query(
        "UPDATE orders SET buyer_user_id=$1 WHERE tracking_token_hash=$2 AND tracking_expires_at>now() AND store_id=(SELECT id FROM stores WHERE slug=$3) AND (buyer_user_id IS NULL OR buyer_user_id=$1) RETURNING id",
        [user.id, await hash(p.tracking_token), p.store_slug],
      );
      assert(
        rows[0],
        404,
        "Bukti kepemilikan pesanan tidak valid atau sudah kedaluwarsa.",
      );
      return json({ ok: true });
    }
    if (path === "/api/customer/orders" && request.method === "GET") {
      const page = Math.max(
        1,
        Math.min(10000, Number(url.searchParams.get("page")) || 1),
      );
      assert(Number.isInteger(page), 400, "Halaman tidak valid.");
      const rows = await db.query(
        "SELECT o.id,o.order_number,o.customer_name,o.total_idr,o.order_status,o.payment_status,o.fulfillment_status,o.created_at,s.name AS store_name,s.slug AS store_slug FROM orders o JOIN stores s ON s.id=o.store_id WHERE o.buyer_user_id=$1 ORDER BY o.created_at DESC,o.id DESC LIMIT 51 OFFSET $2",
        [user.id, (page - 1) * 50],
      );
      return json({
        orders: rows.slice(0, 50),
        page,
        hasMore: rows.length > 50,
      });
    }
    const om = path.match(/^\/api\/customer\/orders\/([a-f0-9-]{36})$/);
    if (om && request.method === "GET") {
      const order = (
        await db.query(
          "SELECT o.*,s.name AS store_name,s.slug AS store_slug FROM orders o JOIN stores s ON s.id=o.store_id WHERE o.id=$1 AND o.buyer_user_id=$2",
          [om[1], user.id],
        )
      )[0];
      assert(order, 404, "Pesanan tidak ditemukan.");
      // Never return encrypted bearer tokens through account history.
      const {
        tracking_token_hash: _hash,
        tracking_token_sealed: _sealed,
        request_hash: _request,
        ...safeOrder
      } = order;
      return json({
        order: safeOrder,
        items: await db.query(
          "SELECT name_snapshot,variant_snapshot,quantity,unit_price_idr,line_total_idr FROM order_items WHERE order_id=$1 AND store_id=$2",
          [order.id, order.store_id],
        ),
      });
    }
    if (path === "/api/customer/conversations" && request.method === "GET")
      return conversationList(db, user.id, null);
  }
  const cm = path.match(
    /^\/api\/merchant\/stores\/([a-f0-9-]{36})\/conversations(?:\/([a-f0-9-]{36})(?:\/(read))?)?$/,
  );
  if (cm) {
    const [, sid, cid, read] = cm,
      access = await storeAccess(db, user, sid);
    assert(
      ["owner", "manager", "fulfillment"].includes(access.role),
      403,
      "Peranmu tidak memiliki akses chat pelanggan.",
    );
    if (request.method !== "GET")
      assert(access.status !== "suspended", 423, "Toko dinonaktifkan admin.");
    if (!cid) {
      assert(request.method === "GET", 405, "Metode tidak tersedia.");
      return conversationList(db, null, sid);
    }
    const c = (
      await db.query<ConversationRow>(
        "SELECT * FROM customer_conversations WHERE id=$1 AND store_id=$2",
        [cid, sid],
      )
    )[0];
    assert(c, 404, "Percakapan tidak ditemukan.");
    return conversationMessages(db, request, c, "seller", user!, !!read);
  }
  const nm = path.match(
    /^\/api\/merchant\/stores\/([a-f0-9-]{36})\/notifications(?:\/(read))?$/,
  );
  if (nm) {
    const sid = nm[1];
    await storeAccess(db, user, sid);
    if (nm[2]) {
      assert(request.method === "POST", 405, "Metode tidak tersedia.");
      const p = await body(
        request,
        z.object({ keys: z.array(z.string().max(200)).max(100) }),
      );
      for (const key of p.keys)
        await db.query(
          "INSERT INTO seller_notification_receipts(user_id,store_id,notification_key) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
          [user!.id, sid, key],
        );
      return json({ ok: true });
    }
    assert(request.method === "GET", 405, "Metode tidak tersedia.");
    const rows = await db.query(
      `WITH events AS (
      SELECT 'order:'||id::text AS key,'Pesanan baru' AS title,order_number AS body,'orders' AS route,created_at FROM orders WHERE store_id=$1 AND order_status='pending'
      UNION ALL SELECT 'chat:'||m.id::text,'Pesan pelanggan',c.customer_name,'chat',m.created_at FROM customer_conversations c JOIN LATERAL(SELECT id,created_at FROM customer_messages WHERE conversation_id=c.id AND sender_kind='buyer' AND created_at>COALESCE(c.seller_read_at,'epoch') ORDER BY created_at DESC LIMIT 1)m ON true WHERE c.store_id=$1
      UNION ALL SELECT 'stock:'||v.id::text||':'||(v.stock_qty-v.reserved_qty)::text,'Stok menipis',p.name||' · '||v.option_label,'inventory',p.updated_at FROM product_variants v JOIN products p ON p.id=v.product_id AND p.store_id=v.store_id JOIN store_settings ss ON ss.store_id=v.store_id WHERE v.store_id=$1 AND v.status='active' AND p.status='active' AND v.stock_qty-v.reserved_qty<=ss.low_stock_threshold
    ) SELECT e.*,r.read_at IS NOT NULL AS is_read FROM events e LEFT JOIN seller_notification_receipts r ON r.notification_key=e.key AND r.store_id=$1 AND r.user_id=$2 ORDER BY e.created_at DESC LIMIT 100`,
      [sid, user!.id],
    );
    return json({
      notifications: rows,
      unread: rows.filter((r) => !r.is_read).length,
    });
  }
}

export async function createConversation(
  db: DB,
  request: Request,
  sid: string,
  user: Identity | null,
) {
  if (user) requireUser(user);
  await rateLimit(
    db,
    "chat-create:" +
      (await hash(
        (user?.id || request.headers.get("cf-connecting-ip") || "local") + sid,
      )),
    20,
  );
  const p = await body(
    request,
    z.object({
      customer_name: z.string().trim().min(2).max(120),
      product_id: id.optional(),
    }),
  );
  if (p.product_id)
    assert(
      (
        await db.query(
          "SELECT id FROM products WHERE id=$1 AND store_id=$2 AND status='active'",
          [p.product_id, sid],
        )
      )[0],
      404,
      "Produk tidak ditemukan.",
    );
  const cid = crypto.randomUUID(),
    raw = token();
  await db.query(
    "INSERT INTO customer_conversations(id,store_id,buyer_user_id,guest_token_hash,guest_expires_at,customer_name,product_id) VALUES($1,$2,$3,$4,now()+interval '30 days',$5,$6)",
    [
      cid,
      sid,
      user?.id || null,
      await hash(raw),
      p.customer_name,
      p.product_id || null,
    ],
  );
  return json({ id: cid, chat_token: raw }, 201);
}
export async function publicChat(
  db: DB,
  request: Request,
  user: Identity | null,
) {
  const match = new URL(request.url).pathname.match(
    /^\/api\/public\/chat\/([a-f0-9-]{36})(?:\/(read))?$/,
  );
  if (!match) return;
  const c = (
    await db.query<ConversationRow>(
      "SELECT * FROM customer_conversations WHERE id=$1",
      [match[1]],
    )
  )[0];
  const raw = request.headers.get("x-chat-token") || "";
  const owned =
    c &&
    ((user?.verified && c.buyer_user_id === user.id) ||
      (!c.buyer_user_id &&
        /^[a-f0-9]{64}$/.test(raw) &&
        c.guest_token_hash === (await hash(raw)) &&
        new Date(c.guest_expires_at) > new Date()));
  assert(owned, 404, "Percakapan tidak ditemukan atau akses kedaluwarsa.");
  if (request.method !== "GET" && !match[2])
    assert(
      (
        await db.query(
          "SELECT id FROM stores WHERE id=$1 AND status<>'suspended'",
          [c.store_id],
        )
      )[0],
      423,
      "Toko sedang dinonaktifkan.",
    );
  return conversationMessages(db, request, c, "buyer", user, !!match[2]);
}
async function conversationList(
  db: DB,
  buyer: string | null,
  sid: string | null,
) {
  const rows = await db.query(
    `SELECT c.id,c.customer_name,c.store_id,c.updated_at,c.product_id,s.name AS store_name,s.slug AS store_slug,p.name AS product_name,
    (SELECT body FROM customer_messages WHERE conversation_id=c.id ORDER BY created_at DESC,id DESC LIMIT 1) AS last_message,
    (SELECT count(*)::int FROM customer_messages WHERE conversation_id=c.id AND sender_kind=$2 AND created_at>COALESCE(${sid ? "c.seller_read_at" : "c.buyer_read_at"},'epoch')) AS unread
    FROM customer_conversations c JOIN stores s ON s.id=c.store_id LEFT JOIN products p ON p.id=c.product_id WHERE ${sid ? "c.store_id=$1" : "c.buyer_user_id=$1"} ORDER BY c.updated_at DESC,c.id DESC LIMIT 100`,
    [sid || buyer, sid ? "buyer" : "seller"],
  );
  return json({ conversations: rows });
}
async function conversationMessages(
  db: DB,
  request: Request,
  c: ConversationRow,
  kind: "buyer" | "seller",
  user: Identity | null,
  read: boolean,
) {
  const cid = c.id;
  if (read) {
    assert(request.method === "POST", 405, "Metode tidak tersedia.");
    // Acknowledge only messages actually displayed, so an incoming message is never accidentally read.
    const p = await body(request, z.object({ last_message_id: id }));
    await db.query(
      `UPDATE customer_conversations SET ${kind === "seller" ? "seller_read_at" : "buyer_read_at"}=GREATEST(COALESCE(${kind === "seller" ? "seller_read_at" : "buyer_read_at"},'epoch'),(SELECT created_at FROM customer_messages WHERE id=$2 AND conversation_id=$1)) WHERE id=$1 AND EXISTS(SELECT 1 FROM customer_messages WHERE id=$2 AND conversation_id=$1)`,
      [cid, p.last_message_id],
    );
    return json({ ok: true });
  }
  if (request.method === "POST") {
    await rateLimit(db, "chat-send:" + cid + ":" + kind, 100);
    const p = await body(request, message);
    const result = await db.tx(async (tx) => {
      await tx.query(
        "SELECT id FROM customer_conversations WHERE id=$1 FOR UPDATE",
        [cid],
      );
      const old = (
        await tx.query(
          "SELECT * FROM customer_messages WHERE conversation_id=$1 AND client_message_id=$2",
          [cid, p.client_message_id],
        )
      )[0];
      if (old) {
        assert(
          old.sender_kind === kind && old.body === p.body,
          409,
          "Referensi pesan sudah dipakai.",
        );
        return old;
      }
      const row = (
        await tx.query(
          "INSERT INTO customer_messages(id,conversation_id,sender_kind,sender_user_id,client_message_id,body) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,sender_kind,body,created_at",
          [
            crypto.randomUUID(),
            cid,
            kind,
            user?.id || null,
            p.client_message_id,
            p.body,
          ],
        )
      )[0];
      await tx.query(
        "UPDATE customer_conversations SET updated_at=now() WHERE id=$1",
        [cid],
      );
      return row;
    });
    return json({ message: result }, 201);
  }
  assert(request.method === "GET", 405, "Metode tidak tersedia.");
  const before = new URL(request.url).searchParams.get("before");
  assert(
    !before || id.safeParse(before).success,
    400,
    "Halaman pesan tidak valid.",
  );
  const rows = await db.query(
    "SELECT id,sender_kind,body,created_at FROM customer_messages WHERE conversation_id=$1 AND ($2::uuid IS NULL OR (created_at,id)<(SELECT created_at,id FROM customer_messages WHERE id=$2 AND conversation_id=$1)) ORDER BY created_at DESC,id DESC LIMIT 51",
    [cid, before],
  );
  return json({
    conversation: {
      id: cid,
      customer_name: c.customer_name,
      product_id: c.product_id,
    },
    messages: rows.slice(0, 50).reverse(),
    hasMore: rows.length > 50,
  });
}
