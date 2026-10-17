import { normalizePlanCode } from "../../shared/plans";
import { AdminStore, AdminModal } from "./AdminStore";
import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
type AdminAction = {
  kind: "invoice" | "domain" | "pilot" | "umkm";
  id: string;
};
const adminTabs: {
  key: string;
  label: string;
  short: string;
  icon: IconName;
}[] = [
  { key: "overview", label: "Operasional", short: "Beranda", icon: "home" },
  { key: "plans", label: "Paket & harga", short: "Paket", icon: "credit-card" },
  {
    key: "policy",
    label: "Aturan billing",
    short: "Billing",
    icon: "settings",
  },
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
  store_id?: string | null;
};
export function Admin() {
  return (
    <RequireAuth admin>
      <AdminPanel />
    </RequireAuth>
  );
}
function AdminPanel() {
  const [params, setParams] = useSearchParams();
  const tab = adminTabs.some((t) => t.key === params.get("tab"))
    ? params.get("tab")!
    : "overview";
  const storeId = params.get("store");
  const setTab = (key: string) => setParams({ tab: key });
  const [rev, setRev] = useState(0),
    [error, setError] = useState(""),
    [editing, setEditing] = useState<Plan | null | false>(false),
    [lead, setLead] = useState<Lead | null>(null),
    [search, setSearch] = useState(""),
    [action, setAction] = useState<AdminAction | null>(null),
    [pilotDays, setPilotDays] = useState("7"),
    [actionBusy, setActionBusy] = useState(false),
    [actionError, setActionError] = useState("");
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
  function openAction(kind: AdminAction["kind"], id: string) {
    setAction({ kind, id });
    setPilotDays("7");
    setActionError("");
  }
  async function submitAction() {
    if (!action || actionBusy) return;
    let endpoint = "";
    let payload: { days?: number; months?: number; verified?: boolean } = {};
    if (action.kind === "pilot") {
      const days = Number(pilotDays);
      if (
        !Number.isInteger(days) ||
        days < 0 ||
        days > 90 ||
        pilotDays.trim() === ""
      ) {
        setActionError("Isi jumlah hari dari 0 sampai 90.");
        return;
      }
      endpoint = `/api/admin/stores/${action.id}/pilot`;
      payload = { days };
    } else if (action.kind === "umkm") {
      endpoint = `/api/admin/stores/${action.id}/pilot`;
      payload = { months: 6 };
    } else if (action.kind === "domain") {
      endpoint = `/api/admin/stores/${action.id}/domain`;
      payload = { verified: true };
    } else {
      endpoint = `/api/admin/invoices/${action.id}/verify`;
    }
    setActionBusy(true);
    setActionError("");
    try {
      await api(endpoint, "POST", payload);
      setAction(null);
      setRev((r) => r + 1);
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setActionBusy(false);
    }
  }
  const storeCount = overview.value?.stores.length;
  const unpaidCount = overview.value?.invoices.filter((i) =>
    ["unpaid", "overdue"].includes(i.status),
  ).length;
  const leadCount = leads.value?.leads.filter((l) =>
    ["new", "reviewing"].includes(l.status),
  ).length;
  const filteredStores = overview.value?.stores.filter((store) =>
    [
      store.name,
      store.slug,
      store.status,
      store.owner_email || "",
      store.plan_name || "",
    ]
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
          <span>
            nalaro store<small>ADMIN CONSOLE</small>
          </span>
        </Link>
        <Link to="/app" className="admin-merchant-link">
          <Icon name="box" size={18} />
          <span>Workspace seller</span>
          <Icon name="arrow-up-right" size={15} />
        </Link>
      </header>
      <main className="shell admin-main">
        <div className="admin-intro">
          <span className="admin-eyebrow">PENGELOLAAN PLATFORM</span>
          <div className="admin-intro-row">
            <div>
              <h1>
                {storeId
                  ? "Kelola toko"
                  : tab === "overview"
                    ? "Ringkasan platform"
                    : adminTabs.find((t) => t.key === tab)?.label}
              </h1>
              <p>
                {tab === "overview"
                  ? "Tinjau toko, akses langganan, dan aktivitas yang perlu ditangani."
                  : tab === "plans"
                    ? "Atur harga, fitur, serta paket publik dan program internal."
                    : tab === "policy"
                      ? "Tentukan instruksi pembayaran dan aturan langganan."
                      : tab === "leads"
                        ? "Tinjau pengajuan dan tindak lanjuti calon peserta."
                        : "Pantau status pengiriman dan tangani notifikasi gagal."}
              </p>
            </div>
            <button
              className="admin-refresh"
              title="Muat ulang data"
              onClick={() => setRev((r) => r + 1)}
            >
              <Icon name="refresh" size={18} /> <span>Segarkan</span>
            </button>
          </div>
        </div>
        {tab === "overview" && !storeId && (
          <div className="admin-kpis" aria-label="Ringkasan platform">
            <div className="admin-kpi">
              <div className="admin-kpi-head">
                <span>Total toko</span>
                <Icon name="box" size={19} />
              </div>
              <strong>{storeCount ?? "—"}</strong>
              <small>Toko dalam pengelolaan</small>
            </div>
            <div className="admin-kpi">
              <div className="admin-kpi-head">
                <span>Tagihan menunggu</span>
                <Icon name="credit-card" size={19} />
              </div>
              <strong>{unpaidCount ?? "—"}</strong>
              <small>Perlu pemeriksaan pembayaran</small>
            </div>
            <div className="admin-kpi">
              <div className="admin-kpi-head">
                <span>Pengajuan masuk</span>
                <Icon name="file" size={19} />
              </div>
              <strong>{leadCount ?? "—"}</strong>
              <small>Prospek & program UMKM</small>
            </div>
          </div>
        )}
        <div
          className="work-tabbar admin-tabs"
          role="tablist"
          aria-label="Menu admin"
        >
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
        {tab === "overview" && storeId && (
          <AdminStore
            key={storeId}
            sid={storeId}
            plans={plans.value?.plans || []}
            back={() => setParams({ tab: "overview" })}
            changed={() => setRev((r) => r + 1)}
          />
        )}
        {tab === "overview" && !storeId && (
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
            <section
              className="admin-panel"
              aria-labelledby="admin-stores-heading"
            >
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
                          <span>
                            {store.slug} · {store.owner_email}
                          </span>
                          <span>
                            {store.plan_name || "Belum ada paket aktif"}
                          </span>
                        </div>
                        <span className="admin-record-status">
                          {label(store.status)}
                        </span>
                      </div>
                      {store.pilot_until && (
                        <p className="admin-record-note">
                          Pilot sampai{" "}
                          {new Date(store.pilot_until).toLocaleDateString(
                            "id-ID",
                          )}
                        </p>
                      )}
                      <div className="admin-record-actions">
                        <button
                          className="admin-action-primary"
                          onClick={() =>
                            setParams({ tab: "overview", store: store.id })
                          }
                        >
                          <Icon name="settings" size={16} /> Kelola toko
                        </button>
                        <Link to={`/preview/${store.id}?admin=1`}>
                          <Icon name="eye" size={16} /> Pratinjau
                        </Link>
                        <button onClick={() => openAction("pilot", store.id)}>
                          Atur pilot
                        </button>
                        <button
                          disabled={Boolean(store.umkm_activated_at)}
                          onClick={() => openAction("umkm", store.id)}
                        >
                          {store.umkm_activated_at
                            ? "UMKM sudah diberikan"
                            : "UMKM 6 bulan"}
                        </button>
                        <button onClick={() => openAction("domain", store.id)}>
                          Verifikasi domain
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="admin-empty">
                  <Icon name="box" size={27} />
                  <strong>
                    {search
                      ? "Tidak ada toko yang cocok"
                      : "Belum ada toko terdaftar"}
                  </strong>
                  <p>
                    {search
                      ? "Coba nama atau slug lain."
                      : "Toko yang dibuat seller akan muncul dan bisa dikelola di sini."}
                  </p>
                </div>
              )}
            </section>
            <section
              className="admin-panel"
              aria-labelledby="admin-invoices-heading"
            >
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
                        <span className="admin-record-status">
                          {label(invoice.status)}
                        </span>
                      </div>
                      {["unpaid", "overdue"].includes(invoice.status) && (
                        <div className="admin-record-actions">
                          <button
                            className="admin-action-primary"
                            onClick={() => openAction("invoice", invoice.id)}
                          >
                            <Icon name="check" size={16} /> Verifikasi
                            pembayaran
                          </button>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="admin-empty">
                  <Icon name="file" size={27} />
                  <strong>
                    {search
                      ? "Invoice tidak ditemukan"
                      : "Belum ada invoice langganan"}
                  </strong>
                  <p>
                    {search
                      ? "Ubah kata pencarianmu."
                      : "Tagihan berlangganan akan terlihat setelah dibuat."}
                  </p>
                </div>
              )}
            </section>
            <section
              className="admin-panel"
              aria-labelledby="admin-delivery-heading"
            >
              <header className="admin-panel-heading">
                <div className="admin-section-title">
                  <Icon name="mail" size={19} />
                  <h3 id="admin-delivery-heading">Pengiriman email</h3>
                </div>
              </header>
              {overview.value?.outbox.length ? (
                <div className="admin-delivery-stats">
                  {overview.value.outbox.map((o) => (
                    <div key={o.status}>
                      <span>{label(o.status)}</span>
                      <strong>{o.count}</strong>
                    </div>
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
                        {rupiah(pr.amount_idr)} / {label(pr.billing_interval)}
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
              stores={overview.value?.stores || []}
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
      {action && (
        <AdminModal
          title="Konfirmasi tindakan"
          busy={actionBusy}
          close={() => setAction(null)}
        >
          <header className="admin-dialog-head">
            <span className="admin-eyebrow">KONFIRMASI TINDAKAN</span>
            <button
              type="button"
              aria-label="Tutup dialog"
              onClick={() => setAction(null)}
              disabled={actionBusy}
            >
              <Icon name="close" size={19} />
            </button>
          </header>
          <h2 id="admin-dialog-title">
            {action.kind === "pilot"
              ? "Atur masa pilot"
              : action.kind === "umkm"
                ? "Aktifkan program UMKM"
                : action.kind === "domain"
                  ? "Verifikasi subdomain"
                  : "Verifikasi pembayaran"}
          </h2>
          <p>
            {action.kind === "pilot"
              ? "Tentukan jumlah hari akses pilot. Gunakan 0 hari untuk mengakhiri akses."
              : action.kind === "umkm"
                ? "Pastikan peserta sudah ditinjau dan disetujui. Akses gratis berlangsung enam bulan sejak hari ini."
                : action.kind === "domain"
                  ? "Lanjutkan hanya jika DNS, route Worker, dan sertifikat HTTPS telah diuji."
                  : "Lanjutkan hanya jika dana pembayaran invoice telah diterima dan diperiksa."}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submitAction();
            }}
          >
            {action.kind === "pilot" && (
              <label className="admin-dialog-input">
                Lama pilot (hari)
                <input
                  type="number"
                  min={0}
                  max={90}
                  step={1}
                  required
                  inputMode="numeric"
                  value={pilotDays}
                  onChange={(e) => setPilotDays(e.target.value)}
                />
              </label>
            )}
            {actionError && (
              <p className="live-error" role="alert">
                {actionError}
              </p>
            )}
            <div className="admin-dialog-actions">
              <button
                type="button"
                className="admin-dialog-cancel"
                onClick={() => setAction(null)}
                disabled={actionBusy}
              >
                Batal
              </button>
              <button
                type="submit"
                className="admin-dialog-submit"
                disabled={actionBusy}
              >
                {actionBusy
                  ? "Memproses…"
                  : action.kind === "pilot"
                    ? "Simpan perubahan"
                    : action.kind === "umkm"
                      ? "Aktifkan akses"
                      : "Ya, verifikasi"}
              </button>
            </div>
          </form>
        </AdminModal>
      )}
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
    [busy, setBusy] = useState(false),
    [code, setCode] = useState(plan?.code || ""),
    [manualCode, setManualCode] = useState(Boolean(plan));
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    const prices = (["monthly", "yearly"] as const)
      .filter((k) => f.get(k) !== "")
      .map((k) => ({ billing_interval: k, amount_idr: Number(f.get(k)) }));
    if (!prices.length) {
      setError(
        "Isi minimal satu harga bulanan atau tahunan. Gunakan 0 untuk paket gratis.",
      );
      setBusy(false);
      return;
    }
    const entitlements = [
      "storefront",
      "products",
      "orders",
      "media_bytes",
    ].map((k) => ({
      feature_code: k,
      allowed: f.has("allow_" + k),
      limit_value:
        k === "storefront" || f.get(k) === ""
          ? null
          : Math.round(
              Number(f.get(k)) * (k === "media_bytes" ? 1_000_000 : 1),
            ),
    }));
    try {
      await api(
        "/api/admin/plans" + (plan ? "/" + plan.id : ""),
        plan ? "PUT" : "POST",
        {
          code: normalizePlanCode(String(f.get("code") || f.get("name"))),
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
      <form className="live-form live-editor admin-plan-editor" onSubmit={save}>
        <label>
          Nama paket
          <input
            required
            minLength={2}
            maxLength={100}
            name="name"
            defaultValue={plan?.name}
            onChange={(e) => {
              if (!manualCode) setCode(normalizePlanCode(e.target.value));
            }}
            placeholder="Contoh: Bisnis Bulanan"
          />
        </label>
        <label>
          Kode paket
          <input
            required
            name="code"
            aria-label="Kode paket"
            minLength={2}
            maxLength={40}
            value={code}
            onChange={(e) => {
              setManualCode(true);
              setCode(
                e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
              );
            }}
            onBlur={() => setCode(normalizePlanCode(code))}
            placeholder="bisnis-bulanan"
          />
          <small>
            Dibuat otomatis dari nama paket. Gunakan huruf kecil, angka, dan
            tanda hubung.
          </small>
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
        <h3>Fitur yang tersedia</h3>
        {[
          ["storefront", "Etalase toko"],
          ["products", "Kelola produk"],
          ["orders", "Terima pesanan"],
          ["media_bytes", "Unggah gambar"],
        ].map(([key, title]) => (
          <label className="check-label" key={key}>
            <input
              name={"allow_" + key}
              type="checkbox"
              defaultChecked={
                plan?.entitlements.find((e) => e.feature_code === key)
                  ?.allowed ?? true
              }
            />
            {title}
          </label>
        ))}
        <h3>Batas penggunaan</h3>
        {[
          ["products", "Jumlah produk"],
          ["orders", "Pesanan per bulan (periode UTC)"],
          ["media_bytes", "Unggahan gambar per bulan (MB)"],
        ].map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              name={key}
              aria-label={label}
              type="number"
              min={0}
              step={key === "media_bytes" ? 0.001 : 1}
              max={key === "media_bytes" ? 1000 : 1000000000}
              defaultValue={
                plan?.entitlements.find((e) => e.feature_code === key)
                  ?.limit_value != null
                  ? Number(
                      plan.entitlements.find((e) => e.feature_code === key)!
                        .limit_value,
                    ) / (key === "media_bytes" ? 1_000_000 : 1)
                  : ""
              }
            />
            <small>Kosongkan untuk tidak membatasi fitur.</small>
          </label>
        ))}
        <label>
          Status
          <select name="status" defaultValue={plan?.status || "active"}>
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
        <p className="admin-record-note">
          Matikan opsi ini untuk paket internal atau program khusus. Paket
          internal tetap dapat diberikan melalui Kelola toko.
        </p>
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
          {busy ? "Menyimpan…" : "Simpan paket"}
        </button>
      </form>
    </>
  );
}
function LeadEditor({
  lead: l,
  done,
  stores,
}: {
  lead: Lead;
  done: () => void;
  stores: Store[];
}) {
  const program = l.project_brief.startsWith("[PENGAJUAN PROGRAM UMKM");
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      if (busy) return;
      setBusy(true);
      setError("");
      await api("/api/admin/leads/" + l.id, "PUT", {
        store_id: f.get("store") || null,
        status: f.get("status"),
        source_ownership: f.get("ownership") || "pending",
        contract_terms: f.get("terms") || "",
        reusable_modules: f.get("modules") || "",
        quote_idr: !f.get("quote") ? null : Number(f.get("quote")),
        delivery_status: f.get("delivery") || "not_started",
      });
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
        ← Kembali ke pengajuan
      </button>
      <h2>{l.business_name}</h2>
      <p>
        {l.contact_name} · {l.contact_email} · {l.contact_phone}
      </p>
      <p className="pre-line">{l.project_brief}</p>
      <form className="live-form live-editor" onSubmit={save}>
        <label>
          {program ? "Status pengajuan" : "Tahap proyek"}
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
        {program ? (
          <>
            <label>
              Toko peserta
              <select name="store" defaultValue={l.store_id || ""}>
                <option value="">Belum membuat toko</option>
                {stores.map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.name} · {s.owner_email}
                  </option>
                ))}
              </select>
            </label>
            <p>
              Jika disetujui dan toko dipilih, akses UMKM enam bulan diberikan
              satu kali. Jika peserta belum membuat toko, simpan persetujuan
              lalu hubungkan tokonya saat sudah tersedia.
            </p>
          </>
        ) : (
          <>
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
                {["not_started", "in_progress", "review", "delivered"].map(
                  (s) => (
                    <option key={s} value={s}>
                      {label(s)}
                    </option>
                  ),
                )}
              </select>
            </label>
          </>
        )}
        {error && (
          <p className="live-error" role="alert">
            {error}
          </p>
        )}
        <button className="button button-dark" disabled={busy}>
          {busy ? "Menyimpan…" : program ? "Simpan pengajuan" : "Simpan proyek"}
        </button>
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
          <input type="hidden" name="trial" value={value.settings.trial_days} />
          <p>
            Akses percobaan diberikan secara khusus melalui Atur pilot atau
            program UMKM di halaman toko. Paket berbayar aktif setelah
            pembayaran diverifikasi.
          </p>
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
