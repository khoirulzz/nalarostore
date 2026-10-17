import { useState } from "react";
import { authorizationHeaders } from "../lib/firebase";
import { Icon } from "../components/Icon";
import { useData, rupiah, adminContextHeaders } from "./api";

export function ExportButton({
  sid,
  resource,
}: {
  sid: string;
  resource: "orders" | "products" | "customers";
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function download() {
    setBusy(true);
    setError("");
    try {
      const parts: string[] = [];
      let bytes = 0;
      for (let page = 1; page <= 100; page++) {
        const r = await fetch(
          `/api/merchant/stores/${sid}/export?resource=${resource}&page=${page}`,
          {
            headers: {
              ...(await authorizationHeaders()),
              ...adminContextHeaders(`/api/merchant/stores/${sid}/export`),
            },
          },
        );
        if (!r.ok) {
          const data = (await r.json()) as { error: string };
          throw Error(data.error);
        }
        const count = Number(r.headers.get("x-export-rows"));
        if (!count && page > 1) break;
        const text = await r.text();
        bytes += text.length;
        if (bytes > 20 * 1024 * 1024)
          throw Error(
            "Ekspor terlalu besar untuk browser. Hubungi dukungan untuk ekspor lengkap.",
          );
        parts.push(
          page === 1 ? text : "\r\n" + text.slice(text.indexOf("\r\n") + 2),
        );
        if (count < 500) break;
        if (page === 100)
          throw Error(
            "Ekspor melebihi 50.000 baris. Hubungi dukungan untuk ekspor lengkap.",
          );
      }
      const url = URL.createObjectURL(
          new Blob(parts, { type: "text/csv;charset=utf-8" }),
        ),
        link = document.createElement("a");
      link.href = url;
      link.download = `nalarostore-${resource}.csv`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="seller-export">
      <button
        className="seller-export-button"
        type="button"
        disabled={busy}
        onClick={download}
      >
        <Icon name={busy ? "refresh" : "file"} size={16} />
        <span>{busy ? "Menyiapkan…" : "Ekspor CSV"}</span>
      </button>
      {error && (
        <p className="live-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
export function Customers({ sid }: { sid: string }) {
  const [q, setQ] = useState(""),
    [page, setPage] = useState(1);
  const data = useData<{
    customers: {
      name: string;
      email: string;
      contact_phone: string;
      orders: number;
      paid_total: number;
      last_order: string;
    }[];
    hasMore: boolean;
  }>(
    `/api/merchant/stores/${sid}/customers?q=${encodeURIComponent(q)}&page=${page}`,
  );
  return (
    <>
      <div className="workspace-heading">
        <div>
          <h1>Pelanggan</h1>
          <p>Lihat pelanggan, riwayat pesanan, dan nilai belanja mereka.</p>
        </div>
        <ExportButton sid={sid} resource="customers" />
      </div>
      <label className="seller-search">
        <span>Cari pelanggan</span>
        <span className="seller-search-control">
          <Icon name="search" size={19} />
          <input
            type="search"
            aria-label="Cari nama, email atau telepon"
            placeholder="Nama, email, atau nomor telepon"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </span>
      </label>
      {data.error && (
        <p className="live-error" role="alert">
          {data.error}
        </p>
      )}
      {data.loading && (
        <p className="seller-loading" aria-busy="true">
          Memuat pelanggan…
        </p>
      )}
      <div className="live-order-list">
        {data.value?.customers.map((c) => (
          <article className="work-section customer-row" key={c.contact_phone}>
            <h2>{c.name}</h2>
            <p>
              {c.contact_phone} · {c.email || "Email tidak diisi"}
            </p>
            <p>
              {c.orders} pesanan · {rupiah(c.paid_total)} dibayar
            </p>
            <small>
              Terakhir: {new Date(c.last_order).toLocaleDateString("id-ID")}
            </small>
          </article>
        ))}
      </div>
      {data.value && !data.loading && !data.value.customers.length && (
        <div className="seller-empty" role="status">
          <span className="seller-empty-icon">
            <Icon name="users" size={25} />
          </span>
          <h2>{q ? "Pelanggan tidak ditemukan" : "Belum ada pelanggan"}</h2>
          <p>
            {q
              ? "Coba kata pencarian lain."
              : "Saat pesanan pertama masuk, data pelanggan akan tampil di sini."}
          </p>
          {q && (
            <button
              className="seller-text-action"
              onClick={() => {
                setQ("");
                setPage(1);
              }}
            >
              Hapus pencarian
            </button>
          )}
        </div>
      )}
      {(page > 1 || !!data.value?.hasMore) && (
        <nav className="seller-pagination" aria-label="Halaman pelanggan">
          <button
            type="button"
            disabled={page === 1 || data.loading}
            onClick={() => setPage((p) => p - 1)}
            aria-label="Halaman sebelumnya"
          >
            <Icon name="chevron-left" size={17} />
            <span>Sebelumnya</span>
          </button>
          <span>Halaman {page}</span>
          <button
            type="button"
            disabled={!data.value?.hasMore || data.loading}
            onClick={() => setPage((p) => p + 1)}
            aria-label="Halaman berikutnya"
          >
            <span>Berikutnya</span>
            <Icon name="chevron-right" size={17} />
          </button>
        </nav>
      )}
    </>
  );
}
export function Analytics({ sid }: { sid: string }) {
  const [from, setFrom] = useState(() =>
      new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10),
    ),
    [to, setTo] = useState(() => new Date().toISOString().slice(0, 10)),
    [timezone, setTimezone] = useState("Asia/Jakarta");
  const data = useData<{
    summary: {
      orders: number;
      paid_orders: number;
      canceled_orders: number;
      revenue: number;
      shipping_revenue: number;
      total_collected: number;
      units_sold: number;
      average_order_value: number;
      purchasing_customers: number;
      returning_customers: number;
    };
    previous: { revenue: number; paid_orders: number; units_sold: number };
    top_products: {
      product_id: string;
      name: string;
      units: number;
      revenue: number;
    }[];
    top_variants: {
      product_id: string;
      variant_id: string;
      name: string;
      variant: string;
      units: number;
      revenue: number;
    }[];
    daily: { day: string; orders: number; revenue: number }[];
  }>(
    `/api/merchant/stores/${sid}/analytics?from=${from}&to=${to}&timezone=${timezone}`,
  );
  const s = data.value?.summary;
  return (
    <>
      <h1>Analitik penjualan</h1>
      <p className="seller-section-lead">
        Pantau penjualan dan pesanan yang sudah dibayar dalam periode pilihanmu.
      </p>
      <div className="form-two seller-date-filters">
        <label>
          Dari tanggal
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          Sampai tanggal
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
      </div>
      <label className="seller-date-filters">
        Zona waktu
        <select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
          {[
            ["Asia/Jakarta", "WIB"],
            ["Asia/Makassar", "WITA"],
            ["Asia/Jayapura", "WIT"],
            ["UTC", "UTC"],
          ].map(([value, name]) => (
            <option key={value} value={value}>
              {name}
            </option>
          ))}
        </select>
      </label>
      {data.error && (
        <p role="alert" className="live-error">
          {data.error}
        </p>
      )}
      {s && (
        <>
          <div className="work-numbers">
            <div>
              <span>Penjualan produk (tanpa ongkir)</span>
              <strong>{rupiah(s.revenue)}</strong>
            </div>
            <div>
              <span>Pesanan dibayar / total</span>
              <strong>
                {s.paid_orders} / {s.orders}
              </strong>
            </div>
            <div>
              <span>Rata-rata pesanan dibayar</span>
              <strong>
                {rupiah(s.paid_orders ? Number(s.revenue) / s.paid_orders : 0)}
              </strong>
            </div>
          </div>
          <div className="work-numbers">
            <div>
              <span>Unit terjual</span>
              <strong>{s.units_sold}</strong>
            </div>
            <div>
              <span>Ongkir dibayar</span>
              <strong>{rupiah(s.shipping_revenue)}</strong>
            </div>
            <div>
              <span>Total pembayaran</span>
              <strong>{rupiah(s.total_collected)}</strong>
            </div>
            <div>
              <span>Pelanggan kembali / pembeli</span>
              <strong>
                {s.returning_customers} / {s.purchasing_customers}
              </strong>
            </div>
          </div>
          <section className="work-section">
            <h2>Dibanding periode sebelumnya</h2>
            <p>
              Penjualan produk {rupiah(data.value?.previous.revenue || 0)} ·{" "}
              {data.value?.previous.paid_orders || 0} pesanan dibayar ·{" "}
              {data.value?.previous.units_sold || 0} unit.
            </p>
            {Number(data.value?.previous.revenue) > 0 && (
              <p>
                Perubahan penjualan{" "}
                {(
                  (Number(s.revenue) / Number(data.value?.previous.revenue) -
                    1) *
                  100
                ).toFixed(1)}
                %.
              </p>
            )}
          </section>
          <section className="work-section">
            <h2>Produk terlaris</h2>
            {data.value?.top_products.map((p, index) => (
              <div className="checkout-line" key={p.product_id + ":" + p.name}>
                <span>
                  {index + 1}. {p.name} · {p.units} unit
                </span>
                <strong>{rupiah(p.revenue)}</strong>
              </div>
            ))}
            {!data.value?.top_products.length && (
              <p>Belum ada produk terjual pada periode ini.</p>
            )}
          </section>
          <section className="work-section">
            <h2>Varian terlaris</h2>
            {data.value?.top_variants.map((p) => (
              <div
                className="checkout-line"
                key={p.variant_id + ":" + p.name + ":" + p.variant}
              >
                <span>
                  {p.name} · {p.variant} · {p.units} unit
                </span>
                <strong>{rupiah(p.revenue)}</strong>
              </div>
            ))}
          </section>
          <p className="seller-section-lead">
            Perhitungan berdasarkan pesanan dibayar yang tidak dibatalkan atau
            kedaluwarsa, dikelompokkan menurut tanggal pesanan. Pelanggan tamu
            dikenali dari telepon yang dinormalisasi; laba dan konversi belum
            dihitung.
          </p>
          <section className="work-section seller-analytics-panel">
            <h2>Penjualan per hari</h2>
            {data.value?.daily.map((d) => (
              <div className="checkout-line" key={d.day}>
                <span>
                  {d.day} · {d.orders} pesanan
                </span>
                <strong>{rupiah(d.revenue)}</strong>
              </div>
            ))}
            {!data.value?.daily.length && (
              <p>Belum ada pesanan dalam rentang ini.</p>
            )}
            <p>{s.canceled_orders} pesanan dibatalkan.</p>
          </section>
        </>
      )}
    </>
  );
}
