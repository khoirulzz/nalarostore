import { MediaImage } from "../components/MediaImage";
import { StoreChat } from "./Engagement";
import { CheckoutAccount, useBuyerSession } from "./BuyerAccount";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import {
  api,
  useData,
  rupiah,
  catalogPrice,
  label,
  type Store,
  type Settings,
  type Product,
  type Variant,
  type Order,
  type Item,
} from "./api";
type Line = { variant_id: string; quantity: number };
export function LiveStore({
  hostname = false,
  preview = false,
}: {
  hostname?: boolean;
  preview?: boolean;
}) {
  const params = useParams(),
    location = useLocation(),
    navigate = useNavigate();
  const slug = params.slug || "";
  const buyer = useBuyerSession();
  const base = preview
      ? "/preview/" + params.sid
      : hostname
        ? ""
        : "/s/" + slug,
    endpoint = preview
      ? `/api/merchant/stores/${params.sid}/preview`
      : hostname
        ? "/api/public/store"
        : "/api/public/stores/" + slug;
  const path = location.pathname.slice(base.length) || "/";
  const isTracking = path.startsWith("/track/");
  const [revision, setRevision] = useState(0);
  const [chatRequest, setChatRequest] = useState<{ product: Product; key: number } | null>(null);
  const askSeller = (product: Product) => {
    setChatRequest((previous) => ({ product, key: (previous?.key || 0) + 1 }));
  };
  const shop = useData<{ store: Store; settings: Settings }>(
      isTracking ? null : endpoint,
      revision,
    ),
    catalog = useData<{ products: Product[] }>(
      isTracking ? null : preview ? endpoint : endpoint + "/products",
      revision,
    ),
    capabilities = useData<{ liveCheckout: boolean; productChatAttachments?: boolean }>(
      "/api/public/capabilities",
    );
  const key =
    "nalaro-cart-v1:" +
    window.location.hostname +
    ":" +
    (preview ? "preview:" + params.sid : slug);
  const [lines, setLines] = useState<Line[]>(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(key) || "[]");
        return Array.isArray(saved)
          ? saved
              .filter(
                (l) =>
                  typeof l.variant_id === "string" &&
                  Number.isInteger(l.quantity) &&
                  l.quantity > 0 &&
                  l.quantity <= 99,
              )
              .slice(0, 50)
          : [];
      } catch {
        return [];
      }
    }),
    [notice, setNotice] = useState("");
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(lines));
    } catch {
      /* Cart remains usable without persistence. */
    }
  }, [key, lines]);
  useEffect(() => {
    document.title = shop.value?.store.name
      ? shop.value.store.name + " | Nalaro Store"
      : "Nalaro Store";
  }, [shop.value?.store.name]);
  const all = catalog.value?.products || [];
  const found = path.startsWith("/product/")
    ? all.find((p) => p.slug === path.slice("/product/".length))
    : null;
  const items = lines
    .map((l) => {
      const p = all.find((p) => p.variants.some((v) => v.id === l.variant_id));
      const v = p?.variants.find((v) => v.id === l.variant_id);
      return p && v
        ? {
            ...l,
            product: p,
            variant: v,
            price: Number(v.price_override_idr ?? p.price_idr),
          }
        : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
  function add(v: Variant, q = 1) {
    if (!v.id) return;
    setLines((prev) => {
      const old = prev.find((l) => l.variant_id === v.id);
      const amount = Math.min(
        Number(v.available_stock),
        99,
        (old?.quantity || 0) + q,
      );
      return old
        ? prev.map((l) => (l === old ? { ...l, quantity: amount } : l))
        : [...prev, { variant_id: v.id!, quantity: amount }];
    });
    setNotice("Produk ditambahkan ke keranjang.");
  }
  function update(vid: string, q: number) {
    setLines((prev) =>
      prev
        .map((l) =>
          l.variant_id === vid
            ? { ...l, quantity: Math.max(0, Math.min(99, q)) }
            : l,
        )
        .filter((l) => l.quantity),
    );
  }
  if (isTracking)
    return (
      <div className="storefront live-store">
        <header className="store-header">
          <div className="store-shell store-header-inner">
            <Link to={base + "/"} className="store-logo">
              Pelacakan pesanan
            </Link>
          </div>
        </header>
        <main>
          <Tracking
            endpoint={endpoint}
            token={path.slice("/track/".length)}
            base={base}
          />
        </main>
      </div>
    );
  if ((shop.loading && !shop.value) || (catalog.loading && !catalog.value))
    return (
      <main className="auth-page" aria-busy="true">
        Memuat toko…
      </main>
    );
  if (shop.error || catalog.error)
    return (
      <main className="auth-page">
        <h1>Toko belum tersedia.</h1>
        <p role="alert">{shop.error || catalog.error}</p>
        <button
          className="button button-dark"
          onClick={() => setRevision((r) => r + 1)}
        >
          Coba lagi
        </button>
      </main>
    );
  const s = shop.value!.settings,
    store = shop.value!.store;
  const count = lines.reduce((a, l) => a + l.quantity, 0);
  return (
    <div
      className="storefront live-store"
      style={{ "--store-accent": s.accent } as React.CSSProperties}
    >
      {preview && (
        <div className="preview-banner">
          Pratinjau toko · Pesanan tidak dapat dibuat di sini.{" "}
          <Link
            to={
              new URLSearchParams(window.location.search).has("adminStore")
                ? `/admin?tab=overview&store=${params.sid}`
                : "/app/settings"
            }
          >
            Kembali ke pengaturan
          </Link>
        </div>
      )}
      <header className="store-header">
        <div className="store-shell store-header-inner">
          <Link className="store-text-link" to={base + "/catalog"}>
            Katalog
          </Link>
          <Link className="store-logo" to={base + "/"}>
            {s.logo_url ? (
              <MediaImage src={s.logo_url} alt={store.name} />
            ) : (
              store.name
            )}
          </Link>
          <div className="store-account-tools">
            {!preview && (
              <a
                className="store-account-link"
                href={
                  hostname ? "https://store.nalaro.digital/account" : "/account"
                }
                aria-label="Akun pembeli"
              >
                <Icon name="users" size={20} />
              </a>
            )}
            <Link
              className="store-bag"
              to={base + "/cart"}
              aria-label={"Keranjang " + count + " item"}
            >
              <Icon name="bag" />
              {count > 0 && <span>{count}</span>}
            </Link>
          </div>
        </div>
      </header>
      <main>
        {notice && (
          <div className="live-cart-notice" role="status">
            {notice}
            <Link to={base + "/cart"}>Lihat keranjang</Link>
            <button aria-label="Tutup informasi" onClick={() => setNotice("")}>
              ×
            </button>
          </div>
        )}
        {path.startsWith("/track/") ? (
          <Tracking
            endpoint={endpoint}
            token={path.slice("/track/".length)}
            base={base}
          />
        ) : path === "/checkout" ? (
          <LiveCheckout
            key={endpoint + ":" + (buyer?.uid || "guest")}
            endpoint={endpoint}
            base={base}
            items={items}
            settings={s}
            enabled={!preview && capabilities.value?.liveCheckout === true}
            invalid={items.length !== lines.length}
            onComplete={(raw) => {
              setLines([]);
              navigate(base + "/track/" + raw);
            }}
            refresh={() => setRevision((r) => r + 1)}
          />
        ) : path === "/cart" ? (
          <div className="store-shell cart-page">
            <h1>Keranjang</h1>
            {items.length < lines.length && (
              <p className="live-error">
                Sebagian produk tidak tersedia.{" "}
                <button
                  onClick={() =>
                    setLines((prev) =>
                      prev.filter((l) =>
                        items.some((i) => i.variant_id === l.variant_id),
                      ),
                    )
                  }
                >
                  Hapus produk tidak tersedia
                </button>
              </p>
            )}
            {items.length ? (
              <div className="cart-layout">
                <div>
                  {items.map((i) => (
                    <div className="cart-line" key={i.variant_id}>
                      {i.product.primary_image_url && (
                        <MediaImage
                          className="live-thumb"
                          src={i.product.primary_image_url}
                          alt=""
                        />
                      )}
                      <div className="cart-line-body">
                        <h2>{i.product.name}</h2>
                        <p>{i.variant.option_label}</p>
                        <p>{rupiah(i.price)}</p>
                        <div className="quantity-stepper">
                          <button
                            aria-label={"Kurangi " + i.product.name}
                            onClick={() => update(i.variant_id, i.quantity - 1)}
                          >
                            −
                          </button>
                          <span>{i.quantity}</span>
                          <button
                            aria-label={"Tambah " + i.product.name}
                            disabled={
                              i.quantity >= Number(i.variant.available_stock)
                            }
                            onClick={() => update(i.variant_id, i.quantity + 1)}
                          >
                            +
                          </button>
                        </div>
                        {i.quantity > Number(i.variant.available_stock) && (
                          <p role="alert">
                            Stok berubah. Tersedia {i.variant.available_stock}.
                          </p>
                        )}
                        <button
                          className="underlined"
                          onClick={() => update(i.variant_id, 0)}
                        >
                          Hapus
                        </button>
                      </div>
                      <strong>{rupiah(i.price * i.quantity)}</strong>
                    </div>
                  ))}
                </div>
                <aside className="cart-summary">
                  <h2>Ringkasan belanja</h2>
                  <div>
                    <span>Subtotal</span>
                    <b>
                      {rupiah(
                        items.reduce((a, i) => a + i.price * i.quantity, 0),
                      )}
                    </b>
                  </div>
                  <p>Pengiriman ditampilkan sebelum pesanan dibuat.</p>
                  <Link className="pdp-add" to={base + "/checkout"}>
                    Lanjut ke checkout <Icon name="arrow-right" />
                  </Link>
                </aside>
              </div>
            ) : (
              <div className="cart-empty">
                <h2>Keranjangmu masih kosong.</h2>
                <Link className="button button-dark" to={base + "/catalog"}>
                  Jelajahi produk
                </Link>
              </div>
            )}
          </div>
        ) : path.startsWith("/product/") ? (
          found ? (
            <LiveProduct key={found.id} product={found} add={add} base={base} onChatProduct={preview ? undefined : askSeller} />
          ) : (
            <div className="store-shell store-section">
              <h1>Produk tidak ditemukan.</h1>
              <Link to={base + "/catalog"}>Kembali ke katalog</Link>
            </div>
          )
        ) : path === "/catalog" ? (
          <LiveCatalog products={all} base={base} />
        ) : path === "/" ? (
          <>
            <section
              className={`live-store-hero ${s.hero_image_url ? "with-photo" : ""}`}
            >
              {s.hero_image_url && (
                <MediaImage src={s.hero_image_url} alt="Koleksi toko" />
              )}
              <div>
                <h1>{s.hero_title || store.name}</h1>
                <p>{store.description || "Pilihan produk dari toko kami."}</p>
                <Link className="store-outline-button" to={base + "/catalog"}>
                  Jelajahi koleksi <Icon name="arrow-up-right" />
                </Link>
              </div>
            </section>
            <section className="store-shell store-section">
              <div className="store-section-head">
                <h2>Pilihan toko</h2>
                <Link to={base + "/catalog"}>Semua produk ↗</Link>
              </div>
              <div className="product-grid">
                {all.slice(0, 8).map((p) => (
                  <Tile key={p.id} product={p} base={base} />
                ))}
              </div>
              {!all.length && <p>Toko sedang menyiapkan koleksi.</p>}
            </section>
          </>
        ) : (
          <div className="store-shell store-section">
            <h1>Halaman tidak ditemukan.</h1>
            <Link to={base + "/"}>Kembali ke toko</Link>
          </div>
        )}
      </main>
      <footer className="store-footer">
        {!preview && (
          <StoreChat
            key={endpoint + ":" + (buyer?.uid || "guest")}
            endpoint={endpoint}
            accountURL="https://store.nalaro.digital/account"
            products={all}
            request={chatRequest}
            attachmentsEnabled={capabilities.value?.productChatAttachments === true}
          />
        )}
        <div className="store-shell store-footer-grid">
          <div>
            <h2>{store.name}</h2>
            <p>{s.opening_hours}</p>
            <p>{s.contact_phone}</p>
          </div>
          <div>
            <b>Pengiriman</b>
            <p>{s.pickup_enabled ? "Ambil di toko tersedia." : ""}</p>
            <p>{s.delivery_enabled ? "Kurir toko tersedia." : ""}</p>
          </div>
          <div>
            <b>Kebijakan toko</b>
            <p className="pre-line">
              {s.policies ||
                "Hubungi toko untuk informasi produk, pembayaran, dan pengiriman."}
            </p>
          </div>
        </div>
        <div className="store-shell store-footer-bottom">
          © {store.name}
          <a href="https://store.nalaro.digital">Powered by Nalaro Store ↗</a>
        </div>
      </footer>
    </div>
  );
}
function Tile({ product: p, base }: { product: Product; base: string }) {
  const available = p.variants.reduce(
    (a, v) => a + Number(v.available_stock || 0),
    0,
  );
  return (
    <Link className="product-tile" to={base + "/product/" + p.slug}>
      <div className="product-image">
        {p.primary_image_url ? (
          <MediaImage src={p.primary_image_url} alt={p.name} loading="lazy" />
        ) : (
          <span className="media-placeholder">
            <Icon name="box" size={40} />
          </span>
        )}
      </div>
      <div className="product-meta">
        <span>{p.category}</span>
        <h3>{p.name}</h3>
        <p>
          {p.variants.length > 1 ? "Mulai dari " : ""}
          {rupiah(catalogPrice(p))}
        </p>
        {!available && <small>Stok habis</small>}
      </div>
    </Link>
  );
}
function LiveCatalog({
  products,
  base,
}: {
  products: Product[];
  base: string;
}) {
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState(""),
    [sort, setSort] = useState("new"),
    [inStock, setInStock] = useState(false),
    [min, setMin] = useState(""),
    [max, setMax] = useState("");
  const shown = products
    .filter(
      (p) =>
        (!category || p.category === category) &&
        p.name.toLowerCase().includes(search.toLowerCase()) &&
        (!inStock || p.variants.some((v) => Number(v.available_stock) > 0)) &&
        (!min || catalogPrice(p) >= Number(min)) &&
        (!max || catalogPrice(p) <= Number(max)),
    )
    .sort((a, b) =>
      sort === "low"
        ? catalogPrice(a) - catalogPrice(b)
        : sort === "high"
          ? catalogPrice(b) - catalogPrice(a)
          : 0,
    );
  return (
    <section className="store-shell store-section">
      <h1>Katalog produk</h1>
      <div className="live-filters">
        <label>
          Cari produk
          <input value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <label>
          Kategori
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Semua kategori</option>
            {[...new Set(products.map((p) => p.category))].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Urutkan
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="new">Terbaru</option>
            <option value="low">Harga terendah</option>
            <option value="high">Harga tertinggi</option>
          </select>
        </label>
        <label>
          Harga minimum
          <input
            type="number"
            min={0}
            value={min}
            onChange={(e) => setMin(e.target.value)}
          />
        </label>
        <label>
          Harga maksimum
          <input
            type="number"
            min={0}
            value={max}
            onChange={(e) => setMax(e.target.value)}
          />
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={inStock}
            onChange={(e) => setInStock(e.target.checked)}
          />{" "}
          Stok tersedia
        </label>
      </div>
      <p>{shown.length} produk</p>
      <div className="product-grid">
        {shown.map((p) => (
          <Tile key={p.id} product={p} base={base} />
        ))}
      </div>
      {!shown.length && (
        <p>
          Tidak ada produk yang sesuai.{" "}
          <button
            onClick={() => {
              setSearch("");
              setCategory("");
              setMin("");
              setMax("");
              setInStock(false);
            }}
          >
            Reset filter
          </button>
        </p>
      )}
    </section>
  );
}
function LiveProduct({
  product: p,
  add,
  base,
  onChatProduct,
}: {
  product: Product;
  add: (v: Variant, q: number) => void;
  base: string;
  onChatProduct?: (product: Product) => void;
}) {
  const navigate = useNavigate();
  const [vid, setVid] = useState(p.variants[0]?.id),
    [quantity, setQuantity] = useState(1),
    [photo, setPhoto] = useState<string | null>(null),
    [shareStatus, setShareStatus] = useState("");
  const v = p.variants.find((v) => v.id === vid),
    stock = Number(v?.available_stock || 0);
  const activePhoto = photo || v?.image_url || p.primary_image_url;
  return (
    <section className="store-shell pdp-page">
      <Link to={base + "/catalog"} className="back-link">
        ← Kembali ke katalog
      </Link>
      <div className="pdp-layout">
        <div className="pdp-gallery">
          {activePhoto ? (
            <MediaImage
              src={activePhoto}
              alt={p.gallery?.find((g) => g.url === activePhoto)?.alt || p.name}
            />
          ) : (
            <span className="media-placeholder">
              <Icon name="box" size={80} />
            </span>
          )}
          {!!p.gallery?.length && (
            <div className="gallery-thumbnails">
              {[{ url: p.primary_image_url, alt: p.name }, ...p.gallery]
                .filter((g) => g.url)
                .map((g, i) => (
                  <button
                    key={i}
                    aria-label={`Lihat foto ${i + 1}: ${g.alt || p.name}`}
                    aria-pressed={activePhoto === g.url}
                    onClick={() => setPhoto(g.url!)}
                  >
                    <MediaImage
                      src={g.url!}
                      alt={g.alt || p.name}
                      loading="lazy"
                    />
                  </button>
                ))}
            </div>
          )}
        </div>
        <div className="pdp-info">
          <p>{p.category}</p>
          <h1>{p.name}</h1>
          <p className="pdp-price">
            {rupiah(v?.price_override_idr ?? p.price_idr)}
          </p>
          <p className="pre-line">{p.description}</p>
          <button type="button" className="product-share-link" onClick={async () => {
            const url = window.location.href;
            setShareStatus("");
            try {
              if (navigator.share) {
                await navigator.share({ title: p.name, url });
              } else if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(url);
                setShareStatus("Tautan produk disalin.");
              } else {
                setShareStatus("Salin tautan produk dari bilah alamat browser.");
              }
            } catch (error) {
              if ((error as Error).name !== "AbortError") setShareStatus("Bagikan produk melalui tautan halaman ini.");
            }
          }}><Icon name="link" size={16} /> Bagikan produk</button>
          {shareStatus && <p role="status" className="product-share-status">{shareStatus}</p>}
          <fieldset>
            <legend>Pilihan produk</legend>
            <div className="size-options">
              {p.variants.map((x) => (
                <button
                  key={x.id}
                  aria-pressed={vid === x.id}
                  className={vid === x.id ? "selected" : ""}
                  onClick={() => {
                    setVid(x.id);
                    setQuantity(1);
                    setPhoto(null);
                  }}
                >
                  {x.option_label}
                </button>
              ))}
            </div>
          </fieldset>
          <p>{stock ? `${stock} tersedia` : "Stok habis"}</p>
          <label>
            Jumlah
            <input
              type="number"
              min={1}
              max={Math.min(99, stock)}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </label>
          <button
            className="pdp-add"
            disabled={
              !v ||
              !stock ||
              quantity < 1 ||
              quantity > stock ||
              quantity > 99 ||
              !Number.isInteger(quantity)
            }
            onClick={() => v && add(v, quantity)}
          >
            Tambah ke keranjang <Icon name="bag" />
          </button>
          {onChatProduct && (
            <button type="button" className="product-ask-seller" onClick={() => onChatProduct(p)}>
              <Icon name="mail" size={19} /> Tanya produk ke penjual
              <Icon name="arrow-up-right" size={16} />
            </button>
          )}
          <button
            className="store-outline-button live-buy-now"
            disabled={
              !v ||
              !stock ||
              !Number.isInteger(quantity) ||
              quantity < 1 ||
              quantity > Math.min(99, stock)
            }
            onClick={() => {
              if (v) {
                add(v, quantity);
                navigate(base + "/checkout");
              }
            }}
          >
            Beli sekarang
          </button>
        </div>
      </div>
      <div className="live-mobile-buybar" aria-label="Pembelian cepat">
        <div className="live-mobile-buybar-price">
          <span>Harga</span>
          <strong>{rupiah(v?.price_override_idr ?? p.price_idr)}</strong>
        </div>
        {onChatProduct && <button type="button" className="live-mobile-chat" aria-label="Chat penjual tentang produk ini" onClick={() => onChatProduct(p)}>
          <Icon name="mail" size={21} />
        </button>}
        <button
          className="live-mobile-cart"
          aria-label="Tambah ke keranjang"
          disabled={
            !v ||
            stock < 1 ||
            quantity < 1 ||
            quantity > stock ||
            !Number.isInteger(quantity)
          }
          onClick={() => v && add(v, quantity)}
        >
          <Icon name="bag" size={21} />
        </button>
        <button
          className="live-mobile-checkout"
          disabled={
            !v ||
            stock < 1 ||
            quantity < 1 ||
            quantity > stock ||
            !Number.isInteger(quantity)
          }
          onClick={() => {
            if (v) {
              add(v, quantity);
              navigate(base + "/checkout");
            }
          }}
        >
          Beli sekarang <Icon name="arrow-right" size={17} />
        </button>
      </div>
    </section>
  );
}
type CheckoutItem = Line & {
  product: Product;
  variant: Variant;
  price: number;
};
function LiveCheckout({
  endpoint,
  base,
  items,
  settings: s,
  enabled,
  invalid,
  onComplete,
  refresh,
}: {
  endpoint: string;
  base: string;
  items: CheckoutItem[];
  settings: Settings;
  enabled: boolean;
  invalid: boolean;
  onComplete: (token: string) => void;
  refresh: () => void;
}) {
  const [method, setMethod] = useState(
      s.pickup_enabled ? "pickup" : "local_flat",
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const subtotal = items.reduce((a, i) => a + i.price * i.quantity, 0),
    shipping = method === "pickup" ? 0 : Number(s.shipping_fee_idr),
    total = subtotal + shipping;
  const buyer = useBuyerSession();
  const storageKey = "checkout-v1:" + endpoint + ":" + (buyer?.uid || "guest");
  const [contact, setContact] = useState({
    name: "",
    phone: "",
    email: buyer?.email || "",
    address: "",
  });
  const [idempotency] = useState(() => {
    let key: string | null = null;
    try {
      key = sessionStorage.getItem(storageKey);
    } catch {
      /* memory-only checkout */
    }
    if (!key || !/^[a-f0-9-]{36}$/.test(key)) key = crypto.randomUUID();
    try {
      sessionStorage.setItem(storageKey, key);
    } catch {
      /* same key persists in this form */
    }
    return key;
  });
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      const r = await api<{ tracking_token: string }>(
        endpoint + "/checkout",
        "POST",
        {
          idempotency_key: idempotency,
          items: items.map((i) => ({
            variant_id: i.variant_id,
            quantity: i.quantity,
            expected_unit_price: i.price,
          })),
          expected_total: total,
          customer_name: f.get("name"),
          contact_email: f.get("email") || "",
          contact_phone: f.get("phone"),
          address: f.get("address") || "",
          shipping_method: method,
        },
      );
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        /* order is already durable */
      }
      onComplete(r.tracking_token);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="store-shell checkout-page">
      <Link to={base + "/cart"} className="back-link">
        ← Kembali ke keranjang
      </Link>
      <h1>Selesaikan pemesanan.</h1>
      <p>Bayar melalui rekening atau QRIS toko setelah pesanan diterima.</p>
      <CheckoutAccount
        onAddress={(a) =>
          setContact({
            name: a.recipient_name,
            phone: a.contact_phone,
            email: buyer?.email || "",
            address: a.address,
          })
        }
      />
      {!enabled && (
        <p className="notice">
          Pemesanan belum dibuka. Hubungi toko untuk informasi.
        </p>
      )}
      {invalid && (
        <p className="live-error">
          Ada produk yang tidak tersedia. Perbarui keranjang terlebih dahulu.
        </p>
      )}
      <form className="checkout-layout live-form" onSubmit={submit}>
        <div className="checkout-fields">
          <fieldset>
            <legend>01 · Kontak pembeli</legend>
            <label>
              Nama lengkap
              <input
                required
                name="name"
                value={contact.name}
                onChange={(e) =>
                  setContact((c) => ({ ...c, name: e.target.value }))
                }
                minLength={2}
                maxLength={120}
                autoComplete="name"
              />
            </label>
            <label>
              Nomor WhatsApp
              <input
                required
                name="phone"
                value={contact.phone}
                onChange={(e) =>
                  setContact((c) => ({ ...c, phone: e.target.value }))
                }
                type="tel"
                pattern="[+0-9 ()-]{8,25}"
                autoComplete="tel"
              />
            </label>
            <label>
              Email (opsional)
              <input
                name="email"
                type="email"
                autoComplete="email"
                value={contact.email}
                onChange={(e) =>
                  setContact((c) => ({ ...c, email: e.target.value }))
                }
              />
              <small>
                Email dicantumkan pada pesanan. Status tersedia melalui tautan
                pelacakan.
              </small>
            </label>
          </fieldset>
          <fieldset>
            <legend>02 · Pengiriman</legend>
            <label>
              Metode menerima barang
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                {s.pickup_enabled && (
                  <option value="pickup">Ambil di toko</option>
                )}
                {s.delivery_enabled && (
                  <option value="local_flat">Kurir toko</option>
                )}
              </select>
            </label>
            {method === "pickup" ? (
              <p>{s.pickup_address}</p>
            ) : (
              <label>
                Alamat lengkap
                <textarea
                  required
                  name="address"
                  value={contact.address}
                  onChange={(e) =>
                    setContact((c) => ({ ...c, address: e.target.value }))
                  }
                  minLength={12}
                  maxLength={2000}
                  autoComplete="street-address"
                  rows={4}
                />
              </label>
            )}
          </fieldset>
          <fieldset>
            <legend>03 · Pembayaran</legend>
            <p>
              Transfer bank / QRIS manual. Status dibayar muncul setelah toko
              memverifikasi pembayaran.
            </p>
          </fieldset>
          {error && (
            <div className="live-error" role="alert">
              <p>{error}</p>
              <button type="button" onClick={refresh}>
                Tinjau harga dan stok terbaru
              </button>
            </div>
          )}
          <button
            className="pdp-add"
            disabled={
              busy ||
              !enabled ||
              invalid ||
              !items.length ||
              items.some((i) => i.quantity > Number(i.variant.available_stock))
            }
          >
            {busy ? "Mengirim pesanan…" : "Buat pesanan · " + rupiah(total)}
          </button>
        </div>
        <aside className="checkout-summary">
          <h2>Ringkasan pesanan</h2>
          {items.map((i) => (
            <div className="checkout-line" key={i.variant_id}>
              <span>
                {i.product.name}
                <small>
                  {i.variant.option_label} × {i.quantity}
                </small>
              </span>
              <strong>{rupiah(i.price * i.quantity)}</strong>
            </div>
          ))}
          <div className="checkout-line">
            <span>Subtotal</span>
            <strong>{rupiah(subtotal)}</strong>
          </div>
          <div className="checkout-line">
            <span>Pengiriman</span>
            <strong>{rupiah(shipping)}</strong>
          </div>
          <div className="checkout-final">
            <span>Total</span>
            <strong>{rupiah(total)}</strong>
          </div>
        </aside>
      </form>
    </div>
  );
}
function Tracking({
  endpoint,
  token: raw,
  base,
}: {
  endpoint: string;
  token: string;
  base: string;
}) {
  const [rev, setRev] = useState(0);
  const { value, error, loading } = useData<{
    order: Order;
    items: Item[];
    payment: Pick<
      Settings,
      "bank_details" | "qris_media_key" | "pickup_address" | "contact_phone"
    >;
  }>(endpoint + "/track/" + raw, rev);
  const o = value?.order;
  return (
    <section className="store-shell complete-page">
      <h1>
        {error
          ? "Pesanan belum tersedia."
          : o?.payment_status === "paid"
            ? "Pembayaran terverifikasi."
            : "Pesanan diterima."}
      </h1>
      {loading && <p aria-busy="true">Memuat pesanan…</p>}
      {error && (
        <p className="live-error" role="alert">
          {error}
        </p>
      )}
      {o && (
        <>
          <p>
            {o.order_number} · {label(o.order_status)} ·{" "}
            {label(o.payment_status)} · {label(o.fulfillment_status)}
          </p>
          <div className="complete-slip">
            {value.items.map((i, n) => (
              <div key={n}>
                <span>
                  {i.name_snapshot} · {i.variant_snapshot} × {i.quantity}
                </span>
                <strong>{rupiah(i.line_total_idr)}</strong>
              </div>
            ))}
            <div>
              <span>Pengiriman</span>
              <strong>{rupiah(o.shipping_idr)}</strong>
            </div>
            <div>
              <span>Total</span>
              <strong>{rupiah(o.total_idr)}</strong>
            </div>
          </div>
          {["unpaid", "pending"].includes(o.payment_status) &&
            o.order_status === "pending" && (
              <>
                <h2>Selesaikan pembayaran.</h2>
                <p className="pre-line">{value.payment.bank_details}</p>
                {value.payment.qris_media_key && (
                  <MediaImage
                    className="qris-image"
                    src={endpoint + "/track/" + raw + "/qris"}
                    alt="QRIS toko"
                  />
                )}
                <p>
                  Batas pembayaran:{" "}
                  {new Date(o.reservation_expires_at).toLocaleString("id-ID")}
                </p>
                <p>
                  Hubungi toko setelah transfer: {value.payment.contact_phone}
                </p>
              </>
            )}
          {o.shipment_reference && (
            <p>Referensi kirim: {o.shipment_reference}</p>
          )}
          <p>
            Simpan tautan halaman ini untuk melacak pesanan. Tautan berlaku 30
            hari.
          </p>
        </>
      )}
      <div className="live-actions">
        <button
          className="button button-dark"
          onClick={() => setRev((r) => r + 1)}
        >
          Perbarui status
        </button>
        <Link to={base + "/"}>Kembali ke toko ↗</Link>
      </div>
    </section>
  );
}
