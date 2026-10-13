# Nalaro Store / Premium Icon Library

Semua ikon UI adalah SVG custom (24×24, stroke 1.8, round cap/join) yang bersumber dari direktori ini. Tidak memakai emoji, font-icon, atau kumpulan ikon acak.

Penggunaan: `import { Icon } from "../components/Icon"; <Icon name="bag" size={20} />`. Registry diketik statis. Aset ditampilkan menggunakan CSS mask sehingga `color` dapat diatur dari konteks.

Untuk menambah ikon: buat file kebab-case ber-viewBox 24×24, cek 16/20/24 px, tambahkan ke registry `Icon.tsx`, pastikan tidak memuat <script>/external resource, tulis `aria-label` jika maknanya bukan dekoratif. Favicon merek berada di `/public` dan tidak diubah menjadi ikon UI.
