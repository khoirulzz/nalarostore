import { useState } from "react";
import { Link } from "react-router-dom";
import { MediaImage } from "../../components/MediaImage";
import {
  useData,
  rupiah,
  label,
  type Order,
  type Item,
  type Settings,
} from "../api";
import { orderProgress } from "./model";

export function StoreTracking({
  endpoint,
  token: raw,
  base,
}: {
  endpoint: string;
  token: string;
  base: string;
}) {
  const [rev, setRev] = useState(0);
  const { value, error, loading } = useData<{
    order: Order;
    items: Item[];
    payment: Pick<
      Settings,
      "bank_details" | "qris_media_key" | "pickup_address" | "contact_phone"
    >;
  }>(endpoint + "/track/" + raw, rev);
  const o = value?.order;
  return (
    <section className="store-shell complete-page">
      <h1>
        {error
          ? "Pesanan belum tersedia."
          : !o
            ? "Memuat pesanan…"
            : o.order_status === "canceled"
              ? "Pesanan dibatalkan."
              : o.order_status === "expired" || o.payment_status === "expired"
                ? "Pesanan kedaluwarsa."
                : o.payment_status === "refunded"
                  ? "Pembayaran dikembalikan."
                  : o.payment_status === "failed"
                    ? "Pembayaran belum berhasil."
                    : o.payment_status === "paid"
                      ? "Pembayaran terverifikasi."
                      : "Pesanan diterima."}
      </h1>
      {loading && <p aria-busy="true">Memuat pesanan…</p>}
      {error && (
        <p className="live-error" role="alert">
          {error}
        </p>
      )}
      {o && (
        <>
          <p>
            {o.order_number} · {label(o.order_status)} ·{" "}
            {label(o.payment_status)} · {label(o.fulfillment_status)}
          </p>
          <ol className="sf-order-timeline" aria-label="Progres pesanan">
            {orderProgress(o).map((step, index) => (
              <li
                key={step.name}
                className={`sf-timeline-${step.state}`}
                aria-current={step.state === "current" ? "step" : undefined}
              >
                <span className="sf-timeline-node" aria-hidden="true">
                  {step.state === "done" ? "✓" : index + 1}
                </span>
                <div>
                  <strong>{step.name}</strong>
                  {index === 0 && (
                    <time dateTime={o.created_at}>
                      {new Date(o.created_at).toLocaleString("id-ID")}
                    </time>
                  )}
                  {step.state === "current" && (
                    <small>
                      {index === 1
                        ? "Menunggu verifikasi toko"
                        : "Tahap saat ini"}
                    </small>
                  )}
                  <span className="sf-sr-only">
                    {step.state === "done"
                      ? "Tercapai"
                      : step.state === "current"
                        ? "Tahap saat ini"
                        : "Belum tercapai"}
                  </span>
                </div>
              </li>
            ))}
          </ol>
          {["canceled", "expired"].includes(o.order_status) && (
            <p className="notice">
              {o.order_status === "expired"
                ? "Batas pembayaran pesanan ini telah berakhir. Jangan transfer untuk pesanan ini; hubungi toko jika sudah membayar."
                : "Pesanan ini dibatalkan. Hubungi toko jika memerlukan bantuan pembayaran."}
            </p>
          )}
          <p className="sf-muted">
            Status terakhir diperbarui{" "}
            {new Date(o.updated_at).toLocaleString("id-ID")}.
          </p>
          <div className="complete-slip">
            {value.items.map((i, n) => (
              <div key={n}>
                <span>
                  {i.name_snapshot} · {i.variant_snapshot} × {i.quantity}
                </span>
                <strong>{rupiah(i.line_total_idr)}</strong>
              </div>
            ))}
            <div>
              <span>Pengiriman</span>
              <strong>{rupiah(o.shipping_idr)}</strong>
            </div>
            <div>
              <span>Total</span>
              <strong>{rupiah(o.total_idr)}</strong>
            </div>
          </div>
          {["unpaid", "pending"].includes(o.payment_status) &&
            o.order_status === "pending" && (
              <>
                <h2>Selesaikan pembayaran.</h2>
                <p className="pre-line">{value.payment.bank_details}</p>
                {value.payment.qris_media_key && (
                  <MediaImage
                    className="qris-image"
                    src={endpoint + "/track/" + raw + "/qris"}
                    alt="QRIS toko"
                  />
                )}
                <p>
                  Batas pembayaran:{" "}
                  {new Date(o.reservation_expires_at).toLocaleString("id-ID")}
                </p>
                <p>
                  Hubungi toko setelah transfer: {value.payment.contact_phone}
                </p>
              </>
            )}
          {o.shipment_reference && (
            <p>Referensi kirim: {o.shipment_reference}</p>
          )}
          <p>
            Simpan tautan halaman ini untuk melacak pesanan. Tautan berlaku 30
            hari.
          </p>
        </>
      )}
      <div className="live-actions">
        <button
          className="button button-dark"
          onClick={() => setRev((r) => r + 1)}
        >
          Perbarui status
        </button>
        <Link to={base + "/"}>Kembali ke toko ↗</Link>
      </div>
    </section>
  );
}
