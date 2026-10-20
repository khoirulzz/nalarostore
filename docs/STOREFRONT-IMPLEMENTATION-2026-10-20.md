# Implementasi storefront — 20 Oktober 2026

Implementasi mengikuti [review plan](STOREFRONT-PLAN-REVIEW-2026-10-20.md), dengan scope storefront dinamis `/s/:slug`, pratinjau toko, dan cabang hostname yang sudah ada. Halaman demo di `src/main.tsx` bukan sumber komponen commerce dinamis.

## Yang diterapkan

- Header sticky dengan pencarian dialog, shortcut `/`, identitas akun, jumlah cart, dan navigasi kategori horizontal.
- Search/filter dari URL: pencarian, kategori, harga, stok, serta urutan. Refresh dan back/forward mempertahankan pilihan. Mobile menggunakan drawer; desktop menggunakan sidebar. “Pilihan toko” mempertahankan urutan yang dikirim server.
- Product tile 4:5 dengan quick-add dan simpan produk. Struktur link dan tombol terpisah. Produk satu varian langsung ditambahkan; beberapa varian membuka sheet dengan harga dan stok per varian.
- Aturan cart bersama memperhitungkan jumlah yang sudah disimpan, stok aktif, batas 99 per varian, dan maksimal 50 baris. Menambah produk pada batas stok tidak menampilkan sukses palsu.
- PDP dengan galeri scroll-snap, thumbnail, jumlah foto, pilihan varian, stepper, deskripsi yang bisa dibuka, berbagi produk, info pickup/kurir, dan buybar mobile.
- Cart dengan stepper yang dipakai ulang, thumbnail varian, penghapusan dengan undo, summary desktop, dan checkout bar mobile. Undo dihentikan waktunya selama hover/fokus.
- Toast dengan status aksesibel, penutupan otomatis, dan pengaturan posisi terhadap buybar. Notifikasi lama dibersihkan saat pindah halaman; launcher chat disembunyikan sementara selama toast/overlay agar tidak bertumpuk.
- Homepage editorial dengan banner merchant, fallback warna accent, susunan produk unggulan, jam buka/kontak/pickup, dan footer yang lebih mudah digunakan.
- Skeleton data toko/PDP, error dengan coba lagi, empty states, ukuran tombol utama minimal 44px, reduced motion, serta foreground yang mengikuti warna accent.
- Wishlist lokal per toko/browser, tetap tersedia tanpa login; produk yang tidak lagi tersedia disembunyikan dengan keterangan.
- Checkout dengan navigasi bagian kontak/pengiriman/pembayaran, validasi dekat field, serta account section opsional. Form tetap terisi ketika identitas berubah; kunci idempotensi tetap dipisahkan menurut identitas akun.
- Auth drawer pada origin platform: login, registrasi, verifikasi email, kirim ulang verifikasi, pemulihan password, dan melanjutkan tanpa akun. Aturan password dan autentikasi digunakan ulang dari `Auth.tsx`. Setelah login, fokus kembali ke pemicu drawer yang sesuai.
- Tracking dengan progres pickup/kirim, status pembayaran yang akurat, dan judul berbeda untuk canceled/expired/failed/refunded. Tanggal hanya ditampilkan untuk data kejadian yang tersedia; tidak mengarang timestamp setiap tahap.
- Scroll reset pada navigasi hostname storefront, yang sebelumnya belum memakai `ScrollTop` platform.

## Struktur

`Storefront.tsx` menjadi penghubung state, data toko, header/home/footer, cart, dan overlay. Komponen commerce dipisahkan di `src/live/storefront/`: `Commerce`, `Products`, `Catalog`, `Cart`, `Checkout`, `Tracking`, dan `model`. CSS baru dibatasi pada storefront dan dialognya; tidak mengganti stylesheet merchant/admin/demo secara global.

Tidak ada dependency baru, perubahan API/schema, migrasi, atau perubahan konfigurasi checkout produksi. Paket lokal diselaraskan kembali melalui `npm ci`; `package.json` dan lockfile tetap sama.

## Validasi

- `npm test`: **68 passed, 1 skipped**. Test yang dilewati adalah restore backup PostgreSQL native yang membutuhkan `TEST_PG_CONTAINER`/Docker; bukan kegagalan storefront.
- Enam skenario browser unik berhasil melalui Playwright dan Chrome terpasang, dengan PGlite dan Firebase Auth emulator: chat/akun/alamat, guest checkout sampai verifikasi dan selesai, flow signup/reset/password yang sudah ada, discovery/varian/cart/undo/wishlist/login/checkout baru, variasi tracking, serta loading/error/retry/empty store/registrasi drawer.
- Percobaan awal mengungkap pemetaan timeline pickup dan nama aksesibel field setelah validasi; keduanya diperbaiki. Fixture retry disesuaikan untuk dua permintaan awal React Strict Mode. Pengujian terkait dijalankan ulang dan lulus.
- Screenshot dan pemeriksaan overflow mencakup lebar 320, 390, 768, dan 1440px; empty store juga diperiksa pada 320×568. Galeri dan checkout mobile ditinjau dari screenshot.
- `npm run build`: verifikasi TypeScript dan build Vite untuk source akhir.
- `git diff --check`: lulus.

Bukti screenshot lokal disimpan di `.local-media/storefront-review/` (diabaikan Git), termasuk homepage desktop/mobile, PDP, checkout, skeleton, dan empty store. Pengujian ini tidak membuktikan perilaku perangkat fisik, pengiriman email nyata, pembayaran bank nyata, atau kondisi domain produksi.

## Batas yang dipertahankan sesuai review

- Domain toko tetap membuka akun pusat; API customer saat ini hanya melayani origin platform. Login/alamat lintas domain penuh membutuhkan rancangan sesi/API lanjutan.
- Riwayat per toko belum ditambahkan karena API baru menyediakan pagination lintas toko. Filtering satu halaman secara lokal tidak dipakai sebagai pengganti histori lengkap.
- Timeline merupakan progres dari status saat ini, bukan log kejadian lengkap; API belum mengirim histori waktu per transisi.
- Preview tidak membuka checkout, dan flag checkout produksi tetap mengikuti konfigurasi backend yang sudah ada.
- Deployment manual dan aktivasi checkout produksi tidak dilakukan.
