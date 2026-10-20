# Review plan storefront — 20 Oktober 2026

Tindak lanjut: [implementasi dan hasil validasi](STOREFRONT-IMPLEMENTATION-2026-10-20.md). Review di bawah mencatat kondisi sebelum implementasi.

Plan yang ditinjau: `C:\Users\ulum\.gemini\antigravity\brain\367edc22-91ca-4596-879d-8733a5db4cf0\storefront-ui-ux-plan.md`.

Baseline repo: branch `main`, commit `2476d37`. Working tree bersih sebelum review. Review ini memeriksa source, kontrak API, spesifikasi desain, dan pengujian yang tersedia; belum merupakan penilaian visual melalui browser.

## Penilaian

Arah plan layak diterapkan setelah revisi. Search yang mudah ditemukan, navigasi kategori, quick-add, galeri mobile, skeleton, dan perbaikan checkout sesuai kebutuhan storefront saat ini. Prinsip guest-first, stok faktual, pembayaran manual yang jujur, dan reduced motion sesuai `desain.md`.

Plan belum siap diterapkan persis sebagaimana ditulis: sebagian gap sudah tertangani, scope auth melampaui frontend untuk domain toko, dan contoh timeline membutuhkan data yang belum dikirim API. Label impact seperti “konversi rendah” adalah hipotesis; review ini tidak menemukan bukti pengukuran konversi yang mendukung kesimpulan tersebut.

## Temuan utama

| Area | Bukti di repo | Implikasi untuk plan |
| --- | --- | --- |
| Cart | `Storefront.tsx` sudah menggunakan `.quantity-stepper`; thumbnail 85×110px; `.cart-summary` sticky pada desktop di `styles.css`. | Gunakan ulang dan perbaiki ukuran target sentuh, undo, serta checkout mobile. Tidak perlu membangun ulang stepper cart. |
| Homepage | Hero sudah mendukung `hero_image_url` dengan layout foto/copy; homepage sudah memiliki delapan produk dan tautan katalog. | Perbaiki komposisi dan fallback tanpa foto. Pernyataan “hanya teks + grid” tidak berlaku untuk toko dengan banner. |
| Gambar dan ikon | Tile dan thumbnail sudah `loading="lazy"`; ikon `heart`, `search`, `plus`, `minus`, dan `filter` tersedia. | Tambahkan placeholder jika berguna, hindari menduplikasi fitur/ikon. Hero dan foto utama PDP perlu prioritas pemuatan yang sesuai. |
| Scroll | `ScrollTop` sudah dipasang pada router platform; cabang hostname storefront belum memasangnya. | Perbaikan terutama diperlukan untuk storefront subdomain. Tentukan perilaku ketika filter berubah dan ketika pengguna kembali ke daftar. |
| Buyer account | Sudah ada avatar, empat tab berikon, kartu pesanan, status, alamat, profil, dan percakapan. | Audit bagian spesifik yang perlu dipoles; klaim seluruh akun masih polos terlalu luas. |
| Search/filter | Katalog memakai state lokal, belum membaca query URL. | Search header dan category rail membutuhkan satu sumber state dari URL, termasuk pencarian, kategori, urutan, harga, dan stok. Uji refresh dan back/forward. |
| Quick-add | Tile saat ini merupakan satu elemen `Link`; handler `add` membatasi jumlah tetapi selalu memberi pesan sukses. | Ubah struktur agar tombol tidak berada di dalam link. Pusatkan validasi varian, stok, jumlah di cart, dan batas 99; jangan memberi pesan berhasil jika jumlah tidak bertambah. |

## Revisi wajib sebelum implementasi

### 1. Batasi janji auth drawer sesuai konteks domain

Storefront `/s/:slug` berada pada origin platform sehingga drawer dapat memakai Firebase dan API customer yang tersedia. Namun `worker/index.ts` menolak endpoint akun/customer pada host nonplatform melalui pemeriksaan `assert(platform, ...)`. `CheckoutAccount` memang mengarahkan pengguna domain toko ke akun pada origin platform.

Karena itu, “cukup tambah AuthDrawer, tanpa perubahan backend” tidak mencakup seluruh perilaku yang diusulkan. Untuk iterasi frontend pertama, dukung drawer pada origin platform dan pertahankan akses akun pusat pada domain toko. Login dan alamat tersimpan sepenuhnya di domain toko membutuhkan rancangan API dan sesi terpisah, termasuk pengujian pada origin yang berbeda.

Gunakan ulang aturan password, pesan error, verifikasi email, reset password, dan proteksi tujuan navigasi di `Auth.tsx`. Hindari form autentikasi kedua yang perilakunya berbeda. Status sedang memulihkan sesi juga harus dibedakan dari guest.

`LiveCheckout` sekarang di-remount ketika UID berubah. Drawer perlu menjaga data kontak/pengiriman yang sudah diisi; sekadar “refresh checkout state” berpotensi mengosongkan form.

### 2. Timeline harus mengikuti status dan metode pemenuhan sebenarnya

`tracking()` di `worker/lib/commerce.ts` mengirim status saat ini, `created_at`, dan `updated_at`, tetapi tidak mengirim histori waktu per transisi. Timeline frontend boleh menggambarkan progres berdasarkan status aktual tanpa mengarang tanggal untuk setiap node. Histori lengkap beserta waktu kejadian memerlukan perluasan response API.

Pisahkan pembayaran dari pemenuhan. Dukung alur kirim (`packing → shipped → delivered`), pickup (`packing/pickup_ready → picked_up`), serta kondisi canceled/expired dan status pembayaran lain yang relevan. Jangan selalu menampilkan “Dalam pengiriman” untuk pesanan pickup.

Tampilan tracking sekarang sudah menerjemahkan status melalui `label()`, sehingga bukan enum mentah. Namun judul awal masih “Pesanan diterima” ketika data belum dimuat, dan judul yang sama bisa muncul untuk order kedaluwarsa/dibatalkan yang belum dibayar. Perbaiki ketepatan judul bersama timeline.

### 3. Riwayat per toko belum didukung sebagai filter API

`/api/customer/orders` mengambil pesanan lintas toko dengan pagination 50 item dan hanya menerima parameter halaman. Memfilter satu halaman di frontend tidak menghasilkan riwayat toko yang lengkap. Tunda riwayat per toko pada iterasi frontend atau tambahkan filter tenant di backend yang tetap dibatasi kepemilikan pembeli.

### 4. Lengkapi aksesibilitas dan pengaturan lapisan UI

- Tombol quick-add contoh berukuran 36px bertentangan dengan target 44px dalam plan. Tampilkan juga saat fokus keyboard, bukan hanya hover/touch.
- Search overlay, auth drawer, filter drawer, dan variant sheet memerlukan nama dialog, fokus awal, pembatasan fokus, Escape/tombol tutup, pengembalian fokus, penguncian scroll, dan perilaku keyboard mobile.
- Atur posisi toast bersama buybar dan widget chat. Buybar sekarang memakai z-index 45, widget chat 60; offset tetap 72px saja belum menjamin tidak bertumpuk.
- Undo jangan hilang saat pengguna sedang fokus pada aksinya. Samakan durasi toast yang di plan masih berbeda antara 2,5 dan 3 detik. Gunakan `calc()` untuk penjumlahan safe-area di CSS.
- Jangan mengasumsikan teks putih selalu terbaca di atas `--store-accent`; warna toko dapat berubah. Terapkan warna foreground yang sesuai dan state selain warna.

### 5. Sesuaikan arsitektur dan desain dengan repo

`Storefront.tsx` menampung routing internal, cart, katalog, PDP, checkout, dan tracking. Ekstrak komponen commerce kecil yang dipakai ulang sebelum menambahkan banyak state overlay. Pertahankan route lazy loading dan muat bagian auth interaktif saat diperlukan.

`styles.css` dan `live.css` dipakai bersama demo, merchant, admin, dan storefront. Scope token serta selector baru di `.live-store` atau modul storefront; jangan mengubah `.product-image`, `.store-header`, atau `:root` secara luas tanpa meninjau dampaknya. File `src/main.tsx`, `MediaImage.tsx`, serta pengujian terkait mungkin ikut tersentuh, walau belum tercantum dalam daftar plan.

`desain.md` mengarahkan homepage Atelier ke koleksi unggulan asimetris; grid desktop empat kolom terutama untuk katalog. Plan homepage perlu menyesuaikan keputusan ini. Rasio gambar 4:5 dapat dipilih setelah review foto yang ada; baseline saat ini 3:4. Banner 85vh ditambah header dan copy juga perlu diperiksa pada 320×568 agar katalog tetap mudah ditemukan.

Gunakan data merchant yang tersedia untuk jam buka, pickup, kurir, kontak, dan kebijakan. Jangan menambahkan estimasi pengiriman “3–5 hari” tanpa sumber data. Pertahankan `option_label` varian yang sebenarnya, termasuk perbedaan harga/foto; contoh S/M/L tidak mewakili semua jenis produk.

Wishlist lokal perlu key yang dibatasi toko, penanganan storage gagal, dan penanganan produk yang sudah tidak dijual. Tunda sampai alur pembelian inti selesai.

## Urutan implementasi yang disarankan

1. **Fondasi:** komponen QuantityStepper/Toast/Dialog, state filter dari URL, validasi cart bersama, skeleton sesuai halaman, CSS terisolasi, dan scroll hostname.
2. **Penemuan dan pembelian:** header/search/category rail, tile quick-add, variant sheet, PDP gallery/stepper, dan cart mobile dengan undo. Pertahankan pilihan guest dan aturan stok/harga server.
3. **Brand dan pascapembelian:** hero/homepage, katalog drawer/sidebar, checkout account dan progress yang sesuai form sebenarnya, serta timeline berdasarkan data tersedia.
4. **Akun:** drawer pada origin platform; selesaikan rancangan domain toko dan riwayat per toko sebelum menjanjikan kesetaraan fitur lintas domain.
5. **Polish:** wishlist, animasi ringan, dan placeholder tambahan setelah review performa serta aksesibilitas.

## Validasi dan batas hasil

- `npm.cmd run build` **lulus** pada baseline; perintah menjalankan `tsc -b` dan Vite build.
- Pengujian browser yang tersedia sudah mencakup guest checkout → verifikasi manual → selesai, responsivitas katalog, registrasi/verifikasi akun pembeli, alamat, dan chat. Pengujian tersebut dibaca, belum dijalankan dalam review ini.
- Tambahkan pengujian perilaku baru saat implementasi: URL filter/back/forward, quick-add varian dan batas stok, cart/undo, dialog keyboard, form tetap terisi setelah login, pickup/kirim/canceled/expired, serta isolasi toko.
- Review visual perlu mencakup 320px hingga desktop, nama/harga panjang, toko tanpa foto/produk, reduced motion, safe area, dan keyboard mobile. Tidak ada klaim hasil visual atau performance lapangan dari audit source ini.
- Tidak ada kode aplikasi yang diubah, tidak ada deploy atau aktivasi checkout produksi. Artefak review ini adalah satu-satunya file baru.
