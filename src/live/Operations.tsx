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
  const today = () => new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  const [from, setFrom] = useState(() =>
    new Date(Date.parse(today()) - 29 * 86400000).toISOString().slice(0, 10),
  );
  const [to, setTo] = useState(today);
  const [timezone, setTimezone] = useState("Asia/Jakarta");
  const [dailyPage, setDailyPage] = useState(1);
  const data = useData<{
    summary: {
      orders: number; paid_orders: number; canceled_orders: number;
      revenue: number; shipping_revenue: number; total_collected: number;
      units_sold: number; average_order_value: number;
      purchasing_customers: number; returning_customers: number;
    };
    previous: { revenue: number; paid_orders: number; units_sold: number };
    top_products: { product_id: string; name: string; units: number; revenue: number }[];
    top_variants: {
      product_id: string; variant_id: string; name: string;
      variant: string; units: number; revenue: number;
    }[];
    daily: { day: string; orders: number; revenue: number }[];
    daily_pagination: {
      page: number; page_size: number; total_days: number;
      total_pages: number; first_published_date: string | null;
    };
  }>(
    `/api/merchant/stores/${sid}/analytics?from=${from}&to=${to}&timezone=${timezone}&daily_page=${dailyPage}`,
  );
  const s = data.value?.summary;
  const pagination = data.value?.daily_pagination;
  const setPeriod = (days: number) => {
    const end = today();
    setTo(end);
    setFrom(new Date(Date.parse(end) - (days - 1) * 86400000).toISOString().slice(0, 10));
    setDailyPage(1);
  };
  const firstPublished = pagination?.first_published_date;
  const formatDay = (day: string) => new Date(day + "T12:00:00Z").toLocaleDateString(
    "id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" },
  );
  return (
    <div className="seller-analytics-page">
      <header className="seller-page-heading">
        <div>
          <h1>Analitik penjualan</h1>
          <p>Pantau performa toko, pesanan dibayar, dan produk yang diminati.</p>
        </div>
      </header>
      <section className="work-section analytics-filters" aria-label="Filter analitik">
        <div className="analytics-filter-header">
          <div>
            <strong>Periode laporan</strong>
            <span>Atur rentang tanggal untuk melihat penjualan toko.</span>
          </div>
          <div className="analytics-presets">
            {[7, 30, 90].map((days) => (
              <button key={days} type="button"
                className={from === new Date(Date.parse(today()) - (days - 1) * 86400000).toISOString().slice(0, 10) && to === today() ? "active" : ""}
                onClick={() => setPeriod(days)}
              >{days} hari</button>
            ))}
          </div>
        </div>
        <div className="analytics-filter-fields">
          <label><span>Dari</span>
            <input type="date" value={from} max={to} onChange={(e) => { if(e.target.value) { setFrom(e.target.value); setDailyPage(1); } }} />
          </label>
          <label><span>Sampai</span>
            <input type="date" value={to} min={from} onChange={(e) => { if(e.target.value) { setTo(e.target.value); setDailyPage(1); } }} />
          </label>
          <label><span>Zona waktu</span>
            <select value={timezone} onChange={(e) => { setTimezone(e.target.value); setDailyPage(1); }}>
              {[
                ["Asia/Jakarta", "WIB"],
                ["Asia/Makassar", "WITA"],
                ["Asia/Jayapura", "WIT"],
                ["UTC", "UTC"],
              ].map(([value, name]) => <option key={value} value={value}>{name}</option>)}
            </select>
          </label>
        </div>
      </section>
      {data.error && <p role="alert" className="live-error">{data.error}</p>}
      {data.loading && <p aria-busy="true" className="seller-list-loading">Memuat analitik…</p>}
      {s && (
        <>
          <section className="analytics-stats" aria-label="Ringkasan analitik">
            {[
              { label: "Penjualan produk", value: rupiah(s.revenue), hint: "Tanpa ongkir" },
              { label: "Pesanan dibayar", value: `${s.paid_orders} / ${s.orders}`, hint: "Dibayar / seluruh pesanan" },
              { label: "Rata-rata transaksi", value: rupiah(s.average_order_value), hint: "Dari pesanan dibayar" },
              { label: "Unit terjual", value: String(s.units_sold), hint: "Total produk" },
              { label: "Total pembayaran", value: rupiah(s.total_collected), hint: `Termasuk ongkir ${rupiah(s.shipping_revenue)}` },
              { label: "Pelanggan kembali", value: `${s.returning_customers} / ${s.purchasing_customers}`, hint: "Pelanggan kembali / pembeli" },
            ].map((metric) => (
              <article className="work-section analytics-stat" key={metric.label}>
                <span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.hint}</small>
              </article>
            ))}
          </section>
          <section className="work-section analytics-comparison">
            <div className="analytics-section-heading">
              <div><h2>Periode sebelumnya</h2><p>Perbandingan dengan rentang tanggal yang sama panjang.</p></div>
              <span className={Number(s.revenue) >= Number(data.value?.previous.revenue) ? "positive" : "negative"}>
                {Number(data.value?.previous.revenue) > 0
                  ? `${Number(s.revenue) >= Number(data.value?.previous.revenue) ? "+" : ""}${((Number(s.revenue) / Number(data.value?.previous.revenue) - 1) * 100).toFixed(1)}%`
                  : "Belum ada pembanding"}
              </span>
            </div>
            <p>Penjualan {rupiah(data.value?.previous.revenue || 0)} · {data.value?.previous.paid_orders || 0} pesanan dibayar · {data.value?.previous.units_sold || 0} unit.</p>
          </section>
          <div className="analytics-two-columns">
            <section className="work-section analytics-list">
              <div className="analytics-section-heading"><h2>Produk terlaris</h2></div>
              {data.value?.top_products.map((p, i) => (
                <div className="analytics-ranked-row" key={p.product_id}>
                  <span className="analytics-rank">{i + 1}</span>
                  <span><strong>{p.name}</strong><small>{p.units} unit</small></span>
                  <b>{rupiah(p.revenue)}</b>
                </div>
              ))}
              {!data.value?.top_products.length && <div className="analytics-inline-empty"><Icon name="box" size={22} /><span>Belum ada produk terjual pada periode ini.</span></div>}
            </section>
            <section className="work-section analytics-list">
              <div className="analytics-section-heading"><h2>Varian terlaris</h2></div>
              {data.value?.top_variants.map((p, i) => (
                <div className="analytics-ranked-row" key={p.variant_id}>
                  <span className="analytics-rank">{i + 1}</span>
                  <span><strong>{p.name}</strong><small>{p.variant} · {p.units} unit</small></span>
                  <b>{rupiah(p.revenue)}</b>
                </div>
              ))}
              {!data.value?.top_variants.length && <div className="analytics-inline-empty"><Icon name="box" size={22} /><span>Belum ada varian terjual.</span></div>}
            </section>
          </div>
          <section className="work-section analytics-daily">
            <div className="analytics-section-heading">
              <div>
                <h2>Penjualan per hari</h2>
                <p>{firstPublished ? `Riwayat tersedia sejak toko dipublikasikan pada ${formatDay(firstPublished)}.` : "Riwayat dimulai setelah toko pertama kali dipublikasikan."}</p>
              </div>
              <span>{pagination?.total_days || 0} hari</span>
            </div>
            {data.value?.daily.map((d) => (
              <div className="analytics-daily-row" key={d.day}>
                <div><strong>{formatDay(d.day)}</strong><small>{d.orders} pesanan masuk</small></div>
                <b>{rupiah(d.revenue)}</b>
              </div>
            ))}
            {!data.value?.daily.length && (
              <div className="analytics-inline-empty">
                <Icon name="calendar" size={22} />
                <span>Belum ada hari penjualan pada periode ini.</span>
              </div>
            )}
            {(pagination?.total_pages || 0) > 1 && (
              <nav className="analytics-pagination" aria-label="Halaman penjualan harian">
                <button type="button" disabled={dailyPage <= 1 || data.loading}
                  onClick={() => setDailyPage((v) => Math.max(1, v - 1))}>
                  <Icon name="chevron-left" size={17} /> Lebih baru
                </button>
                <span>Halaman {dailyPage} dari {pagination?.total_pages}</span>
                <button type="button" disabled={dailyPage >= (pagination?.total_pages || 1) || data.loading}
                  onClick={() => setDailyPage((v) => v + 1)}>
                  Lebih lama <Icon name="chevron-right" size={17} />
                </button>
              </nav>
            )}
            <p className="analytics-footnote">{s.canceled_orders} pesanan dibatalkan. Nilai penjualan berdasarkan pembayaran terverifikasi, tanpa ongkir.</p>
          </section>
        </>
      )}
    </div>
  );
}
