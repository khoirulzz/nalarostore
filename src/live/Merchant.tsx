import { AdminModal } from "./AdminStore";
import { MediaImage } from "../components/MediaImage";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Icon, type IconName } from "../components/Icon";
import { RequireAuth, AccountSecurity } from "./Auth";
import { authorizationHeaders, requireFirebase } from "../lib/firebase";
import { signOut } from "firebase/auth";
import { Customers, Analytics, ExportButton } from "./Operations";
import { ResponsibleProfile, Conversations, Notifications } from "./Engagement";
import { SellerGuide } from "./SellerGuide";
import {
  api,
  APIError,
  adminContextHeaders,
  useData,
  rupiah,
  label,
  type Store,
  type Product,
  type Settings,
  type Order,
  type Item,
  type Variant,
  type Plan,
  type Invoice,
  type User,
} from "./api";
const menus: { key: string; label: string; icon: IconName }[] = [
  { key: "", label: "Ringkasan", icon: "home" },
  { key: "orders", label: "Pesanan", icon: "orders" },
  { key: "products", label: "Produk", icon: "box" },
  { key: "inventory", label: "Stok", icon: "chart" },
  { key: "customers", label: "Pelanggan", icon: "users" },
  { key: "chat", label: "Chat pelanggan", icon: "mail" },
  { key: "notifications", label: "Notifikasi", icon: "alert" },
  { key: "responsible", label: "Penanggung jawab", icon: "shield" },
  { key: "analytics", label: "Analitik", icon: "chart" },
  { key: "settings", label: "Tampilan & pengaturan", icon: "palette" },
  { key: "billing", label: "Langganan", icon: "credit-card" },
  { key: "account", label: "Keamanan akun", icon: "shield" },
];
function Notice({ error }: { error: string }) {
  return error ? (
    <p className="live-error" role="alert">
      {error}
      {/paket|[Ll]angganan|[Kk]uota/.test(error) && (
        <Link className="seller-upgrade-link" to="/app/billing">
          Lihat paket & upgrade <Icon name="arrow-right" size={15} />
        </Link>
      )}
    </p>
  ) : null;
}
export function Merchant() {
  return (
    <RequireAuth>
      <Workspace />
    </RequireAuth>
  );
}
function Workspace() {
  const [rev, setRev] = useState(0);
  const [guideReplay, setGuideReplay] = useState(0);
  const location = useLocation(),
    navigate = useNavigate();
  const adminStore = new URLSearchParams(location.search).get("adminStore");
  const contextQuery = adminStore
    ? "?adminStore=" + encodeURIComponent(adminStore)
    : "";
  const { value, error, loading } = useData<{ stores: Store[] }>(
    adminStore
      ? `/api/admin/workspace/stores/${adminStore}`
      : "/api/merchant/stores",
    rev,
  );
  const account = useData<{ user: User }>("/api/auth/me");
  const [selected, setSelected] = useState(""),
    [drawer, setDrawer] = useState(false);
  const requestedStore = new URLSearchParams(location.search).get("store");
  const chosenStore = requestedStore || selected;
  const sid = value?.stores.some((s) => s.id === chosenStore)
    ? chosenStore
    : value?.stores[0]?.id || "";
  const store = value?.stores.find((s) => s.id === sid);
  useEffect(() => {
    if (account.value?.user.id)
      setSelected(
        localStorage.getItem(
          "nalaro-selected-store:" + account.value.user.id,
        ) || "",
      );
  }, [account.value?.user.id]);
  useEffect(() => {
    if (
      !loading &&
      value &&
      !value.stores.length &&
      account.value?.user.admin &&
      !adminStore &&
      location.pathname !== "/app/new"
    )
      navigate("/admin", { replace: true });
  }, [loading, value, account.value, adminStore, navigate, location.pathname]);
  useEffect(() => {
    if (requestedStore && value?.stores.some((s) => s.id === requestedStore)) {
      setSelected(requestedStore);
      if (account.value?.user.id)
        localStorage.setItem(
          "nalaro-selected-store:" + account.value.user.id,
          requestedStore,
        );
    }
  }, [requestedStore, value, account.value?.user.id]);
  const section =
    location.pathname.slice("/app".length).split("/").filter(Boolean)[0] || "";
  useEffect(() => {
    if (!drawer) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawer(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [drawer]);
  function select(id: string) {
    setDrawer(false);
    setSelected(id);
    if (account.value?.user.id)
      localStorage.setItem(
        "nalaro-selected-store:" + account.value.user.id,
        id,
      );
    navigate("/app");
  }
  return (
    <div className="workspace">
      <aside className={`workspace-sidebar ${drawer ? "workspace-open" : ""}`}>
        <div className="workspace-sidebar-top">
          <div className="seller-drawer-header">
            <Link to="/" className="brand">
              <img src="/favicon-32x32.png" width={28} height={28} alt="" />
              nalaro store
            </Link>
            <button
              className="seller-drawer-close"
              type="button"
              onClick={() => setDrawer(false)}
              aria-label="Tutup menu"
            >
              <Icon name="close" size={20} />
            </button>
          </div>
          <label className="store-select">
            Toko aktif
            <select
              aria-label="Toko aktif"
              value={sid}
              onChange={(e) => select(e.target.value)}
            >
              {value?.stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <nav aria-label="Workspace">
          {menus.map((m) => (
            <Link
              key={m.key}
              className={section === m.key ? "active" : ""}
              onClick={() => setDrawer(false)}
              to={"/app" + (m.key ? "/" + m.key : "") + contextQuery}
            >
              <Icon name={m.icon} />
              {m.label}
            </Link>
          ))}
          <Link to="/app/new" onClick={() => setDrawer(false)}>
            <Icon name="plus" />
            Buat toko
          </Link>
          {account.value?.user.admin && (
            <Link to="/admin" onClick={() => setDrawer(false)}>
              <Icon name="shield" />
              Admin platform
            </Link>
          )}
        </nav>
        <button
          className="logout"
          onClick={() =>
            signOut(requireFirebase()).then(() => navigate("/login"))
          }
        >
          <Icon name="logout" size={18} />
          <span>Keluar dari akun</span>
        </button>
      </aside>
      <div className="workspace-main">
        <header className="workspace-topbar">
          <button type="button" onClick={() => setGuideReplay((r) => r + 1)}>
            Panduan
          </button>
          <button
            className="mobile-menu"
            onClick={() => setDrawer(true)}
            aria-label="Buka menu"
          >
            <Icon name="menu" />
          </button>
          <span
            className="workspace-current-store"
            title={store?.name || "Workspace"}
          >
            {store?.name || "Workspace"}
          </span>
          {store && (
            <Link
              to={"/preview/" + store.id}
              target="_blank"
              className="work-view-store"
            >
              Pratinjau toko <Icon name="arrow-up-right" size={16} />
            </Link>
          )}
        </header>
        <main className="workspace-content">
          {adminStore && account.value?.user.admin && store && (
            <div className="admin-workspace-banner">
              <span>
                Mode admin · {store.name} · Pemilik {store.owner_email}. Akses
                ini dicatat.
              </span>
              <Link to={`/admin?tab=overview&store=${sid}`}>
                Kembali ke detail admin <Icon name="arrow-right" size={15} />
              </Link>
            </div>
          )}
          {store?.status === "suspended" && (
            <p className="live-error" role="alert">
              Toko dinonaktifkan admin. Hubungi pengelola platform untuk
              mengaktifkannya kembali.
            </p>
          )}
          <Notice error={error} />
          {(loading && !value) || account.loading ? (
            <p aria-busy="true">Memuat toko…</p>
          ) : section === "new" || !sid ? (
            <NewStore
              onCreated={(id) => {
                setSelected(id);
                if (account.value?.user.id)
                  localStorage.setItem(
                    "nalaro-selected-store:" + account.value.user.id,
                    id,
                  );
                setRev((r) => r + 1);
                navigate("/app");
              }}
            />
          ) : (
            <div key={(account.value?.user.id || "") + ":" + sid}>
              {section === "account" ? (
                <AccountSecurity />
              ) : section === "chat" ? (
                <Conversations sid={sid} />
              ) : section === "notifications" ? (
                <Notifications sid={sid} />
              ) : section === "responsible" ? (
                <ResponsibleProfile sid={sid} />
              ) : section === "customers" ? (
                <Customers sid={sid} />
              ) : section === "analytics" ? (
                <Analytics sid={sid} />
              ) : section === "products" ? (
                <Products sid={sid} />
              ) : section === "orders" ? (
                <Orders sid={sid} />
              ) : section === "settings" || section === "design" ? (
                <StoreSettings
                  sid={sid}
                  store={store!}
                  refresh={() => setRev((r) => r + 1)}
                />
              ) : section === "billing" ? (
                <Billing sid={sid} />
              ) : section === "inventory" ? (
                <Inventory sid={sid} />
              ) : (
                <Overview sid={sid} store={store!} />
              )}
            </div>
          )}
        </main>
      </div>
      <nav className="workspace-bottom-nav" aria-label="Navigasi mobile">
        {menus.slice(0, 3).map((m) => (
          <Link
            key={m.key}
            to={"/app" + (m.key ? "/" + m.key : "") + contextQuery}
            className={section === m.key ? "active" : ""}
            aria-current={section === m.key ? "page" : undefined}
          >
            <Icon name={m.icon} />
            <span>{m.label}</span>
          </Link>
        ))}
        <button
          className={
            drawer || !menus.slice(0, 3).some((m) => m.key === section)
              ? "active"
              : ""
          }
          aria-expanded={drawer}
          aria-label="Buka navigasi lainnya"
          onClick={() => setDrawer(!drawer)}
        >
          <Icon name="menu" />
          <span>Lainnya</span>
        </button>
      </nav>
      {drawer && (
        <button
          className="workspace-overlay"
          aria-label="Tutup menu"
          onClick={() => setDrawer(false)}
        />
      )}
      {store && account.value?.user.id && !adminStore && (
        <SellerGuide userId={account.value.user.id} replay={guideReplay} />
      )}
    </div>
  );
}
function storeSlug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
}
const validStoreSlug = (value: string) =>
  /^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/.test(value);

function NewStore({ onCreated }: { onCreated: (id: string) => void }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [name, setName] = useState(""),
    [slug, setSlug] = useState(""),
    [manual, setManual] = useState(false),
    [available, setAvailable] = useState<boolean | null>(null);
  const slugValid = validStoreSlug(slug);
  useEffect(() => {
    setAvailable(null);
    if (!validStoreSlug(slug)) return;
    let active = true;
    const timer = setTimeout(() => {
      void api<{ available: boolean }>(
        "/api/merchant/slug?slug=" + encodeURIComponent(slug),
      )
        .then((r) => {
          if (active) setAvailable(r.available);
        })
        .catch(() => {});
    }, 400);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [slug]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!slugValid) {
      setError(
        "Link toko perlu 3–48 karakter, dimulai dan diakhiri huruf atau angka.",
      );
      return;
    }
    if (available === false) {
      setError("Link toko sudah digunakan. Silakan pilih yang lain.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const created = await api<{ id: string }>(
        "/api/merchant/stores",
        "POST",
        {
          name: name.trim(),
          slug,
        },
      );
      onCreated(created.id);
    } catch (e) {
      const message = (e as Error).message || "";
      setError(
        /slug.*(pattern|invalid|string)|invalid.*slug/i.test(message)
          ? "Link toko tidak valid. Gunakan huruf kecil, angka, atau tanda hubung."
          : message,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="live-editor new-store-setup">
      <div className="new-store-heading">
        <span className="new-store-eyebrow">
          LANGKAH PERTAMA · IDENTITAS TOKO
        </span>
        <h1>Buat toko pertamamu.</h1>
        <p>
          Tentukan nama dan link toko yang mudah diingat. Setelah dibuat, kamu
          bisa melengkapi alamat fisik, produk, pembayaran, serta tampilan toko
          di pengaturan.
        </p>
      </div>
      <form onSubmit={submit} className="live-form new-store-form">
        <label>
          Nama toko
          <input
            name="name"
            required
            minLength={2}
            maxLength={120}
            placeholder="Contoh: Nalaro Batik"
            autoComplete="organization"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
              if (!manual) setSlug(storeSlug(e.target.value));
            }}
          />
          <small>Nama yang akan tampil pada halaman toko dan katalog.</small>
        </label>
        <label>
          Link toko
          <input
            name="slug"
            required
            minLength={3}
            maxLength={48}
            pattern="[a-z0-9][a-z0-9-]{1,46}[a-z0-9]"
            title="Gunakan 3–48 huruf kecil, angka, atau tanda hubung."
            inputMode="url"
            spellCheck={false}
            autoCapitalize="none"
            autoComplete="off"
            placeholder="contoh: nalaro-batik"
            value={slug}
            onChange={(e) => {
              setManual(true);
              setError("");
              setSlug(storeSlug(e.target.value));
            }}
          />
          <small>
            Ini alamat web toko, bukan alamat lokasi toko. Spasi otomatis diubah
            menjadi tanda hubung.
          </small>
        </label>
        <div className="new-store-preview" aria-live="polite">
          <span>Link tokomu nanti</span>
          <strong>store.nalaro.digital/s/{slug || "nama-toko"}</strong>
          {slug.length > 0 && !slugValid ? (
            <small>
              Gunakan minimal 3 karakter dan akhiri dengan huruf atau angka.
            </small>
          ) : available !== null ? (
            <small
              className={
                available ? "new-store-available" : "new-store-unavailable"
              }
            >
              {available
                ? "✓ Link tersedia"
                : "Link sudah digunakan. Coba yang lain."}
            </small>
          ) : slugValid ? (
            <small>Memeriksa ketersediaan link…</small>
          ) : null}
        </div>
        <Notice error={error} />
        <button
          className="button button-dark new-store-submit"
          disabled={
            busy || !slugValid || available === false || name.trim().length < 2
          }
        >
          {busy ? "Membuat toko…" : "Buat toko"}{" "}
          <Icon name="arrow-right" size={18} />
        </button>
      </form>
    </div>
  );
}
function Overview({ sid, store }: { sid: string; store: Store }) {
  const { value, error, loading } = useData<{
    summary: { orders: number; revenue: number; pending: number };
    lowStock: { name: string; option_label: string; available_stock: number }[];
  }>(`/api/merchant/stores/${sid}/overview`);
  const preparation = useData<{ products: Product[] }>(
    `/api/merchant/stores/${sid}/products`,
  );
  const configuration = useData<{ settings: Settings }>(
    `/api/merchant/stores/${sid}/settings`,
  );
  const access = useData<{ accessAvailable: boolean }>(
    `/api/merchant/stores/${sid}/billing`,
  );
  const steps = [
    {
      name: "Tambahkan produk",
      description: "Isi foto, harga, varian, dan stok.",
      to: "/app/products",
      done: Boolean(
        preparation.value?.products.some(
          (p) =>
            p.status === "active" &&
            p.variants.some(
              (v) => Number(v.stock_qty) > Number(v.reserved_qty || 0),
            ),
        ),
      ),
    },
    {
      name: "Lengkapi toko",
      description: "Kontak, pembayaran, pengiriman, dan kebijakan toko.",
      to: "/app/settings",
      done: Boolean(
        configuration.value?.settings.contact_phone &&
        (configuration.value.settings.bank_details ||
          configuration.value.settings.qris_media_key) &&
        configuration.value.settings.policies.length >= 20 &&
        (configuration.value.settings.delivery_enabled ||
          (configuration.value.settings.pickup_enabled &&
            configuration.value.settings.pickup_address)),
      ),
    },
    {
      name: "Aktifkan paket",
      description: "Pilih paket atau gunakan akses yang disetujui admin.",
      to: "/app/billing",
      done: access.value?.accessAvailable === true,
    },
    {
      name: "Terbitkan toko",
      description: "Periksa pratinjau, lalu buka toko untuk pembeli.",
      to: "/app/settings",
      done: store.status === "published",
    },
  ];
  return (
    <>
      <div className="workspace-heading">
        <div>
          <h1>Ringkasan toko</h1>
          <p>
            {store.status === "published"
              ? "Toko menerima pesanan."
              : "Toko belum menerima pesanan."}{" "}
            Data 30 hari terakhir.
          </p>
        </div>
        <Link className="button button-dark" to="/app/settings">
          Atur toko
        </Link>
      </div>
      <Notice error={error} />
      {store.status !== "published" && (
        <section className="seller-setup-panel">
          <div>
            <span className="admin-eyebrow">PERSIAPAN TOKO</span>
            <h2>Siapkan toko, lalu mulai berjualan.</h2>
            <p>
              {steps.filter((s) => s.done).length} dari 4 langkah selesai.
              Produk dan pengaturan dapat disiapkan sebelum membeli paket.
            </p>
          </div>
          <ol>
            {steps.map((step, i) => (
              <li key={step.name} className={step.done ? "is-complete" : ""}>
                <Link to={step.to}>
                  <span className="seller-step-number">
                    {step.done ? <Icon name="check" size={16} /> : i + 1}
                  </span>
                  <span>
                    <strong>{step.name}</strong>
                    <small>{step.description}</small>
                  </span>
                  <Icon name="arrow-right" size={16} />
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}
      {loading ? (
        <p>Memuat ringkasan…</p>
      ) : (
        value && (
          <>
            <section className="work-priorities">
              <div className="work-priority-title">
                <Icon name="alert" />
                <span>Perlu perhatian</span>
              </div>
              <div className="priority-columns">
                <Link to="/app/orders">
                  <strong>{value.summary.pending}</strong>
                  <span>Pesanan menunggu konfirmasi</span>
                </Link>
                <Link to="/app/products">
                  <strong>{value.lowStock.length}</strong>
                  <span>Varian stok rendah</span>
                </Link>
              </div>
            </section>
            <div className="work-numbers">
              <div>
                <span>Penjualan terverifikasi</span>
                <strong>{rupiah(value.summary.revenue)}</strong>
              </div>
              <div>
                <span>Pesanan masuk</span>
                <strong>{value.summary.orders}</strong>
              </div>
            </div>
            <section className="work-section seller-stock-panel">
              <div className="seller-panel-heading">
                <Icon name="box" size={19} />
                <h2>Stok perlu diperhatikan</h2>
                <Link to="/app/inventory">
                  Lihat stok <Icon name="arrow-up-right" size={15} />
                </Link>
              </div>
              {value.lowStock.length ? (
                <div className="seller-stock-items">
                  {value.lowStock.map((v, i) => (
                    <div className="seller-stock-row" key={i}>
                      <span>
                        {v.name} · {v.option_label}
                      </span>
                      <strong>{v.available_stock} tersedia</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="seller-stock-okay">
                  <Icon name="check" size={18} />
                  <div>
                    <strong>Stok toko dalam kondisi aman.</strong>
                    <p>Belum ada varian yang melewati batas stok minimum.</p>
                  </div>
                </div>
              )}
            </section>
          </>
        )
      )}
    </>
  );
}
function Products({ sid }: { sid: string }) {
  const [rev, setRev] = useState(0),
    [editing, setEditing] = useState<Product | null | false>(false),
    [q, setQ] = useState("");
  const { value, error } = useData<{ products: Product[] }>(
    `/api/merchant/stores/${sid}/products`,
    rev,
  );
  const filteredProducts =
    value?.products.filter((p) =>
      p.name.toLowerCase().includes(q.toLowerCase().trim()),
    ) || [];
  if (editing !== false)
    return (
      <ProductEditor
        sid={sid}
        product={editing}
        done={() => {
          setEditing(false);
          setRev((r) => r + 1);
        }}
      />
    );
  return (
    <>
      <div className="workspace-heading">
        <div>
          <h1>Produk</h1>
          <p>Katalog dan stok varian.</p>
        </div>
        <div className="seller-heading-actions">
          <ExportButton sid={sid} resource="products" />
          <button
            className="button button-dark"
            onClick={() => setEditing(null)}
          >
            <Icon name="plus" size={17} /> Tambah produk
          </button>
        </div>
      </div>
      <Notice error={error} />
      <label className="seller-search">
        <span>Cari produk</span>
        <span className="seller-search-control">
          <Icon name="search" size={19} />
          <input
            type="search"
            aria-label="Cari produk"
            placeholder="Cari nama produk..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </span>
      </label>
      <div className="work-product-list seller-product-list">
        {filteredProducts.map((p) => (
          <article key={p.id}>
            {p.primary_image_url ? (
              <MediaImage src={p.primary_image_url} alt="" />
            ) : (
              <span className="media-placeholder">
                <Icon name="box" />
              </span>
            )}
            <div>
              <h3>{p.name}</h3>
              <p>
                {p.category} · {label(p.status)}
              </p>
            </div>
            <strong>{rupiah(p.price_idr)}</strong>
            <span className="product-stock">
              {p.variants.reduce(
                (a, v) =>
                  a + (v.status === "active" ? Number(v.available_stock) : 0),
                0,
              )}{" "}
              tersedia
            </span>
            <button aria-label={"Edit " + p.name} onClick={() => setEditing(p)}>
              <Icon name="edit" />
            </button>
          </article>
        ))}
      </div>
      {value && !filteredProducts.length && (
        <div className="seller-empty" role="status">
          <span className="seller-empty-icon">
            <Icon name="box" size={25} />
          </span>
          <h2>{q ? "Produk tidak ditemukan" : "Katalog masih kosong"}</h2>
          <p>
            {q
              ? "Coba kata pencarian lain."
              : "Tambahkan produk pertama agar pelanggan bisa mulai mengenal tokomu."}
          </p>
          {q ? (
            <button className="seller-text-action" onClick={() => setQ("")}>
              Hapus pencarian
            </button>
          ) : (
            <button
              className="seller-inline-button"
              onClick={() => setEditing(null)}
            >
              <Icon name="plus" size={16} /> Isi katalog pertama
            </button>
          )}
        </div>
      )}
    </>
  );
}
const defaultVariant: Variant = {
  sku: "",
  option_label: "Default",
  price_override_idr: null,
  stock_qty: 0,
  status: "active",
};
function ProductEditor({
  sid,
  product,
  done,
}: {
  sid: string;
  product: Product | null;
  done: () => void;
}) {
  const [variants, setVariants] = useState<Variant[]>(
      product?.variants || [{ ...defaultVariant }],
    ),
    [image, setImage] = useState(product?.primary_image_url || ""),
    [gallery, setGallery] = useState(product?.gallery || []),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  function change(
    i: number,
    key: keyof Variant,
    value: string | number | null,
  ) {
    setVariants((v) => v.map((x, j) => (j === i ? { ...x, [key]: value } : x)));
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (gallery.some((photo) => !photo.url.trim())) {
      setError(
        "Masih ada foto galeri tanpa link. Lengkapi atau hapus foto kosong terlebih dahulu.",
      );
      return;
    }
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api(
        `/api/merchant/stores/${sid}/products${product ? "/" + product.id : ""}`,
        product ? "PUT" : "POST",
        {
          slug: f.get("slug"),
          name: f.get("name"),
          description: f.get("description"),
          price_idr: Number(f.get("price")),
          category: f.get("category"),
          primary_image_url: image || null,
          gallery,
          status: f.get("status"),
          variants: variants.map((v) => ({
            ...v,
            price_override_idr:
              v.price_override_idr === null
                ? null
                : Number(v.price_override_idr),
          })),
        },
      );
      done();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function uploadMedia(file: File): Promise<string> {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/merchant/stores/${sid}/media`, {
        method: "POST",
        headers: {
          "content-type": file.type,
          ...(await authorizationHeaders()),
          ...adminContextHeaders(`/api/merchant/stores/${sid}/media`),
        },
        body: file,
      });
      const result = (await response.json()) as {
        error?: string;
        url?: string;
      };
      if (!response.ok || !result.url) {
        throw Error(result.error || "Foto belum berhasil diunggah. Coba lagi.");
      }
      return result.url;
    } finally {
      setBusy(false);
    }
  }
  async function upload(
    file?: File,
    target: "main" | "gallery" = "main",
    variantIndex?: number,
  ) {
    if (!file || busy) return;
    try {
      const url = await uploadMedia(file);
      if (variantIndex !== undefined) change(variantIndex, "image_url", url);
      else if (target === "gallery")
        setGallery((previous) => [...previous, { url, alt: "" }]);
      else setImage(url);
    } catch (error) {
      setError((error as Error).message);
    }
  }
  return (
    <div className="seller-product-editor">
      <div className="seller-editor-heading">
        <button type="button" className="seller-editor-back" onClick={done}>
          <Icon name="arrow-left" size={17} /> <span>Kembali ke produk</span>
        </button>
        <h1>{product ? "Edit produk" : "Tambah produk"}</h1>
        <p>
          Lengkapi informasi, foto, dan stok agar produk siap ditampilkan di
          tokomu.
        </p>
      </div>
      <form
        className="live-form live-editor seller-editor-form"
        onSubmit={save}
      >
        <section className="seller-editor-section seller-editor-basics">
          <header className="seller-editor-section-head">
            <div>
              <Icon name="file" size={19} />
              <h2>Informasi produk</h2>
            </div>
          </header>
          <div className="form-two">
            <label>
              Nama produk
              <input
                required
                name="name"
                defaultValue={product?.name}
                maxLength={160}
              />
            </label>
            <label>
              Link produk
              <input
                required
                name="slug"
                defaultValue={product?.slug}
                placeholder="misal: batik-kawung"
                pattern="[a-z0-9][a-z0-9-]{1,46}[a-z0-9]"
                onChange={(event) => {
                  event.currentTarget.value = storeSlug(
                    event.currentTarget.value,
                  );
                }}
              />
              <small>
                Bagian dari alamat web produkmu. Spasi otomatis menjadi tanda
                hubung.
              </small>
            </label>
          </div>
          <label>
            Deskripsi
            <textarea
              name="description"
              rows={5}
              defaultValue={product?.description}
            />
          </label>
          <div className="form-two">
            <label>
              Harga (Rp)
              <input
                required
                name="price"
                type="number"
                min={0}
                max={1000000000}
                defaultValue={product?.price_idr || 0}
              />
            </label>
            <label>
              Kategori
              <input
                required
                name="category"
                defaultValue={product?.category || "Produk"}
              />
            </label>
          </div>
        </section>
        <section className="seller-editor-section seller-main-photo-section">
          <header className="seller-editor-section-head">
            <div>
              <Icon name="upload" size={19} />
              <h2>Foto utama</h2>
            </div>
          </header>
          <p className="seller-editor-section-help">
            Pilih foto terbaik untuk tampilan pertama produkmu.
          </p>
          <label className="seller-file-picker">
            <Icon name="upload" size={19} />
            <span className="seller-picker-copy">
              <strong>{busy ? "Mengunggah foto…" : "Unggah foto utama"}</strong>
              <small>JPG, PNG atau WebP dari perangkatmu</small>
            </span>
            <Icon name="plus" size={17} />
            <input
              type="file"
              aria-label="Unggah foto utama"
              accept="image/png,image/jpeg,image/webp"
              disabled={busy}
              onChange={(e) => {
                const file = e.currentTarget.files?.[0];
                e.currentTarget.value = "";
                void upload(file);
              }}
            />
          </label>
          <label>
            Link foto produk (opsional)
            <input
              value={image}
              onChange={(e) => setImage(e.target.value)}
              placeholder="https://..."
            />
            <small>Unggah foto dari perangkat atau gunakan link gambar.</small>
          </label>
          {image && (
            <MediaImage
              className="editor-photo"
              src={image}
              alt="Pratinjau produk"
            />
          )}
        </section>
        <section className="seller-editor-section seller-gallery-section">
          <header className="seller-editor-section-head">
            <div>
              <Icon name="grid" size={19} />
              <h2>Galeri produk</h2>
            </div>
            <span>{gallery.length}/12</span>
          </header>
          <p className="seller-editor-section-help">
            Tampilkan sisi lain produkmu. Kamu bisa mengunggah foto atau
            memasukkan link gambar.
          </p>
          {gallery.length === 0 && (
            <div className="seller-gallery-empty">
              <Icon name="grid" size={22} />
              <span>
                Belum ada foto tambahan. Galeri akan membantu pelanggan melihat
                detail produk.
              </span>
            </div>
          )}
          <div className="seller-gallery-list">
            {gallery.map((galleryPhoto, index) => (
              <div className="seller-gallery-item" key={index}>
                {galleryPhoto.url ? (
                  <MediaImage
                    src={galleryPhoto.url}
                    alt={galleryPhoto.alt || `Foto galeri ${index + 1}`}
                    className="seller-gallery-thumbnail"
                  />
                ) : (
                  <div className="seller-gallery-thumbnail seller-gallery-placeholder">
                    <Icon name="bag" size={22} />
                  </div>
                )}
                <div className="seller-gallery-fields">
                  <label>
                    Link foto {index + 1}
                    <input
                      value={galleryPhoto.url}
                      placeholder="https://..."
                      onChange={(event) =>
                        setGallery((previous) =>
                          previous.map((photo, current) =>
                            current === index
                              ? { ...photo, url: event.target.value }
                              : photo,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    Keterangan foto (opsional)
                    <input
                      value={galleryPhoto.alt}
                      placeholder="Contoh: Tampilan bagian belakang"
                      onChange={(event) =>
                        setGallery((previous) =>
                          previous.map((photo, current) =>
                            current === index
                              ? { ...photo, alt: event.target.value }
                              : photo,
                          ),
                        )
                      }
                    />
                  </label>
                </div>
                <button
                  type="button"
                  className="seller-editor-remove"
                  aria-label={`Hapus foto galeri ${index + 1}`}
                  disabled={busy}
                  onClick={() =>
                    setGallery((previous) =>
                      previous.filter((_, current) => current !== index),
                    )
                  }
                >
                  <Icon name="close" size={16} /> Hapus foto
                </button>
              </div>
            ))}
          </div>
          <div className="seller-gallery-actions">
            <label className="seller-file-picker seller-gallery-picker">
              <Icon name="upload" size={19} />
              <span className="seller-picker-copy">
                <strong>
                  {busy ? "Mengunggah foto…" : "Unggah foto galeri"}
                </strong>
                <small>
                  {gallery.length >= 12
                    ? "Maksimal 12 foto tambahan"
                    : "Pilih gambar dari perangkat"}
                </small>
              </span>
              <Icon name="arrow-right" size={16} />
              <input
                type="file"
                aria-label="Unggah foto galeri"
                accept="image/png,image/jpeg,image/webp"
                disabled={busy || gallery.length >= 12}
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = "";
                  void upload(file, "gallery");
                }}
              />
            </label>
            <button
              type="button"
              className="seller-editor-add"
              disabled={busy || gallery.length >= 12}
              onClick={() =>
                setGallery((previous) => [...previous, { url: "", alt: "" }])
              }
            >
              <Icon name="plus" size={18} /> Tambah foto dari link
            </button>
          </div>
        </section>
        <section className="seller-editor-section seller-variants-section">
          <header className="seller-editor-section-head">
            <div>
              <Icon name="box" size={19} />
              <h2>Varian & stok</h2>
            </div>
            <span>{variants.length} pilihan</span>
          </header>
          <p className="seller-editor-section-help">
            Atur SKU, ukuran atau warna, serta jumlah stok setiap pilihan
            produk.
          </p>
          {variants.map((v, i) => (
            <div className="variant-row seller-variant-card" key={v.id || i}>
              <div className="seller-variant-title">
                <span>Varian {String(i + 1).padStart(2, "0")}</span>
                {variants.length > 1 && !v.id ? (
                  <button
                    type="button"
                    className="seller-remove-variant"
                    aria-label={`Hapus varian ${i + 1}`}
                    disabled={busy}
                    onClick={() =>
                      setVariants((previous) =>
                        previous.filter((_, current) => current !== i),
                      )
                    }
                  >
                    <Icon name="close" size={15} /> Hapus varian
                  </button>
                ) : (
                  <span className="seller-variant-meta">
                    {v.reserved_qty || 0} dalam pesanan
                  </span>
                )}
              </div>
              <label>
                SKU
                <input
                  required
                  value={v.sku}
                  onChange={(e) => change(i, "sku", e.target.value)}
                />
              </label>
              <label>
                Pilihan
                <input
                  required
                  value={v.option_label}
                  onChange={(e) => change(i, "option_label", e.target.value)}
                />
              </label>
              <label>
                Harga khusus (opsional)
                <input
                  type="number"
                  min={0}
                  value={v.price_override_idr ?? ""}
                  onChange={(e) =>
                    change(
                      i,
                      "price_override_idr",
                      e.target.value === "" ? null : Number(e.target.value),
                    )
                  }
                />
              </label>
              <div className="seller-variant-image-field">
                <label htmlFor={`variant-image-${i}`}>
                  Link foto khusus varian (opsional)
                </label>
                <input
                  id={`variant-image-${i}`}
                  value={v.image_url || ""}
                  placeholder="https://..."
                  onChange={(e) =>
                    change(i, "image_url", e.target.value || null)
                  }
                />
                <span className="seller-variant-photo-actions">
                  <label className="seller-variant-upload">
                    <Icon name="upload" size={15} />
                    <span>Unggah foto varian</span>
                    <input
                      type="file"
                      aria-label={`Unggah foto varian ${i + 1}`}
                      accept="image/png,image/jpeg,image/webp"
                      disabled={busy}
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0];
                        event.currentTarget.value = "";
                        void upload(file, "main", i);
                      }}
                    />
                  </label>
                </span>
              </div>
              <label>
                Stok total
                <input
                  required
                  type="number"
                  min={v.reserved_qty || 0}
                  value={v.stock_qty}
                  onChange={(e) =>
                    change(i, "stock_qty", Number(e.target.value))
                  }
                />
                <small>{v.reserved_qty || 0} dipesan</small>
              </label>
              <label>
                Status
                <select
                  value={v.status}
                  onChange={(e) => change(i, "status", e.target.value)}
                >
                  <option value="active">Aktif</option>
                  <option value="inactive">Nonaktif</option>
                </select>
              </label>
            </div>
          ))}
          <button
            type="button"
            className="seller-editor-add seller-add-variant"
            disabled={busy || variants.length >= 40}
            onClick={() =>
              setVariants((previous) => [...previous, { ...defaultVariant }])
            }
          >
            <Icon name="plus" size={18} /> Tambah varian
          </button>
        </section>
        <section className="seller-editor-section seller-product-visibility">
          <header className="seller-editor-section-head">
            <div>
              <Icon name="eye" size={19} />
              <h2>Publikasi</h2>
            </div>
          </header>
          <label>
            Status produk
            <select name="status" defaultValue={product?.status || "draft"}>
              <option value="draft">Draft</option>
              <option value="active">Terbitkan</option>
              <option value="archived">Arsipkan</option>
            </select>
            <small>Produk draft tidak akan ditampilkan kepada pelanggan.</small>
          </label>
        </section>
        <Notice error={error} />
        <div className="seller-editor-footer">
          <button className="button button-dark" disabled={busy}>
            <Icon name="check" size={18} />{" "}
            {busy ? "Menyimpan…" : "Simpan produk"}
          </button>
          <button
            type="button"
            className="seller-editor-cancel"
            onClick={done}
            disabled={busy}
          >
            Batal
          </button>
        </div>
      </form>
    </div>
  );
}
function Orders({ sid }: { sid: string }) {
  const [rev, setRev] = useState(0),
    [selected, setSelected] = useState(""),
    [filter, setFilter] = useState("all"),
    [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const query = new URLSearchParams({
    status: filter,
    q,
    page: String(page),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  });
  const { value, error, loading } = useData<{
    orders: Order[];
    hasMore: boolean;
  }>(`/api/merchant/stores/${sid}/orders?${query}`, rev);
  if (selected)
    return (
      <OrderDetail
        sid={sid}
        oid={selected}
        done={() => {
          setSelected("");
          setRev((r) => r + 1);
        }}
      />
    );
  return (
    <>
      <div className="workspace-heading seller-orders-heading">
        <div>
          <h1>Pesanan</h1>
          <p>Kelola pembayaran dan pengiriman dari satu tempat.</p>
        </div>
        <ExportButton sid={sid} resource="orders" />
      </div>
      <div className="live-filters seller-order-filters">
        <label className="seller-order-search">
          Cari pesanan
          <span className="seller-search-control">
            <Icon name="search" size={18} />
            <input
              type="search"
              aria-label="Cari nomor atau nama"
              placeholder="Nomor pesanan atau nama..."
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </span>
        </label>
        <label>
          Dari tanggal
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          Sampai tanggal
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
          />
        </label>
      </div>
      <Notice error={error} />
      <div
        className="work-tabbar seller-order-tabs"
        aria-label="Filter pesanan"
      >
        {[
          ["all", "Semua"],
          ["unpaid", "Belum dibayar"],
          ["paid", "Dibayar"],
          ["packing", "Dikemas"],
          ["shipped", "Dikirim"],
          ["pickup_ready", "Siap diambil"],
          ["completed", "Selesai"],
        ].map(([key, label]) => (
          <button
            key={key}
            className={filter === key ? "active" : ""}
            aria-pressed={filter === key}
            onClick={() => {
              setFilter(key);
              setPage(1);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="live-order-list seller-order-list">
        {value?.orders.map((order) => (
          <button
            key={order.id}
            className="seller-order-card"
            onClick={() => setSelected(order.id)}
          >
            <span className="seller-order-card-top">
              <strong>{order.order_number}</strong>
              <small>
                {new Date(order.created_at).toLocaleDateString("id-ID")}
              </small>
            </span>
            <span className="seller-order-card-body">
              <span>
                <span className="seller-order-customer">
                  {order.customer_name}
                </span>
                <span className="seller-order-status">
                  {label(order.payment_status)} ·{" "}
                  {label(order.fulfillment_status)}
                </span>
              </span>
              <span className="seller-order-total">
                {rupiah(order.total_idr)}{" "}
                <Icon name="chevron-right" size={16} />
              </span>
            </span>
          </button>
        ))}
      </div>
      {value && !loading && !value.orders.length && (
        <div className="seller-empty" role="status">
          <span className="seller-empty-icon">
            <Icon name="orders" size={25} />
          </span>
          <h2>
            {q || filter !== "all" || from || to
              ? "Pesanan tidak ditemukan"
              : "Belum ada pesanan"}
          </h2>
          <p>
            {q || filter !== "all" || from || to
              ? "Coba ubah pencarian atau filter pesanan."
              : "Pesanan pelanggan akan muncul di sini saat tokomu mulai berjualan."}
          </p>
          {(q || filter !== "all" || from || to) && (
            <button
              className="seller-text-action"
              onClick={() => {
                setQ("");
                setFilter("all");
                setFrom("");
                setTo("");
                setPage(1);
              }}
            >
              Hapus filter
            </button>
          )}
        </div>
      )}
      {(page > 1 || !!value?.hasMore) && (
        <nav className="seller-pagination" aria-label="Halaman pesanan">
          <button
            disabled={page === 1 || loading}
            onClick={() => setPage((p) => p - 1)}
          >
            <Icon name="chevron-left" size={17} /> Sebelumnya
          </button>
          <span>Halaman {page}</span>
          <button
            disabled={!value?.hasMore || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Berikutnya <Icon name="chevron-right" size={17} />
          </button>
        </nav>
      )}
    </>
  );
}
function OrderDetail({
  sid,
  oid,
  done,
}: {
  sid: string;
  oid: string;
  done: () => void;
}) {
  const [rev, setRev] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const data = useData<{
    order: Order;
    items: Item[];
    timeline: { action: string; created_at: string }[];
  }>(`/api/merchant/stores/${sid}/orders/${oid}`, rev);
  const o = data.value?.order;
  async function action(name: string, body: unknown) {
    setBusy(true);
    setError("");
    try {
      await api(
        `/api/merchant/stores/${sid}/orders/${oid}/${name}`,
        "POST",
        body,
      );
      setRev((r) => r + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const states =
    o?.shipping_method === "pickup"
      ? {
          unfulfilled: ["packing", "pickup_ready"],
          packing: ["pickup_ready"],
          pickup_ready: ["picked_up"],
        }
      : {
          unfulfilled: ["packing"],
          packing: ["shipped"],
          shipped: ["delivered"],
        };
  const next = o
    ? states[o.fulfillment_status as keyof typeof states] || []
    : [];
  return (
    <>
      <button className="back-link" onClick={done}>
        ← Kembali ke pesanan
      </button>
      <Notice error={data.error || error} />
      {o && (
        <>
          <h1>{o.order_number}</h1>
          <button className="button" onClick={() => window.print()}>
            Cetak ringkasan pesanan
          </button>
          <p>
            {label(o.order_status)} · {label(o.payment_status)} ·{" "}
            {label(o.fulfillment_status)}
          </p>
          <div className="live-detail-layout">
            <section className="work-section">
              <h2>Produk dipesan</h2>
              {data.value?.items.map((i, n) => (
                <p key={n}>
                  {i.name_snapshot} · {i.variant_snapshot} × {i.quantity}
                  <strong>{rupiah(i.line_total_idr)}</strong>
                </p>
              ))}
              <hr />
              <p>
                Subtotal <strong>{rupiah(o.subtotal_idr)}</strong>
              </p>
              <p>
                Pengiriman <strong>{rupiah(o.shipping_idr)}</strong>
              </p>
              <p>
                Total <strong>{rupiah(o.total_idr)}</strong>
              </p>
              <h2>Riwayat</h2>
              {data.value?.timeline.map((t, i) => (
                <p key={i}>
                  {label(t.action)}
                  <small>
                    {new Date(t.created_at).toLocaleString("id-ID")}
                  </small>
                </p>
              ))}
            </section>
            <section className="work-section">
              <h2>Pelanggan</h2>
              <p>
                {o.customer_name}
                <br />
                {o.contact_email}
                <br />
                {o.contact_phone}
              </p>
              <p>
                {o.shipping_method === "pickup"
                  ? "Ambil di toko"
                  : o.address_json.address}
              </p>
              {o.payment_status !== "paid" && o.order_status === "pending" && (
                <>
                  <button
                    className="button button-dark"
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Pembayaran sudah diperiksa pada rekening atau QRIS toko?",
                        )
                      )
                        action("payment", { decision: "verified" });
                    }}
                  >
                    Verifikasi pembayaran
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      action("payment", {
                        decision: "rejected",
                        note: "Bukti belum sesuai",
                      })
                    }
                  >
                    Pembayaran belum sesuai
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm("Batalkan pesanan dan lepaskan stok?"))
                        action("cancel", {});
                    }}
                  >
                    Batalkan pesanan
                  </button>
                </>
              )}
              {o.payment_status === "paid" &&
                next.map((status) => (
                  <button
                    className="button button-dark"
                    key={status}
                    disabled={busy}
                    onClick={() =>
                      action("fulfillment", {
                        status,
                        reference:
                          status === "shipped"
                            ? window.prompt("Nomor resi / referensi kirim") ||
                              ""
                            : "",
                      })
                    }
                  >
                    {
                      (
                        {
                          packing: "Mulai kemas",
                          shipped: "Tandai dikirim",
                          delivered: "Selesai dikirim",
                          pickup_ready: "Siap diambil",
                          picked_up: "Sudah diambil",
                        } as Record<string, string>
                      )[status]
                    }
                  </button>
                ))}
            </section>
          </div>
        </>
      )}
    </>
  );
}
function StoreSettings({
  sid,
  store,
  refresh,
}: {
  sid: string;
  store: Store;
  refresh: () => void;
}) {
  const navigate = useNavigate();
  const [qrisKey, setQrisKey] = useState<string | null | undefined>(undefined);
  const [rev, setRev] = useState(0),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const { value, error: loadError } = useData<{ settings: Settings }>(
    `/api/merchant/stores/${sid}/settings`,
    rev,
  );
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const c = { ...value?.settings };
    for (const key of [
      "contact_phone",
      "pickup_address",
      "bank_details",
      "policies",
      "accent",
      "hero_title",
      "opening_hours",
    ])
      Object.assign(c, { [key]: String(f.get(key) || "") });
    Object.assign(c, {
      shipping_fee_idr: Number(f.get("shipping_fee_idr")),
      pickup_enabled: f.has("pickup_enabled"),
      delivery_enabled: f.has("delivery_enabled"),
      hero_image_url: f.get("hero_image_url") || null,
      logo_url: f.get("logo_url") || null,
      qris_media_key:
        qrisKey === undefined ? value?.settings.qris_media_key : qrisKey,
      low_stock_threshold: Number(f.get("low_stock_threshold")),
    });
    try {
      Object.assign(c, {
        store_name: f.get("store_name"),
        store_description: f.get("store_description"),
      });
      await api(`/api/merchant/stores/${sid}/settings`, "PUT", c);
      refresh();
      setMessage("Pengaturan disimpan.");
      setRev((r) => r + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function uploadQRIS(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/merchant/stores/${sid}/media`, {
        method: "POST",
        headers: {
          "content-type": file.type,
          ...(await authorizationHeaders()),
          ...adminContextHeaders(`/api/merchant/stores/${sid}/media`),
        },
        body: file,
      });
      const result = (await response.json()) as { key: string; error?: string };
      if (!response.ok) throw Error(result.error || "Unggah QRIS gagal.");
      setQrisKey(result.key);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function activateDomain() {
    setBusy(true);
    try {
      const result = await api<{ hostname: string }>(
        `/api/merchant/stores/${sid}/domain/verify`,
        "POST",
        {},
      );
      setMessage("Subdomain siap: " + result.hostname);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function publish() {
    setBusy(true);
    try {
      await api(`/api/merchant/stores/${sid}/publish`, "POST", {
        publish: store.status !== "published",
      });
      refresh();
      setMessage("Status toko diperbarui.");
    } catch (e) {
      if (
        e instanceof APIError &&
        e.status === 423 &&
        !/dinonaktifkan/.test(e.message)
      )
        navigate("/app/billing?reason=publish");
      else setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="merchant-settings-page">
      <div className="workspace-heading">
        <div>
          <h1>Tampilan & pengaturan</h1>
          <p className="seller-status-line">
            <Icon name="info" size={15} /> Status toko:{" "}
            <strong>{label(store.status)}</strong>
          </p>
        </div>
        <button
          className="button button-dark"
          disabled={busy}
          onClick={publish}
        >
          <Icon
            name={store.status === "published" ? "close" : "check"}
            size={17}
          />
          {store.status === "published" ? "Jeda toko" : "Terbitkan toko"}
        </button>
      </div>
      <section className="work-section seller-settings-card seller-link-card">
        <div className="seller-card-title">
          <Icon name="globe" size={20} />
          <div>
            <h2>Link toko</h2>
            <p>Bagikan link ini agar pelanggan bisa melihat katalogmu.</p>
          </div>
        </div>
        <div className="seller-link-primary">
          <span>Link toko utama</span>
          <strong>store.nalaro.digital/s/{store.slug}</strong>
          <Link
            to={"/s/" + store.slug}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon name="external" size={16} /> Lihat toko
          </Link>
        </div>
        <details className="seller-domain-option">
          <summary>Gunakan alamat toko yang lebih singkat</summary>
          <p>
            Alamat alternatif:{" "}
            <strong>{store.slug}.store.nalaro.digital</strong>
          </p>
          <button
            type="button"
            className="seller-inline-button"
            disabled={busy}
            onClick={activateDomain}
          >
            <Icon name="globe" size={16} /> Periksa ketersediaan alamat
          </button>
        </details>
      </section>
      <Notice error={loadError || error} />
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {value && (
        <section className="work-section seller-settings-card seller-readiness-card">
          <div className="seller-card-title">
            <Icon name="check" size={20} />
            <div>
              <h2>Siapkan tokomu</h2>
              <p>Lengkapi beberapa hal sebelum mulai menerima pesanan.</p>
            </div>
          </div>
          <div className="seller-readiness-list">
            <Link to="/app/products" className="seller-readiness-item">
              <Icon name="box" size={19} />
              <span>Tambahkan produk dan stok</span>
              <Icon name="chevron-right" size={17} />
            </Link>
            <div className="seller-readiness-item">
              <Icon
                name={
                  value.settings.bank_details || value.settings.qris_media_key
                    ? "check"
                    : "credit-card"
                }
                size={19}
              />
              <span>
                {value.settings.bank_details || value.settings.qris_media_key
                  ? "Informasi pembayaran sudah diisi"
                  : "Lengkapi metode pembayaran"}
              </span>
            </div>
            <div className="seller-readiness-item">
              <Icon
                name={
                  value.settings.pickup_enabled ||
                  value.settings.delivery_enabled
                    ? "check"
                    : "truck"
                }
                size={19}
              />
              <span>
                {value.settings.pickup_enabled ||
                value.settings.delivery_enabled
                  ? "Metode pengiriman sudah dipilih"
                  : "Pilih metode pengiriman atau pengambilan"}
              </span>
            </div>
            <div className="seller-readiness-item">
              <Icon
                name={value.settings.policies ? "check" : "file"}
                size={19}
              />
              <span>
                {value.settings.policies
                  ? "Kebijakan toko sudah diisi"
                  : "Lengkapi kebijakan toko"}
              </span>
            </div>
            <div className="seller-readiness-item">
              <Icon
                name={value.settings.contact_phone ? "check" : "phone"}
                size={19}
              />
              <span>
                {value.settings.contact_phone
                  ? "Kontak toko sudah diisi"
                  : "Tambahkan nomor kontak toko"}
              </span>
            </div>
          </div>
          <div className="seller-card-actions">
            <Link
              className="seller-inline-button"
              to={"/preview/" + sid}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon name="eye" size={17} /> Pratinjau toko
            </Link>
            <Link className="seller-inline-button" to="/app/billing">
              <Icon name="credit-card" size={17} /> Lihat langganan
            </Link>
          </div>
        </section>
      )}
      {value && (
        <form
          className="live-form live-editor seller-settings-form"
          key={rev}
          onSubmit={save}
        >
          <h2>
            <Icon name="box" size={20} /> Identitas toko
          </h2>
          <label>
            Nama toko
            <input
              name="store_name"
              required
              minLength={2}
              maxLength={120}
              defaultValue={store.name}
            />
          </label>
          <label>
            Deskripsi toko
            <textarea
              name="store_description"
              rows={3}
              maxLength={10000}
              defaultValue={store.description}
            />
          </label>
          <label>
            Judul etalase
            <input name="hero_title" defaultValue={value.settings.hero_title} />
          </label>
          <label>
            Warna utama
            <input
              name="accent"
              type="color"
              defaultValue={value.settings.accent}
            />
          </label>
          <label>
            Link foto etalase
            <input
              name="hero_image_url"
              defaultValue={value.settings.hero_image_url || ""}
            />
          </label>
          <label>
            Link gambar logo
            <input
              name="logo_url"
              defaultValue={value.settings.logo_url || ""}
            />
          </label>
          <label>
            Nomor WhatsApp
            <input
              name="contact_phone"
              defaultValue={value.settings.contact_phone}
            />
          </label>
          <label>
            Jam operasional
            <input
              name="opening_hours"
              defaultValue={value.settings.opening_hours}
            />
          </label>
          <h2>
            <Icon name="truck" size={20} /> Pengiriman
          </h2>
          <label className="check-label">
            <input
              name="pickup_enabled"
              type="checkbox"
              defaultChecked={value.settings.pickup_enabled}
            />{" "}
            Ambil di toko
          </label>
          <label>
            Alamat pengambilan
            <textarea
              name="pickup_address"
              defaultValue={value.settings.pickup_address}
            />
          </label>
          <label className="check-label">
            <input
              name="delivery_enabled"
              type="checkbox"
              defaultChecked={value.settings.delivery_enabled}
            />{" "}
            Kurir toko dengan tarif tetap
          </label>
          <label>
            Ongkos pengiriman (Rp)
            <input
              type="number"
              min={0}
              name="shipping_fee_idr"
              defaultValue={value.settings.shipping_fee_idr}
            />
          </label>
          <h2>
            <Icon name="credit-card" size={20} /> Pembayaran
          </h2>
          <label>
            Rekening & instruksi transfer
            <textarea
              name="bank_details"
              defaultValue={value.settings.bank_details}
              placeholder="Bank, nomor rekening, nama pemilik"
            />
          </label>
          <label>
            Gambar QRIS toko (opsional)
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => uploadQRIS(e.target.files?.[0])}
            />
          </label>
          {(qrisKey === undefined
            ? value.settings.qris_media_key
            : qrisKey) && (
            <div>
              <MediaImage
                className="qris-image"
                src={
                  "/api/media/" +
                  (qrisKey === undefined
                    ? value.settings.qris_media_key
                    : qrisKey)
                }
                alt="QRIS toko"
              />
              <button
                type="button"
                className="seller-inline-button"
                onClick={() => setQrisKey(null)}
              >
                <Icon name="close" size={16} /> Hapus QRIS
              </button>
            </div>
          )}
          <label>
            Kebijakan toko
            <textarea
              name="policies"
              rows={5}
              defaultValue={value.settings.policies}
            />
          </label>
          <label>
            Ambang stok rendah
            <input
              name="low_stock_threshold"
              type="number"
              min={0}
              defaultValue={value.settings.low_stock_threshold}
            />
          </label>
          <button
            className="button button-dark seller-save-settings"
            disabled={busy}
          >
            <Icon name="check" size={18} /> Simpan pengaturan
          </button>
        </form>
      )}
    </div>
  );
}
function Inventory({ sid }: { sid: string }) {
  const { value, error } = useData<{
    movements: {
      id: string;
      name: string;
      option_label: string;
      kind: string;
      quantity_delta: number;
      created_at: string;
    }[];
  }>(`/api/merchant/stores/${sid}/inventory`);
  return (
    <>
      <h1>Riwayat stok</h1>
      <Notice error={error} />
      <p>Stok awal, penyesuaian, reservasi dan penjualan tercatat terpisah.</p>
      {value?.movements.map((m) => (
        <div className="live-order-row" key={m.id}>
          <strong>{m.name}</strong>
          <span>{m.option_label}</span>
          <span>{label(m.kind)}</span>
          <b>{m.quantity_delta}</b>
          <span>{new Date(m.created_at).toLocaleString("id-ID")}</span>
        </div>
      ))}
    </>
  );
}
function Billing({ sid }: { sid: string }) {
  const [rev, setRev] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [choice, setChoice] = useState<{
      id: string;
      name: string;
      amount: number;
      interval: string;
    } | null>(null);
  const location = useLocation();
  const data = useData<{
      paymentInstructions: string;
      accessAvailable: boolean;
      currentSubscriptionId: string | null;
      pilotUntil: string | null;
      entitlements: {
        feature_code: string;
        allowed: boolean;
        limit_value: number | null;
      }[];
      subscriptions: {
        id: string;
        name: string;
        status: string;
        current_period_end: string;
        billing_interval: string;
        plan_price_id: string;
        billing_mode: string;
      }[];
      invoices: Invoice[];
      usage: { feature_code: string; period_key: string; value: number }[];
    }>(`/api/merchant/stores/${sid}/billing`, rev),
    plans = useData<{ plans: Plan[] }>("/api/public/plans");
  const current = data.value?.subscriptions.find(
    (s) => s.id === data.value?.currentSubscriptionId,
  );
  const pending = data.value?.subscriptions.find((s) => s.status === "pending");
  async function choose(pid: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api(`/api/merchant/stores/${sid}/billing`, "POST", {
        plan_price_id: pid,
        confirm_replace: Boolean(current),
      });
      setChoice(null);
      setMessage(
        "Tagihan dibuat. Ikuti instruksi pembayaran di bawah. Paket aktif setelah pembayaran diverifikasi admin.",
      );
      setRev((r) => r + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="seller-billing-page">
      <div className="seller-page-intro">
        <h1>Langganan toko</h1>
        <p>
          Pilih paket untuk mengelola tokomu. Semua biaya layanan terlihat di
          sini.
        </p>
      </div>
      <Notice
        error={
          choice
            ? data.error || plans.error
            : error || data.error || plans.error
        }
      />
      {location.search.includes("reason=publish") && (
        <div className="seller-setup-callout">
          <strong>Aktifkan paket untuk menerbitkan toko.</strong>
          <p>
            Pengaturan tokomu sudah tersimpan. Pilih paket, selesaikan
            pembayaran, lalu kembali ke pengaturan untuk menerbitkan toko.
          </p>
          <Link to="/app/settings">Kembali ke pengaturan</Link>
        </div>
      )}
      {message && (
        <p className="admin-success" role="status">
          {message}
        </p>
      )}
      {pending && (
        <p className="seller-setup-callout" role="status">
          Menunggu pembayaran paket <strong>{pending.name}</strong>. Tagihan ada
          di bawah; pilihan ini belum mengganti paket aktif.
        </p>
      )}
      {data.value?.pilotUntil &&
        new Date(data.value.pilotUntil).getTime() > Date.now() && (
          <p className="seller-setup-callout">
            Akses pilot disetujui sampai{" "}
            {new Date(data.value.pilotUntil).toLocaleDateString("id-ID")}. Paket
            berbayar akan menggantikan akses ini setelah aktif.
          </p>
        )}
      <section className="seller-billing-panel">
        <div className="seller-card-title">
          <Icon name="credit-card" size={21} />
          <div>
            <h2>Langganan aktif</h2>
            <p>Informasi paket yang terhubung dengan tokomu.</p>
          </div>
        </div>
        {current ? (
          <div className="seller-subscription-list">
            {[current].map((subscription) => (
              <div key={subscription.id} className="seller-subscription-row">
                <div>
                  <strong>{subscription.name}</strong>
                  <span>
                    Berlaku hingga{" "}
                    {new Date(
                      subscription.current_period_end,
                    ).toLocaleDateString("id-ID")}
                  </span>
                </div>
                <span className="seller-subscription-state">
                  {label(subscription.status)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="seller-inline-empty">
            <Icon name="info" size={20} />
            <span>Belum ada paket langganan aktif.</span>
          </div>
        )}
      </section>
      <section className="seller-billing-panel">
        <div className="seller-card-title">
          <Icon name="box" size={21} />
          <div>
            <h2>Pilih paket</h2>
            <p>Sesuaikan dengan kebutuhan dan perkembangan tokomu.</p>
          </div>
        </div>
        {plans.value?.plans.length ? (
          <div className="seller-plans">
            {plans.value.plans.map((plan) => (
              <article key={plan.id} className="seller-plan">
                <h3>{plan.name}</h3>
                <p>{plan.description}</p>
                <ul className="seller-plan-features">
                  {plan.entitlements?.map((e) => (
                    <li key={e.feature_code}>
                      {label(e.feature_code)}:{" "}
                      {e.allowed
                        ? e.limit_value === null
                          ? "Tanpa batas"
                          : e.feature_code === "media_bytes"
                            ? `${Number(e.limit_value) / 1000000} MB / bulan`
                            : e.feature_code === "products"
                              ? `${e.limit_value} produk`
                              : `${e.limit_value} / bulan`
                        : "Tidak tersedia"}
                    </li>
                  ))}
                </ul>
                <div className="seller-plan-actions">
                  {plan.prices.map((price) => (
                    <button
                      key={price.id}
                      className="seller-plan-button"
                      disabled={
                        busy ||
                        !data.value ||
                        current?.plan_price_id === price.id ||
                        pending?.plan_price_id === price.id
                      }
                      onClick={() => {
                        setError("");
                        setChoice({
                          id: price.id!,
                          name: plan.name,
                          amount: Number(price.amount_idr),
                          interval: price.billing_interval,
                        });
                      }}
                    >
                      {current?.plan_price_id === price.id
                        ? "Paket saat ini · "
                        : pending?.plan_price_id === price.id
                          ? "Menunggu pembayaran · "
                          : ""}
                      {rupiah(price.amount_idr)} /{" "}
                      {price.billing_interval === "monthly" ? "bulan" : "tahun"}
                      <Icon name="arrow-right" size={16} />
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : plans.value ? (
          <div className="seller-inline-empty">
            <Icon name="clock" size={20} />
            <span>
              Paket langganan belum tersedia. Kamu tetap bisa menyiapkan tokomu.
            </span>
          </div>
        ) : (
          <p className="seller-loading" aria-busy="true">
            Memuat pilihan paket…
          </p>
        )}
      </section>
      <section className="seller-billing-panel">
        <div className="seller-card-title">
          <Icon name="file" size={21} />
          <div>
            <h2>Tagihan</h2>
            <p>Riwayat dan status pembayaran langganan.</p>
          </div>
        </div>
        {data.value?.invoices.length ? (
          <div className="seller-invoice-list">
            {data.value.invoices.map((invoice) => (
              <div className="seller-invoice-row" key={invoice.id}>
                <div>
                  <strong>{invoice.invoice_number}</strong>
                  <span>
                    {new Date(invoice.period_start).toLocaleDateString("id-ID")}
                  </span>
                </div>
                <div className="seller-invoice-meta">
                  <strong>{rupiah(invoice.amount_idr)}</strong>
                  <span>{label(invoice.status)}</span>
                </div>
              </div>
            ))}
            {data.value.paymentInstructions && (
              <div className="seller-payment-details">
                <strong>Informasi pembayaran</strong>
                <p className="pre-line">{data.value.paymentInstructions}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="seller-inline-empty">
            <Icon name="check" size={20} />
            <span>Belum ada tagihan untuk toko ini.</span>
          </div>
        )}
      </section>
      <section className="seller-billing-panel">
        <div className="seller-card-title">
          <Icon name="chart" size={21} />
          <div>
            <h2>Penggunaan fitur</h2>
            <p>Ringkasan pemakaian yang tercatat pada paketmu.</p>
          </div>
        </div>
        {data.value?.entitlements.length ? (
          <ul className="seller-plan-features">
            {data.value.entitlements.map((e) => (
              <li key={e.feature_code}>
                {label(e.feature_code)} ·{" "}
                {e.allowed
                  ? e.limit_value === null
                    ? "Tanpa batas"
                    : e.feature_code === "media_bytes"
                      ? `${Number(e.limit_value) / 1000000} MB`
                      : e.limit_value
                  : "Tidak tersedia"}
              </li>
            ))}
          </ul>
        ) : null}
        {data.value?.usage.length ? (
          <div className="seller-usage-list">
            {data.value.usage.map((usage, index) => (
              <div className="seller-usage-row" key={index}>
                <span>{label(usage.feature_code)}</span>
                <strong>{usage.value}</strong>
              </div>
            ))}
          </div>
        ) : (
          <div className="seller-inline-empty">
            <Icon name="chart" size={20} />
            <span>Belum ada penggunaan fitur yang tercatat.</span>
          </div>
        )}
      </section>
      {choice && (
        <AdminModal
          title={current ? "Ganti paket toko" : "Konfirmasi pilihan paket"}
          busy={busy}
          close={() => {
            setChoice(null);
            setError("");
          }}
        >
          <p>
            <strong>{choice.name}</strong> · {rupiah(choice.amount)} /{" "}
            {label(choice.interval)}
          </p>
          <p>
            {current
              ? `Paket ${current.name} tetap berlaku sampai pembayaran paket baru diverifikasi. Setelah itu, paket lama dihentikan dan seluruh fitur serta batasnya diganti oleh paket baru. Tidak ada penggabungan kuota.`
              : "Paket aktif setelah pembayaran diverifikasi admin. Selama menunggu, kamu dapat menyiapkan isi toko."}
          </p>
          <p>
            Pemakaian bulan berjalan tetap tercatat. Biaya paket baru dibayar
            penuh, tanpa pengembalian otomatis sisa masa paket lama.
          </p>
          {error && (
            <p className="live-error" role="alert">
              {error}
            </p>
          )}
          <div className="admin-dialog-actions">
            <button
              disabled={busy}
              onClick={() => {
                setChoice(null);
                setError("");
              }}
            >
              Batal
            </button>
            <button
              className="admin-dialog-submit"
              disabled={busy}
              onClick={() => void choose(choice.id)}
            >
              {busy ? "Membuat tagihan…" : "Setuju & buat tagihan"}
            </button>
          </div>
        </AdminModal>
      )}
    </div>
  );
}
