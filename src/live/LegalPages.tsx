import { Link } from "react-router-dom";
type LegalKind = "privasi" | "ketentuan" | "program-umkm";

const content: Record<LegalKind, { title: string; intro: string; sections: { heading: string; paragraphs: string[] }[] }> = {
  privasi: {
    title: "Kebijakan privasi",
    intro: "Kami memakai informasi yang diperlukan untuk membuka toko, memproses pesanan, memberikan bantuan, dan menjaga keamanan layanan.",
    sections: [
      { heading: "Informasi yang diproses", paragraphs: [
        "Saat mendaftar, kami memproses email dan status autentikasi melalui Firebase. Pemilik toko menambahkan nama toko, kontak, katalog, stok, dan informasi pembayaran toko.",
        "Ketika pembeli membuat pesanan, toko memproses nama, kontak, produk, alamat atau pilihan pengambilan, dan status pembayaran/pengiriman. Data pesanan dapat diakses oleh pengelola toko yang berwenang.",
        "Pengajuan UMKM memuat identitas kontak, lokasi, bidang usaha, dan cerita usaha yang kamu kirimkan."
      ] },
      { heading: "Untuk apa data digunakan", paragraphs: [
        "Untuk menjalankan transaksi dan pengelolaan toko, mengirim konfirmasi layanan, menanggapi permintaan bantuan dan pengajuan UMKM, mencegah penyalahgunaan, serta mengelola penagihan langganan."
      ] },
      { heading: "Penyedia layanan dan keamanan", paragraphs: [
        "Nalaro Store menggunakan penyedia infrastruktur dan autentikasi, termasuk Cloudflare, Aiven PostgreSQL, dan Firebase, sesuai konfigurasi lingkungan layanan. Akses data dibatasi menurut peran. Pengguna tidak boleh mengunggah data sensitif yang tidak diperlukan untuk operasional toko.",
        "Pembayaran pembeli ditujukan langsung ke metode pembayaran yang dipasang pemilik toko. Nalaro Store tidak menyediakan dompet atau penitipan dana pembeli."
      ] },
      { heading: "Penyimpanan dan hak pengguna", paragraphs: [
        "Data disimpan selama diperlukan untuk menjalankan layanan, memenuhi kewajiban pencatatan yang berlaku, menangani sengketa, dan menjaga keamanan. Permintaan akses, koreksi, atau penghapusan data dapat dikirim ke kontak kami; sebagian catatan transaksi mungkin perlu dipertahankan sesuai hukum dan kebutuhan audit."
      ] },
      { heading: "Hubungi kami", paragraphs: [
        "Pertanyaan privasi atau permintaan terkait informasi pribadi dapat dikirim ke store@nalaro.digital. Kebijakan ini akan diperbarui bila praktik pemrosesan atau fitur berubah."
      ] },
    ],
  },
  ketentuan: {
    title: "Syarat dan ketentuan",
    intro: "Nalaro Store adalah sistem toko online berlangganan. Pemilik toko bertanggung jawab atas produk, kesepakatan dengan pembeli, dan pemenuhan pesanannya.",
    sections: [
      { heading: "Akun dan toko", paragraphs: [
        "Pemilik akun harus menyediakan informasi yang benar, menjaga akses akun, dan tidak menggunakan layanan untuk aktivitas yang melanggar hukum. Toko dapat dibuat sebagai draft dan baru menerima pesanan setelah persyaratan publikasi dan akses langganan terpenuhi."
      ] },
      { heading: "Langganan dan promosi", paragraphs: [
        "Harga promosi di halaman publik merupakan informasi pemasaran dan perlu dikonfirmasi saat aktivasi. Paket, periode bulanan atau tahunan, kuota, cara pembayaran, dan kebijakan perpanjangan yang berlaku dicantumkan dalam penawaran atau tagihan yang disetujui.",
        "Penilaian program UMKM gratis tidak menjamin diterima. Masa gratis enam bulan hanya berlaku untuk peserta yang dikonfirmasi tertulis oleh Nalaro."
      ] },
      { heading: "Domain dan ketersediaan fitur", paragraphs: [
        "Alamat toko bawaan dalam domain Nalaro Store disediakan sesuai kelayakan teknis. Domain yang dimiliki sendiri memerlukan verifikasi kepemilikan, pengaturan DNS/TLS, paket yang sesuai, dan aktivasi terpisah; tidak otomatis aktif pada saat mendaftar."
      ] },
      { heading: "Pesanan, pembayaran, dan pengiriman", paragraphs: [
        "Setiap toko mengelola kebenaran katalog, stok, harga, pembayaran dan pengiriman. Pembeli membayar ke rekening atau QRIS milik merchant sesuai instruksi toko; konfirmasi transfer manual harus diverifikasi oleh merchant.",
        "Nalaro Store tidak memotong persentase dari transaksi penjualan. Biaya transfer, penyedia pembayaran, domain, atau layanan pihak ketiga dapat berlaku sesuai penyedianya. Pengembalian dana dan sengketa pembelian diselesaikan dengan pemilik toko sesuai hukum yang berlaku."
      ] },
      { heading: "Penggunaan layanan", paragraphs: [
        "Layanan dapat mengalami pemeliharaan dan gangguan. Kami berupaya menjaga keamanan dan ketersediaan namun tidak menjanjikan layanan tanpa gangguan. Penyalahgunaan, pelanggaran kebijakan, atau masa langganan yang berakhir dapat membatasi publikasi maupun checkout; akses data ditangani sesuai kebijakan dan kewajiban yang berlaku."
      ] },
      { heading: "Kontak", paragraphs: [
        "Hubungi store@nalaro.digital apabila membutuhkan bantuan terkait akun, langganan, atau ketentuan layanan."
      ] },
    ],
  },
  "program-umkm": {
    title: "Ketentuan program UMKM",
    intro: "Kesempatan enam bulan gratis ditujukan untuk membantu UMKM terpilih mencoba pengelolaan toko digital. Pengisian formulir bukan jaminan memperoleh program.",
    sections: [
      { heading: "Pendaftaran dan seleksi", paragraphs: [
        "Pemohon mengisi informasi usaha dan kontak yang dapat diverifikasi. Nalaro dapat menghubungi pemohon untuk meminta informasi tambahan. Peserta dipilih berdasarkan evaluasi internal dan kuota yang tersedia; waktu pengumuman tidak dijanjikan sebelum ada konfirmasi resmi."
      ] },
      { heading: "Periode manfaat", paragraphs: [
        "Bagi peserta yang diterima dan diaktifkan, kesempatan penggunaan gratis berlangsung paling lama enam bulan sesuai tanggal aktivasi yang dikonfirmasi Nalaro. Fitur dan batas penggunaan mengikuti paket pilot yang disetujui. Tidak ada aktivasi gratis otomatis ketika formulir dikirim."
      ] },
      { heading: "Setelah masa gratis", paragraphs: [
        "Nalaro akan memberitahukan pilihan paket yang tersedia. Tidak ada kewajiban berlangganan berbayar hanya karena mengisi formulir. Setelah periode berakhir, layanan dapat dibatasi sesuai kebijakan, dengan ketentuan penanganan data yang berlaku."
      ] },
      { heading: "Alamat toko dan penggunaan wajar", paragraphs: [
        "Alamat toko bawaan Nalaro Store mengikuti ketersediaan teknis. Domain custom tidak termasuk secara otomatis. Peserta wajib menggunakan layanan secara sah dan wajar."
      ] },
      { heading: "Pertanyaan", paragraphs: [
        "Hubungi store@nalaro.digital untuk pertanyaan atau perubahan data pengajuan."
      ] },
    ],
  },
};

export function LegalPage({kind}: {kind: LegalKind}) {
  const legal = content[kind];
  return <main className="legal-page"><div className="shell legal-layout">
    <Link to="/" className="umkm-back">← Kembali ke Nalaro Store</Link>
    <header><h1>{legal.title}</h1><p>{legal.intro}</p><span>Informasi layanan · Pembaruan 15 Oktober 2026</span></header>
    <div className="legal-content">{legal.sections.map(section => <section key={section.heading}>
      <h2>{section.heading}</h2>{section.paragraphs.map((p,i)=><p key={i}>{p}</p>)}
    </section>)}</div>
  </div></main>;
}
