# Demo Nalaro Fashion

Route utama: `/demo/nalaro-fashion`. Untuk lokal yang sedang berjalan: `http://localhost:5173/demo/nalaro-fashion`.

Demo menggunakan komponen `LiveStore` dan komponen commerce baru yang sama dengan storefront dinamis. Data contoh disediakan oleh `src/data/nalaro-fashion.ts`; demo tidak memerlukan database atau endpoint commerce. Tautan contoh toko pada navigasi, marketing, dan halaman autentikasi diarahkan ke demo ini. Demo lama tetap dapat diakses melalui route sebelumnya.

## Koleksi

| Kategori | Produk |
| --- | --- |
| Sarung Batik | Sogan Bumi, Nila Pesisir, Aruna Marun |
| Kemeja Batik | Sagara, Parang Sogan, Mega Mendung |
| Kebaya | Ivory Laras, Sage Kartini |
| Celana Batik | Kawung, Kulot Sekar |

Sepuluh produk mempunyai foto utama yang berbeda, deskripsi, harga, SKU, serta stok per varian. Beberapa varian mempunyai stok nol untuk memperlihatkan state tidak tersedia. Seluruh harga dan stok merupakan contoh, bukan penawaran barang nyata.

## Aset

Delapan foto baru dibuat dengan **built-in image_gen**, disimpan sebagai WebP 960×1200 di `public/images/nalaro-fashion/` dengan ukuran total 1.577.384 byte (sekitar 1,5 MiB). Foto kemeja Sagara, kebaya Laras, dan hero memakai aset batik yang sudah ada.

Daftar aset dan prompt final lengkap tersedia di [README aset](../public/images/nalaro-fashion/README.md) dan [generation-prompts.json](../public/images/nalaro-fashion/generation-prompts.json). PNG sumber tidak dihapus atau ditimpa. Foto merupakan ilustrasi produk dengan model fiktif.

## Alur yang bisa dicoba

- Beranda dengan 10 product tile, susunan editorial desktop dan dua kolom mobile.
- Kategori, pencarian, filter, urutan, dan URL yang bertahan saat refresh/back.
- Quick-add satu varian, sheet beberapa varian, pilihan ukuran habis, galeri, dan wishlist per toko/browser.
- Keranjang, stepper, undo penghapusan, serta ringkasan/checkout bar mobile.
- Chat lokal dengan konteks produk dan balasan yang diberi label simulasi.
- Drawer akun yang menjelaskan penggunaan akun pada toko asli dan mengarahkan ke produk tersimpan.
- Checkout contoh sampai ringkasan di `/demo/nalaro-fashion/complete`. Tidak ada transfer, QRIS, atau pesanan nyata. Data kontak pada form tidak dikirim dan tidak disimpan. Session storage menyimpan ringkasan produk demo agar halaman selesai tetap bisa direfresh.

## Validasi

- `npm test`: **70 passed, 1 skipped**. Satu test restore PostgreSQL native membutuhkan Docker/`TEST_PG_CONTAINER`.
- Playwright: **3 passed**, mencakup dua alur Nalaro Fashion serta regresi guest checkout storefront nyata melalui verifikasi manual sampai selesai di lingkungan test PGlite/Firebase emulator.
- Kedua test demo memblokir dan mencatat seluruh request `/api/**`; hasilnya tidak ada request API. Test juga memeriksa data kontak tidak muncul di local/session storage setelah checkout.
- Sepuluh URL foto lokal memberi HTTP 200 dan MIME WebP. Screenshot/overflow ditinjau pada 320×568, 390×844, 768×1024, dan 1440×900; galeri dan halaman selesai mobile juga diperiksa.
- Build TypeScript/Vite dan `git diff --check` dijalankan. Screenshot lokal disimpan di `.local-media/nalaro-fashion-review/`, yang diabaikan Git.

Tidak ada perubahan schema, dependency, konfigurasi `.env`, atau resource produksi. Deployment manual dan aktivasi checkout produksi tidak dilakukan.
