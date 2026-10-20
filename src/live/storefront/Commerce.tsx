import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../../components/Icon";

export function StoreDialog({
  title,
  close,
  children,
  wide = false,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    heading = useId();
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const node = dialog.current!,
      previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    node.showModal();
    document.body.style.overflow = "hidden";
    const first = node.querySelector<HTMLElement>("[data-autofocus]");
    first?.focus();
    return () => {
      node.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`sf-dialog ${wide ? "sf-dialog-wide" : ""}`}
      aria-labelledby={heading}
      onCancel={(e) => {
        e.preventDefault();
        closeRef.current();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            closeRef.current();
        }
      }}
    >
      <header>
        <h2 id={heading}>{title}</h2>
        <button
          type="button"
          className="sf-icon-button"
          aria-label="Tutup dialog"
          onClick={close}
        >
          <Icon name="close" />
        </button>
      </header>
      <div className="sf-dialog-content">{children}</div>
    </dialog>
  );
}

export function QuantityStepper({
  value,
  max,
  change,
  name = "produk",
}: {
  value: number;
  max: number;
  change: (n: number) => void;
  name?: string;
}) {
  return (
    <div
      className="quantity-stepper sf-stepper"
      role="group"
      aria-label={`Jumlah ${name}`}
    >
      <button
        type="button"
        aria-label={`Kurangi ${name}`}
        disabled={value <= 1}
        onClick={() => change(value - 1)}
      >
        <Icon name="minus" size={16} />
      </button>
      <output aria-label={`Jumlah ${name}`} aria-live="polite">
        {value}
      </output>
      <button
        type="button"
        aria-label={`Tambah ${name}`}
        disabled={value >= max}
        onClick={() => change(value + 1)}
      >
        <Icon name="plus" size={16} />
      </button>
    </div>
  );
}

export type CartNotice = {
  id: number;
  text: string;
  detail?: string;
  undo?: () => void;
  error?: boolean;
};
export function CartToast({
  notice,
  base,
  close,
}: {
  notice: CartNotice;
  base: string;
  close: () => void;
}) {
  const [hovered, setHovered] = useState(false),
    [focused, setFocused] = useState(false);
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (hovered || focused) return;
    const timer = window.setTimeout(
      () => closeRef.current(),
      notice.undo ? 5000 : 4000,
    );
    return () => window.clearTimeout(timer);
  }, [notice.id, notice.undo, hovered, focused]);
  return (
    <div
      className={`sf-toast ${notice.error ? "sf-toast-error" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
      }}
    >
      <Icon name={notice.error ? "info" : "check"} size={21} />
      <div role="status" aria-live="polite" aria-atomic="true">
        <strong>{notice.text}</strong>
        {notice.detail && <span>{notice.detail}</span>}
      </div>
      {notice.undo ? (
        <button type="button" className="sf-text-button" onClick={notice.undo}>
          Urungkan
        </button>
      ) : (
        !notice.error && (
          <Link to={base + "/cart"} onClick={close}>
            Lihat keranjang <Icon name="arrow-right" size={16} />
          </Link>
        )
      )}
      <button
        type="button"
        className="sf-icon-button"
        aria-label="Tutup informasi"
        onClick={close}
      >
        <Icon name="close" size={17} />
      </button>
    </div>
  );
}

export function StoreSkeleton({ product = false }: { product?: boolean }) {
  return (
    <main
      className="storefront live-store sf-loading"
      aria-busy="true"
      aria-label="Memuat toko"
    >
      <span className="sf-sr-only" role="status">
        Memuat toko…
      </span>
      <div className="sf-skeleton sf-skeleton-header" aria-hidden="true" />
      <div className="store-shell" aria-hidden="true">
        {product ? (
          <div className="sf-skeleton-pdp">
            <div className="sf-skeleton sf-skeleton-photo" />
            <div>
              <div className="sf-skeleton sf-skeleton-title" />
              <div className="sf-skeleton sf-skeleton-title" />
              <div className="sf-skeleton sf-skeleton-photo" />
            </div>
          </div>
        ) : (
          <>
            <div className="sf-skeleton sf-skeleton-hero" />
            <div className="product-grid">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i}>
                  <div className="sf-skeleton sf-skeleton-photo" />
                  <div className="sf-skeleton sf-skeleton-title" />
                  <div className="sf-skeleton sf-skeleton-price" />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

export function EmptyState({
  title,
  children,
  base,
}: {
  title: string;
  children?: ReactNode;
  base: string;
}) {
  return (
    <div className="sf-empty">
      <Icon name="bag" size={40} />
      <h2>{title}</h2>
      {children}
      <Link className="store-outline-button" to={base + "/catalog"}>
        Jelajahi produk <Icon name="arrow-right" size={17} />
      </Link>
    </div>
  );
}
