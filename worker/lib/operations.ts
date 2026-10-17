import { z } from "zod";
import type { DB } from "./db";
import { assert, json, HttpError, calendarDate } from "./security";
import { audit, storeAccess, type Identity } from "./auth";
import { salesAnalytics } from "./sales-analytics";

export function csv(rows: Record<string, unknown>[], columns: string[]) {
  const cell = (value: unknown) => {
    let text =
      value === null || value === undefined
        ? ""
        : value instanceof Date
          ? value.toISOString()
          : typeof value === "object"
            ? JSON.stringify(value)
            : String(value);
    if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  return (
    "\uFEFF" +
    [
      columns.map(cell).join(","),
      ...rows.map((row) => columns.map((key) => cell(row[key])).join(",")),
    ].join("\r\n")
  );
}
export function dateRange(url: URL, timezone = "Asia/Jakarta") {
  const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date()),
    from = new Date(Date.parse(today) - 29 * 86400000)
      .toISOString()
      .slice(0, 10);
  const parsed = z.object({ from: calendarDate, to: calendarDate }).safeParse({
    from: url.searchParams.get("from") || from,
    to: url.searchParams.get("to") || today,
  });
  assert(
    parsed.success &&
      parsed.data.from <= parsed.data.to &&
      (Date.parse(parsed.data.to) - Date.parse(parsed.data.from)) / 86400000 <=
        366,
    400,
    "Pilih rentang tanggal yang valid, maksimal satu tahun.",
  );
  return parsed.data;
}
export async function operationRoutes(
  db: DB,
  request: Request,
  user: Identity | null,
) {
  const url = new URL(request.url),
    match = url.pathname.match(
      /^\/api\/merchant\/stores\/([a-f0-9-]{36})\/(customers|analytics|export)$/,
    );
  if (!match) return;
  assert(request.method === "GET", 405, "Metode tidak tersedia.");
  const [, sid, resource] = match,
    access = await storeAccess(db, user, sid);
  assert(
    ["owner", "manager"].includes(access.role),
    403,
    "Data pelanggan dan ekspor hanya tersedia untuk pemilik atau manager toko.",
  );
  if (resource === "customers") {
    const search = (url.searchParams.get("q") || "").slice(0, 120),
      page = Math.max(
        1,
        Math.min(10000, Number(url.searchParams.get("page")) || 1),
      );
    assert(Number.isInteger(page), 400, "Halaman tidak valid.");
    const rows = await db.query(
      `SELECT contact_phone, (array_agg(customer_name ORDER BY created_at DESC,id DESC))[1] AS name, (array_agg(contact_email ORDER BY created_at DESC,id DESC))[1] AS email, count(*)::int AS orders, COALESCE(sum(total_idr) FILTER(WHERE payment_status='paid'),0) AS paid_total, max(created_at) AS last_order FROM orders WHERE store_id=$1 AND (customer_name ILIKE $2 OR contact_phone ILIKE $2 OR contact_email ILIKE $2) GROUP BY contact_phone ORDER BY max(created_at) DESC LIMIT 51 OFFSET $3`,
      [sid, "%" + search + "%", (page - 1) * 50],
    );
    return json({
      customers: rows.slice(0, 50),
      page,
      hasMore: rows.length > 50,
    });
  }
  if (resource === "analytics") {
    return salesAnalytics(db, sid, url);
  }
  const kind = url.searchParams.get("resource") || "orders",
    page = Number(url.searchParams.get("page") || 1);
  assert(
    Number.isInteger(page) && page >= 1 && page <= 10000,
    400,
    "Halaman ekspor tidak valid.",
  );
  const definitions: Record<string, { query: string; columns: string[] }> = {
    orders: {
      query:
        "SELECT order_number,customer_name,contact_email,contact_phone,total_idr,order_status,payment_status,fulfillment_status,created_at FROM orders WHERE store_id=$1 ORDER BY created_at,id LIMIT 500 OFFSET $2",
      columns: [
        "order_number",
        "customer_name",
        "contact_email",
        "contact_phone",
        "total_idr",
        "order_status",
        "payment_status",
        "fulfillment_status",
        "created_at",
      ],
    },
    products: {
      query:
        "SELECT p.slug,p.name,p.category,p.price_idr,p.status,v.sku,v.option_label,v.stock_qty,v.reserved_qty FROM products p JOIN product_variants v ON v.store_id=p.store_id AND v.product_id=p.id WHERE p.store_id=$1 ORDER BY p.id,v.id LIMIT 500 OFFSET $2",
      columns: [
        "slug",
        "name",
        "category",
        "price_idr",
        "status",
        "sku",
        "option_label",
        "stock_qty",
        "reserved_qty",
      ],
    },
    customers: {
      query:
        "SELECT contact_phone,(array_agg(customer_name ORDER BY created_at DESC,id DESC))[1] AS name,(array_agg(contact_email ORDER BY created_at DESC,id DESC))[1] AS email,count(*)::int AS orders,COALESCE(sum(total_idr) FILTER(WHERE payment_status='paid'),0) AS paid_total FROM orders WHERE store_id=$1 GROUP BY contact_phone ORDER BY contact_phone LIMIT 500 OFFSET $2",
      columns: ["contact_phone", "name", "email", "orders", "paid_total"],
    },
  };
  const definition = definitions[kind];
  if (!definition) throw new HttpError(400, "Jenis ekspor tidak tersedia.");
  const rows = await db.query(definition.query, [sid, (page - 1) * 500]);
  await audit(db, user!.id, sid, "data.export", kind, sid, {
    page,
    rows: rows.length,
  });
  return new Response(csv(rows, definition.columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="nalarostore-${kind}-${page}.csv"`,
      "cache-control": "no-store",
      "x-export-rows": String(rows.length),
    },
  });
}
