import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MediaImage } from "../../components/MediaImage";
import { Icon } from "../../components/Icon";
import {
  catalogPrice,
  rupiah,
  type Product,
  type Settings,
  type Variant,
} from "../api";
import { QuantityStepper, StoreDialog } from "./Commerce";
import { available, type CartLine } from "./model";

export type ProductActions = {
  base: string;
  lines: CartLine[];
  add: (v: Variant, quantity?: number) => boolean;
  saved: string[];
  toggleSaved: (id: string) => void;
};
function remaining(v: Variant | undefined, lines: CartLine[]) {
  return Math.max(
    0,
    available(v) - (lines.find((l) => l.variant_id === v?.id)?.quantity || 0),
  );
}
export function ProductTile({
  product: p,
  actions,
  quickAdd,
}: {
  product: Product;
  actions: ProductActions;
  quickAdd: (p: Product) => void;
}) {
  const stock = p.variants.some((v) => available(v) > 0),
    saved = actions.saved.includes(p.id);
  return (
    <article className="product-tile sf-product-tile">
      <div className="product-image">
        {p.primary_image_url ? (
          <MediaImage
            src={p.primary_image_url}
            alt={p.name}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="media-placeholder">
            <Icon name="box" size={40} />
          </span>
        )}
        {!stock && <span className="sf-stock-label">Stok habis</span>}
        <button
          type="button"
          className="sf-save sf-icon-button"
          aria-label={`Simpan ${p.name}`}
          aria-pressed={saved}
          onClick={() => actions.toggleSaved(p.id)}
        >
          <Icon name="heart" size={19} />
        </button>
        <button
          type="button"
          className="sf-quick-add sf-icon-button"
          aria-label={`Tambah ${p.name} ke keranjang`}
          disabled={!stock}
          onClick={() => quickAdd(p)}
        >
          <Icon name="plus" size={22} />
        </button>
      </div>
      <Link
        to={actions.base + "/product/" + p.slug}
        className="sf-product-link"
      >
        <div className="product-meta">
          <span>{p.category}</span>
          <h3>{p.name}</h3>
          <p>
            {p.variants.length > 1 ? "Mulai dari " : ""}
            {rupiah(catalogPrice(p))}
          </p>
        </div>
      </Link>
    </article>
  );
}
function VariantOptions({
  product,
  selected,
  change,
}: {
  product: Product;
  selected?: string;
  change: (v: Variant) => void;
}) {
  return (
    <fieldset className="sf-variants">
      <legend>Pilihan produk</legend>
      <div className="size-options">
        {product.variants.map((v) => (
          <button
            type="button"
            key={v.id}
            aria-pressed={selected === v.id}
            disabled={!available(v)}
            className={selected === v.id ? "selected" : ""}
            onClick={() => change(v)}
          >
            {v.option_label}
            {!available(v) && <small> · Habis</small>}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
export function QuickAddSheet({
  product: p,
  actions,
  close,
}: {
  product: Product;
  actions: ProductActions;
  close: () => void;
}) {
  const [selected, setSelected] = useState<string>();
  const v = p.variants.find((v) => v.id === selected),
    room = remaining(v, actions.lines);
  return (
    <StoreDialog title="Pilih produk" close={close}>
      <div className="sf-quick-product">
        {(v?.image_url || p.primary_image_url) && (
          <MediaImage
            src={v?.image_url || p.primary_image_url || undefined}
            alt=""
          />
        )}
        <div>
          <h3>{p.name}</h3>
          <strong>{rupiah(v?.price_override_idr ?? p.price_idr)}</strong>
          <Link to={actions.base + "/product/" + p.slug} onClick={close}>
            Lihat detail produk <Icon name="arrow-up-right" size={15} />
          </Link>
        </div>
      </div>
      <VariantOptions
        product={p}
        selected={selected}
        change={(v) => setSelected(v.id)}
      />
      <p className="sf-muted" role="status">
        {!v
          ? "Pilih varian yang ingin kamu tambahkan."
          : room > 0
            ? `${room} dapat ditambahkan`
            : "Stok varian ini sudah ada di keranjang."}
      </p>
      <button
        type="button"
        className="pdp-add"
        disabled={!v || !room}
        onClick={() => {
          if (v && actions.add(v, 1)) close();
        }}
      >
        Tambah ke keranjang <Icon name="bag" size={19} />
      </button>
    </StoreDialog>
  );
}
export function StoreProduct({
  product: p,
  actions,
  settings,
  onChat,
}: {
  product: Product;
  actions: ProductActions;
  settings: Settings;
  onChat?: (p: Product) => void;
}) {
  const navigate = useNavigate(),
    gallery = useRef<HTMLDivElement>(null);
  const [vid, setVid] = useState(
      (p.variants.find((v) => available(v)) || p.variants[0])?.id,
    ),
    [quantity, setQuantity] = useState(1),
    [photo, setPhoto] = useState(0),
    [shareStatus, setShareStatus] = useState("");
  const v = p.variants.find((v) => v.id === vid),
    stock = Number(v?.available_stock || 0),
    room = remaining(v, actions.lines);
  const photos = [
    { url: v?.image_url, alt: p.name },
    { url: p.primary_image_url, alt: p.name },
    ...(p.gallery || []),
  ].filter(
    (g, i, all) => !!g.url && all.findIndex((x) => x.url === g.url) === i,
  );
  const canAdd =
    !!v && room >= quantity && Number.isInteger(quantity) && quantity > 0;
  function selectPhoto(index: number) {
    setPhoto(index);
    gallery.current?.scrollTo({
      left: index * gallery.current.clientWidth,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }
  function buy() {
    if (v && canAdd && actions.add(v, quantity))
      navigate(actions.base + "/checkout");
  }
  async function share() {
    setShareStatus("");
    try {
      if (navigator.share)
        await navigator.share({ title: p.name, url: window.location.href });
      else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(window.location.href);
        setShareStatus("Tautan produk disalin.");
      } else setShareStatus("Salin tautan produk dari bilah alamat browser.");
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        setShareStatus("Bagikan produk melalui tautan halaman ini.");
    }
  }
  return (
    <section className="store-shell pdp-page sf-pdp">
      <div className="sf-pdp-top">
        <Link to={actions.base + "/catalog"} className="back-link">
          <Icon name="arrow-left" size={17} /> Kembali ke katalog
        </Link>
        <div>
          <button
            type="button"
            className="sf-icon-button"
            aria-label={`Simpan ${p.name}`}
            aria-pressed={actions.saved.includes(p.id)}
            onClick={() => actions.toggleSaved(p.id)}
          >
            <Icon name="heart" />
          </button>
          <button
            type="button"
            className="sf-icon-button"
            aria-label="Bagikan produk"
            onClick={() => void share()}
          >
            <Icon name="arrow-up-right" />
          </button>
        </div>
      </div>
      {shareStatus && (
        <p role="status" className="product-share-status">
          {shareStatus}
        </p>
      )}
      <div className="pdp-layout">
        <div className="pdp-gallery">
          {photos.length ? (
            <>
              <div
                ref={gallery}
                className="sf-gallery"
                aria-label="Foto produk"
                onScroll={(e) => {
                  const node = e.currentTarget;
                  setPhoto(Math.round(node.scrollLeft / node.clientWidth));
                }}
              >
                {photos.map((g, i) => (
                  <MediaImage
                    key={g.url}
                    src={g.url!}
                    alt={g.alt || p.name}
                    loading={i === 0 ? "eager" : "lazy"}
                    fetchPriority={i === 0 ? "high" : "auto"}
                    decoding="async"
                  />
                ))}
              </div>
              {photos.length > 1 && (
                <>
                  <div className="sf-gallery-count" aria-live="polite">
                    {photo + 1} / {photos.length}
                  </div>
                  <div className="gallery-thumbnails">
                    {photos.map((g, i) => (
                      <button
                        type="button"
                        key={g.url}
                        aria-label={`Lihat foto ${i + 1}: ${g.alt || p.name}`}
                        aria-pressed={photo === i}
                        onClick={() => selectPhoto(i)}
                      >
                        <MediaImage src={g.url!} alt="" loading="lazy" />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="sf-no-photo">
              <Icon name="box" size={64} />
              <span>Foto produk belum tersedia</span>
            </div>
          )}
        </div>
        <div className="pdp-info">
          <p className="sf-eyebrow">{p.category}</p>
          <h1>{p.name}</h1>
          <p className="pdp-price">
            {rupiah(v?.price_override_idr ?? p.price_idr)}
          </p>
          <VariantOptions
            product={p}
            selected={vid}
            change={(x) => {
              setVid(x.id);
              setQuantity(1);
              setPhoto(0);
              gallery.current?.scrollTo({ left: 0, behavior: "instant" });
            }}
          />
          <p className="sf-availability">
            {stock > 0 ? (
              <>
                <span className="sf-stock-dot" />
                {stock <= 3 ? `Tersisa ${stock}` : `${stock} tersedia`}
              </>
            ) : (
              "Stok habis"
            )}
          </p>
          <div className="sf-quantity-row">
            <span>Jumlah</span>
            <QuantityStepper
              name={p.name}
              value={quantity}
              max={room}
              change={setQuantity}
            />
          </div>
          {stock > 0 && room < quantity && (
            <p className="sf-muted" role="status">
              {room
                ? `Maksimal ${room} lagi dapat ditambahkan.`
                : "Jumlah di keranjang sudah mencapai stok atau batas pembelian."}
            </p>
          )}
          <button
            type="button"
            className="pdp-add"
            disabled={!canAdd}
            onClick={() => v && actions.add(v, quantity)}
          >
            Tambah ke keranjang <Icon name="bag" />
          </button>
          <button
            type="button"
            className="store-outline-button live-buy-now"
            disabled={!canAdd}
            onClick={buy}
          >
            Beli sekarang <Icon name="arrow-right" size={17} />
          </button>
          {onChat && (
            <button
              type="button"
              className="product-ask-seller"
              onClick={() => onChat(p)}
            >
              <Icon name="mail" size={19} /> Tanya produk ke penjual{" "}
              <Icon name="arrow-up-right" size={16} />
            </button>
          )}
          <div className="sf-fulfillment">
            {settings.pickup_enabled && (
              <span>
                <Icon name="map-pin" size={18} /> Ambil di toko
              </span>
            )}
            {settings.delivery_enabled && (
              <span>
                <Icon name="truck" size={18} /> Kurir toko
              </span>
            )}
          </div>
          {p.description && (
            <details
              className="sf-description"
              open={p.description.length < 450}
            >
              <summary>
                Tentang produk <Icon name="chevron-down" size={16} />
              </summary>
              <p className="pre-line">{p.description}</p>
            </details>
          )}
        </div>
      </div>
      <div className="live-mobile-buybar" aria-label="Pembelian cepat">
        <div className="live-mobile-buybar-price">
          <span>Harga</span>
          <strong>{rupiah(v?.price_override_idr ?? p.price_idr)}</strong>
        </div>
        {onChat && (
          <button
            type="button"
            className="live-mobile-chat"
            aria-label="Chat penjual tentang produk ini"
            onClick={() => onChat(p)}
          >
            <Icon name="mail" size={21} />
          </button>
        )}
        <button
          type="button"
          className="live-mobile-cart"
          aria-label="Tambah ke keranjang"
          disabled={!canAdd}
          onClick={() => v && actions.add(v, quantity)}
        >
          <Icon name="bag" size={21} />
        </button>
        <button
          type="button"
          className="live-mobile-checkout"
          disabled={!canAdd}
          onClick={buy}
        >
          Beli sekarang <Icon name="arrow-right" size={17} />
        </button>
      </div>
    </section>
  );
}
