# PRD — Nalaro Store

**Versi:** 1.1 — Keputusan model bisnis Hybrid SaaS + Custom terkunci  
**Tanggal:** 14 Oktober 2026  
**Status:** Model bisnis, periode langganan, provider inti dan sistem ikon terkunci; nominal dan hak lisensi custom ditentukan pemilik Nalaro  
**Pemilik produk:** Nalaro Digital  
**Domain usulan:** `store.nalaro.digital` (platform), `{slug}.store.nalaro.digital` (toko; perlu validasi wildcard DNS/routing/sertifikat)

## 1. Ringkasan eksekutif

Nalaro Store adalah platform **e-commerce mandiri multi-tenant untuk UMKM Indonesia**, bukan marketplace agregator dan bukan sekadar katalog/landing page. Seorang merchant dapat membuka toko bermerek sendiri; pembeli bisa mencari, memilih varian, memasukkan barang ke keranjang, checkout, memilih pemenuhan pesanan, menerima konfirmasi, dan memantau status. Merchant mengelola produk, inventaris, order, pelanggan, pengaturan storefront, serta penjualan manual melalui satu dashboard.

**Posisi produk:** *Toko online milikmu. Transaksi dan operasional dalam satu tempat.*  
**Prinsip:** Free-tier-first, siap tumbuh tanpa penulisan ulang core, mobile-first, transaksi aman, mudah digunakan, dan visual anti-AI-slop.

### 1.1 Keputusan dasar

| Area | Keputusan v1 | Catatan |
|---|---|---|
| **Model bisnis** | **Hybrid: SaaS bulanan/tahunan + pesanan custom** | Nominal SaaS dan harga jasa ditentukan pemilik Nalaro di Super Admin, bukan hardcoded |
| Kategori bisnis | Produk fisik dulu | Produk digital/jasa fase berikutnya |
| Identitas toko | Storefront independen per merchant | Bukan daftar semua toko yang dapat dicari lintas merchant |
| Checkout | **Guest checkout** tanpa akun wajib | Akun pelanggan opsional, data terisolasi per toko |
| Pembayaran | Transfer/QRIS manual untuk MVP; gateway adapter setelah siap | Tidak menganggap QRIS statis diverifikasi otomatis |
| Pengiriman | Ambil di toko, kurir toko, tarif flat/zona | Integrasi ekspedisi live fase berikutnya |
| Database | Aiven PostgreSQL Free di dev/private beta | **Tidak ada jaminan SLA/always-on**; upgrade sebelum transaksi kritis |
| Runtime | Cloudflare Workers + static assets | Query DB via Hyperdrive setelah uji koneksi nyata |
| Media | Cloudflare R2 Standard | Thumbnail varian dan lifecycle file |
| UX | 3 permukaan: platform, dashboard, storefront | Setiap permukaan beridentitas jelas |
| Asset icons | **SVG custom premium terpusat** | `src/assets/icons/`, satu API komponen `<Icon />`, dilarang emoji/icon library campur aduk |

## 2. Masalah yang diselesaikan

UMKM menjual melalui chat, sosial media, dan marketplace, tetapi mengalami pencatatan pesanan tersebar, stok tidak sinkron, checkout tidak terstruktur, branding terbatas, dan sulit mengelola pelanggan sendiri. Solusi harus memberikan **web toko transaksi penuh** yang tetap mudah dioperasikan di ponsel.

### 2.1 Sasaran bisnis

1. Memungkinkan satu merchant meluncurkan toko fungsional tanpa bantuan developer.
2. Menghasilkan fondasi SaaS reusable untuk banyak merchant dengan isolasi data yang ketat.
3. Menjadi basis order pengembangan toko custom tanpa melakukan fork core untuk tiap klien.
4. Mengukur konversi checkout, merchant activation, repeat purchase, dan biaya operasional per toko.

### 2.2 Bukan sasaran v1

Bukan marketplace lintas pedagang; tidak ada escrow, dompet internal, saldo Nalaro, pengelolaan split payment, live shopping, affiliate network, POS fisik penuh, drag-drop builder bebas, aplikasi native pembeli, atau AI assistant sebagai dependensi pembelian. Jangan menambahkan fitur ini diam-diam.

## 3. Persona dan tugas utama

| Persona | Konteks | Job-to-be-done | Friksi yang dihindari |
|---|---|---|---|
| Pemilik UMKM | Mengelola usaha lewat ponsel | Buka toko, unggah produk, layani pesanan | Onboarding panjang, istilah teknis |
| Staf toko | Mengepak pesanan | Melihat order prioritas, mengubah status sesuai izin | Tabel padat, akses terlalu luas |
| Pembeli baru | Datang dari Instagram/WA | Memilih produk dan checkout cepat | Login wajib, biaya tersembunyi |
| Pembeli kembali | Pesan ulang | Melacak status dan menggunakan alamat lama | Alur berulang yang tidak perlu |
| Admin Nalaro | Mengoperasikan SaaS | Moderasi, dukungan, paket, kesehatan platform | Bisa mengintip data tenant tanpa audit |
| Developer Nalaro | Menangani implementasi custom | Perluas tema/modul via adapter | Fork codebase tidak terawat |

## 4. Arsitektur produk dan navigasi

### 4.1 Platform SaaS publik (`store.nalaro.digital`)

Beranda, fitur, contoh toko/tema, harga (jika telah ditentukan), FAQ, masuk, daftar, kebijakan dan status layanan. CTA utama: **Buat toko online**; CTA sekunder: **Lihat contoh toko**.

### 4.2 Dashboard merchant (`store.nalaro.digital/app/...`)

`Beranda / Pesanan / Produk / Stok / Pelanggan / Promosi / Analitik / Tampilan Toko / Pengaturan`.

Beranda menampilkan tindakan yang paling mendesak: pesanan menunggu konfirmasi, harus dikirim, stok menipis, dan aktivitas terbaru. Jangan menjadikan metrik sebagai satu-satunya konten beranda.

### 4.3 Storefront (`{slug}.store.nalaro.digital`)

`Beranda / Katalog / Koleksi / Detail / Keranjang / Checkout / Konfirmasi / Lacak Pesanan / Akun / Info Toko & Kebijakan`.

Toko berbeda merek dapat menggunakan layout/tema yang berbeda secara substantif, sementara checkout, aksesibilitas, transaksi, dan komponen perilaku tetap seragam.

### 4.4 Super admin (`store.nalaro.digital/admin`)

Merchant, status onboarding, laporan penyalahgunaan, paket, harga bulanan/tahunan, masa berlangganan, permintaan custom, penggunaan kuota, pengaturan sistem, insiden, audit log dan support. Hak akses berbeda total dengan merchant.

## 5. Ruang lingkup per fase

| Kode | P0 — Commerce Core (wajib sebelum beta) | P1 — SaaS Beta | P2 — Growth |
|---|---|---|---|
| F01 | Tenant/store creation oleh admin; slug unik; status toko | Self-service onboarding | Merchant invitation/referral |
| F02 | Profil toko, kontak, jam buka, kebijakan | Domain sendiri (sesudah validasi Cloudflare for SaaS) | Multi-lokasi |
| F03 | Produk, kategori, SKU, galeri, varian & stok | CSV import/export | Bundles, produk digital |
| F04 | Katalog, cari, filter, sort, detail | SEO dan tema tambahan | Personalization |
| F05 | Keranjang persisten, kuantitas, validasi | Saved cart cross-device | Wishlist |
| F06 | Guest checkout, alamat, pickup/local delivery | Integrasi ongkir | Multi-warehouse |
| F07 | Pesanan atomik, reservasi stok, expiry | Payment gateway per merchant | Refund otomatis |
| F08 | Transfer/QRIS manual + pemeriksaan pembayaran oleh merchant | Gateway sandbox → produksi setelah review | Metode alternatif |
| F09 | Tracking status pesanan dan tautan aman | Akun pelanggan opsional | Retur self-service |
| F10 | Dashboard dan status fulfillment | Multi-staff RBAC | Automasi fulfillment |
| F11 | Email order opsional via adapter; fallback tampilan web | Notifikasi terstruktur, webhook | WA resmi |
| F12 | Audit log, rate limit, anti-spam | **Paket berlangganan bulanan/tahunan, entitlements dan harga dikelola admin** | Billing otomatis / prorata / dunning |
| F15 | Tombol **Minta toko custom** ke Nalaro melalui brief terstruktur | CRM lead custom, penawaran & invoice jasa | Delivery toolkit, lisensi source/modul custom |
| F13 | Tema pertama profesional; design tokens tenant | Tema kedua/ketiga, section composer terkurasi | Template marketplace |
| F14 | Monitoring, backup restore drill | Analytics merchant & Nalaro | BI lanjutan |

P0 boleh menggunakan **satu toko pilot** (Narwasita hanya sebagai kandidat bila disetujui) sebelum membuka pendaftaran publik. Tidak ada checkout live sampai checklist go-live terpenuhi.

## 6. Alur pengguna dan persyaratan fungsional

### 6.1 Merchant onboarding

1. Buka landing > **Buat toko online**.
2. Register/login; verifikasi identitas email.
3. Isi nama toko, slug otomatis dengan cek ketersediaan, jenis usaha, mata uang IDR, lokasi asal.
4. Pilih tema dasar; unggah logo opsional; set kontak & jam operasional.
5. Tambah produk pertama: nama, foto, harga, stok; sistem menampilkan preview mobile dan desktop.
6. Pilih pemenuhan pesanan (pickup/kurir toko/tarif tetap), lalu pembayaran manual.
7. Preview > checklist kesiapan > **Terbitkan toko**.

**Acceptance:** merchant baru dapat meluncurkan 1 toko dengan 1 produk stok valid tanpa bantuan admin; field belum lengkap mempunyai pesan spesifik; *draft* tidak dapat dibeli; slug reserved (`admin`, `api`, `www`, dll) dilarang.

### 6.2 Katalog dan detail

- Kategori, pencarian kata kunci, sort harga/terbaru, filter ketersediaan dan rentang harga.
- Gambar responsif dengan alt text; rasio gambar seragam per konteks tanpa crop merusak produk.
- Harga dalam IDR; diskon menampilkan harga awal hanya ketika benar-benar ada promosi.
- Variasi produk menggunakan **combination SKU**: harga, stok, gambar per kombinasi jika perlu.
- Tombol **Tambah ke keranjang** harus memberikan feedback inline; **Beli sekarang** lanjut checkout dengan item sesuai varian.
- Produk nonaktif/habis tidak bisa dibeli; beri rekomendasi produk relevan jika tersedia.

### 6.3 Keranjang

- Tanpa login, disimpan client-side memakai ID item dan varian; harga/stok **selalu diverifikasi ulang oleh server**.
- Naik/turunkan kuantitas, hapus produk, ringkasan subtotal, penjelasan pengiriman/potongan.
- Saat harga atau stok berubah, jelaskan item yang berubah dan minta pelanggan meninjau sebelum checkout.
- Satu keranjang satu toko; jangan bocorkan data/keranjang lintas subdomain tenant.

### 6.4 Checkout

1. Tinjau barang dan jumlah.
2. Kontak pembeli (nama, email/nomor WA) dan alamat jika perlu; dukung pickup.
3. Pilih metode pengiriman yang **benar-benar tersedia**; tampilkan biaya sebelum order final.
4. Pilih pembayaran manual yang diaktifkan merchant; lihat jumlah total final.
5. Submit dengan `idempotency_key`, harga dihitung ulang pada server, transaksi DB menyimpan order/items/reservasi stok.
6. Halaman konfirmasi memberi ID pesanan, instruksi bayar, batas waktu, dan tautan pelacakan.

**Acceptance:** double tap, refresh, retry, dan request duplikat tidak membuat order ganda; server menolak harga yang dimanipulasi; total sama dengan rincian sebelum submit; form error terfokus dan tidak menghapus isian.

### 6.5 Pembayaran dan fulfillment

**State dipisah:** `order_status` (draft/pending/confirmed/processing/completed/canceled), `payment_status` (unpaid/pending/paid/failed/expired/refunded), `fulfillment_status` (unfulfilled/packing/shipped/delivered/pickup_ready/picked_up/returned).

- Manual transfer atau QRIS merchant **bukan konfirmasi otomatis**. Merchant menandai pembayaran terverifikasi dengan audit trail; unggah bukti hanya sebagai referensi, tidak menggantikan verifikasi.
- Expiry melepaskan reservasi stok secara aman, mempertahankan histori order. Jangan menghapus order historis.
- Gateway fase P1 menggunakan adapter: create payment, signature/webhook verification, idempotency, rekonsiliasi, refund state. **Tidak menyimpan nomor kartu atau mengumpulkan dana merchant**.
- Merchant bisa membuat pesanan manual dengan label sumber `manual`, tanpa merusak laporan order website.
- Hak merchant/staf dibatasi di backend dan tiap perubahan status memiliki actor + timestamp.

### 6.6 Pelacakan dan akun pelanggan

- Pelacakan guest menggunakan token acak berumur terbatas dan scope satu order; **jangan** hanya mengandalkan nomor order publik.
- Akun pelanggan opsional per toko; riwayat pembelian hanya milik toko tersebut.
- Tidak menampilkan informasi sensitif pelanggan pada halaman publik atau crawler.

### 6.7 Dashboard merchant

- **Inbox Pesanan:** tab aksi `Baru`, `Perlu dibayar`, `Siap diproses`, `Dikirim`, `Selesai`; filter tanggal dan pencarian nomor pesanan.
- **Detail pesanan:** barang, subtotal, ongkir, pembayaran, riwayat perubahan, catatan internal, timeline fulfillment.
- **Produk:** tabel desktop dan list detail mobile; pencarian, bulk select yang aman, drawer/editor full screen mobile, validasi per varian.
- **Stok:** low-stock threshold, perubahan stok historis, tidak boleh negatif kecuali skema preorder eksplisit.
- **Pelanggan:** minimal nama/kontak/transaksi, filter per tenant, izin akses sesuai peran.
- **Pengaturan:** identitas, kontak, pembayaran, pengiriman, SEO dasar, kebijakan toko.
- **Analitik:** revenue hanya dari pembayaran valid, pisahkan pesanan belum dibayar; tampilkan rentang waktu dan definisi metrik.

## 7. Model domain dan data (konseptual)

**Primary tables:** `users`, `merchants`, `merchant_memberships`, `stores`, `store_domains`, `store_settings`, `themes`, `store_theme_configs`, `categories`, `products`, `product_media`, `product_options`, `product_variants`, `inventory_movements`, `inventory_reservations`, `customers`, `customer_addresses`, `carts` (opsional server-side), `orders`, `order_items`, `order_addresses`, `payment_intents`, `payment_events`, `fulfillments`, `shipping_methods`, `discounts`, `discount_redemptions`, `audit_logs`, `outbox_events`, `idempotency_keys`, `usage_counters`, `subscriptions` (skeleton).

**Aturan wajib:**

- Semua tabel tenant-owned memiliki `store_id` atau rute kepemilikan yang eksplisit; indeks umum `(store_id, ...)`.
- Tenant resolution berasal dari hostname yang diverifikasi server dan domain mapping aktif, **bukan menerima `store_id` mentah dari client**.
- Otorisasi per-peran dan per-store; uji akses silang setiap query sensitif. Pertimbangkan PostgreSQL Row Level Security sebagai defense-in-depth dan uji dengan ORM/pool.
- Harga dalam integer satuan rupiah; snapshot `order_items` tidak ikut berubah bila produk diedit.
- Primary ID UUID/ULID; order number manusiawi scoped per store, dibuat secara race-safe, bukan `Date.now()`.
- FK, uniqueness, check constraint, dan transaksi DB untuk stok/order; persentase diskon dan batas pemakaian divalidasi server.
- Tulis log audit perubahan pembayaran, akses dukungan, stok, dan peran; minimalkan dan retensi data pribadi sesuai kebutuhan.
- `outbox_events` mendukung pengiriman email/webhook reliable, dengan retry dan dead-letter policy.

## 8. Arsitektur teknis: Cloudflare + Aiven

```text
Pembeli / Merchant / Admin
          |
     Cloudflare DNS + TLS + Cache
          |
 Cloudflare Workers + static assets / SSR seperlunya
          |             |
  API domain layer    R2 Standard (foto/logo/banner)
          |
   Hyperdrive (uji kompatibilitas & pool)
          |
  Aiven Managed PostgreSQL
          |
  Modul: auth | catalog | cart | orders | payment | fulfillment
          |
  Adapter eksternal opsional: payment provider | email | shipping
```

**Target stack jangka panjang:** React/TypeScript, Workers, Aiven PostgreSQL+Hyperdrive, R2 dan design tokens; Drizzle ORM, Zod, SSR storefront dan E2E menjadi target sesudah integrasi backend disetujui. **Implementasi fase 0** menggunakan Vite+React Router, CSS native, Workers API read-only dan driver Postgres.js, npm serta SQL migration agar dapat diuji sebagai satu proyek ringan. Migrasi ke monorepo dan penambahan library wajib berdasarkan kebutuhan nyata, bukan menambah dependensi tanpa fungsi.

**Struktur fase 0:** satu aplikasi ringan `src` (platform + workspace + storefront), `worker` (API), `db` (schema), `src/assets/icons` (SVG premium), `public` (favicon). **Rencana modular saat skala menuntut:** `apps/platform`, `apps/merchant`, `apps/storefront`, `apps/api`; `packages/ui`, `packages/core`, `packages/db`, `packages/tenancy`, `packages/payment-adapters`, `packages/theme-engine`, `packages/config`. Tidak perlu pecah deployment sebelum ada kebutuhan isolasi yang terbukti.

### 8.1 Catatan khusus Aiven Free

- Dokumentasi resmi per Sep 2026: 1 CPU, 1 GB RAM, 1 GB disk, `max_connections=20`, tanpa built-in pooling dan SLA; layanan Free dapat dipadamkan jika tidak aktif.
- **Jangan mengartikan 20 koneksi sebagai 20 toko.** Koneksi dikelola oleh layer API/pool.
- Hyperdrive pooling terdistribusi **bukan hard cap global**; pool bisa bertambah saat failover/edge terpisah. Uji dengan akun Aiven sendiri, sisakan koneksi untuk admin/migration, pendekkan transaksi, awasi `pg_stat_activity` dan exhaustion. Jangan menjanjikan solusi pool pasti aman tanpa load test.
- Pada beberapa paket Aiven paid, limit koneksi default malah berbeda (contoh Developer 15 menurut docs), jadi upgrade capacity tidak boleh diasumsikan otomatis menyelesaikan koneksi.
- Backup bawaan bukan satu-satunya backup: jalankan eksport terenkripsi berkala ke lokasi terpisah, uji restore, dan batasi aksesnya.
- Free hanya untuk dev/pilot terbatas; ketika order nyata menjadi kritis, lakukan review uptime, backup, pertumbuhan data dan upgrade.

### 8.2 Catatan Cloudflare Free

- Workers Free: 100.000 request/hari; Hyperdrive Free: 100.000 pernyataan SQL/hari; batas tersebut **berbeda** dan dapat menyebabkan request gagal ketika terlampaui.
- R2 Standard free: 10 GB-month, 1 juta operasi Class A dan 10 juta Class B per bulan; biaya/aktifasi billing harus diperiksa.
- Jangan caching stok/payment/checkout secara tidak benar; hanya katalog publik dengan invalidasi per tenant.
- Multi-tenant subdomain dan custom domain **dua masalah berbeda**: rancang wildcard route/DNS/TLS untuk subdomain platform; custom domain merchant memerlukan Cloudflare for SaaS/custom hostnames, validasi domain dan sertifikat, serta review syarat billing. **Fitur custom domain ditahan sampai proven.**
- Cloudflare for SaaS mencantumkan 100 custom hostnames dalam paket Free, namun aktivasi non-Enterprise meminta metode pembayaran: ini bukan jaminan implementasi Rp0 tanpa kartu/tagihan.

### 8.3 Reliability dan operasional

- Health endpoints, structured logs tanpa PII/payment secrets, correlation ID, trace pada checkout/webhook.
- Error budget dan alert: DB space 60/75/85%, koneksi 60/75/90%, Workers/Hyperdrive quota 70/85/95%, 5xx, webhook gagal.
- Budget alert tidak menggantikan hard limit; fitur yang bisa menghasilkan biaya harus melalui approval manual.
- Deployment CI: lint, typecheck, unit, e2e, migration check, preview, smoke test, rollback. Migrations expand-contract jika breaking.
- Backup: versi terjadwal, enkripsi, retention, restore drill, prosedur rollback dan exit plan `pg_dump`→PostgreSQL lain.
- Security: CSRF untuk cookie sessions, secure/HttpOnly/SameSite cookies sesuai arsitektur subdomain, CSP, input sanitization, image upload MIME/sniffing, size caps, malware policy, rate limiting, bot protection, secret rotation.
- Privasi/kepatuhan: dokumen kebijakan, consent yang benar-benar diperlukan, mekanisme akses/hapus data sesuai hukum Indonesia yang relevan; pembayaran via gateway berizin.

## 9. Model bisnis (keputusan terkunci)

**Hybrid, dua jalur komersial yang setara:**

1. **SaaS berlangganan**: merchant mendaftar, memilih paket yang Nalaro terbitkan, dan memilih siklus **bulanan atau tahunan**. Setiap paket menyimpan harga dua periode dalam integer IDR (tanpa hardcode harga, limit, atau diskon). Admin Nalaro menentukan nominal serta apakah paket bisa dipesan. Satu toko dapat mempunyai subscription aktif, trial yang disetujui, expired, canceled atau grace period dengan entitlement server-side. Implementasi billing otomatis menunggu provider terverifikasi; **versi awal memakai penagihan manual/aktivasi admin** agar tidak mengarang pembayaran otomatis.
2. **Custom / Beli Toko**: calon klien meminta toko yang dikembangkan atau diserahkan khusus oleh Nalaro. Klien melengkapi brief, ruang lingkup, domain, kebutuhan integrasi, dan pilihan model kepemilikan; Nalaro melakukan penawaran harga manual. **Source/modul relevan boleh dipakai ulang secara internal** melalui package/adapter/theme engine. Penyerahan source code, lisensi penggunaan, kepemilikan IP, dukungan, hosting dan biaya lanjutan **diatur per kontrak tertulis**, tidak otomatis ikut dalam semua penjualan custom. Jangan menyatukan source custom ke repo utama tanpa review.

**Administrasi harga:** tabel `plans`, `plan_prices` (`billing_interval = monthly|yearly`, `amount_idr`, `is_active`, `valid_from`), `plan_entitlements`, `store_subscriptions` (`current_period_start`, `current_period_end`, `status`, `renewal_policy`), `subscription_invoices`, `subscription_events`, dan `custom_project_leads`. Harga disimpan sebagai snapshot pada invoice/langganan agar perubahan katalog harga tidak mengubah penagihan masa lalu. Perubahan harga berlaku untuk checkout/langganan berikutnya menurut kebijakan migrasi harga yang eksplisit. Seluruh pembayaran membership terpisah dari pembayaran pembeli kepada merchant.

**Perilaku saat berakhir:** tidak menghapus data toko secara otomatis. Berikan peringatan, masa tenggang yang bisa ditentukan admin, lalu kebijakan pembatasan publish/checkout yang jelas, tetap mempertahankan akses ekspor data dan dashboard sesuai kebijakan. Tidak mengunci pembeli yang sudah membuat pesanan agar tidak dapat melihat status transaksinya.

**Untuk fase desain/demonstrasi**: ketika harga belum ditetapkan, situs menampilkan CTA “Diskusikan paket” / “Minta toko custom”, bukan angka harga atau diskon rekayasa. Sistem disiapkan agar pemilik produk dapat memasukkan nominal paket sendiri. Tidak ada fee transaksi Nalaro yang ditetapkan sebelum keputusan resmi.

## 10. Non-functional requirements

| Area | Target penerimaan internal |
|---|---|
| Responsive | Tidak ada horizontal overflow pada 320, 360, 390, 768, 1024, 1440 px |
| Aksesibilitas | Target WCAG 2.2 AA pada alur penting, keyboard navigable, focus visible |
| Performa | Target lapangan p75 LCP ≤2,5 s, INP ≤200 ms, CLS ≤0,1 (jaringan representatif), ukur bukan klaim |
| Checkout | Harga dihitung server, atomic write order+reservation, idempotent retries |
| Tenant isolation | 0 kebocoran cross-tenant pada automated adversarial tests |
| Uptime | Free tier tanpa SLA: tampilkan status/incident jelas; tentukan SLO setelah paid baseline |
| SEO | Metadata per toko, canonical, JSON-LD Product yang valid; noindex dashboard, keranjang, checkout |
| Security | Zero hardcoded credential, anti-enumeration pada tracking, rate limits |
| Internationalization | Bahasa Indonesia default, rupiah dan format lokal; struktur i18n ready |
| Usability | Aksi inti merchant dapat selesai di mobile tanpa keyboard fisik |

## 11. Analytics dan ukuran keberhasilan

**North star:** jumlah toko aktif yang menyelesaikan pesanan valid setiap bulan (*monthly transacting stores*).

- Activation: persentase merchant yang publish + membuat produk pertama.
- Checkout funnel: view product → add to cart → checkout started → order created → paid.
- Order reliability: duplicate orders prevented, failed reservation rate, webhook delivery failures.
- Merchant usage: first order processing time, fulfillment lead time, low-stock action completion.
- Engineering: DB storage/day, p95 query duration, active connections, Worker errors, quota utilization.
- Privacy: event analytics tanpa menyimpan data sensitif customer dalam payload.

## 12. Pengujian dan kriteria rilis

### 12.1 E2E wajib

1. Buat toko A dan B; user A tidak pernah bisa membaca/memodifikasi data B meski ID ditebak atau request dimanipulasi.
2. Buka storefront mobile, pilih varian, tambah dua produk, checkout guest, lihat ringkasan total.
3. Dua checkout bersamaan untuk stok terakhir: hanya satu reservasi berhasil.
4. Double tap pada Place Order: hanya satu order dengan idempotency key.
5. Harga berubah sebelum checkout: pelanggan melihat revalidation notice dan total baru.
6. Pembayaran manual diverifikasi: satu kali penandaan, audit log, invoice/notification tetap retry-safe.
7. Reservasi expired: stok dilepas sekali; status tercatat; tidak boleh overwrite status paid.
8. Produk, kategori, tema, media, dan policy berubah pada storefront yang benar; cache invalidasi tepat tenant.
9. Upload file invalid/oversize ditolak; file R2 tidak mengekspos dokumen pribadi.
10. 320–1440 px, iOS/Android browser, Safari/Chrome/Firefox, keyboard/tab/screenreader smoke.
11. DB unavailable/connection exhaustion: tampilkan recovery-friendly error; order tidak setengah jadi.
12. Restore backup di staging lalu verifikasi integrity order dan jumlah stok.

### 12.2 Gates

- **Gate A / Design approval:** 3 surface prototypes disetujui, mobile dan desktop.
- **Gate B / Commerce alpha:** katalog + cart + order end-to-end berjalan dengan transaksi aman.
- **Gate C / Private beta:** tenant isolation, observability, disaster recovery, load test.
- **Gate D / Live payment:** provider compliance, webhook signature, reconciliation, incident owner, uptime/cost review.

## 13. Backlog implementasi terurut

**Sprint 0 (paket sesi awal):** repository baseline, branding favicon asli, React/Vite UI, Cloudflare Worker route, PostgreSQL migration skema awal, custom SVG icon library, demo storefront + cart, design tokens, dev documentation.  
**Sprint 1:** Aiven + Hyperdrive riil, tenant resolution aman, merchant authentication & RBAC, CRUD produk + varian + R2, storefront dinamis, katalog search.  
**Sprint 2:** checkout guest live, shipping manual, idempotency, order atomik + reservasi stok + expiry worker, tracking aman. Gate sebelum checkout real.  
**Sprint 3:** dashboard order/stock live, verifikasi bayar manual, audit, notifikasi email, QA responsive & accessibility, invoice pesanan.  
**Sprint 4:** SaaS plan editor + harga bulanan/tahunan + entitlement, custom leads admin, pilot load/backup/restore, analytics dan second theme prototype.  
**Sprint 5+:** pembayaran subscription/gateway merchant terverifikasi, ongkir API, custom domains, module licensing/delivery custom setelah biaya/operasional/legalitas terverifikasi.

## 14. Keputusan terbuka (tidak menghambat P0)

1. **Nominal** paket bulanan/tahunan, limit fitur, dan komisi (jika ada): diatur sendiri oleh pemilik Nalaro; **periode bulanan/tahunan sudah final**.
2. Integrasi payment gateway: pilih provider setelah uji onboarding multi-merchant dan settlement langsung merchant.
3. Provider ongkir: TBD, jangan mengandalkan API gratis tanpa cek SLA/kuota.
4. Template tema kedua/ketiga: ditentukan dari observasi merchant pilot.
5. Domain custom/SSL onboarding: rilis sesudah cost & DNS/TLS spike.
6. Rencana legalitas layanan, kebijakan data dan dukungan merchant: ditetapkan sebelum public launch.
7. Rincian lisensi/kepemilikan source code bagi pesanan custom ditentukan dalam kontrak tiap proyek; reuse modul Nalaro dilindungi secara kontraktual.

## 15. Sumber teknis resmi (diverifikasi 14 Oktober 2026)

- Aiven Free: https://aiven.io/docs/products/postgresql/concepts/pg-free-tier
- Aiven limits: https://aiven.io/docs/products/postgresql/reference/pg-connection-limits
- Cloudflare Hyperdrive: https://developers.cloudflare.com/hyperdrive/platform/limits/
- Hyperdrive pricing: https://developers.cloudflare.com/hyperdrive/platform/pricing/
- Workers limits: https://developers.cloudflare.com/workers/platform/limits/
- R2 pricing: https://developers.cloudflare.com/r2/pricing/
- Cloudflare for SaaS plans: https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/plans/
- Cloudflare for SaaS enablement: https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/start/enable/

> Ketentuan free tier dapat berubah. Dokumen ini adalah arahan arsitektur dan requirement produk, bukan klaim bahwa seluruh resource telah aktif atau sepenuhnya gratis pada akun Nalaro.


## 16. Definisi penyelesaian fase awal (implementasi sesi pertama)

- Dokumen PRD dan desain diperbarui dari keputusan hybrid bisnis.
- Repository aplikasi React/TypeScript + Cloudflare Worker tersedia dan dapat dijalankan setelah `npm install`.
- Halaman marketing, contoh storefront **Atelier**, produk, keranjang, checkout pratinjau, workspace merchant mock data dapat dijelajahi di mobile dan desktop.
- Hanya **demo checkout** yang disajikan tanpa kredensial database; tidak pernah diklaim sebagai pembayaran riil. API write produksi harus gated.
- Database schema menyertakan tenant, inventaris, order, subscription monthly/yearly dan custom lead sebagai fondasi. Schema bukan bukti endpoint commerce live.
- Aset favicon Nalaro asli dipakai dari berkas yang diberikan; ikon UI hanya SVG custom dari folder tunggal.
- README menjelaskan mode demo, daftar secrets/binding yang **belum** aktif, dan langkah fase berikutnya. Tidak ada API key di Git.
