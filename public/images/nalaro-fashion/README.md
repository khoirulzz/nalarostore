# Nalaro Fashion — aset foto demo

Delapan foto baru dibuat dengan **built-in image_gen** pada 20 Oktober 2026. Foto menggambarkan model fiktif dan produk ilustrasi untuk toko demo; bukan dokumentasi barang dagangan, pelanggan, proses batik tulis, atau asal produksi nyata.

Setiap foto dibuat lewat satu panggilan imagegen tersendiri, kemudian dikonversi ke WebP 960×1200 untuk website. Komposisi gambar dipertahankan. PNG asli tetap berada di folder generated_images Codex; seluruh aset yang digunakan situs sudah disimpan dalam repo ini.

| Aset | Dipakai untuk |
| --- | --- |
| [sarung-sogan.webp](sarung-sogan.webp) | Sarung Batik Sogan Bumi |
| [sarung-nila.webp](sarung-nila.webp) | Sarung Batik Nila Pesisir |
| [sarung-marun.webp](sarung-marun.webp) | Sarung Batik Aruna Marun |
| [kemeja-parang.webp](kemeja-parang.webp) | Kemeja Batik Parang Sogan |
| [kemeja-megamendung.webp](kemeja-megamendung.webp) | Kemeja Batik Mega Mendung |
| [kebaya-sage.webp](kebaya-sage.webp) | Kebaya Sage Kartini |
| [celana-kawung.webp](celana-kawung.webp) | Celana Batik Kawung |
| [celana-kulot.webp](celana-kulot.webp) | Celana Kulot Batik Sekar |

Ukuran total delapan WebP sekitar **1,5 MiB**. Foto Kemeja Batik Sagara, Kebaya Ivory Laras, dan banner koleksi menggunakan aset yang sudah ada di `../batiknalaro/`, tanpa menyalin atau menimpanya.

Prompt final lengkap setiap panggilan tersimpan di [generation-prompts.json](generation-prompts.json). Arah visual bersama: foto katalog fashion Indonesia yang fotorealistis, latar batu ivory dan kayu jati, cahaya alami hangat, detail kain yang jelas, tanpa teks, logo, watermark, atau kolase.
