import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { RequireAuth } from "./Auth";
import {
  api,
  useData,
  rupiah,
  label,
  type Plan,
  type Invoice,
  type Store,
} from "./api";
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
    [lead, setLead] = useState<Lead | null>(null);
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
  return (
    <div className="admin-page">
      <header className="live-admin-head">
        <Link className="brand" to="/">
          nalaro store
        </Link>
        <Link to="/app">Workspace merchant ↗</Link>
      </header>
      <main className="shell">
        <h1>Pengelolaan platform</h1>
        <p>
          Atur langganan SaaS, tagihan, toko, dan pengajuan program UMKM dari
          satu tempat.
        </p>
        <div className="work-tabbar">
          {[
            ["overview", "Toko & invoice"],
            ["plans", "Paket & harga"],
            ["policy", "Pengaturan billing"],
            ["leads", "Pengajuan masuk"],
            ["outbox", "Notifikasi"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={key === tab ? "active" : ""}
              onClick={() => {
                setTab(key);
                setEditing(false);
                setLead(null);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {(error || overview.error || plans.error || leads.error) && (
          <p className="live-error" role="alert">
            {error || overview.error || plans.error || leads.error}
          </p>
        )}
        {tab === "overview" && (
          <>
            <h2>Toko</h2>
            {overview.value?.stores.map((s) => (
              <div className="live-order-row" key={s.id}>
                <strong>{s.name}</strong>
                <span>{s.slug}</span>
                <span>{label(s.status)}</span>
                <button onClick={() => pilot(s.id)}>Atur masa pilot</button>
                <button onClick={() => approveUmkm(s.id)}>
                  Aktifkan UMKM 6 bulan
                </button>
                {s.pilot_until && (
                  <small>
                    Pilot sampai{" "}
                    {new Date(s.pilot_until).toLocaleDateString("id-ID")}
                  </small>
                )}
                <Link to={"/s/" + s.slug}>Lihat toko</Link>
                <button onClick={() => domain(s.id)}>
                  Verifikasi subdomain
                </button>
              </div>
            ))}
            <h2>Invoice langganan</h2>
            {overview.value?.invoices.map((i) => (
              <div className="live-order-row" key={i.id}>
                <strong>{i.invoice_number}</strong>
                <b>{rupiah(i.amount_idr)}</b>
                <span>{label(i.status)}</span>
                {["unpaid", "overdue"].includes(i.status) && (
                  <button
                    className="button button-dark"
                    onClick={() => verify(i.id)}
                  >
                    Verifikasi pembayaran
                  </button>
                )}
              </div>
            ))}
            <h2>Pengiriman email</h2>
            {overview.value?.outbox.map((o) => (
              <p key={o.status}>
                {o.status}: {o.count}
              </p>
            ))}
          </>
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
