import { Link } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { MediaImage } from "../../components/MediaImage";
import { rupiah, type Product, type Variant } from "../api";
import { EmptyState, QuantityStepper } from "./Commerce";
import { available, type CartLine } from "./model";

export type CheckoutItem = CartLine & {
  product: Product;
  variant: Variant;
  price: number;
};
export function StoreCart({
  items,
  missing,
  base,
  update,
  remove,
  removeMissing,
}: {
  items: CheckoutItem[];
  missing: boolean;
  base: string;
  update: (id: string, q: number) => void;
  remove: (id: string) => void;
  removeMissing: () => void;
}) {
  const count = items.reduce((n, i) => n + i.quantity, 0),
    subtotal = items.reduce((n, i) => n + i.price * i.quantity, 0);
  return (
    <section className="store-shell cart-page sf-cart">
      <Link className="back-link" to={base + "/catalog"}>
        <Icon name="arrow-left" size={17} /> Lanjut belanja
      </Link>
      <div className="sf-catalog-heading">
        <h1>Keranjang</h1>
        <p>{count} item</p>
      </div>
      {missing && (
        <div className="live-error" role="alert">
          <p>Sebagian produk tidak lagi tersedia.</p>
          <button type="button" onClick={removeMissing}>
            Hapus produk tidak tersedia
          </button>
        </div>
      )}
      {items.length ? (
        <>
          <div className="cart-layout">
            <div>
              {items.map((i) => (
                <article className="cart-line" key={i.variant_id}>
                  <Link
                    to={base + "/product/" + i.product.slug}
                    className="sf-cart-photo"
                    aria-label={`Lihat ${i.product.name}`}
                  >
                    {i.variant.image_url || i.product.primary_image_url ? (
                      <MediaImage
                        className="live-thumb"
                        src={
                          i.variant.image_url ||
                          i.product.primary_image_url ||
                          undefined
                        }
                        alt=""
                      />
                    ) : (
                      <Icon name="box" size={30} />
                    )}
                  </Link>
                  <div className="cart-line-body">
                    <h2>
                      <Link to={base + "/product/" + i.product.slug}>
                        {i.product.name}
                      </Link>
                    </h2>
                    <p>{i.variant.option_label}</p>
                    <p>{rupiah(i.price)}</p>
                    <div className="sf-cart-controls">
                      <QuantityStepper
                        name={i.product.name}
                        value={i.quantity}
                        max={available(i.variant)}
                        change={(q) => update(i.variant_id, q)}
                      />
                      <button
                        type="button"
                        className="underlined"
                        aria-label={`Hapus ${i.product.name}`}
                        onClick={() => remove(i.variant_id)}
                      >
                        Hapus
                      </button>
                    </div>
                    {i.quantity > available(i.variant) && (
                      <p role="alert" className="sf-cart-stock-error">
                        Stok berubah. Tersedia {available(i.variant)}. Kurangi
                        jumlah atau hapus produk.
                      </p>
                    )}
                  </div>
                  <strong>{rupiah(i.price * i.quantity)}</strong>
                </article>
              ))}
            </div>
            <aside className="cart-summary">
              <h2>Ringkasan belanja</h2>
              <div>
                <span>Subtotal</span>
                <b>{rupiah(subtotal)}</b>
              </div>
              <p>Ongkos kirim ditampilkan sebelum pesanan dibuat.</p>
              <Link className="pdp-add" to={base + "/checkout"}>
                Lanjut ke checkout <Icon name="arrow-right" />
              </Link>
              <Link className="sf-cart-continue" to={base + "/catalog"}>
                Lanjut belanja
              </Link>
            </aside>
          </div>
          <div className="sf-cart-mobile-summary">
            <div>
              <span>Subtotal</span>
              <strong>{rupiah(subtotal)}</strong>
            </div>
            <Link className="pdp-add" to={base + "/checkout"}>
              Lanjut ke checkout <Icon name="arrow-right" size={17} />
            </Link>
          </div>
        </>
      ) : (
        <EmptyState title="Keranjangmu masih kosong." base={base}>
          <p>Temukan produk pilihanmu, lalu tambahkan ke sini.</p>
        </EmptyState>
      )}
    </section>
  );
}
