import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import { Icon } from "../components/Icon";
import {
  api,
  label,
  rupiah,
  useData,
  type Plan,
  type Store,
  type Settings,
} from "./api";

type Subscription = {
  id: string;
  name: string;
  status: string;
  current_period_end: string;
  billing_mode: string;
};
export function AdminModal({
  title,
  children,
  close,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const closeRef = useRef(close),
    busyRef = useRef(busy);
  closeRef.current = close;
  busyRef.current = busy;
  useEffect(() => {
    ref.current?.focus();
  }, [title]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    function key(e: KeyboardEvent) {
      if (e.key === "Escape" && !busyRef.current) {
        e.preventDefault();
        closeRef.current();
      }
      if (e.key !== "Tab") return;
      const nodes = Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]",
        ) || [],
      );
      const first = nodes[0],
        last = nodes.at(-1);
      if (
        e.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === ref.current)
      ) {
        e.preventDefault();
        last?.focus();
      } else if (
        !e.shiftKey &&
        (document.activeElement === last ||
          document.activeElement === ref.current)
      ) {
        e.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  return (
    <div className="admin-dialog-backdrop">
      <section
        className="admin-dialog"
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="admin-dialog-head">
          <h2>{title}</h2>
          <button
            type="button"
            disabled={busy}
            onClick={close}
            aria-label="Tutup dialog"
          >
            <Icon name="close" />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
export function AdminStore({
  sid,
  plans,
  back,
  changed,
}: {
  sid: string;
  plans: Plan[];
  back: () => void;
  changed: () => void;
}) {
  const [rev, setRev] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [deletion, setDeletion] = useState<{
      step: 1 | 2 | 3;
      token?: string;
    } | null>(null),
    [typed, setTyped] = useState("");
  const data = useData<{
    store: Store & { owner_email: string };
    settings: Settings;
    domains: { hostname: string; verification_status: string }[];
    subscriptions: Subscription[];
    stats: { products: number; orders: number };
    activity: {
      action: string;
      created_at: string;
      metadata: { reason?: string };
    }[];
  }>(`/api/admin/stores/${sid}`, rev);
  function refresh() {
    setRev((r) => r + 1);
    changed();
  }
  async function mutate(endpoint: string, payload: unknown, method = "PUT") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api(`/api/admin/stores/${sid}/${endpoint}`, method, payload);
      refresh();
      setMessage("Perubahan tersimpan.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function assign(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await mutate("subscription", {
      plan_price_id: f.get("price"),
      duration_days: Number(f.get("days")),
      reason: f.get("reason"),
    });
  }
  async function confirmDelete(e: FormEvent) {
    e.preventDefault();
    if (!deletion || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<{ token?: string }>(
        `/api/admin/stores/${sid}/deletion`,
        "POST",
        deletion.step === 1
          ? { step: 1, confirmed: true }
          : deletion.step === 2
            ? { step: 2, token: deletion.token, store_name: typed }
            : { step: 3, token: deletion.token, irreversible: true },
      );
      if (deletion.step === 3) {
        setDeletion(null);
        changed();
        back();
      } else
        setDeletion({
          step: deletion.step === 1 ? 2 : 3,
          token: result.token || deletion.token,
        });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!data.value)
    return (
      <>
        <button className="back-link" onClick={back}>
          ← Kembali ke daftar toko
        </button>
        <p role={data.error ? "alert" : undefined}>
          {data.error || "Memuat detail toko…"}
        </p>
      </>
    );
  const { store, subscriptions, stats } = data.value;
  const current = subscriptions.find((s) =>
    ["active", "trial", "grace", "past_due"].includes(s.status),
  );
  return (
    <div className="admin-store-detail">
      <button className="back-link" onClick={back}>
        ← Kembali ke daftar toko
      </button>
      <section className="admin-panel admin-store-summary">
        <div className="admin-record-main">
          <div>
            <span className="admin-eyebrow">DETAIL TOKO</span>
            <h2>{store.name}</h2>
            <p>
              {store.slug} · {store.owner_email}
            </p>
          </div>
          <span className="admin-record-status">{label(store.status)}</span>
        </div>
        <div className="admin-store-stats">
          <span>
            <strong>{stats.products}</strong> produk
          </span>
          <span>
            <strong>{stats.orders}</strong> pesanan
          </span>
          <span>
            Paket: <strong>{current?.name || "Belum aktif"}</strong>
          </span>
        </div>
        {store.pilot_until && (
          <p>
            Akses pilot sampai{" "}
            {new Date(store.pilot_until).toLocaleDateString("id-ID")}
          </p>
        )}
        <div className="admin-record-actions">
          <Link className="admin-action-primary" to={`/preview/${sid}?adminStore=${sid}`}>
            <Icon name="eye" size={16} /> Pratinjau toko
          </Link>
          <Link
                  to={`/app?adminStore=${sid}`}
            onClick={() => localStorage.setItem("nalaro-selected-store", sid)}
          >
            <Icon name="edit" size={16} /> Kelola isi toko
          </Link>
          {store.status === "published" && (
            <Link
              to={`/s/${store.slug}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Buka etalase publik
            </Link>
          )}
        </div>
        {store.status !== "published" && (
          <p className="admin-record-note">
            Pratinjau dapat dibuka saat toko masih draft, dijeda, atau
            dinonaktifkan. Pembeli hanya dapat membuka etalase setelah toko
            diterbitkan dan aksesnya aktif.
          </p>
        )}
      </section>
      {(error || data.error) && !deletion && (
        <p className="live-error" role="alert">
          {error || data.error}
        </p>
      )}
      {message && (
        <p className="admin-success" role="status">
          {message}
        </p>
      )}
      <section className="admin-panel admin-store-summary">
        <h3>Paket & program internal</h3>
        <p>
          Tetapkan paket aktif, termasuk paket khusus yang tidak tampil di
          halaman harga. Penetapan ini langsung mengganti paket dan akses pilot
          lama, tanpa membuat tagihan otomatis.
        </p>
        <form className="live-form" onSubmit={assign}>
          <label>
            Paket yang diberikan
            <select required name="price" defaultValue="">
              <option value="" disabled>
                Pilih paket aktif
              </option>
              {plans
                .filter((p) => p.status === "active")
                .flatMap((p) =>
                  p.prices.map((pr) => (
                    <option value={pr.id} key={pr.id}>
                      {p.name} · {p.is_public ? "Publik" : "Internal"} ·{" "}
                      {rupiah(pr.amount_idr)} / {label(pr.billing_interval)}
                    </option>
                  )),
                )}
            </select>
          </label>
          <label>
            Masa akses (hari)
            <input
              required
              name="days"
              type="number"
              min={1}
              max={3660}
              defaultValue={30}
            />
          </label>
          <label>
            Alasan penetapan
            <textarea
              required
              name="reason"
              minLength={5}
              maxLength={1000}
              placeholder="Contoh: Program binaan Nalaro periode Oktober"
            />
          </label>
          <p className="admin-record-note">
            Setelah diganti, fitur dan batas paket baru langsung berlaku. Data
            dan pemakaian bulan berjalan tetap tercatat.
          </p>
          <button className="button button-dark" disabled={busy}>
            Terapkan paket pengganti
          </button>
        </form>
        {!plans.some((p) => p.status === "active") && (
          <p>
            Buat paket berstatus Aktif terlebih dahulu. Matikan opsi tampil di
            halaman paket untuk paket internal.
          </p>
        )}
      </section>
      <section className="admin-panel admin-store-summary">
        <h3>Status & akses toko</h3>
        <p>
          Menonaktifkan toko menutup etalase dan menghentikan perubahan oleh
          seller. Mengaktifkan kembali mengembalikan toko ke Draft untuk
          diperiksa sebelum terbit.
        </p>
        <form
          className="live-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void mutate("status", {
              status: store.status === "suspended" ? "draft" : "suspended",
              reason: f.get("reason"),
            });
          }}
        >
          <label>
            Alasan perubahan status
            <textarea name="reason" required minLength={5} maxLength={1000} />
          </label>
          <button className="button" disabled={busy}>
            {store.status === "suspended"
              ? "Aktifkan kembali sebagai Draft"
              : "Nonaktifkan toko"}
          </button>
        </form>
      </section>
      <section className="admin-panel admin-store-summary">
        <h3>Domain & riwayat paket</h3>
        {data.value.domains.map((d) => (
          <p key={d.hostname}>
            {d.hostname} · {label(d.verification_status)}
          </p>
        ))}
        {subscriptions.map((s) => (
          <p key={s.id}>
            <strong>{s.name}</strong> · {label(s.status)} · hingga{" "}
            {new Date(s.current_period_end).toLocaleDateString("id-ID")}
            {s.billing_mode === "internal" ? " · Program internal" : ""}
          </p>
        ))}
      </section>
      <section className="admin-panel admin-store-summary">
        <h3>Aktivitas terakhir</h3>
        {data.value.activity.map((a, i) => (
          <p key={i}>
            <strong>{label(a.action)}</strong> ·{" "}
            {new Date(a.created_at).toLocaleString("id-ID")}
            {a.metadata.reason && <span> · {a.metadata.reason}</span>}
          </p>
        ))}
      </section>
      <section className="admin-panel admin-store-summary admin-danger">
        <h3>Hapus toko permanen</h3>
        <p>
          Produk, pesanan, pengaturan, dan langganan toko akan dihapus. Data
          toko tidak bisa dipulihkan. Akun pemilik tetap tersedia.
        </p>
        <button
          className="button admin-danger-button"
          disabled={busy}
          onClick={() => {
            setError("");
            setTyped("");
            setDeletion({ step: 1 });
          }}
        >
          Hapus toko
        </button>
      </section>
      {deletion && (
        <AdminModal
          title={`Konfirmasi ${deletion.step} dari 3`}
          busy={busy}
          close={() => {
            setDeletion(null);
            setError("");
          }}
        >
          <form className="live-form" onSubmit={confirmDelete}>
            {deletion.step === 1 ? (
              <>
                <h3>Apakah Anda yakin?</h3>
                <p>
                  Anda akan menghapus toko <strong>{store.name}</strong> beserta
                  datanya.
                </p>
              </>
            ) : deletion.step === 2 ? (
              <label>
                Ketik nama toko persis: {store.name}
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  autoComplete="off"
                  required
                />
              </label>
            ) : (
              <>
                <h3>Data toko tidak bisa dipulihkan.</h3>
                <p>
                  Ini konfirmasi terakhir. Seluruh produk, pesanan, dan
                  langganan <strong>{store.name}</strong> akan dihapus permanen.
                </p>
              </>
            )}
            {error && (
              <p role="alert" className="live-error">
                {error}
              </p>
            )}
            <div className="admin-dialog-actions">
              <button
                type="button"
                onClick={() => {
                  setDeletion(null);
                  setError("");
                }}
                disabled={busy}
              >
                Batal
              </button>
              <button
                className={
                  deletion.step === 3
                    ? "admin-danger-button"
                    : "admin-dialog-submit"
                }
                disabled={busy || (deletion.step === 2 && typed !== store.name)}
              >
                {busy
                  ? "Memproses…"
                  : deletion.step === 3
                    ? "Ya, hapus permanen"
                    : "Lanjutkan"}
              </button>
            </div>
          </form>
        </AdminModal>
      )}
    </div>
  );
}
