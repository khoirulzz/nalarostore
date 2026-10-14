import { useState } from "react";
import { authorizationHeaders } from "../lib/firebase";
import { useData, rupiah } from "./api";

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
          { headers: await authorizationHeaders() },
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
    <div>
      <button className="button" disabled={busy} onClick={download}>
        {busy ? "Menyiapkan ekspor…" : "Ekspor CSV"}
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
          <p>
            Kontak dari pesanan toko ini. Total belanja menghitung pembayaran
            terverifikasi.
          </p>
        </div>
        <ExportButton sid={sid} resource="customers" />
      </div>
      <label>
        Cari nama, email atau telepon
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
      </label>
      {data.error && (
        <p className="live-error" role="alert">
          {data.error}
        </p>
      )}
      {data.loading && <p aria-busy="true">Memuat pelanggan…</p>}
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
      {data.value && !data.value.customers.length && (
        <p>Belum ada pelanggan yang sesuai.</p>
      )}
      <div className="live-actions">
        <button
          disabled={page === 1 || data.loading}
          onClick={() => setPage((p) => p - 1)}
        >
          Sebelumnya
        </button>
        <span>Halaman {page}</span>
        <button
          disabled={!data.value?.hasMore || data.loading}
          onClick={() => setPage((p) => p + 1)}
        >
          Berikutnya
        </button>
      </div>
    </>
  );
}
export function Analytics({ sid }: { sid: string }) {
  const [from, setFrom] = useState(() =>
      new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10),
    ),
    [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const data = useData<{
    summary: {
      orders: number;
      paid_orders: number;
      canceled_orders: number;
      revenue: number;
    };
    daily: { day: string; orders: number; revenue: number }[];
  }>(`/api/merchant/stores/${sid}/analytics?from=${from}&to=${to}`);
  const s = data.value?.summary;
  return (
    <>
      <h1>Analitik penjualan</h1>
      <p>
        Pesanan dikelompokkan menurut tanggal dibuat (UTC). Pendapatan hanya
        menghitung pesanan dengan pembayaran terverifikasi.
      </p>
      <div className="form-two">
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
      {data.error && (
        <p role="alert" className="live-error">
          {data.error}
        </p>
      )}
      {s && (
        <>
          <div className="work-numbers">
            <div>
              <span>Penjualan terverifikasi</span>
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
          <section className="work-section">
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
