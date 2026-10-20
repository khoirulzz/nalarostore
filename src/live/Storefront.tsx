import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { MediaImage } from "../components/MediaImage";
import { Icon } from "../components/Icon";
import { StoreChat } from "./Engagement";
import { useBuyerSession } from "./BuyerAccount";
import {
  useData,
  type Store,
  type Settings,
  type Product,
  type Variant,
} from "./api";
import {
  CartToast,
  StoreDialog,
  StoreSkeleton,
  type CartNotice,
} from "./storefront/Commerce";
import { StoreCatalog, CategoryRail } from "./storefront/Catalog";
import {
  ProductTile,
  QuickAddSheet,
  StoreProduct,
  type ProductActions,
} from "./storefront/Products";
import { StoreCart } from "./storefront/Cart";
import { StoreCheckout } from "./storefront/Checkout";
import { StoreTracking } from "./storefront/Tracking";
import type { StorefrontDemo } from "./storefront/demo-types";
import {
  accentForeground,
  addToCart,
  available,
  readCart,
  type CartLine,
} from "./storefront/model";
import "./storefront/storefront.css";
const AuthDrawer = lazy(() =>
  import("./Auth").then((m) => ({ default: m.AuthDrawer })),
);

export function LiveStore({
  hostname = false,
  preview = false,
  demo,
}: {
  hostname?: boolean;
  preview?: boolean;
  demo?: StorefrontDemo;
}) {
  const params = useParams(),
    location = useLocation(),
    navigate = useNavigate(),
    session = useBuyerSession();
  const buyer = demo ? null : session;
  const slug = params.slug || "",
    base =
      demo?.base ||
      (preview ? "/preview/" + params.sid : hostname ? "" : "/s/" + slug);
  const endpoint = demo
    ? demo.base + "/local"
    : preview
      ? `/api/merchant/stores/${params.sid}/preview`
      : hostname
        ? "/api/public/store"
        : "/api/public/stores/" + slug;
  const path = location.pathname.slice(base.length) || "/",
    isTracking = path.startsWith("/track/");
  const [revision, setRevision] = useState(0),
    [searchOpen, setSearchOpen] = useState(false),
    [authOpen, setAuthOpen] = useState(false),
    [quickProduct, setQuickProduct] = useState<Product | null>(null);
  const [chatRequest, setChatRequest] = useState<{
    product: Product;
    key: number;
  } | null>(null);
  const remoteShop = useData<{ store: Store; settings: Settings }>(
      demo || isTracking ? null : endpoint,
      revision,
    ),
    remoteCatalog = useData<{ products: Product[] }>(
      demo || isTracking ? null : preview ? endpoint : endpoint + "/products",
      revision,
    ),
    capabilities = useData<{
      liveCheckout: boolean;
      productChatAttachments?: boolean;
    }>(demo ? null : "/api/public/capabilities");
  const shop = demo
    ? {
        value: { store: demo.store, settings: demo.settings },
        loading: false,
        error: "",
      }
    : remoteShop;
  const catalog = demo
    ? { value: { products: demo.products }, loading: false, error: "" }
    : remoteCatalog;
  const storageKey =
      "nalaro-cart-v1:" +
      window.location.hostname +
      ":" +
      (demo
        ? "demo:" + demo.store.id
        : preview
          ? "preview:" + params.sid
          : slug),
    savedKey = storageKey.replace("cart-v1", "saved-v1");
  const [lines, setLines] = useState<CartLine[]>(() => {
    try {
      return readCart(localStorage.getItem(storageKey));
    } catch {
      return [];
    }
  });
  const linesRef = useRef(lines),
    noticeId = useRef(0);
  const authReturn = useRef("store-account");
  function openAuth(source = "store-account") {
    authReturn.current = source;
    setAuthOpen(true);
  }
  function closeAuth() {
    setAuthOpen(false);
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>(`[data-focus-key="${authReturn.current}"]`)
        ?.focus({ preventScroll: true }),
    );
  }
  const [notice, setNotice] = useState<CartNotice | null>(null);
  const [saved, setSaved] = useState<string[]>(() => {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(savedKey) || "[]");
      return Array.isArray(value)
        ? [
            ...new Set(
              value.filter(
                (id): id is string => typeof id === "string" && id.length < 100,
              ),
            ),
          ].slice(0, 500)
        : [];
    } catch {
      return [];
    }
  });
  function commit(next: CartLine[]) {
    linesRef.current = next;
    setLines(next);
  }
  function notify(value: Omit<CartNotice, "id">) {
    setNotice({ ...value, id: ++noticeId.current });
  }
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(lines));
    } catch {
      /* Cart remains usable without storage. */
    }
  }, [storageKey, lines]);
  useEffect(() => {
    try {
      localStorage.setItem(savedKey, JSON.stringify(saved));
    } catch {
      /* Saved products remain usable for this visit. */
    }
  }, [savedKey, saved]);
  useEffect(() => {
    document.title = shop.value?.store.name
      ? shop.value.store.name + " | Nalaro Store"
      : "Nalaro Store";
  }, [shop.value?.store.name]);
  useEffect(() => {
    setSearchOpen(false);
    setAuthOpen(false);
    setQuickProduct(null);
    setNotice(null);
    if (hostname) window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname, hostname]);
  useEffect(() => {
    function shortcut(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        e.key === "/" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !authOpen &&
        !quickProduct &&
        !target.closest("input,textarea,select,[contenteditable]")
      ) {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [authOpen, quickProduct]);
  const all = catalog.value?.products || [];
  const items = lines.flatMap((line) => {
    const product = all.find((p) =>
        p.variants.some((v) => v.id === line.variant_id),
      ),
      variant = product?.variants.find((v) => v.id === line.variant_id);
    return product && variant
      ? [
          {
            ...line,
            product,
            variant,
            price: Number(variant.price_override_idr ?? product.price_idr),
          },
        ]
      : [];
  });
  function add(variant: Variant, q = 1) {
    const result = addToCart(linesRef.current, variant, q);
    if (!result.added) {
      notify({ text: result.error, error: true });
      return false;
    }
    commit(result.lines);
    const product = all.find((p) =>
      p.variants.some((v) => v.id === variant.id),
    );
    notify({
      text: "Produk ditambahkan ke keranjang.",
      detail: `${product?.name || "Produk"} · ${variant.option_label} · ${result.added} item`,
    });
    return true;
  }
  function update(id: string, quantity: number) {
    if (!Number.isInteger(quantity) || quantity < 1) return;
    const v = all.flatMap((p) => p.variants).find((v) => v.id === id),
      current = linesRef.current.find((l) => l.variant_id === id);
    if (
      !v ||
      !current ||
      (quantity > current.quantity && quantity > available(v))
    )
      return;
    commit(
      linesRef.current.map((l) =>
        l.variant_id === id ? { ...l, quantity: Math.min(99, quantity) } : l,
      ),
    );
  }
  function remove(id: string) {
    const line = linesRef.current.find((l) => l.variant_id === id),
      item = items.find((i) => i.variant_id === id);
    if (!line) return;
    commit(linesRef.current.filter((l) => l.variant_id !== id));
    notify({
      text: "Produk dihapus dari keranjang.",
      detail: item?.product.name,
      undo: () => {
        if (item) {
          const current = catalog.value?.products
            .flatMap((p) => p.variants)
            .find((v) => v.id === id);
          if (current) add(current, line.quantity);
        } else
          notify({ text: "Produk ini sudah tidak tersedia.", error: true });
      },
    });
  }
  const actions: ProductActions = {
    base,
    lines,
    add,
    saved,
    toggleSaved: (id) =>
      setSaved((previous) =>
        previous.includes(id)
          ? previous.filter((x) => x !== id)
          : previous.length < 500
            ? [...previous, id]
            : previous,
      ),
  };
  function quickAdd(p: Product) {
    if (p.variants.length === 1) add(p.variants[0]);
    else setQuickProduct(p);
  }
  const askSeller = (product: Product) => {
    setNotice(null);
    setChatRequest((previous) => ({ product, key: (previous?.key || 0) + 1 }));
  };
  function search(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = String(new FormData(e.currentTarget).get("q") || "").trim();
    const next = new URLSearchParams(location.search);
    if (q) next.set("q", q);
    else next.delete("q");
    navigate(base + "/catalog" + (next.size ? "?" + next : ""));
    setSearchOpen(false);
  }
  if (isTracking && !demo)
    return (
      <div className="storefront live-store sf-store">
        <header className="store-header">
          <div className="store-shell sf-tracking-header">
            <Link className="store-logo" to={base + "/"}>
              Pelacakan pesanan
            </Link>
            <Link to={base + "/"}>
              Kembali ke toko <Icon name="arrow-up-right" size={17} />
            </Link>
          </div>
        </header>
        <main>
          <StoreTracking
            endpoint={endpoint}
            token={path.slice("/track/".length)}
            base={base}
          />
        </main>
      </div>
    );
  if ((shop.loading && !shop.value) || (catalog.loading && !catalog.value))
    return <StoreSkeleton product={path.startsWith("/product/")} />;
  if (shop.error || catalog.error || !shop.value)
    return (
      <main className="auth-page">
        <h1>Toko belum tersedia.</h1>
        <p role="alert">
          {shop.error || catalog.error || "Coba muat ulang halaman."}
        </p>
        <button
          className="button button-dark"
          onClick={() => setRevision((r) => r + 1)}
        >
          Coba lagi
        </button>
      </main>
    );
  const s = shop.value.settings,
    store = shop.value.store,
    count = lines.reduce((n, l) => n + l.quantity, 0);
  const found = path.startsWith("/product/")
    ? all.find((p) => p.slug === path.slice("/product/".length))
    : null;
  const accountURL = new URL(
    "/account",
    import.meta.env.VITE_APP_ORIGIN || "https://store.nalaro.digital",
  ).href;
  return (
    <div
      className={`storefront live-store sf-store ${demo ? "sf-demo-fashion" : ""} ${found ? "sf-has-buybar" : ""} ${path === "/cart" && items.length ? "sf-has-cartbar" : ""} ${notice ? "sf-has-toast" : ""} ${authOpen || searchOpen || quickProduct ? "sf-overlay-open" : ""}`}
      style={
        {
          "--store-accent": s.accent,
          "--store-on-accent": accentForeground(s.accent),
        } as CSSProperties
      }
    >
      <a className="sf-skip-link" href="#store-content">
        Langsung ke produk
      </a>
      {demo && (
        <div className="sf-demo-banner">
          <span>Demo Nalaro Fashion</span>
          <span>10 produk contoh · Checkout simulasi</span>
          <Link to="/">
            Tentang Nalaro <Icon name="arrow-up-right" size={13} />
          </Link>
        </div>
      )}
      {preview && (
        <div className="preview-banner">
          Pratinjau toko · Pesanan tidak dapat dibuat di sini.{" "}
          <Link
            to={
              new URLSearchParams(location.search).has("adminStore")
                ? `/admin?tab=overview&store=${params.sid}`
                : "/app/settings"
            }
          >
            Kembali ke pengaturan
          </Link>
        </div>
      )}
      <header className="store-header">
        <div className="store-shell store-header-inner sf-header-inner">
          <Link className="store-logo" to={base + "/"}>
            {s.logo_url ? (
              <MediaImage src={s.logo_url} alt={store.name} />
            ) : (
              store.name
            )}
          </Link>
          <button
            type="button"
            className="sf-header-search"
            aria-label="Cari produk di toko"
            onClick={() => setSearchOpen(true)}
          >
            <Icon name="search" size={20} />
            <span>Cari produk di toko ini</span>
            <kbd>/</kbd>
          </button>
          <nav className="store-account-tools" aria-label="Navigasi toko">
            <Link className="sf-header-catalog" to={base + "/catalog"}>
              Katalog
            </Link>
            <Link
              className="sf-icon-button sf-header-saved"
              to={base + "/wishlist"}
              aria-label={`Produk tersimpan ${saved.length}`}
            >
              <Icon name="heart" size={21} />
              {saved.length > 0 && (
                <span className="sf-mini-count">{saved.length}</span>
              )}
            </Link>
            {!preview &&
              (hostname ? (
                <a
                  className="sf-icon-button"
                  href={accountURL}
                  aria-label="Akun pembeli"
                >
                  <Icon name="users" />
                </a>
              ) : (
                <button
                  type="button"
                  className="sf-icon-button"
                  aria-label="Akun pembeli"
                  data-focus-key="store-account"
                  onClick={() => openAuth()}
                >
                  {buyer ? (
                    <span className="sf-avatar">
                      {(buyer.displayName || buyer.email || "A")
                        .charAt(0)
                        .toUpperCase()}
                    </span>
                  ) : (
                    <Icon name="users" />
                  )}
                </button>
              ))}
            <Link
              className="store-bag sf-icon-button"
              to={base + "/cart"}
              aria-label={`Keranjang ${count} item`}
            >
              <Icon name="bag" />
              {count > 0 && (
                <span className="sf-cart-count" key={count}>
                  {count}
                </span>
              )}
            </Link>
          </nav>
        </div>
        {path === "/" && (
          <div className="store-shell">
            <CategoryRail products={all} base={base} />
          </div>
        )}
      </header>
      <main id="store-content" tabIndex={-1}>
        {demo && path === "/complete" ? (
          demo.completion
        ) : path === "/checkout" ? (
          <StoreCheckout
            key={endpoint}
            endpoint={endpoint}
            base={base}
            items={items}
            settings={s}
            enabled={
              !!demo || (!preview && capabilities.value?.liveCheckout === true)
            }
            demo={!!demo}
            onDemoComplete={
              demo
                ? (method) => {
                    demo.complete(items, method);
                    commit([]);
                    setNotice(null);
                    navigate(base + "/complete");
                  }
                : undefined
            }
            invalid={items.length !== lines.length}
            platform={!hostname}
            onSignIn={
              !hostname && !preview
                ? () => openAuth("checkout-account")
                : undefined
            }
            onComplete={(raw) => {
              commit([]);
              setNotice(null);
              navigate(base + "/track/" + raw);
            }}
            refresh={() => setRevision((r) => r + 1)}
          />
        ) : path === "/cart" ? (
          <StoreCart
            items={items}
            missing={items.length < lines.length}
            base={base}
            update={update}
            remove={remove}
            removeMissing={() =>
              commit(
                linesRef.current.filter((l) =>
                  items.some((i) => i.variant_id === l.variant_id),
                ),
              )
            }
          />
        ) : path.startsWith("/product/") ? (
          found ? (
            <StoreProduct
              key={found.id}
              product={found}
              actions={actions}
              settings={s}
              onChat={preview ? undefined : askSeller}
            />
          ) : (
            <section className="store-shell store-section sf-empty">
              <h1>Produk tidak ditemukan.</h1>
              <Link className="store-outline-button" to={base + "/catalog"}>
                Kembali ke katalog
              </Link>
            </section>
          )
        ) : path === "/catalog" || path === "/wishlist" ? (
          <StoreCatalog
            products={all}
            actions={actions}
            quickAdd={quickAdd}
            wishlist={path === "/wishlist"}
          />
        ) : path === "/" ? (
          <>
            <section
              className={`live-store-hero sf-hero ${s.hero_image_url ? "with-photo" : ""}`}
            >
              {s.hero_image_url && (
                <MediaImage
                  src={s.hero_image_url}
                  alt={s.hero_title || `Koleksi ${store.name}`}
                  fetchPriority="high"
                  decoding="async"
                />
              )}
              <div>
                <p className="sf-eyebrow">{store.name}</p>
                <h1>{s.hero_title || store.name}</h1>
                <p>
                  {store.description ||
                    "Temukan pilihan produk dari toko kami."}
                </p>
                <Link className="store-outline-button" to={base + "/catalog"}>
                  Jelajahi koleksi <Icon name="arrow-up-right" />
                </Link>
              </div>
            </section>
            <section className="store-shell store-section sf-home-products">
              <div className="store-section-head">
                <div>
                  <p className="sf-eyebrow">Dari koleksi kami</p>
                  <h2>Pilihan toko</h2>
                </div>
                <Link to={base + "/catalog"}>
                  Semua produk <Icon name="arrow-up-right" size={17} />
                </Link>
              </div>
              <div className="product-grid sf-featured-grid">
                {all.slice(0, demo ? 10 : 8).map((p) => (
                  <ProductTile
                    key={p.id}
                    product={p}
                    actions={actions}
                    quickAdd={quickAdd}
                  />
                ))}
              </div>
              {!all.length && (
                <div className="sf-empty">
                  <Icon name="box" size={36} />
                  <h2>Koleksi sedang disiapkan.</h2>
                  <p>Kamu bisa menghubungi toko untuk informasi produk.</p>
                </div>
              )}
            </section>
            <section className="sf-store-info">
              <div className="store-shell">
                {s.opening_hours && (
                  <div>
                    <Icon name="clock" size={23} />
                    <span>
                      <small>Jam toko</small>
                      {s.opening_hours}
                    </span>
                  </div>
                )}
                {s.pickup_enabled && (
                  <div>
                    <Icon name="map-pin" size={23} />
                    <span>
                      <small>Ambil di toko</small>
                      {s.pickup_address || "Hubungi toko untuk lokasi"}
                    </span>
                  </div>
                )}
                {s.contact_phone && (
                  <a href={`tel:${s.contact_phone.replace(/[^+0-9]/g, "")}`}>
                    <Icon name="phone" size={23} />
                    <span>
                      <small>Hubungi toko</small>
                      {s.contact_phone}
                    </span>
                  </a>
                )}
              </div>
            </section>
          </>
        ) : (
          <section className="store-shell store-section sf-empty">
            <h1>Halaman tidak ditemukan.</h1>
            <Link className="store-outline-button" to={base + "/"}>
              Kembali ke toko
            </Link>
          </section>
        )}
      </main>
      <footer className="store-footer">
        <div className="store-shell store-footer-grid">
          <div>
            <h2>{store.name}</h2>
            <p>{store.description}</p>
            {s.contact_phone && (
              <a
                className="sf-footer-contact"
                href={`tel:${s.contact_phone.replace(/[^+0-9]/g, "")}`}
              >
                Hubungi toko <Icon name="arrow-up-right" size={17} />
              </a>
            )}
          </div>
          <div>
            <b>Belanja di sini</b>
            <Link to={base + "/catalog"}>Katalog produk</Link>
            <Link to={base + "/wishlist"}>Produk tersimpan</Link>
            <Link to={base + "/cart"}>Keranjang belanja</Link>
          </div>
          <div>
            <b>Informasi toko</b>
            <p>{s.opening_hours}</p>
            <p>
              {s.pickup_enabled ? "Ambil di toko tersedia." : ""}
              {s.delivery_enabled ? " Kurir toko tersedia." : ""}
            </p>
            <details>
              <summary>Kebijakan toko</summary>
              <p className="pre-line">
                {s.policies ||
                  "Hubungi toko untuk informasi produk, pembayaran, dan pengiriman."}
              </p>
            </details>
          </div>
        </div>
        <div className="store-shell store-footer-bottom">
          <span>© {store.name}</span>
          <a href="https://store.nalaro.digital">Powered by Nalaro Store ↗</a>
        </div>
      </footer>
      {demo
        ? demo.chat(chatRequest)
        : !preview && (
            <StoreChat
              key={endpoint + ":" + (buyer?.uid || "guest")}
              endpoint={endpoint}
              accountURL={accountURL}
              products={all}
              request={chatRequest}
              attachmentsEnabled={
                capabilities.value?.productChatAttachments === true
              }
            />
          )}
      {notice && (
        <CartToast
          key={notice.id}
          notice={notice}
          base={base}
          close={() => setNotice(null)}
        />
      )}
      {quickProduct && (
        <QuickAddSheet
          key={quickProduct.id}
          product={all.find((p) => p.id === quickProduct.id) || quickProduct}
          actions={actions}
          close={() => setQuickProduct(null)}
        />
      )}
      {searchOpen && (
        <StoreDialog
          title={`Cari di ${store.name}`}
          close={() => setSearchOpen(false)}
        >
          <form className="sf-search-field" onSubmit={search}>
            <Icon name="search" />
            <input
              data-autofocus
              type="search"
              name="q"
              aria-label="Cari produk"
              placeholder="Nama produk yang kamu cari"
              defaultValue={new URLSearchParams(location.search).get("q") || ""}
            />
            <button className="sf-icon-button" aria-label="Cari">
              <Icon name="arrow-right" />
            </button>
          </form>
          <p className="sf-muted">
            Cari produk berdasarkan nama, lalu persempit dengan filter katalog.
          </p>
        </StoreDialog>
      )}
      {authOpen && demo
        ? demo.account(closeAuth)
        : authOpen &&
          !hostname && (
            <Suspense
              fallback={
                <StoreDialog title="Akun Nalaro Store" close={closeAuth}>
                  <p role="status">Memuat akun…</p>
                </StoreDialog>
              }
            >
              <AuthDrawer close={closeAuth} />
            </Suspense>
          )}
    </div>
  );
}
