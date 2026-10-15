import { z } from "zod";
import type { DB } from "./db";
import {
  assert,
  body,
  calendarDate,
  hash,
  id,
  json,
  money,
  token,
  unseal,
} from "./security";
import {
  audit,
  encryptedToken,
  enqueue,
  requireUser,
  storeAccess,
  type AuthConfig,
  type Identity,
} from "./auth";
import { entitlement, incrementUsage } from "./billing";
export const checkoutSchema = z
  .object({
    idempotency_key: z.string().uuid(),
    items: z
      .array(
        z.object({
          variant_id: id,
          quantity: z.number().int().min(1).max(99),
          expected_unit_price: money,
        }),
      )
      .min(1)
      .max(50),
    expected_total: money,
    customer_name: z.string().trim().min(2).max(120),
    contact_email: z.union([z.email().max(254), z.literal("")]).default(""),
    contact_phone: z.string().regex(/^[+0-9 ()-]{8,25}$/),
    address: z.string().trim().max(2000).default(""),
    shipping_method: z.enum(["pickup", "local_flat"]),
  })
  .refine(
    (c) => new Set(c.items.map((i) => i.variant_id)).size === c.items.length,
    "Varian tidak boleh duplikat.",
  )
  .refine(
    (c) => c.shipping_method === "pickup" || c.address.length >= 12,
    "Alamat pengiriman belum lengkap.",
  );
export async function checkout(
  db: DB,
  sid: string,
  c: z.infer<typeof checkoutSchema>,
  env: AuthConfig,
) {
  const canonical = {
    ...c,
    items: [...c.items].sort((a, b) =>
      a.variant_id.localeCompare(b.variant_id),
    ),
  };
  const fingerprint = await hash(JSON.stringify(canonical));
  return db.tx(async (tx) => {
    const stores = await tx.query(
      "SELECT * FROM stores WHERE id=$1 FOR UPDATE",
      [sid],
    );
    assert(stores[0], 404, "Toko tidak ditemukan.");
    const previous = (
      await tx.query(
        "SELECT * FROM orders WHERE store_id=$1 AND idempotency_key=$2",
        [sid, c.idempotency_key],
      )
    )[0];
    if (previous) {
      assert(
        previous.request_hash === fingerprint,
        409,
        "Referensi permintaan sudah dipakai untuk pesanan berbeda.",
      );
      assert(env.TOKEN_SECRET, 503, "Layanan belum dikonfigurasi.");
      return {
        order_number: previous.order_number,
        tracking_token: await unseal(
          previous.tracking_token_sealed,
          env.TOKEN_SECRET,
        ),
        total_idr: Number(previous.total_idr),
        replayed: true,
      };
    }
    assert(
      stores[0].status === "published",
      409,
      "Toko sedang tidak menerima pesanan.",
    );
    await entitlement(tx, sid, "orders", 1);
    const ss = (
      await tx.query("SELECT * FROM store_settings WHERE store_id=$1", [sid])
    )[0];
    assert(
      ss.bank_details || ss.qris_media_key,
      409,
      "Pembayaran toko belum tersedia.",
    );
    assert(
      c.shipping_method === "pickup" ? ss.pickup_enabled : ss.delivery_enabled,
      409,
      "Metode pengiriman tidak tersedia.",
    );
    const variants = await tx.query(
      `SELECT v.*,p.name,p.status AS product_status,p.price_idr FROM product_variants v JOIN products p ON p.store_id=v.store_id AND p.id=v.product_id WHERE v.store_id=$1 AND v.id=ANY($2::uuid[]) ORDER BY v.id FOR UPDATE OF v`,
      [sid, c.items.map((i) => i.variant_id)],
    );
    let subtotal = 0;
    for (const item of c.items) {
      const v = variants.find((v) => v.id === item.variant_id);
      assert(
        v && v.status === "active" && v.product_status === "active",
        409,
        "Produk tidak lagi tersedia.",
      );
      assert(
        v.stock_qty - v.reserved_qty >= item.quantity,
        409,
        `Stok ${v.name} (${v.option_label}) tidak mencukupi.`,
      );
      const price = Number(v.price_override_idr ?? v.price_idr);
      assert(
        price === item.expected_unit_price,
        409,
        `Harga ${v.name} berubah. Tinjau kembali keranjang.`,
      );
      subtotal += price * item.quantity;
    }
    const shipping =
        c.shipping_method === "pickup" ? 0 : Number(ss.shipping_fee_idr),
      total = subtotal + shipping;
    assert(
      total === c.expected_total,
      409,
      "Total pesanan berubah. Tinjau biaya sebelum melanjutkan.",
    );
    assert(total <= 1_000_000_000, 400, "Nilai pesanan melebihi batas.");
    const oid = crypto.randomUUID(),
      raw = token();
    const counter = await tx.query(
      `INSERT INTO store_order_counters(store_id,counter) VALUES($1,1) ON CONFLICT(store_id) DO UPDATE SET counter=store_order_counters.counter+1 RETURNING counter`,
      [sid],
    );
    const number = "NS-" + String(counter[0].counter).padStart(6, "0");
    const sealed = await encryptedToken(raw, env);
    await tx.query(
      `INSERT INTO orders(id,store_id,order_number,idempotency_key,request_hash,customer_name,contact_email,contact_phone,address_json,shipping_method,subtotal_idr,shipping_idr,total_idr,reservation_expires_at,tracking_token_hash,tracking_token_sealed,tracking_expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now()+interval '24 hours',$14,$15,now()+interval '30 days')`,
      [
        oid,
        sid,
        number,
        c.idempotency_key,
        fingerprint,
        c.customer_name,
        c.contact_email || null,
        c.contact_phone,
        JSON.stringify({
          address: c.shipping_method === "local_flat" ? c.address : "",
        }),
        c.shipping_method,
        subtotal,
        shipping,
        total,
        await hash(raw),
        sealed,
      ],
    );
    for (const item of c.items) {
      const v = variants.find((v) => v.id === item.variant_id)!;
      const price = Number(v.price_override_idr ?? v.price_idr);
      await tx.query(
        `INSERT INTO order_items(id,store_id,order_id,variant_id,name_snapshot,variant_snapshot,sku_snapshot,quantity,unit_price_idr,line_total_idr) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          crypto.randomUUID(),
          sid,
          oid,
          v.id,
          v.name,
          v.option_label,
          v.sku,
          item.quantity,
          price,
          item.quantity * price,
        ],
      );
      await tx.query(
        "UPDATE product_variants SET reserved_qty=reserved_qty+$3 WHERE store_id=$1 AND id=$2",
        [sid, v.id, item.quantity],
      );
      await tx.query(
        `INSERT INTO inventory_movements(id,store_id,variant_id,order_id,kind,quantity_delta) VALUES($1,$2,$3,$4,'reserve',$5)`,
        [crypto.randomUUID(), sid, v.id, oid, -item.quantity],
      );
    }
    await incrementUsage(tx, sid, "orders", 1);
    await audit(tx, null, sid, "order.create", "order", oid);
    if (c.contact_email)
      await enqueue(
        tx,
        sid,
        c.contact_email,
        `Pesanan ${number} diterima`,
        `${stores[0].name}\nTotal: Rp${total.toLocaleString("id-ID")}\nSelesaikan pembayaran dalam 24 jam. Pembayaran menunggu verifikasi toko.\nLacak: ${env.APP_ORIGIN}/s/${stores[0].slug}/track/${raw}`,
      );
    return {
      order_number: number,
      tracking_token: raw,
      total_idr: total,
      replayed: false,
    };
  });
}
export async function releaseOrder(
  tx: DB,
  order: Record<string, unknown>,
  actor: string | null,
  expired = false,
) {
  const sid = String(order.store_id),
    oid = String(order.id);
  assert(
    order.payment_status !== "paid",
    409,
    "Pesanan dibayar tidak dapat dibatalkan tanpa proses refund.",
  );
  if (["canceled", "expired"].includes(String(order.order_status))) return;
  const items = await tx.query(
    "SELECT * FROM order_items WHERE store_id=$1 AND order_id=$2 ORDER BY variant_id",
    [sid, oid],
  );
  for (const i of items) {
    const rows = await tx.query(
      "UPDATE product_variants SET reserved_qty=reserved_qty-$3 WHERE store_id=$1 AND id=$2 AND reserved_qty>=$3 RETURNING id",
      [sid, i.variant_id, i.quantity],
    );
    assert(rows[0], 409, "Reservasi stok tidak konsisten.");
    await tx.query(
      `INSERT INTO inventory_movements(id,store_id,variant_id,order_id,kind,quantity_delta,actor_id) VALUES($1,$2,$3,$4,'release',$5,$6)`,
      [crypto.randomUUID(), sid, i.variant_id, oid, i.quantity, actor],
    );
  }
  await tx.query(
    "UPDATE orders SET order_status=$3,payment_status=$4,updated_at=now() WHERE store_id=$1 AND id=$2",
    [
      sid,
      oid,
      expired ? "expired" : "canceled",
      expired ? "expired" : "failed",
    ],
  );
  await audit(
    tx,
    actor,
    sid,
    expired ? "order.expire" : "order.cancel",
    "order",
    oid,
  );
}
export async function expireReservations(db: DB) {
  let count = 0;
  await db.tx(async (tx) => {
    const rows = await tx.query(
      `SELECT * FROM orders WHERE order_status='pending' AND payment_status IN ('unpaid','pending') AND reservation_expires_at<=now() ORDER BY id LIMIT 100 FOR UPDATE SKIP LOCKED`,
    );
    for (const o of rows) {
      await releaseOrder(tx, o, null, true);
      count++;
    }
  });
  return count;
}
export async function tracking(db: DB, sid: string, raw: string) {
  assert(/^[a-f0-9]{64}$/.test(raw), 404, "Pesanan tidak ditemukan.");
  const o = (
    await db.query(
      `SELECT order_number,order_status,payment_status,fulfillment_status,subtotal_idr,shipping_idr,total_idr,reservation_expires_at,created_at,updated_at,shipment_reference,id,shipping_method FROM orders WHERE store_id=$1 AND tracking_token_hash=$2 AND tracking_expires_at>now()`,
      [sid, await hash(raw)],
    )
  )[0];
  assert(o, 404, "Pesanan tidak ditemukan atau tautan kedaluwarsa.");
  const settings = (
    await db.query(
      "SELECT bank_details,qris_media_key,pickup_address,contact_phone FROM store_settings WHERE store_id=$1",
      [sid],
    )
  )[0];
  const items = await db.query(
    "SELECT name_snapshot,variant_snapshot,quantity,unit_price_idr,line_total_idr FROM order_items WHERE store_id=$1 AND order_id=$2",
    [sid, o.id],
  );
  delete o.id;
  return { order: o, items, payment: settings };
}
export async function orderRoutes(
  db: DB,
  request: Request,
  user: Identity | null,
  path: string,
): Promise<Response | undefined> {
  const match = path.match(
    /^\/api\/merchant\/stores\/([a-f0-9-]{36})\/orders(?:\/([a-f0-9-]{36})(?:\/(payment|fulfillment|cancel))?)?$/,
  );
  if (!match) return;
  const [, sid, oid, action] = match;
  const access = await storeAccess(db, user, sid);
  requireUser(user);
  if (request.method !== "GET")
    assert(
      ["owner", "manager", "fulfillment"].includes(access.role),
      403,
      "Akses perubahan pesanan ditolak.",
    );
  if (!oid && request.method === "GET") {
    const url = new URL(request.url),
      page = Number(url.searchParams.get("page") || 1),
      search = (url.searchParams.get("q") || "").slice(0, 120),
      status = url.searchParams.get("status") || "all",
      from = url.searchParams.get("from") || "1970-01-01",
      to = url.searchParams.get("to") || "2999-12-31";
    assert(
      Number.isInteger(page) &&
        page > 0 &&
        page <= 10000 &&
        [
          "all",
          "unpaid",
          "paid",
          "completed",
          "shipped",
          "packing",
          "pickup_ready",
        ].includes(status) &&
        calendarDate.safeParse(from).success &&
        calendarDate.safeParse(to).success &&
        from <= to,
      400,
      "Filter pesanan tidak valid.",
    );
    const rows = await db.query(
      `SELECT id,order_number,customer_name,total_idr,payment_status,fulfillment_status,order_status,created_at FROM orders WHERE store_id=$1 AND (order_number ILIKE $2 OR customer_name ILIKE $2) AND ($3='all' OR payment_status=$3 OR order_status=$3 OR fulfillment_status=$3) AND created_at >= $4::date AND created_at < $5::date+interval '1 day' ORDER BY created_at DESC,id DESC LIMIT 51 OFFSET $6`,
      [sid, "%" + search + "%", status, from, to, (page - 1) * 50],
    );
    return json({ orders: rows.slice(0, 50), page, hasMore: rows.length > 50 });
  }
  if (oid && !action && request.method === "GET") {
    const o = (
      await db.query("SELECT * FROM orders WHERE store_id=$1 AND id=$2", [
        sid,
        oid,
      ])
    )[0];
    assert(o, 404, "Pesanan tidak ditemukan.");
    delete o.tracking_token_hash;
    delete o.tracking_token_sealed;
    delete o.request_hash;
    return json({
      order: o,
      items: await db.query(
        "SELECT * FROM order_items WHERE store_id=$1 AND order_id=$2",
        [sid, oid],
      ),
      timeline: await db.query(
        `SELECT action,created_at FROM audit_logs WHERE store_id=$1 AND entity_type='order' AND entity_id=$2 ORDER BY created_at`,
        [sid, oid],
      ),
    });
  }
  if (!oid || request.method !== "POST") return;
  const c: {
    decision?: "verified" | "rejected";
    note?: string;
    status?: "packing" | "shipped" | "delivered" | "pickup_ready" | "picked_up";
    reference?: string;
  } =
    action === "payment"
      ? await body(
          request,
          z.object({
            decision: z.enum(["verified", "rejected"]),
            note: z.string().max(2000).default(""),
          }),
        )
      : action === "fulfillment"
        ? await body(
            request,
            z.object({
              status: z.enum([
                "packing",
                "shipped",
                "delivered",
                "pickup_ready",
                "picked_up",
              ]),
              reference: z.string().max(120).default(""),
            }),
          )
        : {};
  await db.tx(async (tx) => {
    const o = (
      await tx.query(
        "SELECT * FROM orders WHERE store_id=$1 AND id=$2 FOR UPDATE",
        [sid, oid],
      )
    )[0];
    assert(o, 404, "Pesanan tidak ditemukan.");
    if (action === "cancel") {
      assert(
        ["owner", "manager"].includes(access.role),
        403,
        "Hanya pengelola dapat membatalkan pesanan.",
      );
      await releaseOrder(tx, o, user.id);
      return;
    }
    if (action === "payment" && c.decision) {
      assert(
        ["owner", "manager"].includes(access.role),
        403,
        "Hanya pengelola dapat memverifikasi pembayaran.",
      );
      if (o.payment_status === "paid") {
        assert(
          c.decision === "verified",
          409,
          "Pembayaran sudah diverifikasi.",
        );
        return;
      }
      assert(
        o.order_status === "pending",
        409,
        "Pesanan tidak dapat diverifikasi.",
      );
      assert(
        new Date(o.reservation_expires_at).getTime() > Date.now(),
        409,
        "Reservasi sudah kedaluwarsa.",
      );
      if (c.decision === "rejected") {
        await tx.query(
          `INSERT INTO manual_payment_reviews(id,store_id,order_id,reviewed_by,decision,note) VALUES($1,$2,$3,$4,'rejected',$5)`,
          [crypto.randomUUID(), sid, oid, user.id, c.note],
        );
        await audit(tx, user.id, sid, "payment.reject", "order", oid);
        return;
      }
      const items = await tx.query(
        "SELECT * FROM order_items WHERE store_id=$1 AND order_id=$2 ORDER BY variant_id",
        [sid, oid],
      );
      for (const i of items) {
        const changed = await tx.query(
          "UPDATE product_variants SET stock_qty=stock_qty-$3,reserved_qty=reserved_qty-$3 WHERE store_id=$1 AND id=$2 AND reserved_qty>=$3 AND stock_qty>=$3 RETURNING id",
          [sid, i.variant_id, i.quantity],
        );
        assert(changed[0], 409, "Stok reservasi tidak konsisten.");
        await tx.query(
          `INSERT INTO inventory_movements(id,store_id,variant_id,order_id,kind,quantity_delta,actor_id) VALUES($1,$2,$3,$4,'fulfill',$5,$6)`,
          [crypto.randomUUID(), sid, i.variant_id, oid, -i.quantity, user.id],
        );
      }
      await tx.query(
        `UPDATE orders SET payment_status='paid',order_status='confirmed',updated_at=now() WHERE store_id=$1 AND id=$2`,
        [sid, oid],
      );
      await tx.query(
        `INSERT INTO manual_payment_reviews(id,store_id,order_id,reviewed_by,decision,note) VALUES($1,$2,$3,$4,'verified',$5)`,
        [crypto.randomUUID(), sid, oid, user.id, c.note],
      );
      await audit(tx, user.id, sid, "payment.verify", "order", oid);
      if (o.contact_email)
        await enqueue(
          tx,
          sid,
          o.contact_email,
          `Pembayaran ${o.order_number} terverifikasi`,
          "Pembayaran telah diperiksa oleh toko. Pesanan akan diproses.",
        );
      return;
    }
    if (action === "fulfillment" && c.status) {
      assert(
        o.payment_status === "paid" &&
          !["canceled", "expired"].includes(o.order_status),
        409,
        "Pembayaran belum terverifikasi.",
      );
      const next =
        o.shipping_method === "pickup"
          ? {
              unfulfilled: ["packing", "pickup_ready"],
              packing: ["pickup_ready"],
              pickup_ready: ["picked_up"],
            }
          : {
              unfulfilled: ["packing"],
              packing: ["shipped"],
              shipped: ["delivered"],
            };
      const allowed = next[o.fulfillment_status as keyof typeof next] as
        string[] | undefined;
      assert(
        allowed?.includes(c.status),
        409,
        "Urutan pengiriman tidak valid.",
      );
      await tx.query(
        "UPDATE orders SET fulfillment_status=$3,order_status=$4,shipment_reference=$5,updated_at=now() WHERE store_id=$1 AND id=$2",
        [
          sid,
          oid,
          c.status,
          ["delivered", "picked_up"].includes(c.status)
            ? "completed"
            : "processing",
          c.reference || o.shipment_reference,
        ],
      );
      await audit(tx, user.id, sid, "fulfillment." + c.status, "order", oid);
      if (o.contact_email)
        await enqueue(
          tx,
          sid,
          o.contact_email,
          `Status pesanan ${o.order_number}`,
          `Status pesanan diperbarui: ${c.status}.`,
        );
      return;
    }
    assert(false, 404, "Tindakan tidak tersedia.");
  });
  return json({ ok: true });
}
