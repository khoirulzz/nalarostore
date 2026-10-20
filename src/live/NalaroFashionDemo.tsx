import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../components/Icon";
import {
  fashionBase,
  fashionProducts,
  fashionSettings,
  fashionStore,
} from "../data/nalaro-fashion";
import { LiveStore } from "./Storefront";
import { rupiah, type Product } from "./api";
import { StoreDialog } from "./storefront/Commerce";
import type { DemoOrder, StorefrontDemo } from "./storefront/demo-types";
import "./storefront/fashion-demo.css";

const receiptKey = "nalaro-fashion-demo-receipt-v1";
function readReceipt(): DemoOrder | null {
  try {
    const value = JSON.parse(
      sessionStorage.getItem(receiptKey) || "null",
    ) as DemoOrder | null;
    if (
      !value ||
      !/^DEMO-\d+$/.test(value.number) ||
      !Array.isArray(value.items) ||
      !value.items.length ||
      !Number.isFinite(value.shipping)
    )
      return null;
    if (
      !value.items.every(
        (i) =>
          typeof i.name === "string" &&
          typeof i.variant === "string" &&
          Number.isInteger(i.quantity) &&
          i.quantity > 0 &&
          Number.isFinite(i.price),
      )
    )
      return null;
    return value;
  } catch {
    return null;
  }
}
function DemoAccount({ close }: { close: () => void }) {
  return (
    <StoreDialog title="Akun pembeli" close={close}>
      <div className="nf-account-avatar">
        <Icon name="users" size={28} />
      </div>
      <h3>Satu akun, semua toko Nalaro.</h3>
      <p className="sf-muted">
        Di toko asli, akunmu menyimpan alamat, riwayat pesanan, dan percakapan.
        Demo ini bisa kamu jelajahi tanpa masuk atau membuat akun.
      </p>
      <Link className="pdp-add" to={fashionBase + "/wishlist"} onClick={close}>
        Lihat produk tersimpan <Icon name="heart" size={18} />
      </Link>
      <button type="button" className="sf-text-button" onClick={close}>
        Lanjut belanja sebagai tamu →
      </button>
    </StoreDialog>
  );
}
function DemoChat({
  request,
}: {
  request: { product: Product; key: number } | null;
}) {
  const [open, setOpen] = useState(false),
    [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<{ buyer: boolean; text: string }[]>(
    [],
  );
  useEffect(() => {
    if (!request) return;
    setOpen(true);
    setDraft(`Halo, saya ingin bertanya tentang ${request.product.name}.`);
  }, [request]);
  function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setMessages((previous) => [
      ...previous.slice(-18),
      { buyer: true, text },
      {
        buyer: false,
        text: request
          ? `Untuk ${request.product.name}, kamu bisa melihat ukuran dan stok contoh pada pilihan produk. Ini balasan simulasi untuk mencoba chat toko.`
          : "Terima kasih sudah mencoba chat Nalaro Fashion. Pilih produk untuk melihat ukuran dan stok contohnya. Ini balasan simulasi, bukan pesan dari penjual.",
      },
    ]);
    setDraft("");
  }
  return (
    <div className="store-chat nf-demo-chat">
      <button
        type="button"
        className="button button-dark sf-chat-launcher"
        aria-label={open ? "Tutup chat" : "Chat toko"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name={open ? "close" : "mail"} size={21} />
        <span>{open ? "Tutup chat" : "Chat toko"}</span>
      </button>
      {open && (
        <section
          className="store-chat-panel"
          aria-label="Chat demo Nalaro Fashion"
        >
          <header>
            <div>
              <strong>Nalaro Fashion</strong>
              <p>Chat simulasi · Pesan tidak dikirim</p>
            </div>
            <button
              type="button"
              className="sf-icon-button"
              aria-label="Tutup panel chat"
              onClick={() => setOpen(false)}
            >
              <Icon name="close" size={17} />
            </button>
          </header>
          {request && (
            <Link
              className="nf-chat-product"
              to={fashionBase + "/product/" + request.product.slug}
              onClick={() => setOpen(false)}
            >
              <Icon name="box" size={18} />
              {request.product.name}
              <Icon name="arrow-up-right" size={15} />
            </Link>
          )}
          <div
            className="nf-chat-messages"
            role="log"
            aria-label="Percakapan demo"
            aria-live="polite"
          >
            <p className="sf-muted">
              Ada yang ingin kamu tanyakan? Coba tulis pesan untuk melihat
              tampilan percakapannya.
            </p>
            {messages.map((m, i) => (
              <div
                key={i}
                className={m.buyer ? "nf-chat-message mine" : "nf-chat-message"}
              >
                <small>{m.buyer ? "Kamu" : "Balasan contoh"}</small>
                <p>{m.text}</p>
              </div>
            ))}
          </div>
          <form onSubmit={send}>
            <label htmlFor="nf-demo-message">Pesan</label>
            <textarea
              id="nf-demo-message"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="Tulis pertanyaanmu…"
              required
            />
            <button className="pdp-add" disabled={!draft.trim()}>
              Kirim pesan demo <Icon name="arrow-right" size={16} />
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
function DemoComplete({ receipt }: { receipt: DemoOrder | null }) {
  if (!receipt)
    return (
      <section className="store-shell sf-empty">
        <Icon name="bag" size={38} />
        <h1>Belum ada simulasi pesanan.</h1>
        <p>Tambahkan produk ke keranjang untuk mencoba alur pemesanan.</p>
        <Link className="store-outline-button" to={fashionBase + "/catalog"}>
          Jelajahi koleksi
        </Link>
      </section>
    );
  const subtotal = receipt.items.reduce((n, i) => n + i.quantity * i.price, 0);
  return (
    <section className="store-shell nf-complete">
      <div className="nf-complete-mark">
        <Icon name="check" size={30} />
      </div>
      <p className="sf-eyebrow">Demo Nalaro Fashion</p>
      <h1>Simulasi pesanan selesai.</h1>
      <p>Tidak ada pesanan nyata atau pembayaran yang perlu dilakukan.</p>
      <div className="nf-receipt">
        <header>
          <strong>{receipt.number}</strong>
          <span>Ringkasan contoh</span>
        </header>
        {receipt.items.map((i, index) => (
          <div className="checkout-line" key={index}>
            <span>
              {i.name}
              <small>
                {i.variant} × {i.quantity}
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
          <span>
            {receipt.method === "pickup"
              ? "Ambil di toko"
              : "Kurir toko (contoh)"}
          </span>
          <strong>{rupiah(receipt.shipping)}</strong>
        </div>
        <div className="checkout-line nf-receipt-total">
          <span>Total simulasi</span>
          <strong>{rupiah(subtotal + receipt.shipping)}</strong>
        </div>
      </div>
      <p className="sf-muted">
        Di toko asli, tahap berikutnya adalah pembayaran dan verifikasi oleh
        toko. Data kontak yang kamu isi pada demo tidak dikirim atau disimpan.
      </p>
      <Link className="store-outline-button" to={fashionBase + "/catalog"}>
        Lanjut jelajahi koleksi <Icon name="arrow-right" size={18} />
      </Link>
    </section>
  );
}
export function NalaroFashionDemo() {
  const [receipt, setReceipt] = useState<DemoOrder | null>(readReceipt);
  const demo: StorefrontDemo = {
    base: fashionBase,
    store: fashionStore,
    settings: fashionSettings,
    products: fashionProducts,
    complete: (items, method) => {
      const next: DemoOrder = {
        number: "DEMO-" + Date.now().toString().slice(-8),
        createdAt: new Date().toISOString(),
        method,
        shipping: method === "pickup" ? 0 : fashionSettings.shipping_fee_idr,
        items: items.map((i) => ({
          name: i.product.name,
          variant: i.variant.option_label,
          quantity: i.quantity,
          price: i.price,
        })),
      };
      setReceipt(next);
      try {
        sessionStorage.setItem(receiptKey, JSON.stringify(next));
      } catch {
        /* Demo remains usable without persistence. */
      }
    },
    completion: <DemoComplete receipt={receipt} />,
    account: (close) => <DemoAccount close={close} />,
    chat: (request) => <DemoChat request={request} />,
  };
  return <LiveStore key={fashionStore.id} demo={demo} />;
}
