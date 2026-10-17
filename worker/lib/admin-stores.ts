import { z } from "zod";
import type { DB } from "./db";
import { assert, body, id, json } from "./security";
import { audit, requireAdmin, type Identity } from "./auth";

export async function replaceSubscription(
  tx: DB,
  sid: string,
  keepId?: string,
) {
  await tx.query(
    `UPDATE subscription_invoices SET status='void' WHERE status IN ('unpaid','overdue','draft') AND subscription_id IN (SELECT id FROM store_subscriptions WHERE store_id=$1 AND id<>COALESCE($2::uuid,'00000000-0000-0000-0000-000000000000'::uuid))`,
    [sid, keepId ?? null],
  );
  await tx.query(
    `UPDATE store_subscriptions SET status='canceled' WHERE store_id=$1 AND status<>'canceled' AND id<>COALESCE($2::uuid,'00000000-0000-0000-0000-000000000000'::uuid)`,
    [sid, keepId ?? null],
  );
  await tx.query("UPDATE stores SET pilot_until=NULL WHERE id=$1", [sid]);
}

export async function adminStoreRoutes(
  db: DB,
  request: Request,
  user: Identity | null,
  path: string,
) {
  const match = path.match(
    /^\/api\/admin\/stores\/([a-f0-9-]{36})(?:\/(status|subscription|deletion))?$/,
  );
  if (!match) return;
  requireAdmin(user);
  const [, sid, resource] = match;
  const store = (
    await db.query(
      `SELECT s.*,u.email AS owner_email FROM stores s JOIN merchants m ON m.id=s.merchant_id JOIN users u ON u.id=m.owner_user_id WHERE s.id=$1`,
      [sid],
    )
  )[0];
  assert(store, 404, "Toko tidak ditemukan.");
  if (!resource && request.method === "GET") {
    await audit(db, user.id, sid, "admin.store.view", "store", sid);
    return json({
      store,
      settings: (
        await db.query("SELECT * FROM store_settings WHERE store_id=$1", [sid])
      )[0],
      domains: await db.query("SELECT * FROM store_domains WHERE store_id=$1", [
        sid,
      ]),
      subscriptions: await db.query(
        "SELECT s.*,p.name FROM store_subscriptions s JOIN plans p ON p.id=s.plan_id WHERE s.store_id=$1 ORDER BY s.created_at DESC,s.id",
        [sid],
      ),
      stats: (
        await db.query(
          "SELECT (SELECT count(*)::int FROM products WHERE store_id=$1) AS products,(SELECT count(*)::int FROM orders WHERE store_id=$1) AS orders",
          [sid],
        )
      )[0],
      activity: await db.query(
        "SELECT action,created_at,metadata FROM audit_logs WHERE store_id=$1 ORDER BY created_at DESC LIMIT 20",
        [sid],
      ),
    });
  }
  if (resource === "status" && request.method === "PUT") {
    const c = await body(
      request,
      z.object({
        status: z.enum(["suspended", "draft"]),
        reason: z.string().trim().min(5).max(1000),
      }),
    );
    await db.tx(async (tx) => {
      await tx.query("SELECT id FROM stores WHERE id=$1 FOR UPDATE", [sid]);
      await tx.query(
        "UPDATE stores SET status=$2,updated_at=now() WHERE id=$1",
        [sid, c.status],
      );
      await audit(tx, user.id, sid, "admin.store.status", "store", sid, c);
    });
    return json({ ok: true });
  }
  if (resource === "subscription" && request.method === "PUT") {
    const c = await body(
      request,
      z.object({
        plan_price_id: id,
        duration_days: z.number().int().min(1).max(3660),
        reason: z.string().trim().min(5).max(1000),
      }),
    );
    await db.tx(async (tx) => {
      await tx.query("SELECT id FROM stores WHERE id=$1 FOR UPDATE", [sid]);
      const price = (
        await tx.query(
          "SELECT pr.* FROM plan_prices pr JOIN plans p ON p.id=pr.plan_id WHERE pr.id=$1 AND pr.is_active AND p.status='active'",
          [c.plan_price_id],
        )
      )[0];
      assert(
        price,
        404,
        "Pilih paket aktif, termasuk paket internal yang tidak ditampilkan ke publik.",
      );
      await replaceSubscription(tx, sid);
      const subid = crypto.randomUUID();
      await tx.query(
        `INSERT INTO store_subscriptions(id,store_id,plan_id,plan_price_id,billing_interval,price_snapshot_idr,status,current_period_start,current_period_end,grace_days,billing_mode) VALUES($1,$2,$3,$4,$5,$6,'active',now(),now()+interval '1 day'*$7,0,'internal')`,
        [
          subid,
          sid,
          price.plan_id,
          price.id,
          price.billing_interval,
          price.amount_idr,
          c.duration_days,
        ],
      );
      await audit(
        tx,
        user.id,
        sid,
        "admin.subscription.assign",
        "subscription",
        subid,
        c,
      );
    });
    return json({ ok: true });
  }
  if (resource === "deletion" && request.method === "POST") {
    const c = await body(
      request,
      z.discriminatedUnion("step", [
        z.object({ step: z.literal(1), confirmed: z.literal(true) }),
        z.object({ step: z.literal(2), token: id, store_name: z.string() }),
        z.object({
          step: z.literal(3),
          token: id,
          irreversible: z.literal(true),
        }),
      ]),
    );
    return db.tx(async (tx) => {
      const locked = (
        await tx.query("SELECT name FROM stores WHERE id=$1 FOR UPDATE", [sid])
      )[0];
      assert(locked, 404, "Toko tidak ditemukan.");
      await tx.query(
        "DELETE FROM store_deletion_confirmations WHERE expires_at<=now()",
        [],
      );
      if (c.step === 1) {
        const token = crypto.randomUUID();
        await tx.query(
          "INSERT INTO store_deletion_confirmations(token,store_id,actor_user_id,store_name) VALUES($1,$2,$3,$4)",
          [token, sid, user.id, locked.name],
        );
        return json({ token, step: 2 });
      }
      const confirmation = (
        await tx.query(
          "SELECT * FROM store_deletion_confirmations WHERE token=$1 AND store_id=$2 AND actor_user_id=$3 AND expires_at>now() FOR UPDATE",
          [c.token, sid, user.id],
        )
      )[0];
      assert(
        confirmation && confirmation.store_name === locked.name,
        409,
        "Konfirmasi kedaluwarsa atau nama toko berubah. Ulangi dari awal.",
      );
      if (c.step === 2) {
        assert(
          confirmation.stage === 1 && c.store_name === locked.name,
          400,
          "Nama toko harus sama persis.",
        );
        await tx.query(
          "UPDATE store_deletion_confirmations SET stage=2 WHERE token=$1",
          [c.token],
        );
        return json({ step: 3 });
      }
      assert(
        confirmation.stage === 2,
        409,
        "Konfirmasi nama toko harus diselesaikan terlebih dahulu.",
      );
      await tx.query(
        "DELETE FROM subscription_invoices WHERE subscription_id IN (SELECT id FROM store_subscriptions WHERE store_id=$1)",
        [sid],
      );
      // Dependent commerce rows must be removed before their parent products/orders.
      for (const table of [
        "manual_payment_reviews",
        "inventory_movements",
        "order_items",
        "orders",
        "product_media",
        "product_variants",
        "products",
        "categories",
        "store_order_counters",
        "store_settings",
        "store_domains",
        "usage_counters",
        "store_subscriptions",
        "outbox_events",
      ])
        await tx.query(`DELETE FROM ${table} WHERE store_id=$1`, [sid]);
      await tx.query(
        "INSERT INTO media_deletion_jobs(store_id) VALUES($1) ON CONFLICT DO NOTHING",
        [sid],
      );
      await tx.query("DELETE FROM stores WHERE id=$1", [sid]);
      await audit(tx, user.id, sid, "admin.store.delete", "store", sid, {
        name: locked.name,
      });
      return json({ ok: true });
    });
  }
}

export async function deleteStoreMedia(db: DB, bucket: R2Bucket | undefined) {
  await db.query(
    "DELETE FROM store_deletion_confirmations WHERE expires_at<=now()",
  );
  if (!bucket) return;
  for (const job of await db.query(
    "SELECT store_id FROM media_deletion_jobs ORDER BY created_at LIMIT 10",
  )) {
    let cursor: string | undefined;
    do {
      const page = await bucket.list({
        prefix: job.store_id + "/",
        limit: 1000,
        cursor,
      });
      if (page.objects.length)
        await bucket.delete(page.objects.map((o) => o.key));
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
    await db.query("DELETE FROM media_deletion_jobs WHERE store_id=$1", [
      job.store_id,
    ]);
  }
}
