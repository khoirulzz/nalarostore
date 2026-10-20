import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { type Product } from "../api";
import { filterCatalog } from "./model";
import { StoreDialog } from "./Commerce";
import { ProductTile, type ProductActions } from "./Products";

export function CategoryRail({
  products,
  base,
}: {
  products: Product[];
  base: string;
}) {
  const location = useLocation(),
    params = new URLSearchParams(location.search),
    selected = params.get("category") || "";
  const categories = [
    ...new Set(products.map((p) => p.category).filter(Boolean)),
  ];
  if (!categories.length) return null;
  return (
    <nav className="sf-category-rail" aria-label="Kategori produk">
      {["", ...categories].map((category) => {
        const next = new URLSearchParams(params);
        if (category) next.set("category", category);
        else next.delete("category");
        return (
          <Link
            key={category}
            className="sf-category-pill"
            aria-current={category === selected ? "page" : undefined}
            to={
              (location.pathname.endsWith("/wishlist")
                ? location.pathname
                : base + "/catalog") + (next.size ? "?" + next : "")
            }
          >
            {category || "Semua"}
          </Link>
        );
      })}
    </nav>
  );
}
function Filters({
  initial,
  apply,
  reset,
}: {
  initial: string;
  apply: (params: URLSearchParams) => void;
  reset: () => void;
}) {
  const [error, setError] = useState("");
  const params = new URLSearchParams(initial);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      min = String(f.get("min") || ""),
      max = String(f.get("max") || "");
    if (min && max && Number(min) > Number(max)) {
      setError("Harga minimum harus lebih kecil dari harga maksimum.");
      return;
    }
    const next = new URLSearchParams(initial);
    for (const key of ["sort", "min", "max", "stock"]) {
      const value = String(f.get(key) || "");
      if (value && !(key === "sort" && value === "new")) next.set(key, value);
      else next.delete(key);
    }
    apply(next);
  }
  return (
    <form className="sf-filter-form" onSubmit={submit}>
      <fieldset>
        <legend>Urutkan</legend>
        {[
          ["new", "Pilihan toko"],
          ["low", "Harga terendah"],
          ["high", "Harga tertinggi"],
        ].map(([value, name]) => (
          <label className="sf-radio" key={value}>
            <input
              type="radio"
              name="sort"
              value={value}
              defaultChecked={(params.get("sort") || "new") === value}
            />
            {name}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>Rentang harga</legend>
        <label>
          Harga minimum
          <input
            type="number"
            name="min"
            min="0"
            step="1"
            inputMode="numeric"
            placeholder="Rp 0"
            defaultValue={params.get("min") || ""}
          />
        </label>
        <label>
          Harga maksimum
          <input
            type="number"
            name="max"
            min="0"
            step="1"
            inputMode="numeric"
            placeholder="Tanpa batas"
            defaultValue={params.get("max") || ""}
          />
        </label>
      </fieldset>
      <label className="sf-radio">
        <input
          type="checkbox"
          name="stock"
          value="1"
          defaultChecked={params.get("stock") === "1"}
        />
        Stok tersedia
      </label>
      {error && (
        <p role="alert" className="live-error">
          {error}
        </p>
      )}
      <div className="sf-filter-actions">
        <button type="button" className="sf-text-button" onClick={reset}>
          Reset
        </button>
        <button className="pdp-add">Terapkan filter</button>
      </div>
    </form>
  );
}
export function StoreCatalog({
  products,
  actions,
  quickAdd,
  wishlist = false,
}: {
  products: Product[];
  actions: ProductActions;
  quickAdd: (p: Product) => void;
  wishlist?: boolean;
}) {
  const location = useLocation(),
    navigate = useNavigate(),
    [filtersOpen, setFiltersOpen] = useState(false);
  const params = new URLSearchParams(location.search),
    query = params.get("q") || "";
  const candidates = wishlist
    ? products.filter((p) => actions.saved.includes(p.id))
    : products;
  const shown = filterCatalog(candidates, params),
    activeFilters = ["min", "max", "stock", "sort"].filter((k) =>
      params.has(k),
    ).length;
  function apply(next: URLSearchParams) {
    navigate(location.pathname + (next.size ? "?" + next : ""));
    setFiltersOpen(false);
  }
  const reset = () => apply(new URLSearchParams());
  function search(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next = new URLSearchParams(params),
      q = String(new FormData(e.currentTarget).get("q") || "").trim();
    if (q) next.set("q", q);
    else next.delete("q");
    apply(next);
  }
  return (
    <section className="store-shell store-section sf-catalog">
      <div className="sf-catalog-heading">
        <div>
          <p className="sf-eyebrow">
            {wishlist ? "Pilihanmu" : "Koleksi toko"}
          </p>
          <h1>{wishlist ? "Produk tersimpan" : "Katalog produk"}</h1>
        </div>
        <p aria-live="polite">{shown.length} produk</p>
      </div>
      {wishlist && (
        <p className="sf-muted">Disimpan di browser ini untuk toko ini.</p>
      )}
      {wishlist && actions.saved.length > candidates.length && (
        <p className="sf-muted">
          Produk yang sudah tidak tersedia di toko ini disembunyikan.
        </p>
      )}
      <div className="sf-catalog-tools">
        <form className="sf-search-field" onSubmit={search}>
          <Icon name="search" size={19} />
          <input
            key={query}
            name="q"
            type="search"
            aria-label="Cari produk"
            defaultValue={query}
            placeholder="Cari produk di toko ini"
          />
          <button type="submit" className="sf-icon-button" aria-label="Cari">
            <Icon name="arrow-right" size={18} />
          </button>
        </form>
        <button
          type="button"
          className="sf-filter-trigger store-outline-button"
          onClick={() => setFiltersOpen(true)}
        >
          <Icon name="sliders" size={18} /> Filter
          {activeFilters > 0 && <span>{activeFilters}</span>}
        </button>
      </div>
      <CategoryRail products={candidates} base={actions.base} />
      <div className="sf-catalog-layout">
        <aside className="sf-filter-sidebar">
          <h2>Filter & urutkan</h2>
          <Filters
            key={location.search}
            initial={location.search}
            apply={apply}
            reset={reset}
          />
        </aside>
        <div>
          <div className="product-grid">
            {shown.map((p) => (
              <ProductTile
                key={p.id}
                product={p}
                actions={actions}
                quickAdd={quickAdd}
              />
            ))}
          </div>
          {!shown.length && (
            <div className="sf-empty">
              <Icon name={wishlist ? "heart" : "search"} size={36} />
              <h2>
                {!candidates.length
                  ? wishlist
                    ? "Belum ada produk tersimpan."
                    : "Koleksi sedang disiapkan."
                  : "Produk belum ditemukan."}
              </h2>
              <p>
                {!candidates.length && wishlist
                  ? "Ketuk ikon hati pada produk yang ingin kamu lihat lagi."
                  : "Coba kata pencarian atau pilihan kategori lainnya."}
              </p>
              {params.size > 0 && (
                <button
                  type="button"
                  className="store-outline-button"
                  onClick={reset}
                >
                  Reset pencarian & filter
                </button>
              )}
              {wishlist && (
                <Link
                  className="store-outline-button"
                  to={actions.base + "/catalog"}
                >
                  Jelajahi produk
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
      {filtersOpen && (
        <StoreDialog
          title="Filter & urutkan"
          close={() => setFiltersOpen(false)}
        >
          <Filters initial={location.search} apply={apply} reset={reset} />
        </StoreDialog>
      )}
    </section>
  );
}
