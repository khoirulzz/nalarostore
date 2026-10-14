# Menjalankan Nalaro Store di localhost

Auth menggunakan Firebase email/kata sandi. Data toko, hak akses, pesanan dan billing tetap disimpan di PostgreSQL. SDK web dalam `.env.example` sudah menunjuk proyek `nalarostore`; konfigurasi ini boleh berada di frontend. Kata sandi dan koneksi database hanya berada di server.

## Persiapan

Gunakan Node 22 atau lebih baru. Di PowerShell:

```powershell
npm.cmd ci
Copy-Item .env.example .env.local
npm.cmd run dev
```

Buka `http://localhost:5173`. Jika port digunakan proses lain, ubah `APP_ORIGIN=http://localhost:5174` dalam `.env.local` lalu mulai kembali. `npm run dev` menjalankan UI dan API dalam satu origin; `dev:ui` hanya untuk desain tanpa backend.

Saat muncul pesan `Server siap`, buka URL tersebut di browser. Terminal tetap berjalan untuk melayani aplikasi dan tidak kembali ke prompt; ini normal. Tekan `Ctrl+C` untuk menghentikannya. Beranda memuat kode auth/dashboard/admin saat halaman tersebut dibuka.

Mode awal `LOCAL_DATABASE_MODE=pglite` menyediakan database sementara yang baru setiap kali server dimulai. Tidak ada akun/password lokal tersembunyi: daftar menggunakan Firebase sendiri, verifikasi melalui email, lalu masuk. Auth dapat bertahan di browser ketika data toko lokal direset.

Aktifkan provider Email/Password pada proyek Firebase yang sama. Authorized Domains harus memuat `localhost`, `127.0.0.1` bila digunakan, dan domain aplikasi produksi, tanpa protokol atau nomor port. Aplikasi membaca kebijakan kata sandi melalui SDK; kebijakan saat implementasi adalah 8–4096 karakter, huruf besar, huruf kecil, dan angka wajib, karakter khusus opsional. Login tidak memaksa pengguna lama memenuhi kebijakan baru.

Email verifikasi/reset secara default memakai halaman Firebase dan kembali ke aplikasi. Untuk memakai halaman aplikasi, atur **custom action URL** template email Firebase ke `http://localhost:5173/auth/action` saat development, atau URL HTTPS produksi saat rilis. URL verifikasi dan reset harus sesuai lingkungan yang sedang diuji.

## Memakai database Aiven yang persisten

Ubah `.env.local`:

```dotenv
LOCAL_DATABASE_MODE=aiven
DATABASE_URL=postgresql://USER:URL_ENCODED_PASSWORD@HOST:PORT/defaultdb
PG_CA_CERT_FILE=C:/path/ke/aiven-ca.pem
TOKEN_SECRET=ISI_DENGAN_RANDOM_32_BYTE_ATAU_LEBIH
```

Alternatif `DATABASE_URL`: isi `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`; password pada `PGPASSWORD` tidak perlu URL encoding. CA dapat diisi sebagai `PG_CA_CERT_BASE64` jika tidak memakai file. TLS remote selalu memverifikasi sertifikat.

`TOKEN_SECRET` mengenkripsi tautan tracking agar retry order dapat mengembalikan tautan yang sama. Pertahankan nilainya selama menggunakan database yang sama. Buat nilai acak:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
npm.cmd run db:status
npm.cmd run db:migrate
npm.cmd run dev
```

`db:status` hanya membaca. `db:migrate` mengubah database yang Anda pilih; pastikan database tersebut adalah target development/staging yang tepat. Server development tidak menjalankan migrasi remote secara otomatis dan tidak menghapus data Aiven. Gunakan role migrasi terpisah dari role aplikasi.

Untuk mencoba checkout, isi `ENABLE_LIVE_CHECKOUT=true`. Produk, stok dan pesanan yang dibuat pada Aiven benar-benar tersimpan. Tanpa langganan, penerimaan pesanan membutuhkan masa pilot yang diberikan admin; draft dan preview dapat disiapkan terlebih dahulu.

Owner platform ditentukan oleh `OWNER_EMAIL`, tetapi akses admin baru diberikan setelah Firebase membuktikan email tersebut terverifikasi. Anda tidak dapat memperoleh akses admin dengan mengirim email atau peran buatan dari browser.

Upload development disimpan dalam `.local-media` yang diabaikan Git. Upload produksi tetap menggunakan R2. Jangan menganggap direktori lokal sebagai backup media produksi.

## Tes otomatis tanpa akun Firebase nyata

```powershell
npm.cmd test
npm.cmd run test:e2e
```

E2E menjalankan Firebase Auth Emulator (`9099`) dan aplikasi terisolasi (`5175`) dengan proyek `demo-nalarostore`, database sementara dan akun fixture. Tes tidak memakai `DATABASE_URL` development atau membuat akun di Firebase produksi. Emulator memakai aturan kata sandi dari konfigurasi yang disepakati karena API password-policy tidak tersedia di emulator.

Jika Chromium Playwright belum tersedia:

```powershell
npx.cmd playwright install chromium
```

Atau gunakan Chrome yang sudah ada:

```powershell
$env:CHROMIUM_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
npm.cmd run test:e2e
```

Konfigurasi emulator tidak boleh dipakai dalam build produksi. Hasil emulator membuktikan integrasi lokal; pengiriman email Firebase nyata dan pengujian produksi tetap perlu dilakukan pada akun terkontrol.
