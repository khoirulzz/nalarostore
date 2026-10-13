# desain.md — Nalaro Store

**Versi:** 1.1 · 14 Oktober 2026 · Hybrid SaaS + Custom + Premium SVG Library  
**Status:** Design direction + implementable UI/UX specification  
**Dokumen pasangan:** `PRD-Nalaro-Store.md`  
**Filosofi:** *A real commerce product, not an AI-generated dashboard template.*

## 1. Visi pengalaman

Nalaro Store terdiri atas **tiga pengalaman yang sengaja dibedakan**:

1. **Nalaro Store Marketing:** menjual manfaat platform dengan presentasi editorial, bukti produk, dan transisi yang terarah.
2. **Merchant Workspace:** area kerja efisien untuk pemilik UMKM, bukan parade statistik dan kartu generik.
3. **Customer Storefront:** sebuah toko sungguhan yang terasa dimiliki merchant, bukan landing builder; tipe toko menentukan komposisi visual dan merchandising.

Persatuan ketiganya berasal dari kualitas tipografi, keluwesan navigasi, performa, aksesibilitas, dan pola komponen fungsional, **bukan** karena seluruh permukaan menggunakan desain card yang sama.

### 1.1 Hukum desain

- **Commerce first:** fitur transaksi harus terasa lebih utama dibanding dekorasi.
- **Content creates layout:** komposisi dipandu foto produk, informasi harga, dan tindakan nyata.
- **Mobile is first-class:** bukan desktop yang diperkecil; interaksi didesain ulang sesuai konteks.
- **Confident restraint:** ruang kosong, ritme tipografi, fotografi autentik, dan grid disiplin.
- **Human clarity:** label Bahasa Indonesia natural, tanpa jargon development atau copy promosi hiperbolis.
- **Consistent mechanics, varied expression:** logika checkout sama di seluruh tema, ekspresi visual berbeda.

## 2. Daftar larangan anti-AI-slop

**Jangan gunakan sebagai pola default:**

- Badge kecil penuh huruf kapital di atas setiap headline besar.
- Tanda dash/garis pendek dekoratif sebagai pemisah kalimat setiap section.
- Hero gradient neon ungu-biru, blob blur, glow murahan, glassmorphism berlebihan.
- Grid 3 kolom berisi card identik di setiap section; statistik card berulang tanpa makna.
- Ikon emoji/random, ilustrasi karakter stok SaaS, gambar AI plastik dengan kulit/produk tidak realistis.
- Headline klise: “Solusi Digital Masa Depan”, “Revolusi Bisnis Anda”, “All-in-one Ultimate”, “Tingkatkan Bisnismu ke Level Berikutnya”.
- Fake social proof, angka pelanggan atau omzet palsu, logo partner yang tidak nyata.
- Badge “AI powered” jika tidak ada fitur AI yang benar-benar digunakan.
- Shadow berat pada semua panel, border radius raksasa di semua komponen, border dekoratif di semua sisi.
- Tombol CTA dengan banyak warna dan prioritas sama; pop-up promosi sebelum user memahami toko.
- Sticky elemen yang menutup konten atau membuat mobile sulit digunakan.
- Skeleton loading yang melompat dan merusak CLS.
- Parallax/autoplay panjang yang melawan preferensi reduced motion.
- Placeholder non-produksi: `Lorem ipsum`, `Demo Mode`, `Feature Coming Soon` di jalur transaksi, `Trusted by 1000+` tanpa bukti.

**Gunakan sebagai gantinya:** fotografi produk yang konkret, informasi terstruktur, garis separator seperlunya, editorial asymmetry, warna terbatas, ikon SVG konsisten, animasi mikro yang membantu orientasi, serta interaksi yang menyelesaikan pekerjaan.

## 3. Identitas platform Nalaro Store

Warna brand induk boleh dipakai di **marketing dan merchant dashboard**, tetapi **tidak dipaksakan pada storefront klien**.

| Token | Nilai awal | Fungsi |
|---|---|---|
| `--brand` | `#FF5B2E` | CTA platform, fokus brand, status tindakan aktif |
| `--ink` | `#151515` | Headline dan teks kuat |
| `--canvas` | `#F5F3EF` | Latar marketing, panel editorial |
| `--paper` | `#FFFFFF` | Surface kerja dan konten |
| `--subtle` | `#6C6A66` | Teks sekunder, verifikasi kontras |
| `--line` | `#E6E3DE` | Divider informasional |
| `--success` | `#197A4E` | Pembayaran/status berhasil |
| `--warning` | `#AE641C` | Butuh tindakan |
| `--danger` | `#B42318` | Error/destructive |

**Status payment harus memiliki label teks dan ikon; warna tidak boleh menjadi satu-satunya indikator.** Token status diuji WCAG contrast; nilai di atas merupakan seed design, bukan izin memakai teks tanpa pengecekan kontras.

### 3.1 Tipografi

- **Display/marketing:** sans editorial grotesk dengan varian berat yang bagus; alternatif aman `Inter`, `Manrope`, atau font open-source yang di-host sendiri setelah audit lisensi dan performa. Jangan bergantung pada font lisensi berbayar tanpa izin.
- **UI operasional:** sans mudah dibaca; numeric tabular untuk harga/tabel dan jam.
- **Storefront:** tema dapat memilih maksimal dua keluarga font yang telah diuji performance; hindari script dekoratif pada harga/checkout.
- Font size mobile minimal 16px untuk input/teks utama dan hindari input zoom iOS; caption hanya untuk informasi sekunder non-kritis.

**Skala contoh:** display 56–80 desktop / 36–46 mobile; H1 halaman 36–48 desktop / 28–34 mobile; H2 28–40 desktop / 24–30 mobile; body 16–18; label 13–14; harga 18–30 sesuai konteks.

### 3.2 Grid, layout, spacing

| Mode | Ukuran | Grid | Padding |
|---|---|---|---|
| Small phone | 320–374px | 4 kolom | 16px |
| Phone | 375–599px | 4 kolom | 20px |
| Tablet | 600–1023px | 8 kolom | 24–32px |
| Desktop | ≥1024px | 12 kolom | 40–64px |
| Large | ≥1440px | 12 kolom bounded | max-width 1360–1440px |

Spacing baseline 4/8/12/16/24/32/48/64/96. Hindari semua komponen dipaksa rounded 24px. Radius 4–8px untuk kontrol, 8–12px panel tertentu, 0px saat visual editorial memang membutuhkan edge penuh. Shadow hanya untuk elevasi yang nyata (popover/dialog), bukan isi halaman.

## 4. Marketing website — art direction dan komposisi

### 4.1 Hero yang berbeda dari SaaS biasa

**Konsep:** “Your commerce, in motion.” Setengah pertama berupa copy tegas; setengah kedua **potongan layar produk autentik** yang tersusun seperti photographic editorial spread: storefront fashion desktop, checkout mobile, merchant orders panel. Hindari dashboard miring 3D floating generik.

Desktop: headline kiri sekitar 44% lebar dan komposisi editorial kanan 56%; tiga potongan layar tumpang tindih hanya jika tiap elemen tetap terbaca. Mobile: headline/CTA dahulu, satu visual perangkat besar dengan crop terarah, visual tambahan berikutnya sebagai horizontal scroll yang accessible.

Usulan copy:

**“Toko online yang benar-benar bisa berjualan.”**  
“Katalog, keranjang, checkout, dan pengelolaan pesanan dalam satu tempat. Dirancang untuk bisnis yang ingin punya toko sendiri.”  
CTA: **Buat toko online** · **Lihat contoh toko** · layanan sekunder **Pesan toko custom** (jelas terpisah dari langganan).

### 4.2 Urutan section — jangan gunakan pola card monoton

| Section | Bentuk | Tujuan |
|---|---|---|
| Hero | Split editorial + real UI composition | Positioning langsung |
| Cara kerja | Storyline horizontal 3 langkah dengan screenshot detail | Onboarding mudah |
| Pilih identitas toko | Side-by-side dua storefront berbeda | Bukti variasi desain |
| Dari produk ke pembayaran | Scrollytelling sederhana: detail → cart → checkout | Tunjukkan commerce nyata |
| Workspace | Full-bleed dashboard screenshot + annotation terbatas | Tunjukkan efisiensi operasional |
| Commerce Indonesia | Editorial list tentang pickup, kurir lokal, WA dan pembayaran | Relevansi pasar |
| Paket dan Custom | Dua jalur bisnis yang jelas: langganan bulanan/tahunan + pesanan pengembangan khusus. Harga SaaS hanya dari admin; sebelum ditentukan arahkan “Diskusikan paket” | Kepercayaan |
| FAQ | Accordion yang relevan, bukan sekadar pengisi halaman | Mengatasi keberatan |
| Closing | Statement besar + satu CTA | Konversi |

Gunakan fotografi merchant nyata hanya bila memiliki hak penggunaan; jika belum ada, pakai **screenshot produk dari seed data yang ditandai sebagai contoh**. Jangan tampilkan testimonial palsu.

## 5. Merchant dashboard — desain untuk pekerjaan nyata

### 5.1 Rangka halaman

**Desktop ≥1024px**

```text
┌──────────── sidebar 228–248 ──────────┬──────────────── workspace ─────────────────────┐
│ Nalaro Store                           │ Toko: Narwasita              [Lihat toko] [⋯] │
│ [Pemilih toko]                         │ Beranda                                     │
│                                       │                                             │
│ Beranda                                │ Perlu perhatian                            │
│ Pesanan   (4)                         │  3 pesanan baru  •  2 perlu dikirim       │
│ Produk                                │                                             │
│ Stok                                  │ Pesanan terbaru        │ Penjualan 7 hari    │
│ Pelanggan                             │ row • row • row        │ grafik tenang       │
│ Promosi                               │                      │                    │
│ Analitik                              │ Item stok rendah   /  aktivitas terbaru     │
│ Tampilan Toko                         │                                             │
│ Pengaturan                            │                                             │
└───────────────────────────────────────┴─────────────────────────────────────────────┘
```

Sidebar bukan list dengan kotak card di setiap item. Ada active rail halus, ikon tunggal 20px, label, badge jumlah hanya ketika membutuhkan perhatian.

**Mobile ≤767px:** header kecil berisi pemilih toko dan action; bottom navigation **Beranda, Pesanan, Produk, Lainnya**. Halaman daftar mengutamakan pencarian/filter sebelum item; detail/editor memakai halaman penuh, bukan modal sempit. Sidebar desktop menjadi drawer untuk menu lanjutan di tablet bila diperlukan.

### 5.2 Beranda merchant

- Judul natural: **“Selamat pagi, berikut kondisi tokonya.”** hanya jika salam dinamis masuk akal; alternatif **“Ringkasan toko”**.
- Bagian teratas **action queue**, bukan empat kartu metrik berulang. Misalnya satu baris order yang bisa langsung ditindaklanjuti.
- KPI cukup 2–3 indikator penting dalam strip sederhana: Pesanan hari ini, Penjualan terverifikasi, Perlu diproses. Jika tidak ada data, tampilkan nol secara jujur dan panduan tindakan.
- Grafik penjualan line/bar sederhana, bisa diakses via tabel dan tidak memaksakan animasi.
- Riwayat aktivitas ditampilkan hanya bila berguna, tanpa feed noise.

### 5.3 Pesanan

Desktop: tabel tegas tanpa card wrapper berulang; kolom `Pesanan`, `Pembeli`, `Waktu`, `Total`, `Pembayaran`, `Pengiriman`, `Aksi`. Truncation tetap punya akses konten penuh.

Mobile: row stack pendek per pesanan, urutan ID+status → pembeli → nominal → action. Filter berbentuk chip horizontal dengan scroll-snap, tetapi bukan satu-satunya cara filter (ada dropdown lengkap).

Detail order: header ID dan status, tombol status yang sesuai (tidak tampilkan tindakan ilegal), timeline aktivitas, ringkasan produk, pembayaran, alamat dan catatan. Untuk order berisiko, konfirmasi irreversible action di dialog.

### 5.4 Produk dan editor

- **List:** thumbnail 48–64px, nama, varian, harga, status stok, publish state. Batch actions dipisahkan dan jelas.
- **Editor desktop:** form utama 2/3 lebar, rail 1/3 untuk publish/visibility/media ringkasan; tidak semua field dijadikan card sendiri.
- **Editor mobile:** urutan section dengan sticky action bottom `Simpan draft` / `Terbitkan` (safe area diperhitungkan); label tetap terlihat; navigasi tidak menutup keyboard.
- **Variant matrix:** kombinasi ukuran/warna dalam tabel compact desktop, list accordion di mobile. Stok total tidak boleh menipu apabila varian berbeda.
- Upload menampilkan progressive status, preview, crop guidance, alt text dan validasi file.

### 5.5 Tema dan tampilan toko

Store design editor memakai **split preview + structured controls**, bukan page-builder bebas:

- Desktop: panel kiri `Tema / Warna / Font / Section / Header / Footer`; area kanan iframe isolated storefront preview (responsif), toolbar perangkat.
- Mobile: pilih section → form parameter → tombol **Lihat pratinjau** full-screen → kembali edit.
- Konfigurasi tema JSON versioned, whitelist sections, schema validation, sanitization; URL/media hanya dari sumber tepercaya. Draft/publish versioning + rollback.
- Terapkan perubahan hanya ke tenant terpilih; preview tidak memengaruhi situs publik sebelum publish.

## 6. Storefront — bukan satu layout untuk seluruh toko

### 6.1 Template pertama: **Atelier** (fashion/lifestyle)

**Untuk:** pakaian, beauty, produk handmade bernilai desain.  
**Prinsip:** fotografi dan cerita koleksi, katalog tetap mudah ditelusuri.  
**Komposisi desktop:** header tipis dengan logo+search+bag; hero 60/40 (foto editorial besar vs teks koleksi); subnav kategori; *product grid* 4 kolom hanya pada halaman katalog; koleksi unggulan asimetris di homepage; produk terkait; footer editorial.  
**Mobile:** hero portrait 4:5 yang tidak memakan lebih dari satu viewport penuh, kategori sebagai tabs atau links, produk 2 kolom (1 kolom jika viewport/teks terlalu sempit), harga dan add action terbaca.

### 6.2 Template kedua: **Market** (general/electronics)

**Untuk:** toko serba ada, perangkat, produk banyak SKU.  
**Prinsip:** findability, perbandingan, kegunaan.  
**Komposisi:** pencarian menonjol, category rail, featured products, filter lebih kaya, kepadatan informasi moderat; halaman produk fokus spesifikasi, stok, pengiriman dan value.  
**Bukan** mengubah warna dari Atelier; struktur navigasi, density dan prioritasnya memang lain.

### 6.3 Template ketiga: **Local** (makanan/flower/lokal)

**Untuk:** bisnis pengiriman lokal, pickup, pre-order terbatas.  
**Prinsip:** cepat pesan, jelas jam buka dan area layanan.  
**Komposisi:** shop status & jam operasi prominen, kategori ringkas, produk best-seller, pesan berdasarkan jadwal dan metode fulfillment; mobile product list bisa memakai row foto + harga + tombol tambah.

> Implementasi pertama hanya **Atelier** lengkap; Market dan Local menjadi spesifikasi arah sampai commerce core stabil. Section dan tema harus reuse commerce primitives, bukan duplicate backend.

### 6.4 Halaman storefront standar

**Header:** logo toko, katalog/kategori, cari yang mudah ditemukan, cart icon dengan jumlah item, akun opsional. Mobile header tidak lebih dari perlu; pencarian dibuka cepat dengan fokus otomatis dan escape/back yang jelas.

**Katalog:** search; jumlah hasil nyata; filter kategori, harga, stok; urutan; breadcrumb bila relevan; pagination/infinite load dengan accessible fallback; empty state berbeda untuk toko kosong dan filter tanpa hasil.

**Product detail desktop:** galeri foto kiri 55–60%; info kanan sticky terbatas (nama, harga, ketersediaan, variasi, kuantitas, CTA, pengiriman). Product detail mobile: galeri swipe dengan indikator, nama/harga, variation controls berukuran touch, aksi add-to-cart sticky hanya ketika benar-benar membantu; tidak menutup footer.

**Cart desktop:** item list kiri, ringkasan order kanan. Mobile: satu kolom, gambar 72–88px, summary jelas di akhir dengan sticky checkout yang menghormati safe area. Drawer mini-cart hanya untuk feedback singkat; akses cart page utuh tersedia.

**Checkout:** layout satu kolom bertahap di mobile dan dua kolom ringkasan sticky di desktop; progress `Kontak → Pengiriman → Pembayaran`, guest-first, autofill browser; tidak boleh hidden extra fee; validasi inline; subtotal/ongkir/diskon/total tegas. Tidak ada navigation trap.

**Confirmation:** nomor pesanan, status pembayaran yang akurat, langkah berikutnya, metode pelacakan, tindakan “Kembali ke toko”; jangan menampilkan “Pembayaran berhasil” saat baru mengirim order manual.

**Track order:** token aman, timeline status, tanggal kejadian, rincian ringkas; sembunyikan alamat lengkap jika tautan dibuka tidak terautentikasi.

### 6.5 Prinsip commerce UI

- Harga aktif menggunakan ukuran kuat dan kontras tinggi; harga coret hanya untuk diskon faktual.
- Promo tidak boleh otomatis disuntikkan ke semua area.
- Pilihan varian terpilih jelas secara bentuk, label, outline, dan state accessibility.
- **Tidak ada dark pattern:** checkbox subscribe default-off, tidak ada stock urgency palsu, countdown palsu, atau popup diskon pengganggu.
- Form alamat Indonesia disusun dengan label natural dan opsi kecamatan/kode pos apabila provider valid tersedia; jangan membuat lookup wilayah yang gagal menahan semua checkout bila metode pickup tersedia.

## 7. Tokens dan komponen teknis

### 7.1 Shared primitives

`Button`, `IconButton`, `Field`, `Select`, `Combobox`, `QuantityStepper`, `Money`, `PriceBlock`, `ProductMedia`, `VariantSelector`, `AvailabilityStatus`, `Toast`, `InlineAlert`, `Dialog`, `Drawer`, `Tabs`, `Breadcrumb`, `SearchField`, `EmptyState`, `Pagination`, `ProgressSteps`, `StatusPill`, `Table`, `ListRow`, `ChartAccessible`, `PageHeader`, `OrderTimeline`, `LoadingSkeleton`.

**Gunakan varian**, jangan copy-paste komponen. Misalnya `ProductTile` berbeda density pada Atelier/Market/Local tetapi tetap memakai `PriceBlock` dan `AddToCart` yang sama.

### 7.2 Component states wajib

Every interaction has `default`, `hover` (pointer), `focus-visible`, `active/selected`, `disabled`, `loading`, `success`, `error`. Error harus membantu pengguna memperbaiki: “Stok ukuran L tinggal 1. Ubah jumlah untuk melanjutkan.” Hindari “Something went wrong” sebagai satu-satunya pesan.

### 7.3 Motion

- Transisi UI 120–200ms; panel/drawer 180–260ms (sesuaikan konteks), easing natural; animasi hanya pada perubahan bermakna.
- Cart count subtle, success tick opsional, input error tidak menggoyang layout.
- Hero marketing scroll-reveal secukupnya; no scroll-jacking, no animation yang wajib dilihat untuk memahami isi.
- Hormati `prefers-reduced-motion: reduce`, kurangi/transparankan motion tanpa menghilangkan konten.
- Prioritaskan CSS transform/opacity, tidak animasi height/layout berat berulang.

## 8. Responsiveness spesifik

| Halaman | Mobile | Tablet | Desktop |
|---|---|---|---|
| Marketing | Hero stacked; satu device visual prioritas | Split adaptif | Split editorial lebar |
| Merchant nav | Bottom nav + More sheet | Rail/drawer | Sidebar persist |
| Merchant orders | List rows + filters | Compact table/list | Dense readable table |
| Product editor | Single-column full-screen | Two-column bila cukup | Main+rail |
| Storefront home | Portrait editorial + quick catalog | 2–3 cols merchandising | Asymmetrical editorial + grid |
| Product catalog | 2 cols / 1 if narrow | 3 cols | 4 cols typical |
| PDP | Media then details; sticky CTA safe area | Split if legible | 55/45 split |
| Cart | Single-column + bottom checkout | Main+summary | Main+summary sticky |
| Checkout | One-column steps | One-column or split | Form+order summary |

**Ukuran target validasi:** 320×568, 360×800, 390×844, 430×932, 768×1024, 1024×768, 1280×800, 1440×900, 1920×1080. Tambahan landscape mobile, zoom 200%, keyboard mobile, safe-area notch, long address/long price, nama produk 3 baris.

## 9. Aksesibilitas dan microcopy

- Target WCAG 2.2 AA pada funnel; visible focus, skip link, landmarks, semantic headings, aria-live untuk cart/checkout status dan async form updates.
- Tap target ideal minimal 44×44 CSS px; jarak antar tombol cukup dan tidak membebani jempol.
- Error form dekat field, summary error di atas setelah submit, fokus diarahkan ke perbaikan pertama bila perlu.
- Password manager, autocomplete, inputmode numeric untuk angka, label tidak hanya placeholder.
- Kontras minimum sesuai WCAG; jangan mengorbankan keterbacaan untuk estetika fashion.
- Currency Intl.NumberFormat `id-ID`, rupiah tanpa desimal kecuali kebutuhan khusus.

### 9.1 Contoh copy riil

| Konteks | Copy disarankan | Hindari |
|---|---|---|
| Cart empty | “Keranjangmu masih kosong. Jelajahi produk untuk mulai belanja.” | “Oops! Such emptiness!” |
| Stock | “Tersisa 2 untuk ukuran M” (hanya jika benar) | “HURRY! FOMO!” |
| Order manual | “Pesanan diterima. Selesaikan transfer, lalu tunggu konfirmasi toko.” | “Pembayaran sukses!” |
| Save product | “Produk berhasil disimpan sebagai draft.” | “Success operation!” |
| Gateway failed | “Pembayaran belum berhasil. Kamu bisa mencoba lagi tanpa membuat pesanan baru.” | “Error 500” |
| Suspended shop | “Toko ini sedang tidak menerima pesanan.” | “Database unavailable” |
| 404 | “Halaman tidak ditemukan. Kembali ke katalog.” | “Lost in the digital universe” |

## 10. Fotografi, aset, dan media

- **Storefront produk:** gambar benar-benar representatif dan mendapat persetujuan/izin merchant. Lifestyle boleh, detail produk wajib jujur.
- **Marketing:** gunakan screenshot UI milik Nalaro Store hasil implementasi, bukan screenshot kompetitor/brand palsu. Mockup perangkat boleh, tetapi UI harus akurat dengan produk sebenarnya.
- Format WebP/AVIF dengan fallback dan ukuran responsif; target kualitas foto produk tetap cukup untuk melihat detail.
- Crop: hero fashion editorial 3:4 atau 4:5 mobile; product grid 1:1 atau 4:5 sesuai tema; jangan stretch rasio.
- Placeholder image tampil dengan warna netral dan deskripsi, bukan skeleton tak berhenti.
- **Semua ikon antarmuka adalah aset SVG custom premium**, satu set 24×24 viewBox, stroke 1.8 px, round caps/joins, detail tajam di 16/20/24 px. Ikon disimpan pada `src/assets/icons/*.svg`, diekspos lewat `src/components/Icon.tsx`/registry agar dapat dipakai di seluruh aplikasi. Tidak menggunakan emoji, Unicode pictogram, kumpulan font icon, atau library ikon generik sebagai visual akhir. Ikon status bukan pengganti label teks. Folder icon memiliki `README.md` berisi naming convention dan proses review.
- Favicon/logo merek **bukan** bagian icon set: pertahankan aset Nalaro yang diberikan dan gunakan `favicon.ico`, ukuran 16/32, Apple touch 180 serta webmanifest sesuai metadata. Ikon tidak boleh meniru logo Nalaro atau mengubah artwork asli.
- Pertimbangkan `object-position` per media dalam editor agar merchant bisa menentukan titik fokus gambar.

## 11. Empty, loading, error, offline

- **Toko belum punya produk:** pengunjung melihat empty yang meyakinkan dan kontak toko; merchant melihat wizard tambah produk.
- **Filter no-result:** tampilkan reset filter dan pencarian alternatif; jangan mengarang hasil.
- **Tidak ada koneksi DB:** cart tetap bisa menampilkan client items yang tersimpan namun **checkout disabled** dengan pesan jelas dan retry; jangan konfirmasi order palsu.
- **Gateway callback pending:** status tetap `Menunggu konfirmasi`, bisa refresh/reconcile; jangan ubah otomatis menjadi paid.
- **Store tak aktif:** storefront menampilkan status dengan brand toko minimal, tidak exposing internal cause.
- **Loading:** reserve geometry, skeleton hanya bagian yang perlu, content readable tanpa animation excess.
- **Order submission:** disable submit sementara, idempotency memastikan reload aman; feedback progress yang dapat dibaca screenreader.

## 12. Figma/UI deliverables untuk implementasi

Sebelum coding massal, wajib ada UI lengkap untuk:

1. Marketing landing: mobile + desktop hero, 3 section unik, pricing/waitlist, footer.
2. Merchant: overview (ada dan tidak ada data), order list, order detail, products list, product editor, theme editor.
3. Storefront Atelier: homepage, catalog, product detail, cart, checkout, confirmation, tracking.
4. Semua state penting: out-of-stock, invalid variant, payment pending, maintenance, server error, loading.
5. Shared component gallery + tokens, responsive rules, keyboard tab order.

**Screenshot review gate:** design dicek pada 390px dan 1440px **sebelum** dianggap selesai, kemudian pada seluruh matriks viewport target. Revisi berbasis perbandingan visual dan walkthrough nyata, bukan cuma lulus build.

## 13. Acceptance checklist desain

- [ ] Marketing tidak terlihat sebagai template SaaS generik 3-card-per-section.
- [ ] Merchant overview memprioritaskan kerja (order/stok), bukan dekorasi metrik.
- [ ] Storefront Atelier terlihat sebagai **toko fashion asli**, bukan katalog tersamar.
- [ ] Keranjang, checkout dan tracking berfungsi tanpa login wajib.
- [ ] Semua harga, ongkir dan status transparan serta tepat.
- [ ] Tampilan responsive tidak overflow; mobile bukan miniatur desktop.
- [ ] Touch targets, keyboard focus dan screenreader mendukung alur vital.
- [ ] Teks Bahasa Indonesia siap produksi; tidak ada istilah/dummy internal bocor.
- [ ] Tidak ada AI-slop visual/copy dan tidak ada bukti sosial palsu.
- [ ] Transisi singkat dan hormati reduced motion.
- [ ] Gambar produk jelas, tidak stretch, dan optimisasi performa aktif.
- [ ] Tema merchant tidak mewarisi warna brand Nalaro tanpa pilihan.
- [ ] Kesalahan koneksi/pembayaran tidak memunculkan order ganda.

## 14. Instruksi langsung untuk AI coding agent

1. **Baca `PRD-Nalaro-Store.md` sebelum membuat komponen**; jangan menambah fitur di luar fase tanpa persetujuan.
2. Buat design system dan satu toko Atelier yang benar-benar lengkap, bukan lima tema setengah jadi.
3. Implementasikan desain mobile dan desktop secara simultan; setiap halaman harus memiliki responsive specification.
4. Gunakan komponen bersama untuk *commerce behavior*, dan modul layout berbeda untuk tema.
5. Jangan menggunakan library template dashboard sebagai visual final tanpa redesign signifikan.
6. Buat seed data realistis **secara eksplisit sebagai data demonstrasi**; jangan mengklaim pelanggan/transaksi nyata.
7. Gunakan foto dan aset berlisensi sesuai sumber; jangan mengarang partner/testimoni.
8. Setiap PR sertakan screenshot mobile+desktop, checklist audit aksesibilitas, dan catatan ketidaksesuaian terhadap desain.
9. Jangan mendeploy payment live tanpa gates keamanan di PRD.
10. Jika implementasi bertentangan dengan kapasitas Free Tier, **tampilkan risiko dan opsi upgrade**, jangan diam-diam mengaktifkan resource berbayar.

---

**Design thesis:** Nalaro Store harus terasa seperti **alat perdagangan yang dapat dipercaya** sekaligus **toko milik setiap merchant**. Kualitasnya tampak dari alur pengguna, detail transaksi, tipografi, fotografi, serta ketelitian responsif—bukan dari dekorasi yang ramai.


## 15. UI model bisnis Hybrid (terkunci)

- Navigasi marketing menawarkan dua jalur tanpa melebur penawarannya: **Buka toko berlangganan** dan **Buat toko custom bersama Nalaro**.
- Switch periode **Bulanan / Tahunan** hanya jika ada paket aktif dari API; angka, potongan, dan fitur harus berasal dari admin. Jangan membuat harga placeholder seolah harga sungguhan. Jika belum ada data paket, tampilkan perbandingan manfaat dan CTA konsultasi tanpa nominal.
- Alur custom berupa halaman/section editorial berisi contoh personalisasi konkret, daftar deliverable, formulir brief terstruktur dan status penawaran. Hak milik source, domain, dukungan, dan jadwal disepakati per proposal, bukan klaim otomatis.
- UI admin harga memakai field IDR, validasi >0, status publikasi paket, rentang tanggal efektif, preview invoice; merchant melihat snapshot harga dan siklus perpanjangan. Tidak ada tombol pembayaran fiktif.
- Gunakan **aset ikon custom premium** `src/assets/icons`, registry berjenis, audit render di 16/20/24px, dekorasi hanya jika bermakna. Setiap ikon punya label aria atau `aria-hidden` untuk dekoratif.
