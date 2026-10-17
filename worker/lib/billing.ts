import { normalizePlanCode } from "../../shared/plans";
import { replaceSubscription } from "./admin-stores";
import { z } from "zod";
import type { DB } from "./db";
import { assert, body, id, json, money, HttpError } from "./security";
import {
  audit,
  enqueue,
  rateLimit,
  requireAdmin,
  requireUser,
  storeAccess,
  type Identity,
} from "./auth";
export async function incrementUsage(
  db: DB,
  sid: string,
  feature: string,
  delta: number,
) {
  const period =
    feature === "products" ? "all" : new Date().toISOString().slice(0, 7);
  await db.query(
    `INSERT INTO usage_counters(store_id,feature_code,period_key,value) VALUES($1,$2,$3,$4) ON CONFLICT(store_id,feature_code,period_key) DO UPDATE SET value=usage_counters.value+$4`,
    [sid, feature, period, delta],
  );
}
export async function entitlement(
  db: DB,
  sid: string,
  feature: string,
  increment = 0,
) {
  const sub = (
    await db.query(
      `SELECT s.*,e.allowed,e.limit_value FROM store_subscriptions s LEFT JOIN plan_entitlements e ON e.plan_id=s.plan_id AND e.feature_code=$2 WHERE s.store_id=$1 AND s.status NOT IN ('canceled','pending') ORDER BY CASE WHEN s.status IN ('trial','active','grace','past_due') THEN 0 ELSE 1 END,s.created_at DESC LIMIT 1`,
      [sid, feature],
    )
  )[0];
  if (!sub) {
    if (feature === "storefront" || feature === "orders") {
      const store = (
        await db.query("SELECT pilot_until FROM stores WHERE id=$1", [sid])
      )[0];
      assert(
        store?.pilot_until &&
          new Date(store.pilot_until).getTime() > Date.now(),
        423,
        "Pilih paket langganan atau minta persetujuan toko pilot sebelum menerima pesanan.",
      );
    }
    return;
  }
  const end = sub.current_period_end
    ? new Date(sub.current_period_end).getTime()
    : 0;
  const active =
    ["trial", "active", "grace", "past_due"].includes(sub.status) &&
    Date.now() < end + (sub.status === "trial" ? 0 : sub.grace_days * 86400000);
  if (!["storefront", "orders"].includes(feature) && !active) return;
  assert(
    active,
    423,
    "Langganan toko berakhir. Pilih atau perbarui paket di halaman Langganan.",
  );
  assert(
    sub.allowed !== false,
    403,
    "Fitur ini tidak tersedia pada paket toko. Pilih upgrade di halaman Langganan.",
  );
  if (increment && sub.limit_value !== null && sub.limit_value !== undefined) {
    const used =
      feature === "products"
        ? (
            await db.query(
              `SELECT count(*)::int AS value FROM products WHERE store_id=$1`,
              [sid],
            )
          )[0].value
        : (
            await db.query(
              `SELECT value FROM usage_counters WHERE store_id=$1 AND feature_code=$2 AND period_key=$3`,
              [sid, feature, new Date().toISOString().slice(0, 7)],
            )
          )[0]?.value || 0;
    assert(
      Number(used) + increment <= Number(sub.limit_value),
      409,
      "Kuota paket telah tercapai. Pilih upgrade di halaman Langganan.",
    );
  }
}
const planSchema = z
  .object({
    code: z
      .string()
      .transform(normalizePlanCode)
      .pipe(
        z
          .string()
          .regex(
            /^[a-z0-9-]{2,40}$/,
            "Kode paket perlu 2–40 karakter, misalnya bisnis-bulanan.",
          ),
      ),
    name: z.string().trim().min(2).max(100),
    description: z.string().max(3000).default(""),
    status: z.enum(["draft", "active", "archived"]),
    is_public: z.boolean(),
    sort_order: z.number().int().min(0).max(1000).default(0),
    prices: z
      .array(
        z.object({
          billing_interval: z.enum(["monthly", "yearly"]),
          amount_idr: money,
        }),
      )
      .min(1)
      .max(2),
    entitlements: z
      .array(
        z.object({
          feature_code: z.enum([
            "storefront",
            "products",
            "orders",
            "media_bytes",
          ]),
          allowed: z.boolean(),
          limit_value: z.number().int().min(0).max(1_000_000_000).nullable(),
        }),
      )
      .max(4),
  })
  .refine(
    (p) =>
      new Set(p.prices.map((x) => x.billing_interval)).size === p.prices.length,
    "Periode harga harus unik.",
  )
  .refine(
    (p) =>
      new Set(p.entitlements.map((x) => x.feature_code)).size ===
      p.entitlements.length,
    "Fitur harus unik.",
  );
export async function publicPlans(db: DB) {
  return db.query(
    `SELECT p.*,COALESCE((SELECT jsonb_agg(jsonb_build_object('id',pr.id,'billing_interval',pr.billing_interval,'amount_idr',pr.amount_idr)) FROM plan_prices pr WHERE pr.plan_id=p.id AND pr.is_active),'[]') AS prices,COALESCE((SELECT jsonb_agg(e) FROM plan_entitlements e WHERE e.plan_id=p.id),'[]') AS entitlements FROM plans p WHERE p.is_public AND p.status='active' ORDER BY p.sort_order`,
  );
}
export async function billingRoutes(
  db: DB,
  request: Request,
  user: Identity | null,
  path: string,
): Promise<Response | undefined> {
  if (path === "/api/public/custom-leads" && request.method === "POST") {
    await rateLimit(
      db,
      "leads:" + (request.headers.get("cf-connecting-ip") || "local"),
      5,
    );
    const c = await body(
      request,
      z.object({
        business_name: z.string().min(2).max(120),
        contact_name: z.string().min(2).max(120),
        contact_email: z.email().max(254),
        contact_phone: z.string().min(8).max(30),
        project_brief: z.string().min(20).max(10000),
        website: z.literal("").default(""),
      }),
    );
    const lid = crypto.randomUUID();
    await db.query(
      "INSERT INTO custom_project_leads(id,business_name,contact_name,contact_email,contact_phone,project_brief) VALUES($1,$2,$3,$4,$5,$6)",
      [
        lid,
        c.business_name,
        c.contact_name,
        c.contact_email,
        c.contact_phone,
        c.project_brief,
      ],
    );
    return json(
      {
        id: lid,
        message:
          "Brief diterima. Nalaro akan menghubungi kontak yang kamu isi.",
      },
      201,
    );
  }
  const merchant = path.match(
    /^\/api\/merchant\/stores\/([a-f0-9-]{36})\/billing$/,
  );
  if (merchant) {
    const sid = merchant[1];
    const access = await storeAccess(db, user, sid, request.method !== "GET");
    requireUser(user);
    if (request.method === "GET") {
      const current = (
        await db.query(
          `SELECT id FROM store_subscriptions WHERE store_id=$1 AND status IN ('trial','active','grace','past_due') AND current_period_end+CASE WHEN status='trial' THEN interval '0 days' ELSE interval '1 day'*grace_days END>now() LIMIT 1`,
          [sid],
        )
      )[0];
      let accessAvailable = true;
      try {
        await entitlement(db, sid, "storefront");
      } catch (e) {
        if (e instanceof HttpError && [403, 423].includes(e.status))
          accessAvailable = false;
        else throw e;
      }
      return json({
        accessAvailable,
        currentSubscriptionId: current?.id || null,
        pilotUntil: access.pilot_until,
        paymentInstructions:
          (
            await db.query(
              "SELECT billing_instructions FROM platform_settings WHERE id=true",
            )
          )[0]?.billing_instructions || "",
        subscriptions: await db.query(
          `SELECT s.*,p.name FROM store_subscriptions s JOIN plans p ON p.id=s.plan_id WHERE s.store_id=$1 ORDER BY s.created_at DESC`,
          [sid],
        ),
        invoices: await db.query(
          `SELECT i.* FROM subscription_invoices i JOIN store_subscriptions s ON s.id=i.subscription_id WHERE s.store_id=$1 ORDER BY i.issued_at DESC`,
          [sid],
        ),
        usage: await db.query(
          "SELECT * FROM usage_counters WHERE store_id=$1",
          [sid],
        ),
        entitlements: await db.query(
          `SELECT e.* FROM plan_entitlements e JOIN store_subscriptions s ON s.plan_id=e.plan_id WHERE s.store_id=$1 AND s.id=$2`,
          [sid, current?.id || null],
        ),
      });
    }
    if (request.method === "POST") {
      assert(
        access.role === "owner",
        403,
        "Hanya pemilik toko dapat memilih paket.",
      );
      const c = await body(
        request,
        z.object({
          plan_price_id: id,
          confirm_replace: z.boolean().default(false),
        }),
      );
      const subid = crypto.randomUUID();
      await db.tx(async (tx) => {
        await tx.query("SELECT id FROM stores WHERE id=$1 FOR UPDATE", [sid]);
        const policy = (
          await tx.query("SELECT * FROM platform_settings WHERE id=true")
        )[0];
        assert(
          policy.billing_instructions,
          409,
          "Instruksi pembayaran langganan belum ditetapkan admin.",
        );
        const pr = (
          await tx.query(
            `SELECT pr.* FROM plan_prices pr JOIN plans p ON p.id=pr.plan_id WHERE pr.id=$1 AND pr.is_active AND p.status='active' AND p.is_public`,
            [c.plan_price_id],
          )
        )[0];
        assert(pr, 404, "Paket tidak tersedia.");
        const active = await tx.query(
          `SELECT id,plan_price_id FROM store_subscriptions WHERE store_id=$1 AND status IN ('trial','active','past_due','grace') AND current_period_end+CASE WHEN status='trial' THEN interval '0 days' ELSE interval '1 day'*grace_days END>now()`,
          [sid],
        );
        assert(
          !active.some((s) => s.plan_price_id === pr.id),
          409,
          "Paket ini sudah aktif.",
        );
        assert(
          !active.length || c.confirm_replace,
          409,
          "Konfirmasikan penggantian paket. Seluruh fitur dan batas paket lama berakhir setelah pembayaran diverifikasi.",
        );
        const pending = (
          await tx.query(
            "SELECT id,plan_price_id FROM store_subscriptions WHERE store_id=$1 AND status='pending'",
            [sid],
          )
        )[0];
        assert(
          !pending || pending.plan_price_id !== pr.id,
          409,
          "Tagihan paket ini sudah tersedia. Selesaikan pembayaran pada tagihan yang ada.",
        );
        await tx.query(
          `UPDATE subscription_invoices SET status='void' WHERE status IN ('unpaid','overdue','draft') AND subscription_id IN (SELECT id FROM store_subscriptions WHERE store_id=$1 AND status='pending')`,
          [sid],
        );
        await tx.query(
          "UPDATE store_subscriptions SET status='canceled' WHERE store_id=$1 AND status='pending'",
          [sid],
        );
        await tx.query(
          `INSERT INTO store_subscriptions(id,store_id,plan_id,plan_price_id,billing_interval,price_snapshot_idr,status,current_period_start,current_period_end,grace_days) VALUES($1,$2,$3,$4,$5,$6,'pending',now(),now(),$7)`,
          [
            subid,
            sid,
            pr.plan_id,
            pr.id,
            pr.billing_interval,
            pr.amount_idr,
            policy.grace_days,
          ],
        );
        await issueInvoice(tx, subid);
        await audit(
          tx,
          user.id,
          sid,
          "subscription.request",
          "subscription",
          subid,
        );
      });
      return json({ id: subid }, 201);
    }
  }
  if (!path.startsWith("/api/admin/")) return;
  requireAdmin(user);
  if (path === "/api/admin/outbox" && request.method === "GET")
    return json({
      events: await db.query(
        "SELECT id,store_id,topic,status,attempts,next_attempt_at,created_at FROM outbox_events WHERE status<>'sent' ORDER BY created_at DESC LIMIT 100",
      ),
    });
  const retry = path.match(/^\/api\/admin\/outbox\/([a-f0-9-]{36})\/retry$/);
  if (retry && request.method === "POST") {
    await db.tx(async (tx) => {
      const event = (
        await tx.query(
          "SELECT id,store_id,status FROM outbox_events WHERE id=$1 FOR UPDATE",
          [retry[1]],
        )
      )[0];
      assert(event, 404, "Notifikasi tidak ditemukan.");
      assert(
        event.status === "failed",
        409,
        "Hanya notifikasi gagal yang dapat dicoba ulang.",
      );
      await tx.query(
        "UPDATE outbox_events SET status='pending',attempts=0,next_attempt_at=now() WHERE id=$1",
        [retry[1]],
      );
      await audit(
        tx,
        user.id,
        event.store_id,
        "email.retry",
        "outbox",
        event.id,
      );
    });
    return json({ ok: true });
  }
  const pilot = path.match(/^\/api\/admin\/stores\/([a-f0-9-]{36})\/pilot$/);
  if (pilot && request.method === "POST") {
    const c = await body(
      request,
      z.union([
        z.object({ days: z.number().int().min(0).max(90) }).strict(),
        z.object({ months: z.literal(6) }).strict(),
      ]),
    );
    await db.tx(async (tx) => {
      const locked = (
        await tx.query(
          "SELECT umkm_activated_at FROM stores WHERE id=$1 FOR UPDATE",
          [pilot[1]],
        )
      )[0];
      assert(locked, 404, "Toko tidak ditemukan.");
      if ("months" in c && locked.umkm_activated_at) return;
      // Explicit admin pilot activation replaces previous package rights.
      if (("days" in c && c.days > 0) || "months" in c)
        await replaceSubscription(tx, pilot[1]);
      const store = await tx.query(
        "UPDATE stores SET pilot_until=CASE WHEN $2=0 AND $3=0 THEN NULL ELSE now()+interval '1 day'*$2+interval '1 month'*$3 END,umkm_activated_at=CASE WHEN $3=6 THEN now() ELSE umkm_activated_at END WHERE id=$1 RETURNING id,pilot_until",
        [pilot[1], "days" in c ? c.days : 0, "months" in c ? c.months : 0],
      );
      await audit(tx, user.id, pilot[1], "pilot.update", "store", pilot[1], {
        ...c,
        pilot_until: store[0].pilot_until,
      });
    });
    return json({ ok: true });
  }
  if (path === "/api/admin/billing-settings") {
    if (request.method === "GET")
      return json({
        settings: (
          await db.query("SELECT * FROM platform_settings WHERE id=true")
        )[0],
      });
    if (request.method === "PUT") {
      const c = await body(
        request,
        z.object({
          billing_instructions: z.string().min(10).max(3000),
          trial_days: z.number().int().min(0).max(30),
          grace_days: z.number().int().min(0).max(30),
        }),
      );
      await db.tx(async (tx) => {
        await tx.query(
          "UPDATE platform_settings SET billing_instructions=$1,trial_days=$2,grace_days=$3 WHERE id=true",
          [c.billing_instructions, c.trial_days, c.grace_days],
        );
        await audit(
          tx,
          user.id,
          null,
          "billing.policy.update",
          "platform",
          "billing",
        );
      });
      return json({ ok: true });
    }
  }
  if (path === "/api/admin/overview" && request.method === "GET")
    return json({
      stores: await db.query(
        `SELECT s.id,s.slug,s.name,s.status,s.pilot_until,s.umkm_activated_at,u.email AS owner_email,
        (SELECT p.name FROM store_subscriptions sub JOIN plans p ON p.id=sub.plan_id WHERE sub.store_id=s.id AND sub.status IN ('trial','active','grace','past_due') LIMIT 1) AS plan_name
        FROM stores s JOIN merchants m ON m.id=s.merchant_id JOIN users u ON u.id=m.owner_user_id ORDER BY s.created_at DESC`,
      ),
      invoices: await db.query(
        `SELECT i.*,s.store_id FROM subscription_invoices i JOIN store_subscriptions s ON s.id=i.subscription_id ORDER BY i.issued_at DESC LIMIT 200`,
      ),
      outbox: await db.query(
        "SELECT status,count(*)::int AS count FROM outbox_events GROUP BY status",
      ),
    });
  if (path === "/api/admin/plans" && request.method === "GET")
    return json({
      plans: await db.query(
        `SELECT p.*,COALESCE((SELECT jsonb_agg(pr) FROM plan_prices pr WHERE pr.plan_id=p.id AND pr.is_active),'[]') AS prices,COALESCE((SELECT jsonb_agg(e) FROM plan_entitlements e WHERE e.plan_id=p.id),'[]') AS entitlements FROM plans p ORDER BY sort_order`,
      ),
    });
  const planMatch = path.match(/^\/api\/admin\/plans(?:\/([a-f0-9-]{36}))?$/);
  if (planMatch && ["POST", "PUT"].includes(request.method)) {
    const c = await body(request, planSchema),
      pid = planMatch[1] || crypto.randomUUID();
    await db.tx(async (tx) => {
      assert(
        !(
          await tx.query("SELECT id FROM plans WHERE code=$1 AND id<>$2", [
            c.code,
            pid,
          ])
        )[0],
        409,
        "Kode paket sudah digunakan. Pilih kode lain.",
      );
      if (planMatch[1]) {
        const found = await tx.query(
          "SELECT id FROM plans WHERE id=$1 FOR UPDATE",
          [pid],
        );
        assert(found[0], 404, "Paket tidak ditemukan.");
        await tx.query(
          "UPDATE plans SET code=$2,name=$3,description=$4,status=$5,is_public=$6,sort_order=$7 WHERE id=$1",
          [
            pid,
            c.code,
            c.name,
            c.description,
            c.status,
            c.is_public,
            c.sort_order,
          ],
        );
      } else
        await tx.query(
          "INSERT INTO plans(id,code,name,description,status,is_public,sort_order) VALUES($1,$2,$3,$4,$5,$6,$7)",
          [
            pid,
            c.code,
            c.name,
            c.description,
            c.status,
            c.is_public,
            c.sort_order,
          ],
        );
      await tx.query(
        "UPDATE plan_prices SET is_active=false WHERE plan_id=$1",
        [pid],
      );
      for (const pr of c.prices)
        await tx.query(
          "INSERT INTO plan_prices(id,plan_id,billing_interval,amount_idr,is_active) VALUES($1,$2,$3,$4,true)",
          [crypto.randomUUID(), pid, pr.billing_interval, pr.amount_idr],
        );
      await tx.query("DELETE FROM plan_entitlements WHERE plan_id=$1", [pid]);
      for (const e of c.entitlements)
        await tx.query(
          "INSERT INTO plan_entitlements(plan_id,feature_code,allowed,limit_value) VALUES($1,$2,$3,$4)",
          [pid, e.feature_code, e.allowed, e.limit_value],
        );
      await audit(tx, user.id, null, "plan.save", "plan", pid);
    });
    return json({ id: pid });
  }
  const pay = path.match(/^\/api\/admin\/invoices\/([a-f0-9-]{36})\/verify$/);
  if (pay && request.method === "POST") {
    await db.tx(async (tx) => {
      const peek = (
        await tx.query(
          "SELECT i.subscription_id,s.store_id FROM subscription_invoices i JOIN store_subscriptions s ON s.id=i.subscription_id WHERE i.id=$1",
          [pay[1]],
        )
      )[0];
      assert(peek, 404, "Invoice tidak ditemukan.");
      await tx.query("SELECT id FROM stores WHERE id=$1 FOR UPDATE", [
        peek.store_id,
      ]);
      const sub = (
        await tx.query(
          "SELECT * FROM store_subscriptions WHERE id=$1 FOR UPDATE",
          [peek.subscription_id],
        )
      )[0];
      const inv = (
        await tx.query(
          "SELECT * FROM subscription_invoices WHERE id=$1 FOR UPDATE",
          [pay[1]],
        )
      )[0];
      if (inv.status === "paid") return;
      assert(
        ["unpaid", "overdue"].includes(inv.status) && sub.status !== "canceled",
        409,
        "Invoice tidak dapat diverifikasi.",
      );
      if (sub.status === "pending")
        await replaceSubscription(tx, sub.store_id, sub.id);
      else {
        if (sub.status === "expired")
          assert(
            !(
              await tx.query(
                `SELECT id FROM store_subscriptions WHERE store_id=$1 AND id<>$2 AND status IN ('trial','active','grace','past_due')`,
                [sub.store_id, sub.id],
              )
            )[0],
            409,
            "Tagihan lama tidak dapat menggantikan paket aktif. Pilih paket melalui halaman Langganan.",
          );
        await tx.query("UPDATE stores SET pilot_until=NULL WHERE id=$1", [
          sub.store_id,
        ]);
      }
      await tx.query(
        `UPDATE subscription_invoices SET status='paid',paid_at=now(),verified_by=$2 WHERE id=$1`,
        [inv.id, user.id],
      );
      await tx.query(
        `UPDATE store_subscriptions SET status='active',current_period_start=GREATEST(now(),$2::timestamptz),current_period_end=GREATEST(now(),$2::timestamptz)+CASE WHEN billing_interval='monthly' THEN interval '1 month' ELSE interval '1 year' END WHERE id=$1`,
        [sub.id, inv.period_start],
      );
      await audit(
        tx,
        user.id,
        sub.store_id,
        "subscription.payment.verify",
        "invoice",
        inv.id,
      );
      const owner = await tx.query(
        `SELECT u.email FROM stores s JOIN merchants m ON m.id=s.merchant_id JOIN users u ON u.id=m.owner_user_id WHERE s.id=$1`,
        [sub.store_id],
      );
      await enqueue(
        tx,
        sub.store_id,
        owner[0].email,
        "Langganan Nalaro Store aktif",
        `Pembayaran invoice ${inv.invoice_number} telah diverifikasi.`,
      );
    });
    return json({ ok: true });
  }
  const domain = path.match(/^\/api\/admin\/stores\/([a-f0-9-]{36})\/domain$/);
  if (domain && request.method === "POST") {
    const c = await body(request, z.object({ verified: z.boolean() }));
    await db.tx(async (tx) => {
      const r = await tx.query(
        `UPDATE store_domains SET verification_status=$2 WHERE store_id=$1 AND kind='platform' RETURNING hostname`,
        [domain[1], c.verified ? "verified" : "pending"],
      );
      assert(r[0], 404, "Toko tidak ditemukan.");
      await audit(tx, user.id, domain[1], "domain.verify", "store", domain[1]);
    });
    return json({ ok: true });
  }
  if (path === "/api/admin/leads" && request.method === "GET")
    return json({
      leads: await db.query(
        "SELECT * FROM custom_project_leads ORDER BY created_at DESC LIMIT 200",
      ),
    });
  const lead = path.match(/^\/api\/admin\/leads\/([a-f0-9-]{36})$/);
  if (lead && request.method === "PUT") {
    const c = await body(
      request,
      z.object({
        store_id: id.nullable().default(null),
        status: z.enum([
          "new",
          "reviewing",
          "quoted",
          "accepted",
          "declined",
          "closed",
        ]),
        source_ownership: z.enum([
          "pending",
          "nalaro_license",
          "client_owned",
          "mixed",
        ]),
        reusable_modules: z.string().max(5000),
        contract_terms: z.string().max(10000),
        quote_idr: money.nullable(),
        delivery_status: z.enum([
          "not_started",
          "in_progress",
          "review",
          "delivered",
        ]),
      }),
    );
    const existingLead = (
      await db.query(
        "SELECT project_brief FROM custom_project_leads WHERE id=$1",
        [lead[1]],
      )
    )[0];
    assert(existingLead, 404, "Pengajuan tidak ditemukan.");
    const program = existingLead.project_brief.startsWith(
      "[PENGAJUAN PROGRAM UMKM",
    );
    assert(
      program ||
        !["quoted", "accepted", "closed"].includes(c.status) ||
        (c.quote_idr !== null &&
          c.source_ownership !== "pending" &&
          c.contract_terms.length >= 20),
      400,
      "Lengkapi nilai penawaran, hak source dan kontrak.",
    );
    assert(
      c.delivery_status !== "delivered" ||
        c.status === "accepted" ||
        c.status === "closed",
      400,
      "Proyek harus disepakati sebelum serah terima.",
    );
    await db.tx(async (tx) => {
      if (c.store_id) {
        const target = (
          await tx.query(
            "SELECT id,umkm_activated_at FROM stores WHERE id=$1 FOR UPDATE",
            [c.store_id],
          )
        )[0];
        assert(target, 404, "Toko peserta tidak ditemukan.");
        if (program && c.status === "accepted" && !target.umkm_activated_at) {
          await replaceSubscription(tx, c.store_id);
          await tx.query(
            "UPDATE stores SET pilot_until=now()+interval '6 months',umkm_activated_at=now() WHERE id=$1",
            [c.store_id],
          );
          await audit(
            tx,
            user.id,
            c.store_id,
            "pilot.update",
            "store",
            c.store_id,
            { months: 6, lead_id: lead[1] },
          );
        }
      }
      const r = await tx.query(
        "UPDATE custom_project_leads SET store_id=$8,status=$2,source_ownership=$3,reusable_modules=$4,contract_terms=$5,quote_idr=$6,delivery_status=$7 WHERE id=$1 RETURNING id",
        [
          lead[1],
          c.status,
          c.source_ownership,
          c.reusable_modules,
          c.contract_terms,
          c.quote_idr,
          c.delivery_status,
          c.store_id,
        ],
      );
      assert(r[0], 404, "Brief tidak ditemukan.");
      await audit(tx, user.id, null, "custom.update", "lead", lead[1]);
    });
    return json({ ok: true });
  }
}
export async function issueInvoice(tx: DB, subId: string) {
  const sub = (
    await tx.query("SELECT * FROM store_subscriptions WHERE id=$1", [subId])
  )[0];
  const periodStart = sub.current_period_end;
  const end = (
    await tx.query(
      `SELECT $1::timestamptz+CASE WHEN $2='monthly' THEN interval '1 month' ELSE interval '1 year' END AS value`,
      [periodStart, sub.billing_interval],
    )
  )[0].value;
  const key = `${sub.id}:${new Date(periodStart).toISOString()}`;
  const counter = (
    await tx.query("SELECT nextval('subscription_invoice_counter') AS value")
  )[0].value;
  await tx.query(
    `INSERT INTO subscription_invoices(id,subscription_id,invoice_number,amount_idr,period_start,period_end,status,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,'unpaid',$7) ON CONFLICT(idempotency_key) DO NOTHING`,
    [
      crypto.randomUUID(),
      sub.id,
      "NAL-SUB-" + String(counter).padStart(6, "0"),
      sub.price_snapshot_idr,
      periodStart,
      end,
      key,
    ],
  );
}
export async function billingCycle(db: DB) {
  await db.tx(async (tx) => {
    const rows = await tx.query(
      `SELECT * FROM store_subscriptions WHERE status IN ('trial','active','past_due','grace') AND current_period_end<now()+interval '7 days' ORDER BY id LIMIT 100 FOR UPDATE SKIP LOCKED`,
    );
    for (const s of rows) {
      if (s.billing_mode !== "internal") await issueInvoice(tx, s.id);
      const end = new Date(s.current_period_end).getTime(),
        grace = end + (s.status === "trial" ? 0 : s.grace_days * 86400000);
      if (Date.now() > grace)
        await tx.query(
          "UPDATE store_subscriptions SET status='expired' WHERE id=$1",
          [s.id],
        );
      else if (Date.now() > end)
        await tx.query(
          "UPDATE store_subscriptions SET status='grace' WHERE id=$1",
          [s.id],
        );
      await tx.query(
        "UPDATE subscription_invoices SET status='overdue' WHERE subscription_id=$1 AND status='unpaid' AND period_start<now()",
        [s.id],
      );
    }
  });
}
