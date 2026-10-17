import type { DB } from "./db";
import { assert, json } from "./security";
import { dateRange } from "./operations";

export async function salesAnalytics(db: DB, sid: string, url: URL) {
  const timezone = url.searchParams.get("timezone") || "Asia/Jakarta";
  assert(
    ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura", "UTC"].includes(
      timezone,
    ),
    400,
    "Zona waktu tidak tersedia.",
  );
  const { from, to } = dateRange(url, timezone);
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
  const previousFrom = new Date(Date.parse(from) - days * 86400000)
    .toISOString()
    .slice(0, 10);
  const previousTo = new Date(Date.parse(from) - 86400000)
    .toISOString()
    .slice(0, 10);
  const paid =
    "payment_status='paid' AND order_status NOT IN ('canceled','expired')";
  const summarySQL = `SELECT count(*)::int AS orders,count(*) FILTER(WHERE ${paid})::int AS paid_orders,count(*) FILTER(WHERE order_status='canceled')::int AS canceled_orders,
    COALESCE(sum(subtotal_idr) FILTER(WHERE ${paid}),0) AS revenue,COALESCE(sum(shipping_idr) FILTER(WHERE ${paid}),0) AS shipping_revenue,COALESCE(sum(total_idr) FILTER(WHERE ${paid}),0) AS total_collected,
    COALESCE(avg(subtotal_idr) FILTER(WHERE ${paid}),0) AS average_order_value,
    COALESCE((SELECT sum(i.quantity) FROM order_items i JOIN orders o ON o.id=i.order_id AND o.store_id=i.store_id WHERE o.store_id=$1 AND o.${paid.replaceAll("order_status", "o.order_status")} AND o.created_at>=($2::date::timestamp AT TIME ZONE $4) AND o.created_at<(($3::date+1)::timestamp AT TIME ZONE $4)),0) AS units_sold
    FROM orders WHERE store_id=$1 AND created_at>=($2::date::timestamp AT TIME ZONE $4) AND created_at<(($3::date+1)::timestamp AT TIME ZONE $4)`;
  const summary = (await db.query(summarySQL, [sid, from, to, timezone]))[0];
  const previous = (
    await db.query(summarySQL, [sid, previousFrom, previousTo, timezone])
  )[0];
  const daily = await db.query(
    `SELECT to_char(d.day,'YYYY-MM-DD') AS day,count(o.id)::int AS orders,COALESCE(sum(o.subtotal_idr) FILTER(WHERE o.${paid.replaceAll("order_status", "o.order_status")}),0) AS revenue FROM generate_series($2::date::timestamp,$3::date::timestamp,interval '1 day') d(day) LEFT JOIN orders o ON o.store_id=$1 AND o.created_at>=(d.day AT TIME ZONE $4) AND o.created_at<((d.day+interval '1 day') AT TIME ZONE $4) GROUP BY d.day ORDER BY d.day`,
    [sid, from, to, timezone],
  );
  const top = async (variants: boolean) =>
    db.query(
      `SELECT p.id AS product_id,${variants ? "v.id AS variant_id,v.option_label AS variant," : ""}p.name AS name,sum(i.quantity)::int AS units,sum(i.line_total_idr) AS revenue FROM order_items i JOIN orders o ON o.id=i.order_id AND o.store_id=i.store_id JOIN product_variants v ON v.id=i.variant_id AND v.store_id=i.store_id JOIN products p ON p.id=v.product_id AND p.store_id=v.store_id WHERE o.store_id=$1 AND o.${paid.replaceAll("order_status", "o.order_status")} AND o.created_at>=($2::date::timestamp AT TIME ZONE $4) AND o.created_at<(($3::date+1)::timestamp AT TIME ZONE $4) GROUP BY p.id${variants ? ",v.id" : ""} ORDER BY units DESC,revenue DESC,p.id LIMIT 20`,
      [sid, from, to, timezone],
    );
  const top_products = await top(false),
    top_variants = await top(true);
  const customers = (
    await db.query(
      `WITH period AS (SELECT DISTINCT COALESCE(buyer_user_id::text,regexp_replace(contact_phone,'[^0-9]','','g')) AS customer FROM orders WHERE store_id=$1 AND ${paid} AND created_at>=($2::date::timestamp AT TIME ZONE $4) AND created_at<(($3::date+1)::timestamp AT TIME ZONE $4)) SELECT count(*)::int AS purchasing_customers,count(*) FILTER(WHERE EXISTS(SELECT 1 FROM orders o WHERE o.store_id=$1 AND COALESCE(o.buyer_user_id::text,regexp_replace(o.contact_phone,'[^0-9]','','g'))=period.customer AND o.${paid.replaceAll("order_status", "o.order_status")} AND o.created_at<($2::date::timestamp AT TIME ZONE $4)))::int AS returning_customers FROM period`,
      [sid, from, to, timezone],
    )
  )[0];
  return json({
    summary: { ...summary, ...customers },
    previous,
    previous_from: previousFrom,
    previous_to: previousTo,
    daily,
    top_products,
    top_variants,
    from,
    to,
    timezone,
    metric_basis: "paid_product_subtotal_excluding_shipping",
  });
}
