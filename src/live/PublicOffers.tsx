import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "./api";

const planBenefits = {
  starter: [
    "Toko online dengan katalog & checkout",
    "Kelola produk, variasi dan stok",
    "Pesanan, pelanggan, dan ringkasan penjualan",
    "Alamat toko di domain Nalaro Store",
    "Pembayaran transfer atau QRIS toko",
  ],
  growth: [
    "Semua kemudahan paket Starter",
    "Kapasitas penggunaan lebih besar sesuai paket aktif",
    "Laporan dan ekspor data penjualan",
    "Bisa mengajukan domain milik sendiri*",
    "Bantuan pengaturan toko dan prioritas dukungan sesuai ketentuan",
  ],
};

export function PublicPricing() {
  return (
    <section className="section-spacing pricing-section" id="paket" aria-labelledby="pricing-title">
      <div className="shell">
        <div className="pricing-heading">
          <h2 id="pricing-title">Pilih langkah pertama untuk tokomu.</h2>
          <p>Mau mulai dari program UMKM atau langsung berlangganan? Cari yang paling cocok buat usahamu.</p>
        </div>
        <div className="pricing-grid">
          <article className="pricing-card pricing-card-free">
            <div className="pricing-card-top">
              <h3>Free untuk UMKM</h3>
              <p>Kesempatan khusus untuk usaha yang ingin mulai go digital.</p>
            </div>
            <div className="pricing-value"><strong>Rp0</strong><span>/ 6 bulan bagi peserta terpilih</span></div>
            <p className="pricing-summary">Ceritakan usahamu lewat formulir. Ada kesempatan berjualan gratis selama enam bulan di Nalaro Store.</p>
            <ul>
              <li>Kesempatan akses toko selama 6 bulan</li>
              <li>Etalase, produk, dan pesanan online</li>
              <li>Pembayaran transfer atau QRIS toko</li>
              <li>Alamat toko dalam domain Nalaro Store</li>
              <li>Pendampingan awal sesuai ketersediaan program</li>
            </ul>
            <Link to="/program-umkm" className="button pricing-action pricing-action-light">Isi formulir UMKM</Link>
            <small>Melalui seleksi, kuota, dan persetujuan Nalaro. Tidak otomatis gratis untuk semua pendaftar.</small>
          </article>
          <article className="pricing-card pricing-card-highlight">
            <div className="pricing-card-top">
              <h3>Starter</h3>
              <p>Untuk mulai punya tempat belanja yang rapi dan mudah dikelola.</p>
            </div>
            <div className="pricing-value"><strong>Rp69.000</strong><span>/ bulan</span></div>
            <p className="pricing-summary">Tidak perlu pusing bikin website atau urus server. Isi produk, lalu mulai jualan.</p>
            <ul>{planBenefits.starter.map(item => <li key={item}>{item}</li>)}</ul>
            <Link to="/register" className="button button-orange pricing-action">Mulai buka toko <span aria-hidden="true">↗</span></Link>
            <small>Harga penawaran pengenalan. Aktivasi dan batas penggunaan sesuai paket yang dikonfirmasi admin.</small>
          </article>
          <article className="pricing-card">
            <div className="pricing-card-top">
              <h3>Growth</h3>
              <p>Untuk bisnis yang mulai ramai dan ingin bergerak lebih jauh.</p>
            </div>
            <div className="pricing-value"><strong>Rp129.000</strong><span>/ bulan</span></div>
            <p className="pricing-summary">Ruang lebih lega untuk mengelola pesanan dan perkembangan bisnismu.</p>
            <ul>{planBenefits.growth.map(item => <li key={item}>{item}</li>)}</ul>
            <Link to="/register" className="button button-dark pricing-action">Pilih paket Growth <span aria-hidden="true">↗</span></Link>
            <small>*Domain custom memerlukan verifikasi DNS/TLS, paket yang memenuhi syarat, dan aktivasi saat fitur tersedia.</small>
          </article>
        </div>
        <p className="pricing-disclaimer">Harga dan hak penggunaan final mengikuti paket aktif pada saat aktivasi. Nalaro tidak mengenakan potongan per transaksi pembeli; biaya bank/penyedia pembayaran di luar Nalaro mungkin berlaku. Domain toko bawaan termasuk; domain milik sendiri belum aktif untuk semua pelanggan.</p>
      </div>
    </section>
  );
}

export function UmkmApplication() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api<{ message?: string }>("/api/public/custom-leads", "POST", {
        business_name: data.get("business_name"),
        contact_name: data.get("contact_name"),
        contact_email: data.get("contact_email"),
        contact_phone: data.get("contact_phone"),
        project_brief: "[PENGAJUAN PROGRAM UMKM NALARO STORE - 6 BULAN]\n" +
          "Bidang usaha: " + data.get("business_category") + "\n" +
          "Lokasi usaha: " + data.get("business_location") + "\n" +
          "Cerita usaha: " + data.get("business_story"),
      });
      setSuccess("Pengajuanmu berhasil terkirim. Tim Nalaro akan meninjau informasi usahamu dan menghubungi kontak yang kamu isi jika ada tindak lanjut.");
    } catch (e) {
      setError((e as Error).message || "Pengajuan belum terkirim. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="umkm-page">
      <div className="shell umkm-layout">
        <div>
          <Link className="umkm-back" to="/">← Kembali ke Nalaro Store</Link>
          <h1>Usahamu layak punya toko sendiri.</h1>
          <p>Kenalkan usaha yang kamu jalankan. Kami membuka kesempatan bagi UMKM terpilih untuk memakai Nalaro Store gratis selama enam bulan.</p>
          <p className="umkm-fine">Pengajuan tidak memerlukan pembayaran. Seleksi, kuota, dan ketentuan penggunaan berlaku. <Link to="/legal/program-umkm">Baca ketentuan program.</Link></p>
        </div>
        <form className="live-form umkm-form" onSubmit={submit}>
          <h2>Formulir UMKM</h2>
          <label>Nama usaha <input required name="business_name" minLength={2} maxLength={120} /></label>
          <label>Nama pemilik/kontak <input required name="contact_name" minLength={2} maxLength={120} /></label>
          <label>Email aktif <input required type="email" name="contact_email" /></label>
          <label>Nomor WhatsApp <input required type="tel" name="contact_phone" minLength={8} maxLength={30}/></label>
          <label>Bidang usaha <select required name="business_category" defaultValue=""><option value="" disabled>Pilih bidang usaha</option><option>Kuliner</option><option>Fashion & tekstil</option><option>Kerajinan & produk lokal</option><option>Kecantikan</option><option>Perlengkapan rumah</option><option>Lainnya</option></select></label>
          <label>Kota/kabupaten usaha <input required name="business_location" maxLength={100}/></label>
          <label>Ceritakan usaha dan produkmu <textarea required name="business_story" minLength={20} maxLength={3000} rows={5} placeholder="Apa yang kamu jual dan mengapa ingin punya toko online?"/></label>
          {error && <p role="alert" className="live-error">{error}</p>}
          {success ? <p role="status" className="notice">{success} Pengajuan akan ditinjau, bukan aktivasi otomatis.</p> : <button className="button button-dark" disabled={busy}>{busy ? "Mengirim pengajuan…" : "Kirim pengajuan UMKM"}</button>}
          <small>Data digunakan untuk meninjau pengajuan dan menghubungimu terkait program. <Link to="/legal/privasi">Kebijakan privasi.</Link></small>
        </form>
      </div>
    </main>
  );
}
