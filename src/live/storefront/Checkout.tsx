import { useMemo, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { CheckoutAccount, useBuyerSession } from "../BuyerAccount";
import { api, rupiah, type Settings } from "../api";
import { type CheckoutItem } from "./Cart";

export function StoreCheckout({
  endpoint,
  base,
  items,
  settings: s,
  enabled,
  invalid,
  onComplete,
  refresh,
  onSignIn,
  platform,
  demo = false,
  onDemoComplete,
}: {
  endpoint: string;
  base: string;
  items: CheckoutItem[];
  settings: Settings;
  enabled: boolean;
  invalid: boolean;
  onComplete: (token: string) => void;
  refresh: () => void;
  onSignIn?: () => void;
  platform: boolean;
  demo?: boolean;
  onDemoComplete?: (method: string) => void;
}) {
  const [method, setMethod] = useState(
      s.pickup_enabled ? "pickup" : "local_flat",
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const subtotal = items.reduce((a, i) => a + i.price * i.quantity, 0),
    shipping = method === "pickup" ? 0 : Number(s.shipping_fee_idr),
    total = subtotal + shipping;
  const session = useBuyerSession();
  const buyer = demo ? null : session;
  const storageKey = "checkout-v1:" + endpoint + ":" + (buyer?.uid || "guest");
  const [contact, setContact] = useState({
    name: "",
    phone: "",
    email: buyer?.email || "",
    address: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({}),
    [activeStep, setActiveStep] = useState(0);
  useEffect(() => {
    if (buyer?.email)
      setContact((c) => (c.email ? c : { ...c, email: buyer.email || "" }));
  }, [buyer?.email]);
  const idempotency = useMemo(() => {
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
  }, [storageKey]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget;
    const errors: Record<string, string> = {};
    const messages: Record<string, string> = {
      name: "Isi nama lengkap, minimal 2 karakter.",
      phone: "Isi nomor WhatsApp yang benar (8–25 karakter).",
      email: "Periksa alamat email yang kamu masukkan.",
      address: "Isi alamat lengkap, minimal 12 karakter.",
    };
    let first:
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | undefined;
    for (const element of Array.from(form.elements)) {
      if (
        (element instanceof HTMLInputElement ||
          element instanceof HTMLTextAreaElement ||
          element instanceof HTMLSelectElement) &&
        !element.validity.valid
      ) {
        errors[element.name] = messages[element.name] || "Periksa isian ini.";
        first ||= element;
      }
    }
    if (contact.name.trim().length < 2) errors.name = messages.name;
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      (first || form.querySelector<HTMLInputElement>('[name="name"]'))?.focus();
      return;
    }
    if (demo) {
      if (
        enabled &&
        !invalid &&
        items.length &&
        items.every((i) => i.quantity <= Number(i.variant.available_stock))
      )
        onDemoComplete?.(method);
      return;
    }
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
      <h1>{demo ? "Coba alur pemesanan." : "Selesaikan pemesanan."}</h1>
      <p>
        {demo
          ? "Gunakan data contoh. Tidak ada pesanan atau pembayaran nyata; data kontak tidak dikirim atau disimpan."
          : "Bayar melalui rekening atau QRIS toko setelah pesanan diterima."}
      </p>
      <nav className="sf-checkout-progress" aria-label="Bagian checkout">
        {[
          ["contact", "Kontak"],
          ["shipping", "Pengiriman"],
          ["payment", "Pembayaran"],
        ].map(([id, name], index) => (
          <a
            key={id}
            href={`#checkout-${id}`}
            aria-current={activeStep === index ? "step" : undefined}
            onClick={() => setActiveStep(index)}
          >
            <span>{index + 1}</span>
            {name}
          </a>
        ))}
      </nav>
      {demo ? (
        <div className="notice checkout-account">
          <div>
            <strong>Belanja sebagai tamu</strong>
            <p>
              Kamu bisa mencoba checkout tanpa akun. Seluruh harga dan ongkir di
              sini adalah contoh.
            </p>
          </div>
        </div>
      ) : (
        <CheckoutAccount
          onSignIn={onSignIn}
          platform={platform}
          onAddress={(a) =>
            setContact({
              name: a.recipient_name,
              phone: a.contact_phone,
              email: buyer?.email || "",
              address: a.address,
            })
          }
        />
      )}
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
      <form
        className="checkout-layout live-form"
        noValidate
        onSubmit={submit}
        onFocusCapture={(e) => {
          const step = (e.target as HTMLElement).closest<HTMLElement>(
            "[data-step]",
          )?.dataset.step;
          if (step) setActiveStep(Number(step));
        }}
        onChange={(e) => {
          const name = (e.target as unknown as HTMLInputElement).name;
          if (fieldErrors[name])
            setFieldErrors((previous) => {
              const next = { ...previous };
              delete next[name];
              return next;
            });
        }}
      >
        <div className="checkout-fields">
          <fieldset id="checkout-contact" data-step="0">
            <legend>01 · Kontak pembeli</legend>
            <label>
              <span id="checkout-name-label">Nama lengkap</span>
              <input
                required
                name="name"
                aria-labelledby="checkout-name-label"
                aria-invalid={!!fieldErrors.name}
                aria-describedby={
                  fieldErrors.name ? "checkout-name-error" : undefined
                }
                value={contact.name}
                onChange={(e) =>
                  setContact((c) => ({ ...c, name: e.target.value }))
                }
                minLength={2}
                maxLength={120}
                autoComplete="name"
              />
              {fieldErrors.name && (
                <small
                  id="checkout-name-error"
                  className="sf-field-error"
                  role="alert"
                >
                  {fieldErrors.name}
                </small>
              )}
            </label>
            <label>
              <span id="checkout-phone-label">Nomor WhatsApp</span>
              <input
                required
                name="phone"
                aria-labelledby="checkout-phone-label"
                aria-invalid={!!fieldErrors.phone}
                aria-describedby={
                  fieldErrors.phone ? "checkout-phone-error" : undefined
                }
                value={contact.phone}
                onChange={(e) =>
                  setContact((c) => ({ ...c, phone: e.target.value }))
                }
                type="tel"
                pattern="[+0-9 ()-]{8,25}"
                autoComplete="tel"
              />
              {fieldErrors.phone && (
                <small
                  id="checkout-phone-error"
                  className="sf-field-error"
                  role="alert"
                >
                  {fieldErrors.phone}
                </small>
              )}
            </label>
            <label>
              <span id="checkout-email-label">Email (opsional)</span>
              <input
                name="email"
                aria-labelledby="checkout-email-label"
                aria-invalid={!!fieldErrors.email}
                aria-describedby={
                  fieldErrors.email ? "checkout-email-error" : undefined
                }
                type="email"
                autoComplete="email"
                value={contact.email}
                onChange={(e) =>
                  setContact((c) => ({ ...c, email: e.target.value }))
                }
              />
              {fieldErrors.email && (
                <small
                  id="checkout-email-error"
                  className="sf-field-error"
                  role="alert"
                >
                  {fieldErrors.email}
                </small>
              )}
              <small>
                Email dicantumkan pada pesanan. Status tersedia melalui tautan
                pelacakan.
              </small>
            </label>
          </fieldset>
          <fieldset id="checkout-shipping" data-step="1">
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
                <span id="checkout-address-label">Alamat lengkap</span>
                <textarea
                  required
                  name="address"
                  aria-labelledby="checkout-address-label"
                  aria-invalid={!!fieldErrors.address}
                  aria-describedby={
                    fieldErrors.address ? "checkout-address-error" : undefined
                  }
                  value={contact.address}
                  onChange={(e) =>
                    setContact((c) => ({ ...c, address: e.target.value }))
                  }
                  minLength={12}
                  maxLength={2000}
                  autoComplete="street-address"
                  rows={4}
                />
                {fieldErrors.address && (
                  <small
                    id="checkout-address-error"
                    className="sf-field-error"
                    role="alert"
                  >
                    {fieldErrors.address}
                  </small>
                )}
              </label>
            )}
          </fieldset>
          <fieldset id="checkout-payment" data-step="2">
            <legend>03 · Pembayaran</legend>
            <p>
              {demo
                ? "Di toko asli, instruksi transfer atau QRIS ditampilkan setelah pesanan dibuat. Demo ini tidak meminta pembayaran."
                : "Transfer bank / QRIS manual. Status dibayar muncul setelah toko memverifikasi pembayaran."}
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
            {busy
              ? "Mengirim pesanan…"
              : (demo ? "Simulasikan pesanan · " : "Buat pesanan · ") +
                rupiah(total)}
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
