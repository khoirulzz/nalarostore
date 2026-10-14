import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, useData, rupiah, type Plan } from "./api";

export function CustomInquiry() {
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      const r = await api<{ message: string }>(
        "/api/public/custom-leads",
        "POST",
        Object.fromEntries(f.entries()),
      );
      setMessage(r.message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <Link className="brand" to="/">
        nalaro store
      </Link>
      <div className="auth-layout">
        <div>
          <h1>Toko yang dibangun untuk cara bisnismu bekerja.</h1>
          <p>
            Desain, alur transaksi, integrasi, hosting, dan kepemilikan source
            ditetapkan dalam penawaran proyek.
          </p>
        </div>
        <form className="live-form" onSubmit={submit}>
          <h2>Ceritakan kebutuhan toko.</h2>
          <label>
            Nama bisnis
            <input
              required
              name="business_name"
              minLength={2}
              maxLength={120}
            />
          </label>
          <label>
            Nama kontak
            <input required name="contact_name" minLength={2} maxLength={120} />
          </label>
          <label>
            Email
            <input required type="email" name="contact_email" />
          </label>
          <label>
            Nomor WhatsApp
            <input
              required
              type="tel"
              name="contact_phone"
              minLength={8}
              maxLength={30}
            />
          </label>
          <label>
            Kebutuhan proyek
            <textarea
              required
              name="project_brief"
              minLength={20}
              maxLength={10000}
              rows={6}
            />
          </label>
          <label className="honeypot" aria-hidden="true">
            Website
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
          {error && (
            <p className="live-error" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="notice" role="status">
              {message}
            </p>
          )}
          <button className="button button-dark" disabled={busy || !!message}>
            {busy ? "Mengirim…" : "Kirim brief proyek"}
          </button>
        </form>
      </div>
    </main>
  );
}
export function PublicPricing() {
  const { value, error } = useData<{ plans: Plan[] }>("/api/public/plans");
  return (
    <section
      className="section-spacing shell"
      id="paket"
      aria-labelledby="pricing-title"
    >
      <div className="section-intro">
        <h2 id="pricing-title">Mulai dengan paket yang pas.</h2>
        <p>
          Pilih langganan untuk membuka dan mengelola toko sendiri. Punya
          kebutuhan khusus? Kita bisa membahasnya bersama.
        </p>
      </div>
      {error && (
        <p>
          Informasi paket belum bisa dimuat.{" "}
          <a className="underlined" href="mailto:store@nalaro.digital">
            Hubungi kami untuk pilihan langganan
          </a>
          .
        </p>
      )}
      <div className="plan-list">
        {value?.plans.map((p) => (
          <article key={p.id}>
            <h3>{p.name}</h3>
            <p>{p.description}</p>
            {p.prices.map((pr, i) => (
              <p key={i}>
                <strong>{rupiah(pr.amount_idr)}</strong> /{" "}
                {pr.billing_interval === "monthly" ? "bulan" : "tahun"}
              </p>
            ))}
            <Link to="/register" className="button button-dark">
              Mulai buka toko
            </Link>
          </article>
        ))}
      </div>
      {value && !value.plans.length && (
        <p>
          Pilihan paket sedang disiapkan. Ingin tahu mana yang cocok untuk
          usahamu?{" "}
          <a className="underlined" href="mailto:store@nalaro.digital">
            Tanya lewat email
          </a>
        </p>
      )}
    </section>
  );
}
