import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { RequireAuth } from "./Auth";
import { Icon, type IconName } from "../components/Icon";
import {
  api,
  useData,
  rupiah,
  label,
  type Plan,
  type Invoice,
  type Store,
} from "./api";
const adminTabs: { key: string; label: string; short: string; icon: IconName }[] = [
  { key: "overview", label: "Operasional", short: "Beranda", icon: "home" },
  { key: "plans", label: "Paket & harga", short: "Paket", icon: "credit-card" },
  { key: "policy", label: "Aturan billing", short: "Billing", icon: "settings" },
  { key: "leads", label: "Pengajuan", short: "Pengajuan", icon: "file" },
  { key: "outbox", label: "Notifikasi", short: "Notifikasi", icon: "mail" },
];
type Lead = {
  id: string;
  business_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  project_brief: string;
  status: string;
  source_ownership: string;
  reusable_modules: string;
  contract_terms: string;
  quote_idr: number | null;
  delivery_status: string;
};
export function Admin() {
  return (
    <RequireAuth admin>
      <AdminPanel />
    </RequireAuth>
  );
}
function AdminPanel() {
  const [tab, setTab] = useState("overview"),
    [rev, setRev] = useState(0),
    [error, setError] = useState(""),
    [editing, setEditing] = useState<Plan | null | false>(false),
    [lead, setLead] = useState<Lead | null>(null),
    [search, setSearch] = useState("");
  const overview = useData<{
      stores: Store[];
      invoices: Invoice[];
      outbox: { status: string; count: number }[];
    }>("/api/admin/overview", rev),
    plans = useData<{ plans: Plan[] }>("/api/admin/plans", rev),
    leads = useData<{ leads: Lead[] }>("/api/admin/leads", rev),
    outbox = useData<{
      events: {
        id: string;
        topic: string;
        status: string;
        attempts: number;
        next_attempt_at: string;
      }[];
    }>(tab === "outbox" ? "/api/admin/outbox" : null, rev);
  async function verify(id: string) {
    if (!window.confirm("Dana invoice langganan telah diterima dan diperiksa?"))
      return;
    try {
      await api(`/api/admin/invoices/${id}/verify`, "POST", {});
      setRev((r) => r + 1);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function domain(sid: string) {
    if (
      !window.confirm(
        "DNS, route Worker, dan sertifikat HTTPS subdomain ini sudah diuji?",
      )
    )
      return;
    try {
      await api(`/api/admin/stores/${sid}/domain`, "POST", { verified: true });
      setRev((r) => r + 1);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function pilot(sid: string) {
    const value = window.prompt(
      "Lama toko pilot dalam hari (1–90). Isi 0 untuk mengakhiri akses pilot.",
      "7",
    );
    if (value === null) return;
    const days = Number(value);
    if (!Number.isInteger(days) || days < 0 || days > 90) {
      setError("Isi 0–90 hari.");
      return;
    }
    try {
      await api(`/api/admin/stores/${sid}/pilot`, "POST", { days });
      setRev((r) => r + 1);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function approveUmkm(sid: string) {
    if (
      !window.confirm(
        "Peserta ini sudah ditinjau dan disetujui untuk program UMKM? Akses gratis akan berlaku enam bulan sejak hari ini.",
      )
    )
      return;
    try {
      await api(`/api/admin/stores/${sid}/pilot`, "POST", { months: 6 });
      setRev((r) => r + 1);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const storeCount = overview.value?.stores.length;
  const unpaidCount = overview.value?.invoices.filter((i) =>
    ["unpaid", "overdue"].includes(i.status),
  ).length;
  const leadCount = leads.value?.leads.length;
  const filteredStores = overview.value?.stores.filter((store) =>
    [store.name, store.slug, store.status]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase().trim()),
  );
  const filteredInvoices = overview.value?.invoices.filter((invoice) =>
    [invoice.invoice_number, invoice.status]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase().trim()),
  );
  function changeTab(key: string) {
    setTab(key);
    setEditing(false);
    setLead(null);
    setError("");
    setSearch("");
  }
  return (
    <div className="admin-page">
      <header className="live-admin-head">
        <Link className="admin-brand" to="/">
          <img src="/favicon-32x32.png" alt="" />
          <span>nalaro store<small>ADMIN CONSOLE</small></span>
        </Link>
        <Link to="/app" className="admin-merchant-link">
          <Icon name="store" size={18} />
          <span>Workspace seller</span>
          <Icon name="arrow-up-right" size={15} />
        </Link>
      </header>
      <main className="shell admin-main">
        <div className="admin-intro">
          <span className="admin-eyebrow">PENGELOLAAN PLATFORM</span>
          <div className="admin-intro-row">
            <div>
              <h1>Bisnis di satu kendali.</h1>
              <p>Pantau aktivitas toko, langganan, dan pengajuan baru dengan lebih mudah.</p>
            </div>
            <button className="admin-refresh" title="Muat ulang data" onClick={() => setRev((r) => r + 1)}>
              <Icon name="refresh" size={18} /> <span>Segarkan</span>
            </button>
          </div>
        </div>
        <div className="admin-kpis" aria-label="Ringkasan platform">
          <div className="admin-kpi">
            <div className="admin-kpi-head"><span>Total toko</span><Icon name="box" size={19} /></div>
            <strong>{storeCount ?? "—"}</strong>
            <small>Toko dalam pengelolaan</small>
          </div>
          <div className="admin-kpi">
            <div className="admin-kpi-head"><span>Tagihan menunggu</span><Icon name="credit-card" size={19} /></div>
            <strong>{unpaidCount ?? "—"}</strong>
            <small>Perlu pemeriksaan pembayaran</small>
          </div>
          <div className="admin-kpi">
            <div className="admin-kpi-head"><span>Pengajuan masuk</span><Icon name="file" size={19} /></div>
            <strong>{leadCount ?? "—"}</strong>
            <small>Prospek & program UMKM</small>
          </div>
        </div>
        <div className="work-tabbar admin-tabs" role="tablist" aria-label="Menu admin">
          {adminTabs.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              className={tab === item.key ? "active" : ""}
              onClick={() => changeTab(item.key)}
            >
              <Icon name={item.icon} size={17} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
        {(error || overview.error || plans.error || leads.error) && (
          <p className="live-error" role="alert">
            {error || overview.error || plans.error || leads.error}
          </p>
        )}
        {tab === "overview" && (
          <div className="admin-overview">
            <div className="admin-overview-toolbar">
              <div>
                <h2>Aktivitas operasional</h2>
                <p>Informasi dan tindakan penting untuk mengelola platform.</p>
              </div>
              <label className="admin-search">
                <Icon name="search" size={18} />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari toko atau invoice"
                  aria-label="Cari toko atau invoice"
                />
              </label>
            </div>
            <section className="admin-panel" aria-labelledby="admin-stores-heading">
              <header className="admin-panel-heading">
                <div className="admin-section-title">
                  <Icon name="box" size={19} />
                  <h3 id="admin-stores-heading">Toko terdaftar</h3>
                </div>
                <span>{filteredStores?.length ?? "—"} toko</span>
              </header>
              {filteredStores?.length ? (
                <div className="admin-records">
                  {filteredStores.map((store) => (
                    <article className="admin-record" key={store.id}>
                      <div className="admin-record-main">
                        <div className="admin-record-identity">
                          <strong>{store.name}</strong>
                          <span>{store.slug}</span>
                        </div>
                        <span className="admin-record-status">{label(store.status)}</span>
                      </div>
                      {store.pilot_until && (
                        <p className="admin-record-note">
                          Pilot sampai {new Date(store.pilot_until).toLocaleDateString("id-ID")}
                        </p>
                      )}
                      <div className="admin-record-actions">
                        <Link className="admin-action-primary" to={"/s/" + store.slug}>
                          <Icon name="eye" size={16} /> Lihat toko
                        </Link>
                        <button onClick={() => pilot(store.id)}>Atur pilot</button>
                        <button onClick={() => approveUmkm(store.id)}>UMKM 6 bulan</button>
                        <button onClick={() => domain(store.id)}>Verifikasi domain</button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="admin-empty">
                  <Icon name="box" size={27} />
                  <strong>{search ? "Tidak ada toko yang cocok" : "Belum ada toko terdaftar"}</strong>
                  <p>{search ? "Coba nama atau slug lain." : "Toko yang dibuat seller akan muncul dan bisa dikelola di sini."}</p>
                </div>
              )}
            </section>
            <section className="admin-panel" aria-labelledby="admin-invoices-heading">
              <header className="admin-panel-heading">
                <div className="admin-section-title">
                  <Icon name="credit-card" size={19} />
                  <h3 id="admin-invoices-heading">Invoice langganan</h3>
                </div>
                <span>{filteredInvoices?.length ?? "—"} invoice</span>
              </header>
              {filteredInvoices?.length ? (
                <div className="admin-records">
                  {filteredInvoices.map((invoice) => (
                    <article className="admin-record" key={invoice.id}>
                      <div className="admin-record-main">
                        <div className="admin-record-identity">
                          <strong>{invoice.invoice_number}</strong>
                          <span>{rupiah(invoice.amount_idr)}</span>
                        </div>
                        <span className="admin-record-status">{label(invoice.status)}</span>
                      </div>
                      {["unpaid", "overdue"].includes(invoice.status) && (
                        <div className="admin-record-actions">
                          <button className="admin-action-primary" onClick={() => verify(invoice.id)}>
                            <Icon name="check" size={16} /> Verifikasi pembayaran
                          </button>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="admin-empty">
                  <Icon name="file" size={27} />
                  <strong>{search ? "Invoice tidak ditemukan" : "Belum ada invoice langganan"}</strong>
                  <p>{search ? "Ubah kata pencarianmu." : "Tagihan berlangganan akan terlihat setelah dibuat."}</p>
                </div>
              )}
            </section>
            <section className="admin-panel" aria-labelledby="admin-delivery-heading">
              <header className="admin-panel-heading">
                <div className="admin-section-title">
                  <Icon name="mail" size={19} />
                  <h3 id="admin-delivery-heading">Pengiriman email</h3>
                </div>
              </header>
              {overview.value?.outbox.length ? (
                <div className="admin-delivery-stats">
                  {overview.value.outbox.map((o) => (
                    <div key={o.status}><span>{label(o.status)}</span><strong>{o.count}</strong></div>
                  ))}
                </div>
              ) : (
                <div className="admin-empty">
                  <Icon name="mail" size={27} />
                  <strong>Belum ada aktivitas email</strong>
                  <p>Ringkasan pengiriman muncul saat notifikasi diproses.</p>
                </div>
              )}
            </section>
          </div>
        )}
        {tab === "plans" &&
          (editing !== false ? (
            <PlanEditor
              plan={editing}
              done={() => {
                setEditing(false);
                setRev((r) => r + 1);
              }}
            />
          ) : (
            <>
              <div className="workspace-heading">
                <h2>Paket yang kamu tentukan</h2>
                <button
                  className="button button-dark"
                  onClick={() => setEditing(null)}
                >
                  Buat paket
                </button>
              </div>
              <div className="plan-list">
                {plans.value?.plans.map((p) => (
                  <article key={p.id}>
                    <h2>{p.name}</h2>
                    <p>
                      {label(p.status)} · {p.is_public ? "Publik" : "Internal"}
                    </p>
                    {p.prices.map((pr, i) => (
                      <p key={i}>
                        {rupiah(pr.amount_idr)} / {pr.billing_interval}
                      </p>
                    ))}
                    <button
                      className="button button-dark"
                      onClick={() => setEditing(p)}
                    >
                      Edit paket
                    </button>
                  </article>
                ))}
              </div>
            </>
          ))}
        {tab === "policy" && <BillingPolicy />}
        {tab === "outbox" && (
          <>
            <h2>Antrean notifikasi</h2>
            <p>
              Notifikasi gagal dapat dicoba ulang setelah konfigurasi pengiriman
              diperiksa.
            </p>
            {outbox.error && (
              <p role="alert" className="live-error">
                {outbox.error}
              </p>
            )}
            {outbox.value?.events.map((event) => (
              <div key={event.id} className="live-order-row">
                <span>{event.topic}</span>
                <span>{label(event.status)}</span>
                <span>{event.attempts} percobaan</span>
                {event.status === "failed" && (
                  <button
                    onClick={async () => {
                      try {
                        await api(
                          `/api/admin/outbox/${event.id}/retry`,
                          "POST",
                          {},
                        );
                        setRev((r) => r + 1);
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    Coba kirim ulang
                  </button>
                )}
              </div>
            ))}
            {outbox.value && !outbox.value.events.length && (
              <p>Tidak ada notifikasi yang menunggu.</p>
            )}
          </>
        )}
        {tab === "leads" &&
          (lead ? (
            <LeadEditor
              lead={lead}
              done={() => {
                setLead(null);
                setRev((r) => r + 1);
              }}
            />
          ) : (
            <div className="live-order-list">
              {leads.value?.leads.map((l) => (
                <button
                  className="live-order-row"
                  key={l.id}
                  onClick={() => setLead(l)}
                >
                  <strong>{l.business_name}</strong>
                  <span>{l.contact_name}</span>
                  <span>
                    {l.project_brief.startsWith("[PENGAJUAN PROGRAM UMKM")
                      ? "Program UMKM"
                      : "Arsip prospek custom"}
                  </span>
                  <span>{label(l.status)}</span>
                </button>
              ))}
            </div>
          ))}
      </main>
      <nav className="admin-mobile-nav" aria-label="Navigasi admin mobile">
        {adminTabs.map((item) => (
          <button
            type="button"
            key={item.key}
            className={tab === item.key ? "active" : ""}
            aria-current={tab === item.key ? "page" : undefined}
            onClick={() => changeTab(item.key)}
          >
            <Icon name={item.icon} size={21} />
            <span>{item.short}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
function PlanEditor({ plan, done }: { plan: Plan | null; done: () => void }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const prices = (["monthly", "yearly"] as const)
      .filter((k) => f.get(k) !== "")
      .map((k) => ({ billing_interval: k, amount_idr: Number(f.get(k)) }));
    const entitlements = ["products", "orders", "media_bytes"]
      .filter((k) => f.get(k) !== "")
      .map((k) => ({
        feature_code: k,
        allowed: true,
        limit_value: Number(f.get(k)),
      }));
    try {
      await api(
        "/api/admin/plans" + (plan ? "/" + plan.id : ""),
        plan ? "PUT" : "POST",
        {
          code: f.get("code"),
          name: f.get("name"),
          description: f.get("description"),
          status: f.get("status"),
          is_public: f.has("public"),
          sort_order: Number(f.get("sort")),
          prices,
          entitlements,
        },
      );
      done();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button className="back-link" onClick={done}>
        ← Kembali ke paket
      </button>
      <h2>{plan ? "Edit paket" : "Buat paket"}</h2>
      <form className="live-form live-editor" onSubmit={save}>
        <label>
          Nama paket
          <input required name="name" defaultValue={plan?.name} />
        </label>
        <label>
          Kode paket
          <input
            required
            name="code"
            pattern="[a-z0-9-]{2,40}"
            defaultValue={plan?.code}
          />
        </label>
        <label>
          Deskripsi
          <textarea name="description" defaultValue={plan?.description} />
        </label>
        <div className="form-two">
          {[
            ["monthly", "Harga bulanan (Rp)"],
            ["yearly", "Harga tahunan (Rp)"],
          ].map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                name={key}
                type="number"
                min={0}
                max={1000000000}
                defaultValue={
                  plan?.prices.find((p) => p.billing_interval === key)
                    ?.amount_idr ?? ""
                }
              />
            </label>
          ))}
        </div>
        <p>
          Minimal satu harga. Harga baru berlaku untuk langganan baru; invoice
          lama mempertahankan harga yang disepakati.
        </p>
        <h3>Kuota</h3>
        {[
          ["products", "Jumlah produk"],
          ["orders", "Pesanan per bulan UTC"],
          ["media_bytes", "Gambar diunggah per bulan (byte)"],
        ].map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              name={key}
              type="number"
              min={0}
              defaultValue={
                plan?.entitlements.find((e) => e.feature_code === key)
                  ?.limit_value ?? ""
              }
            />
            <small>Kosongkan untuk tidak membatasi fitur.</small>
          </label>
        ))}
        <label>
          Status
          <select name="status" defaultValue={plan?.status || "draft"}>
            <option value="draft">Draft</option>
            <option value="active">Aktif</option>
            <option value="archived">Arsip</option>
          </select>
        </label>
        <label className="check-label">
          <input
            name="public"
            type="checkbox"
            defaultChecked={plan?.is_public}
          />{" "}
          Tampilkan di halaman paket
        </label>
        <label>
          Urutan
          <input
            name="sort"
            type="number"
            min={0}
            defaultValue={plan?.sort_order || 0}
          />
        </label>
        {error && (
          <p role="alert" className="live-error">
            {error}
          </p>
        )}
        <button className="button button-dark" disabled={busy}>
          Simpan paket
        </button>
      </form>
    </>
  );
}
function LeadEditor({ lead: l, done }: { lead: Lead; done: () => void }) {
  const [error, setError] = useState("");
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await api("/api/admin/leads/" + l.id, "PUT", {
        status: f.get("status"),
        source_ownership: f.get("ownership"),
        contract_terms: f.get("terms"),
        reusable_modules: f.get("modules"),
        quote_idr: f.get("quote") === "" ? null : Number(f.get("quote")),
        delivery_status: f.get("delivery"),
      });
      done();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <button className="back-link" onClick={done}>
        ← Kembali ke pengajuan
      </button>
      <h2>{l.business_name}</h2>
      <p>
        {l.contact_name} · {l.contact_email} · {l.contact_phone}
      </p>
      <p className="pre-line">{l.project_brief}</p>
      <form className="live-form live-editor" onSubmit={save}>
        <label>
          Tahap proyek
          <select name="status" defaultValue={l.status}>
            {[
              "new",
              "reviewing",
              "quoted",
              "accepted",
              "declined",
              "closed",
            ].map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Nilai penawaran (Rp)
          <input
            name="quote"
            type="number"
            min={0}
            defaultValue={l.quote_idr ?? ""}
          />
        </label>
        <label>
          Kepemilikan source
          <select name="ownership" defaultValue={l.source_ownership}>
            {[
              ["pending", "Belum disepakati"],
              ["nalaro_license", "Lisensi Nalaro"],
              ["client_owned", "Milik klien"],
              ["mixed", "Campuran sesuai kontrak"],
            ].map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Modul yang digunakan ulang
          <textarea name="modules" defaultValue={l.reusable_modules} />
        </label>
        <label>
          Ruang lingkup, lisensi, hosting & dukungan
          <textarea name="terms" rows={6} defaultValue={l.contract_terms} />
        </label>
        <label>
          Implementasi / serah terima
          <select name="delivery" defaultValue={l.delivery_status}>
            {["not_started", "in_progress", "review", "delivered"].map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
        </label>
        {error && (
          <p className="live-error" role="alert">
            {error}
          </p>
        )}
        <button className="button button-dark">Simpan proyek</button>
      </form>
    </>
  );
}
function BillingPolicy() {
  const { value, error } = useData<{
    settings: {
      billing_instructions: string;
      trial_days: number;
      grace_days: number;
    };
  }>("/api/admin/billing-settings");
  const [message, setMessage] = useState("");
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await api("/api/admin/billing-settings", "PUT", {
        billing_instructions: f.get("instructions"),
        trial_days: Number(f.get("trial")),
        grace_days: Number(f.get("grace")),
      });
      setMessage("Kebijakan billing disimpan.");
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  return (
    <>
      <h2>Pembayaran & masa tenggang</h2>
      <p>
        Berlaku bagi langganan baru. Invoice toko dan pembayaran pelanggan toko
        tetap terpisah.
      </p>
      {error && <p role="alert">{error}</p>}
      {value && (
        <form className="live-form live-editor" onSubmit={save}>
          <label>
            Rekening / instruksi pembayaran Nalaro
            <textarea
              required
              name="instructions"
              minLength={10}
              rows={5}
              defaultValue={value.settings.billing_instructions}
            />
          </label>
          <label>
            Masa coba (hari)
            <input
              required
              type="number"
              min={0}
              max={30}
              name="trial"
              defaultValue={value.settings.trial_days}
            />
          </label>
          <label>
            Masa tenggang (hari)
            <input
              required
              type="number"
              min={0}
              max={30}
              name="grace"
              defaultValue={value.settings.grace_days}
            />
          </label>
          {message && <p role="status">{message}</p>}
          <button className="button button-dark">Simpan kebijakan</button>
        </form>
      )}
    </>
  );
}
