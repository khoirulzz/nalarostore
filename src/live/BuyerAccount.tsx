import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../components/Icon";
import {
  onIdTokenChanged,
  signOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { auth, requireFirebase } from "../lib/firebase";
import { RequireAuth } from "./Auth";
import { api, useData, rupiah, label, type Order, type Item } from "./api";
import { Conversations } from "./Engagement";

export function useBuyerSession() {
  const [user, setUser] = useState<FirebaseUser | null>(
    auth?.currentUser || null,
  );
  useEffect(() => (auth ? onIdTokenChanged(auth, setUser) : undefined), []);
  return user;
}
type Address = {
  id: string;
  label: string;
  recipient_name: string;
  contact_phone: string;
  address: string;
  is_default: boolean;
};
export function CheckoutAccount({
  onAddress,
}: {
  onAddress: (address: Address) => void;
}) {
  const user = useBuyerSession();
  const addresses = useData<{ addresses: Address[] }>(
    user?.emailVerified ? "/api/customer/addresses" : null,
  );
  const accountURL = window.location.pathname.startsWith("/s/")
    ? "/account"
    : new URL(
        "/account",
        import.meta.env.VITE_APP_ORIGIN || "https://store.nalaro.digital",
      ).href;
  return (
    <section className="notice checkout-account">
      <strong>
        {user?.emailVerified
          ? `Belanja sebagai ${user.email}`
          : "Belanja lebih praktis dengan akun Nalaro"}
      </strong>
      <p>Login opsional. Kamu tetap bisa menyelesaikan pesanan sebagai tamu.</p>
      <a href={accountURL} target="_blank" rel="noreferrer">
        {user ? "Kelola akun dan alamat" : "Masuk / daftar akun umum"}
      </a>
      {user && !user.emailVerified && (
        <p>
          Verifikasi email untuk menyimpan pesanan ke akun, atau keluar agar
          dapat checkout sebagai tamu.
        </p>
      )}
      {user && (
        <button type="button" onClick={() => void signOut(requireFirebase())}>
          Lanjut sebagai tamu
        </button>
      )}
      {!!addresses.value?.addresses.length && (
        <label>
          Gunakan alamat tersimpan
          <select
            defaultValue=""
            onChange={(e) => {
              const a = addresses.value?.addresses.find(
                (a) => a.id === e.target.value,
              );
              if (a) onAddress(a);
            }}
          >
            <option value="">Pilih alamat</option>
            {addresses.value.addresses.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label} · {a.recipient_name}
              </option>
            ))}
          </select>
        </label>
      )}
    </section>
  );
}
export function BuyerAccount() {
  return (
    <RequireAuth buyer>
      <Account />
    </RequireAuth>
  );
}
function Account() {
  const user = useBuyerSession();
  const [tab, setTab] = useState("orders"),
    [revision, setRevision] = useState(0),
    [page, setPage] = useState(1),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [detail, setDetail] = useState("");
  const profile = useData<{
    profile: { full_name: string; contact_phone: string } | null;
  }>("/api/customer/profile", revision);
  const addresses = useData<{ addresses: Address[] }>(
    "/api/customer/addresses",
    revision,
  );
  const orders = useData<{
    orders: (Order & { store_name: string; store_slug: string })[];
    hasMore: boolean;
  }>("/api/customer/orders?page=" + page, revision);
  const order = useData<{
    order: Order & { store_name: string };
    items: Item[];
  }>(detail ? "/api/customer/orders/" + detail : null);
  async function mutate(path: string, method: string, payload?: unknown) {
    setBusy(true);
    setError("");
    try {
      await api(path, method, payload);
      setRevision((r) => r + 1);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function saveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await mutate("/api/customer/profile", "PUT", Object.fromEntries(f));
  }
  async function saveAddress(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      f = new FormData(form);
    if (
      await mutate("/api/customer/addresses", "POST", {
        ...Object.fromEntries(f),
        is_default: f.has("is_default"),
      })
    )
      form.reset();
  }
  async function claim(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await mutate("/api/customer/orders/claim", "POST", Object.fromEntries(f));
  }
  return (
    <div className="buyer-account workspace">
      <header className="workspace-topbar buyer-topbar">
        <Link to="/" className="buyer-back-home"><Icon name="arrow-left" size={19} /><span>Nalaro Store</span></Link>
        <strong>Akun pembeli</strong>
        <button type="button" className="buyer-signout" onClick={() => void signOut(requireFirebase())}><Icon name="logout" size={17} /> Keluar</button>
      </header>
      <main className="workspace-content buyer-content">
        <div className="buyer-hero">
          <span className="buyer-avatar" aria-hidden="true">{(user?.email || "B").charAt(0).toUpperCase()}</span>
          <div><small>AKUN NALARO</small><h1>Aktivitas belanjamu</h1><p>{user?.email}</p></div>
        </div>
        <nav className="buyer-tabs buyer-primary-tabs" aria-label="Menu akun">
          {([
            ["orders", "Pesanan", "bag"],
            ["chat", "Chat", "mail"],
            ["addresses", "Alamat", "map-pin"],
            ["profile", "Profil", "users"],
          ] as const).map(([key, name, icon]) => (
            <button type="button" key={key} aria-current={tab === key ? "page" : undefined}
              className={tab === key ? "active" : ""} onClick={() => setTab(key)}>
              <Icon name={icon} size={19} /><span>{name}</span>
            </button>
          ))}
        </nav>
        {error && (
          <p role="alert" className="live-error">
            {error}
          </p>
        )}
        {tab === "chat" ? (
          <Conversations />
        ) : tab === "orders" ? (
          <>
            <h2>Riwayat lintas toko</h2>
            {orders.error && <p role="alert">{orders.error}</p>}
            {orders.value?.orders.map((o) => (
              <article className="work-section buyer-order-card" key={o.id}>
                <header><span className="buyer-order-store"><Icon name="box" size={17} /> {o.store_name}</span>
                  <span className="buyer-order-number">{o.order_number}</span></header>
                <div className="buyer-order-summary">
                  <div><small>Total pesanan</small><strong>{rupiah(o.total_idr)}</strong></div>
                  <div className="buyer-order-status">
                    <span className={o.payment_status === "paid" ? "paid" : ""}>{label(o.payment_status)}</span>
                    <small>{label(o.fulfillment_status)}</small>
                  </div>
                </div>
                <footer>
                  <button type="button" className="buyer-primary-action" onClick={() => setDetail(o.id)}>Lihat rincian <Icon name="arrow-right" size={16} /></button>
                  <Link to={"/s/" + o.store_slug}>Kunjungi toko <Icon name="arrow-up-right" size={15} /></Link>
                </footer>
              </article>
            ))}
            {orders.value && !orders.value.orders.length && (
              <p>Belum ada pesanan yang tertaut ke akun ini.</p>
            )}
            <div className="buyer-pagination">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Sebelumnya
              </button>
              <span>Halaman {page}</span>
              <button
                disabled={!orders.value?.hasMore}
                onClick={() => setPage((p) => p + 1)}
              >
                Berikutnya
              </button>
            </div>
            {detail && (
              <section className="work-section buyer-order-detail">
                <button type="button" onClick={() => setDetail("")}><Icon name="close" size={16} /> Tutup rincian</button>
                {order.error && <p role="alert">{order.error}</p>}
                {order.value && (
                  <>
                    <h3>
                      {order.value.order.store_name} ·{" "}
                      {order.value.order.order_number}
                    </h3>
                    {order.value.items.map((i, index) => (
                      <p key={index}>
                        {i.name_snapshot} · {i.variant_snapshot} × {i.quantity}{" "}
                        — {rupiah(i.line_total_idr)}
                      </p>
                    ))}
                    <p>
                      Ongkir {rupiah(order.value.order.shipping_idr)} · Total{" "}
                      {rupiah(order.value.order.total_idr)}
                    </p>
                    <p>
                      {label(order.value.order.order_status)} ·{" "}
                      {label(order.value.order.fulfillment_status)}
                    </p>
                    {order.value.order.shipment_reference && (
                      <p>
                        Referensi pengiriman:{" "}
                        {order.value.order.shipment_reference}
                      </p>
                    )}
                  </>
                )}
              </section>
            )}
            <form className="work-section live-form buyer-account-form" onSubmit={claim}>
              <h3>Tautkan pesanan tamu</h3>
              <p>
                Gunakan slug toko dan token dari tautan pelacakan milikmu. Token
                hanya berlaku selama masa akses pelacakan.
              </p>
              <label>
                Slug toko
                <input
                  name="store_slug"
                  required
                  maxLength={48}
                  placeholder="nalaro-batik"
                />
              </label>
              <label>
                Token pelacakan
                <input
                  name="tracking_token"
                  required
                  pattern="[a-f0-9]{64}"
                  autoComplete="off"
                />
              </label>
              <button disabled={busy}>Tautkan pesanan</button>
            </form>
          </>
        ) : tab === "addresses" ? (
          <>
            <h2>Alamat tersimpan</h2>
            {addresses.error && <p role="alert">{addresses.error}</p>}
            {addresses.value?.addresses.map((a) => (
              <article className="work-section buyer-address-card" key={a.id}>
                <h3>
                  {a.label}
                  {a.is_default ? " · Utama" : ""}
                </h3>
                <p>
                  {a.recipient_name} · {a.contact_phone}
                </p>
                <p>{a.address}</p>
                <button
                  disabled={busy}
                  onClick={() =>
                    void mutate("/api/customer/addresses/" + a.id, "DELETE")
                  }
                >
                  Hapus alamat
                </button>
                {!a.is_default && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void mutate("/api/customer/addresses/" + a.id, "PUT", {
                        ...a,
                        is_default: true,
                      })
                    }
                  >
                    Jadikan utama
                  </button>
                )}
              </article>
            ))}
            <form className="work-section live-form buyer-account-form" onSubmit={saveAddress}>
              <h3>Tambah alamat</h3>
              <label>
                Label
                <input
                  name="label"
                  required
                  maxLength={50}
                  placeholder="Rumah"
                />
              </label>
              <label>
                Nama penerima
                <input
                  name="recipient_name"
                  required
                  minLength={2}
                  maxLength={120}
                />
              </label>
              <label>
                Telepon
                <input
                  name="contact_phone"
                  required
                  type="tel"
                  pattern="[+0-9 ()-]{8,25}"
                />
              </label>
              <label>
                Alamat lengkap
                <textarea
                  name="address"
                  required
                  minLength={12}
                  maxLength={2000}
                />
              </label>
              <label>
                <input type="checkbox" name="is_default" />
                Jadikan alamat utama
              </label>
              <button disabled={busy}>Simpan alamat</button>
            </form>
          </>
        ) : (
          <>
            {profile.error && <p role="alert">{profile.error}</p>}
            {profile.value && (
              <form className="work-section live-form buyer-account-form" onSubmit={saveProfile}>
                <h2>Profil pembeli</h2>
                <label>
                  Nama lengkap
                  <input
                    name="full_name"
                    required
                    minLength={2}
                    maxLength={120}
                    defaultValue={profile.value.profile?.full_name || ""}
                  />
                </label>
                <label>
                  Telepon
                  <input
                    name="contact_phone"
                    required
                    type="tel"
                    pattern="[+0-9 ()-]{8,25}"
                    defaultValue={profile.value.profile?.contact_phone || ""}
                  />
                </label>
                <button disabled={busy}>Simpan profil</button>
              </form>
            )}
          </>
        )}
      </main>
    </div>
  );
}
