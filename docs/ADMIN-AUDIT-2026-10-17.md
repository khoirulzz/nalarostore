# Audit dan perbaikan admin Nalaro Store

Tanggal: 17 Oktober 2026. Repositori dasar: `khoirulzz/nalarostore`, commit `115fb6c`.

## Temuan dan hasil perbaikan

| Temuan | Perbaikan |
| --- | --- |
| Kode paket dengan kapital/spasi ditolak regex teknis. | Kode dibuat otomatis dari nama, dinormalisasi konsisten di UI/API, dan konflik kode diberi pesan Indonesia. |
| “Lihat toko” menuju etalase publik saat toko masih Draft. | Daftar membuka detail pengelolaan. Pratinjau berautentikasi tersedia untuk draft, jeda, dan nonaktif; etalase publik ditawarkan hanya ketika sudah terbit. |
| Program UMKM bisa diaktifkan berulang. | Aktivasi dicatat sekali; pengulangan tidak mengubah tanggal. Data aktivasi lama ditelusuri dari audit saat migrasi. |
| Ringkasan besar berulang pada semua tab. | KPI hanya di beranda; judul dan deskripsi menyesuaikan halaman. Tab/detail memakai URL agar tombol kembali bekerja. |
| Admin tidak dapat mengelola toko merchant lain. | Admin platform terverifikasi dapat mengakses pratinjau, produk, pengaturan, pesanan, pelanggan, stok, analitik, dan ekspor melalui workspace toko yang dipilih. Akses admin ke data toko dicatat pada audit log. |
| Seller dapat mengubah status toko yang dinonaktifkan. | API menolak perubahan merchant pada toko suspended. Pengaktifan kembali oleh admin mengembalikan toko ke Draft. |
| Paket internal belum dapat diberikan langsung. | Admin dapat membuat paket Aktif nonpublik dan menetapkannya beserta masa akses dan alasan. Paket tersebut langsung mengganti akses lama tanpa tagihan otomatis. |
| Upgrade oleh merchant selalu ditolak. | Pembelian membuat langganan pending dan invoice. Paket lama bertahan selama pembayaran belum diverifikasi; verifikasi mengakhiri paket lama dan membatalkan tagihan lamanya yang belum dibayar. |
| Pengajuan UMKM terikat kontrak proyek custom. | Form program terpisah dari kolom kontrak proyek. Pengajuan diterima dapat dihubungkan ke toko untuk aktivasi UMKM satu kali. |
| Belum ada penghapusan permanen dengan konfirmasi berlapis. | Tiga tahap diperiksa server: persetujuan awal, nama toko persis, dan persetujuan kehilangan data permanen. Token terikat admin/toko/nama, kedaluwarsa 10 menit, dan tidak dapat dipakai ulang. |

## Aturan akses dan paket

1. Seller membuat toko Draft dan menyiapkan produk serta pengaturan.
2. Panduan persiapan menunjukkan empat langkah: produk, pengaturan, paket, dan publikasi.
3. Tanpa hak akses aktif, publikasi diarahkan ke Langganan. Pilihan paket belum memberikan akses sebelum pembayaran diverifikasi admin.
4. Upgrade memerlukan persetujuan penggantian. Setelah aktif, hanya fitur dan batas paket baru yang berlaku; tidak ada penjumlahan kuota paket lama dan baru.
5. Data produk dan pemakaian bulan berjalan dipertahankan. Penggantian paket tidak menghapus data ataupun mengatur ulang penggunaan untuk menghindari batas.
6. Paket baru dibayar penuh; sisa masa paket lama tidak dikembalikan secara otomatis. Ketentuan ini ditampilkan sebelum persetujuan.
7. Paket internal memiliki tanggal akhir yang ditetapkan admin dan tidak menghasilkan invoice perpanjangan otomatis.
8. Perpanjangan paket aktif tidak membatalkan permintaan upgrade lain yang masih pending. Invoice milik langganan yang sudah dibatalkan tidak dapat menghidupkan kembali hak akses lama.
9. Saat langganan berakhir, etalase/pesanan dikunci, sementara persiapan isi toko dan ekspor tetap tersedia bagi pihak yang berhak.

## Penghapusan toko

Penghapusan dilakukan dalam transaksi, mencakup data pesanan beserta dependensinya, produk, stok, pengaturan, domain, langganan, invoice, dan antrean notifikasi toko. Akun pemilik dipertahankan. Riwayat audit administratif dipertahankan untuk penelusuran.

Berkas R2 dijadwalkan untuk dihapus berdasarkan prefix ID toko. Jika R2 gagal, pekerjaan tetap tersedia untuk percobaan berikutnya. Setelah toko dihapus, rute media menolak akses berkas toko tersebut. Penghapusan media berjalan melalui jadwal Worker yang sudah ada.

## Aplikasi Android

Penyesuaian pendamping di `khoirulzz/seller-center`:

- Persetujuan upgrade diteruskan melalui service dan repository ke API.
- Paket aktif dipisahkan dari permintaan pending dan riwayat yang dibatalkan.
- Pilihan paket yang sedang aktif atau sudah menunggu pembayaran dinonaktifkan.
- Publikasi tanpa akses aktif diarahkan ke halaman Langganan.
- Error kuota di editor produk menyediakan tombol menuju paket/upgrade tanpa menghapus draft.
- Batas paket aktif dan fitur paket publik ditampilkan melalui model entitlement yang sama dengan server.

Validasi Android: 38 pengujian Flutter lulus, termasuk pengujian API baru dan regresi tampilan pada lebar 320–600 dp serta skala teks 1,0 dan 1,6. Analisis statis dengan `--no-fatal-infos` selesai tanpa error/warning; terdapat 95 catatan lint tingkat informasi. APK baru belum dibangun pada pekerjaan ini.

## Validasi web/API

- `npm run check`: lulus, termasuk tipe Worker, pemeriksaan skema, TypeScript, 52 pengujian dan build produksi.
- Satu pengujian concurrency yang sudah ada memerlukan PostgreSQL eksternal dan dilewati pada PGlite lokal; pengujian tersebut tetap tersedia di CI PostgreSQL.
- Enam pengujian browser lulus, mencakup alur jual beli, autentikasi, viewport mobile, UMKM, serta paket/detail/upgrade/hapus admin.
- Pengujian admin tambahan lulus setelah penyesuaian terakhir terhadap identitas paket aktif.
- `npm run check:worker`: bundel Worker berhasil dibuat dengan dry-run.
- Pemeriksaan tampilan dilakukan pada lebar 390 dan 1440 piksel; halaman admin mobile tidak meluap horizontal.

## Penerapan

Perubahan masih lokal dan belum dipublikasikan. Pemeriksaan persetujuan otomatis menolak push Android karena publikasi belum diotorisasi secara eksplisit dalam permintaan ini. Belum ada data toko produksi yang diubah, dinonaktifkan, diberi paket, atau dihapus.

Urutan penerapan setelah diizinkan:

1. Push branch dan buat PR untuk kedua repositori.
2. Jalankan pemeriksaan CI dan build Android.
3. Terapkan migrasi `db/0006_admin_store_management.sql` melalui runner migrasi agar checksum tersimpan. Perubahan skema kompatibel dengan Worker lama selama jeda penerapan.
4. Terapkan Worker API baru dan frontend Pages dengan binding/secret yang sudah ada.
5. Periksa health endpoint, akses admin, paket, pratinjau, dan metadata langganan di produksi.

Konfigurasi produksi saat audit masih menonaktifkan live checkout. Perbaikan ini tidak mengubah pengaturan tersebut. Pembayaran langganan menggunakan instruksi transfer dan verifikasi admin yang sudah tersedia.
