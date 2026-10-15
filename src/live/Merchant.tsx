import { MediaImage } from "../components/MediaImage";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Icon, type IconName } from "../components/Icon";
import { RequireAuth, AccountSecurity } from "./Auth";
import { authorizationHeaders, requireFirebase } from "../lib/firebase";
import { signOut } from "firebase/auth";
import { Customers, Analytics, ExportButton } from "./Operations";
import {
  api,
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
  { key: "analytics", label: "Analitik", icon: "chart" },
  { key: "settings", label: "Tampilan & pengaturan", icon: "palette" },
  { key: "billing", label: "Langganan", icon: "credit-card" },
  { key: "account", label: "Keamanan akun", icon: "shield" },
];
function Notice({ error }: { error: string }) {
  return error ? (
    <p className="live-error" role="alert">
      {error}
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
  const { value, error, loading } = useData<{ stores: Store[] }>(
    "/api/merchant/stores",
    rev,
  );
  const account = useData<{ user: User }>("/api/auth/me");
  const [selected, setSelected] = useState(
      () => localStorage.getItem("nalaro-selected-store") || "",
    ),
    [drawer, setDrawer] = useState(false);
  const location = useLocation(),
    navigate = useNavigate();
  const sid = value?.stores.some((s) => s.id === selected)
    ? selected
    : value?.stores[0]?.id || "";
  const store = value?.stores.find((s) => s.id === sid);
  const section =
    location.pathname.slice("/app".length).split("/").filter(Boolean)[0] || "";
  function select(id: string) {
    setSelected(id);
    localStorage.setItem("nalaro-selected-store", id);
    navigate("/app");
  }
  return (
    <div className="workspace">
      <aside className={`workspace-sidebar ${drawer ? "workspace-open" : ""}`}>
        <div className="workspace-sidebar-top">
          <Link to="/" className="brand">
            nalaro store
          </Link>
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
              to={"/app" + (m.key ? "/" + m.key : "")}
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
            <Link to="/admin">
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
          Keluar dari akun
        </button>
      </aside>
      <div className="workspace-main">
        <header className="workspace-topbar">
          <button
            className="mobile-menu"
            onClick={() => setDrawer(true)}
            aria-label="Buka menu"
          >
            <Icon name="menu" />
          </button>
          <span>{store?.name || "Workspace"}</span>
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
          <Notice error={error} />
          {loading && !value ? (
            <p aria-busy="true">Memuat toko…</p>
          ) : section === "new" || !sid ? (
            <NewStore
              onCreated={() => {
                setRev((r) => r + 1);
                navigate("/app");
              }}
            />
          ) : (
            <div key={sid}>
              {section === "account" ? (
                <AccountSecurity />
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
            to={"/app" + (m.key ? "/" + m.key : "")}
            className={section === m.key ? "active" : ""}
            aria-current={section === m.key ? "page" : undefined}
          >
            <Icon name={m.icon} />
            <span>{m.label}</span>
          </Link>
        ))}
        <button
          className={drawer || !menus.slice(0, 3).some((m) => m.key === section) ? "active" : ""}
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
    </div>
  );
}
function NewStore({ onCreated }: { onCreated: () => void }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [name, setName] = useState(""),
    [slug, setSlug] = useState(""),
    [manual, setManual] = useState(false),
    [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    setAvailable(null);
    if (slug.length < 3) return;
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
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await api("/api/merchant/stores", "POST", {
        name: f.get("name"),
        slug: f.get("slug"),
      });
      onCreated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="live-editor">
      <h1>Buat toko pertamamu.</h1>
      <p>
        Atur nama dan alamat. Toko disimpan sebagai draft sampai siap menerima
        pesanan.
      </p>
      <form onSubmit={submit} className="live-form">
        <label>
          Nama toko
          <input
            name="name"
            required
            minLength={2}
            maxLength={120}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!manual)
                setSlug(
                  e.target.value
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-|-$/g, "")
                    .slice(0, 48),
                );
            }}
          />
        </label>
        <label>
          Alamat toko
          <input
            name="slug"
            required
            pattern="[a-z0-9][a-z0-9-]{1,46}[a-z0-9]"
            value={slug}
            onChange={(e) => {
              setManual(true);
              setSlug(e.target.value.toLowerCase());
            }}
          />
          <small>3–48 karakter, huruf kecil, angka dan tanda hubung.</small>
          {available !== null && (
            <small role="status">
              {available
                ? "Alamat tersedia."
                : "Alamat belum dapat digunakan. Pilih alamat lain."}
            </small>
          )}
        </label>
        <Notice error={error} />
        <button
          className="button button-dark"
          disabled={busy || available === false}
        >
          {busy ? "Membuat…" : "Buat toko"}
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
                <Link to="/app/inventory">Lihat stok <Icon name="arrow-up-right" size={15} /></Link>
              </div>
              {value.lowStock.length ? (
                <div className="seller-stock-items">
                  {value.lowStock.map((v, i) => (
                    <div className="seller-stock-row" key={i}>
                      <span>{v.name} · {v.option_label}</span>
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
        <ExportButton sid={sid} resource="products" />
        <button className="button button-dark" onClick={() => setEditing(null)}>
          Tambah produk <Icon name="plus" />
        </button>
      </div>
      <Notice error={error} />
      <label className="live-search">
        Cari produk
        <input value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <div className="work-product-list">
        {value?.products
          .filter((p) => p.name.toLowerCase().includes(q.toLowerCase()))
          .map((p) => (
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
              <button
                aria-label={"Edit " + p.name}
                onClick={() => setEditing(p)}
              >
                <Icon name="edit" />
              </button>
            </article>
          ))}
      </div>
      {value && !value.products.length && (
        <div className="seller-product-empty">
          <Icon name="box" size={29} />
          <strong>Belum ada produk di katalog.</strong>
          <p>Unggah produk pertama, lengkapi harga dan stok, lalu siapkan etalase tokomu.</p>
          <button className="button button-dark" onClick={() => setEditing(null)}>
            Mulai isi katalog <Icon name="arrow-right" size={16} />
          </button>
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
    const f = new FormData(e.currentTarget);
    setBusy(true);
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
  async function upload(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/merchant/stores/${sid}/media`, {
        method: "POST",
        headers: {
          "content-type": file.type,
          ...(await authorizationHeaders()),
        },
        body: file,
      });
      const data = (await r.json()) as { error?: string; url: string };
      if (!r.ok) throw Error(data.error);
      setImage(data.url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button className="back-link" onClick={done}>
        <Icon name="arrow-left" /> Kembali ke produk
      </button>
      <h1>{product ? "Edit produk" : "Tambah produk"}</h1>
      <form className="live-form live-editor" onSubmit={save}>
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
            Alamat produk
            <input
              required
              name="slug"
              defaultValue={product?.slug}
              pattern="[a-z0-9][a-z0-9-]{1,46}[a-z0-9]"
            />
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
        <label>
          Foto produk
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => upload(e.target.files?.[0])}
          />
        </label>
        <label>
          URL foto HTTPS atau media toko
          <input value={image} onChange={(e) => setImage(e.target.value)} />
        </label>
        {image && (
          <MediaImage
            className="editor-photo"
            src={image}
            alt="Pratinjau produk"
          />
        )}
        <fieldset>
          <legend>Galeri produk</legend>
          {gallery.map((g, i) => (
            <div className="form-two" key={i}>
              <label>
                URL foto {i + 1}
                <input
                  value={g.url}
                  onChange={(e) =>
                    setGallery((prev) =>
                      prev.map((x, n) =>
                        n === i ? { ...x, url: e.target.value } : x,
                      ),
                    )
                  }
                />
              </label>
              <label>
                Deskripsi foto
                <input
                  value={g.alt}
                  onChange={(e) =>
                    setGallery((prev) =>
                      prev.map((x, n) =>
                        n === i ? { ...x, alt: e.target.value } : x,
                      ),
                    )
                  }
                />
              </label>
              <button
                type="button"
                onClick={() =>
                  setGallery((prev) => prev.filter((_, n) => n !== i))
                }
              >
                Hapus foto
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={gallery.length >= 12}
            onClick={() =>
              setGallery((prev) => [...prev, { url: "", alt: "" }])
            }
          >
            Tambah foto galeri
          </button>
          <label>
            Unggah foto galeri
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={busy || gallery.length >= 12}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setBusy(true);
                try {
                  const response = await fetch(
                    `/api/merchant/stores/${sid}/media`,
                    {
                      method: "POST",
                      headers: {
                        "content-type": file.type,
                        ...(await authorizationHeaders()),
                      },
                      body: file,
                    },
                  );
                  const r = (await response.json()) as {
                    url: string;
                    error?: string;
                  };
                  if (!response.ok) throw Error(r.error);
                  setGallery((prev) => [...prev, { url: r.url, alt: "" }]);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            />
          </label>
        </fieldset>
        <fieldset>
          <legend>Varian & stok</legend>
          {variants.map((v, i) => (
            <div className="variant-row" key={v.id || i}>
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
              <label>
                Foto varian (URL)
                <input
                  value={v.image_url || ""}
                  onChange={(e) =>
                    change(i, "image_url", e.target.value || null)
                  }
                />
              </label>
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
            className="text-link"
            onClick={() => setVariants((v) => [...v, { ...defaultVariant }])}
          >
            Tambah varian <Icon name="plus" />
          </button>
        </fieldset>
        <label>
          Status produk
          <select name="status" defaultValue={product?.status || "draft"}>
            <option value="draft">Draft</option>
            <option value="active">Terbitkan</option>
            <option value="archived">Arsipkan</option>
          </select>
        </label>
        <Notice error={error} />
        <button className="button button-dark" disabled={busy}>
          {busy ? "Menyimpan…" : "Simpan produk"}
        </button>
      </form>
    </>
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
      <h1>Pesanan</h1>
      <ExportButton sid={sid} resource="orders" />
      <div className="live-filters">
        <label>
          Cari nomor atau nama
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
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
      <div className="work-tabbar">
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
            onClick={() => {
              setFilter(key);
              setPage(1);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="live-order-list">
        {value?.orders.map((o) => (
          <button
            key={o.id}
            className="live-order-row"
            onClick={() => setSelected(o.id)}
          >
            <strong>{o.order_number}</strong>
            <span>{o.customer_name}</span>
            <span>{new Date(o.created_at).toLocaleDateString("id-ID")}</span>
            <b>{rupiah(o.total_idr)}</b>
            <span>{label(o.payment_status)}</span>
            <span>{label(o.fulfillment_status)}</span>
            <Icon name="arrow-right" />
          </button>
        ))}
      </div>
      {value && !value.orders.length && <p>Belum ada pesanan masuk.</p>}
      <div className="live-actions">
        <button
          disabled={page === 1 || loading}
          onClick={() => setPage((p) => p - 1)}
        >
          Sebelumnya
        </button>
        <span>Halaman {page}</span>
        <button
          disabled={!value?.hasMore || loading}
          onClick={() => setPage((p) => p + 1)}
        >
          Berikutnya
        </button>
      </div>
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
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="workspace-heading">
        <div>
          <h1>Tampilan & pengaturan</h1>
          <p>Status: {label(store.status)}</p>
        </div>
        <button
          className="button button-dark"
          disabled={busy}
          onClick={publish}
        >
          {store.status === "published" ? "Jeda toko" : "Terbitkan toko"}
        </button>
      </div>
      <section className="work-section">
        <h2>Alamat toko</h2>
        <p>
          <Link to={"/s/" + store.slug} target="_blank">
            Buka toko di platform ↗
          </Link>
        </p>
        <p>{store.slug}.store.nalaro.digital</p>
        <button
          type="button"
          className="button button-dark"
          disabled={busy}
          onClick={activateDomain}
        >
          Periksa & aktifkan subdomain
        </button>
      </section>
      <Notice error={loadError || error} />
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {value && (
        <section className="work-section">
          <h2>Kesiapan toko</h2>
          <ul className="readiness-list">
            <li>
              Produk dengan stok tersedia:{" "}
              <Link to="/app/products">periksa produk</Link>
            </li>
            <li>
              {value.settings.bank_details || value.settings.qris_media_key
                ? "Pembayaran sudah diisi."
                : "Isi rekening atau QRIS."}
            </li>
            <li>
              {value.settings.pickup_enabled || value.settings.delivery_enabled
                ? "Metode penerimaan barang tersedia."
                : "Aktifkan pickup atau kurir toko."}
            </li>
            <li>
              {value.settings.policies
                ? "Kebijakan toko sudah diisi."
                : "Lengkapi kebijakan pengiriman dan pengembalian."}
            </li>
            <li>
              {value.settings.contact_phone
                ? "Kontak toko sudah diisi."
                : "Isi kontak yang dapat dihubungi."}
            </li>
          </ul>
          <Link className="button" to={"/preview/" + sid} target="_blank">
            Pratinjau sebelum terbit
          </Link>
          <Link className="button" to="/app/billing">
            Periksa langganan atau masa pilot
          </Link>
        </section>
      )}
      {value && (
        <form className="live-form live-editor" key={rev} onSubmit={save}>
          <h2>Identitas toko</h2>
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
            Foto etalase HTTPS
            <input
              name="hero_image_url"
              defaultValue={value.settings.hero_image_url || ""}
            />
          </label>
          <label>
            Logo HTTPS
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
          <h2>Pengiriman</h2>
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
          <h2>Pembayaran manual</h2>
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
              <button type="button" onClick={() => setQrisKey(null)}>
                Hapus QRIS
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
          <button className="button button-dark" disabled={busy}>
            Simpan pengaturan
          </button>
        </form>
      )}
    </>
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
    [error, setError] = useState("");
  const data = useData<{
      paymentInstructions: string;
      subscriptions: {
        id: string;
        name: string;
        status: string;
        current_period_end: string;
        billing_interval: string;
      }[];
      invoices: Invoice[];
      usage: { feature_code: string; period_key: string; value: number }[];
    }>(`/api/merchant/stores/${sid}/billing`, rev),
    plans = useData<{ plans: Plan[] }>("/api/public/plans");
  async function choose(pid: string) {
    try {
      await api(`/api/merchant/stores/${sid}/billing`, "POST", {
        plan_price_id: pid,
      });
      setRev((r) => r + 1);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <h1>Langganan toko</h1>
      <p>
        Tagihan Nalaro Store terpisah dari pembayaran pelanggan tokomu. Invoice
        diperiksa admin setelah pembayaran.
      </p>
      <Notice error={error || data.error || plans.error} />
      {data.value?.subscriptions.map((s) => (
        <section className="work-section" key={s.id}>
          <h2>{s.name}</h2>
          <p>
            {label(s.status)} · {label(s.billing_interval)} · berakhir{" "}
            {new Date(s.current_period_end).toLocaleDateString("id-ID")}
          </p>
        </section>
      ))}
      <div className="plan-list">
        {plans.value?.plans.map((p) => (
          <article key={p.id}>
            <h2>{p.name}</h2>
            <p>{p.description}</p>
            {p.prices.map((pr) => (
              <button
                key={pr.id}
                className="button button-dark"
                onClick={() => choose(pr.id!)}
              >
                {rupiah(pr.amount_idr)} /{" "}
                {pr.billing_interval === "monthly" ? "bulan" : "tahun"}
              </button>
            ))}
          </article>
        ))}
      </div>
      {plans.value && !plans.value.plans.length && (
        <p>Paket belum dipublikasikan. Toko pilot tetap dapat disiapkan.</p>
      )}
      <h2>Invoice langganan</h2>
      <p className="pre-line">
        {data.value?.paymentInstructions ||
          "Instruksi pembayaran belum ditetapkan admin."}
      </p>
      {data.value?.invoices.map((i) => (
        <div className="live-order-row" key={i.id}>
          <strong>{i.invoice_number}</strong>
          <b>{rupiah(i.amount_idr)}</b>
          <span>{label(i.status)}</span>
          <span>{new Date(i.period_start).toLocaleDateString("id-ID")}</span>
        </div>
      ))}
      <h2>Penggunaan kuota</h2>
      {data.value?.usage.map((u, i) => (
        <p key={i}>
          {u.feature_code} · {u.period_key}: {u.value}
        </p>
      ))}
    </>
  );
}
