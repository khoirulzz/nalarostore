import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  lazy,
  Suspense,
} from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { Icon, type IconName } from "./components/Icon";
import {
  categories,
  collectionImage,
  detailImage,
  editorialImage,
  products,
  rupiah,
  type DemoProduct,
} from "./data/demo";
import "./styles.css";
import "./live/live.css";
import { PublicPricing, UmkmApplication } from "./live/PublicOffers";
import { LegalPage } from "./live/LegalPages";
import { SellerCenterSection } from "./components/SellerCenterSection";
const Auth = lazy(() =>
  import("./live/Auth").then((m) => ({ default: m.Auth })),
);
const Verify = lazy(() =>
  import("./live/Auth").then((m) => ({ default: m.Verify })),
);
const ForgotPassword = lazy(() =>
  import("./live/Auth").then((m) => ({ default: m.ForgotPassword })),
);
const AuthAction = lazy(() =>
  import("./live/Auth").then((m) => ({ default: m.AuthAction })),
);
const RequireAuth = lazy(() =>
  import("./live/Auth").then((m) => ({ default: m.RequireAuth })),
);
const Merchant = lazy(() =>
  import("./live/Merchant").then((m) => ({ default: m.Merchant })),
);
const LiveStore = lazy(() =>
  import("./live/Storefront").then((m) => ({ default: m.LiveStore })),
);
const Admin = lazy(() =>
  import("./live/Admin").then((m) => ({ default: m.Admin })),
);

type CartLine = { id: string; size: string; quantity: number };
type CartAPI = {
  lines: CartLine[];
  count: number;
  add: (id: string, size: string, quantity?: number) => void;
  update: (id: string, size: string, quantity: number) => void;
  clear: () => void;
};
const CartContext = createContext<CartAPI | null>(null);
function useCart() {
  const context = useContext(CartContext);
  if (!context) throw Error("Cart context unavailable");
  return context;
}
function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("nalaro-demo-batiknalaro-cart") || "[]",
      );
      return Array.isArray(saved)
        ? saved.filter(
            (line: CartLine) =>
              products.some((p) => p.id === line.id) &&
              typeof line.size === "string" &&
              Number.isInteger(line.quantity) &&
              line.quantity > 0 &&
              line.quantity <= 99,
          )
        : [];
    } catch {
      return [];
    }
  });
  useEffect(
    () =>
      localStorage.setItem(
        "nalaro-demo-batiknalaro-cart",
        JSON.stringify(lines),
      ),
    [lines],
  );
  const api = useMemo<CartAPI>(
    () => ({
      lines,
      count: lines.reduce((sum, l) => sum + l.quantity, 0),
      add(id, size, quantity = 1) {
        setLines((prev) => {
          const existing = prev.find((x) => x.id === id && x.size === size);
          return existing
            ? prev.map((x) =>
                x === existing
                  ? { ...x, quantity: Math.min(99, x.quantity + quantity) }
                  : x,
              )
            : [...prev, { id, size, quantity }];
        });
      },
      update(id, size, quantity) {
        setLines((prev) =>
          prev
            .map((x) =>
              x.id === id && x.size === size
                ? { ...x, quantity: Math.max(0, Math.min(99, quantity)) }
                : x,
            )
            .filter((x) => x.quantity > 0),
        );
      },
      clear() {
        setLines([]);
      },
    }),
    [lines],
  );
  return <CartContext.Provider value={api}>{children}</CartContext.Provider>;
}
function ScrollTop(){const {pathname}=useLocation(); useEffect(()=>{window.scrollTo({top:0,behavior:'instant'});},[pathname]); return null;}
function Logo({light=false}:{light?:boolean}){return <Link to="/" className={`brand ${light?'brand-light':''}`} aria-label="Nalaro Store beranda"><span className="brand-mark"><img src="/favicon-32x32.png" alt="" width="28" height="28" /></span><span className="brand-word">nalaro<span className="brand-store">store</span></span></Link>;}
function ArrowLink({to,children,light=false}:{to:string;children:React.ReactNode;light?:boolean}){return <Link to={to} className={`text-link ${light?'text-link-light':''}`}>{children}<Icon name="arrow-up-right" size={19}/></Link>;}
function SectionIntro({eyebrow,title,desc}:{eyebrow?:string;title:string;desc?:string}){return <div className="section-intro">{eyebrow&&<p className="section-number">{eyebrow}</p>}<h2>{title}</h2>{desc&&<p>{desc}</p>}</div>;}
function MarketingNav() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location]);
  return (
    <header className="site-header">
      <div className="shell site-header-inner">
        <Logo />
        <nav
          className={`site-nav ${open ? "site-nav-open" : ""}`}
          aria-label="Navigasi utama"
        >
          <a href="/#fitur" onClick={() => setOpen(false)}>
            Solusi jualan
          </a>
          <a href="/#cara-kerja" onClick={() => setOpen(false)}>
            Cara kerja
          </a>
          <a href="/#seller-center" onClick={() => setOpen(false)}>
            Seller Center
          </a>
          <a href="/#paket" onClick={() => setOpen(false)}>
            Harga paket
          </a>
        </nav>
        <div className="header-actions">
          <Link className="header-login" to="/login">
            Masuk
          </Link>
          <Link
            className="button button-dark button-small"
            to="/demo/batiknalaro"
          >
            Lihat contoh toko <Icon name="arrow-up-right" size={16} />
          </Link>
        </div>
        <button
          className="mobile-menu"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Tutup menu" : "Buka menu"}
          aria-expanded={open}
        >
          <Icon name={open ? "close" : "menu"} size={24} />
        </button>
      </div>
    </header>
  );
}
const subscriptionWhatsApp = `https://wa.me/6285771298582?text=${encodeURIComponent("Halo Nalaro, saya ingin berlangganan Nalaro Store. Boleh dibantu info paket dan cara memulai toko online? Nama usaha saya: ")}`;
const CUSTOM_ORDER_URL = "https://order.nalaro.digital/form/";
function Footer() {
  return (
    <footer className="footer">
      <div className="shell">
        <div className="footer-top footer-expanded">
          <div className="footer-brand">
            <Logo light />
            <p>Tokomu sendiri, jualan lebih mudah. Nalaro yang bantu urusan teknisnya.</p>
            <div className="footer-contacts">
              <a href="mailto:store@nalaro.digital"><Icon name="mail" size={17}/>store@nalaro.digital</a>
              <a href={subscriptionWhatsApp} target="_blank" rel="noopener noreferrer"><Icon name="phone" size={17}/>0857 7129 8582</a>
              <a href="https://order.nalaro.digital/form/" target="_blank" rel="noopener noreferrer"><Icon name="file" size={17}/>Form order Nalaro</a>
            </div>
          </div>
          <div className="footer-column">
            <h3>Jelajahi Nalaro Store</h3>
            <a href="/#fitur">Fitur toko</a>
            <a href="/#seller-center">App Seller Center</a>
            <Link to="/demo/batiknalaro">Coba demo toko</Link>
            <a href="/#paket">Harga & paket</a>
            <a href="/#pertanyaan">Pertanyaan umum</a>
            <Link to="/program-umkm">Program UMKM</Link>
          </div>
          <div className="footer-column">
            <h3>Bantuan & legal</h3>
            <a href={subscriptionWhatsApp} target="_blank" rel="noopener noreferrer">Hubungi tim Nalaro</a>
            <a href={CUSTOM_ORDER_URL} target="_blank" rel="noopener noreferrer">Jasa toko custom · Nalaro Dev</a>
            <Link to="/legal/privasi">Kebijakan privasi</Link>
            <Link to="/legal/ketentuan">Syarat & ketentuan</Link>
            <Link to="/legal/program-umkm">Ketentuan program UMKM</Link>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Nalaro Digital.</span>
          <a href="https://nalaro.digital" target="_blank" rel="noopener noreferrer">
            Bagian dari Nalaro Digital <Icon name="arrow-up-right" size={15} />
          </a>
        </div>
      </div>
    </footer>
  );
}
function HeroMockup() {
  return (
    <div
      className="hero-stage"
      aria-label="Contoh toko Batik Nalaro dengan model Indonesia mengenakan batik dan kebaya"
    >
      <div
        className="hero-image"
        style={{ backgroundImage: `url(${editorialImage})` }}
      />
      <div className="hero-sample-note">
        Batik Nalaro <span>Koleksi untuk keseharian</span>
      </div>
      <div className="hero-previews">
        <div className="floating-order">
          <div className="floating-top">
            <span className="tiny-round">
              <Icon name="bag" size={16} />
            </span>
            <span>Contoh pesanan masuk</span>
            <Icon name="arrow-up-right" size={16} />
          </div>
          <strong>BN-00248</strong>
          <p>2 produk · Siap dikemas</p>
          <div className="floating-bottom">
            <span>Hari ini, 10.24</span>
            <b>{rupiah(products[0].price + products[3].price)}</b>
          </div>
        </div>
        <Link
          to="/demo/batiknalaro/product/kemeja-batik-sagara"
          className="floating-mobile"
          aria-label="Lihat Kemeja Batik Sagara di toko demo"
        >
          <div className="floating-mobile-top">
            BATIK NALARO <Icon name="bag" size={15} />
          </div>
          <div
            className="floating-product"
            style={{ backgroundImage: `url(${products[0].image})` }}
          />
          <span>Pilihan koleksi</span>
          <b>{products[0].name}</b>
          <p>{rupiah(products[0].price)}</p>
          <div className="floating-cart-label">
            Lihat produk <Icon name="arrow-right" size={13} />
          </div>
        </Link>
      </div>
    </div>
  );
}
function Marketing() {
  return (
    <>
      <MarketingNav />
      <main className="marketing-main">
        <section className="marketing-hero">
          <div className="shell hero-grid">
            <div className="hero-copy">
              <span className="hero-decor" aria-hidden="true" />
              <h1>
                Saatnya punya
                <br />
                <em className="hero-store-line">toko online mu</em>
                <br />
                sendiri.
              </h1>
              <p>
                Tokomu sendiri, stok kamu atur, pesanan terkumpul rapi.
                Bagikan satu link ke pelanggan dan fokus pada jualanmu,
                tanpa potongan transaksi dari Nalaro.
              </p>
              <div className="hero-ctas">
                <Link to="/register" className="button button-orange">
                  Mulai buka toko <Icon name="arrow-up-right" size={19} />
                </Link>
                <a href="#seller-center" className="button button-ghost">
                  App Android <Icon name="arrow-right" size={18} />
                </a>
              </div>
              <div className="hero-foot">
                <span className="hero-rule" />
                <span>
                  Punya toko sendiri. Jualan lebih tenang.
                </span>
              </div>
            </div>
            <HeroMockup />
          </div>
        </section>
        <section className="partner-strip">
          <div className="shell partner-inner">
            <span>Satu link, alur belanja lebih lengkap</span>
            <div>
              <span>
                <Icon name="box" size={19} /> Katalog & stok
              </span>
              <span>
                <Icon name="bag" size={19} /> Keranjang & checkout
              </span>
              <span>
                <Icon name="orders" size={19} /> Status pesanan
              </span>
              <span>
                <Icon name="truck" size={19} /> Pilihan pengiriman
              </span>
            </div>
          </div>
        </section>
        <section className="problem-section">
          <div className="shell problem-layout">
            <h2>
              Sudah saatnya
              <br />
              <em className="hero-store-line">go digital.</em>
            </h2>
            <div>
              <p>
                Jualan lewat chat boleh tetap jalan. Tapi saat pelanggan ingin
                langsung memilih barang, biarkan toko onlinemu yang membantu.
              </p>
              <p>
                Ini tokomu sendiri: produk bisa kamu susun, stok kamu atur,
                dan pesanan tercatat di satu tempat. Nalaro tidak mengambil
                potongan dari setiap transaksi penjualanmu.
              </p>
              <a className="text-link" href="#fitur">
                Kenali fitur tokomu <Icon name="arrow-right" size={18} />
              </a>
            </div>
          </div>
        </section>
        <section className="section-spacing" id="fitur">
          <div className="shell">
            <div className="split-heading">
              <SectionIntro
                title="Yang kamu butuhkan untuk mulai jualan, ada di sini."
                desc="Etalase yang mudah dijelajahi, pesanan yang rapi, dan stok yang bisa kamu cek kapan saja."
              />
            </div>
            <div className="editorial-features">
              <div className="editorial-feature feature-image">
                <div
                  className="editorial-photo"
                  style={{ backgroundImage: `url(${collectionImage})` }}
                />
                <span className="corner-note">
                  BATIK NALARO
                  <br />
                  BUSANA UNTUK KESEHARIAN
                </span>
              </div>
              <div className="editorial-feature feature-content">
                <h3>“Ada ukuran apa?” Jawabannya sudah di toko.</h3>
                <p>
                  Foto, harga, ukuran, dan stok ada di halaman produk. Pelanggan
                  lebih mudah menentukan pilihan, tanpa menunggu kamu membalas
                  satu per satu.
                </p>
                <ArrowLink to="/demo/batiknalaro/catalog">
                  Coba lihat koleksinya
                </ArrowLink>
              </div>
              <div className="editorial-feature feature-stacked">
                <div className="mini-order-head">
                  <Icon name="orders" size={22} />
                  <span>CONTOH RINGKASAN PESANAN</span>
                </div>
                <div className="mini-order-row">
                  <span className="small-green" />
                  Siap dikemas<strong>04</strong>
                </div>
                <div className="mini-order-row">
                  <span className="small-sand" />
                  Menunggu pembayaran<strong>07</strong>
                </div>
                <div className="mini-order-row">
                  <span className="small-orange" />
                  Perlu cek stok<strong>02</strong>
                </div>
              </div>
              <div className="editorial-feature feature-content feature-content-alt">
                <h3>Pesanan masuk. Kamu tahu harus mulai dari mana.</h3>
                <p>
                  Pantau pembayaran, cek produk yang dipesan, dan perbarui
                  status pengiriman dari satu tempat. Tidak perlu mencari ulang
                  pesanan di tumpukan percakapan.
                </p>
                <a className="text-link" href="#cara-kerja">
                  Lihat langkah memulai <Icon name="arrow-right" size={18} />
                </a>
              </div>
            </div>
          </div>
        </section>
        <section className="dark-story" id="cara-kerja">
          <div className="shell">
            <div className="dark-header">
              <SectionIntro title="Produk sudah ada? Mari buka tokonya." />
              <p>
                Mulai dari koleksi yang kamu punya. Lengkapi informasi toko,
                lalu bagikan link-nya ke pelanggan.
              </p>
            </div>
            <div className="journey">
              <div>
                <b>01</b>
                <Icon name="palette" size={28} />
                <h3>Beri nama tokomu</h3>
                <p>
                  Pasang logo, pilih tampilan, dan isi kontak agar pelanggan
                  mengenali bisnismu.
                </p>
              </div>
              <div>
                <b>02</b>
                <Icon name="box" size={28} />
                <h3>Isi etalase pertamamu</h3>
                <p>
                  Tambahkan foto, harga, pilihan produk, dan stok. Mulai dari
                  produk andalanmu dulu.
                </p>
              </div>
              <div>
                <b>03</b>
                <Icon name="bag" size={28} />
                <h3>Bagikan link, terima pesanan</h3>
                <p>
                  Taruh di bio atau kirim lewat WhatsApp. Pelanggan bisa memilih
                  dan checkout dari sana.
                </p>
              </div>
            </div>
          </div>
        </section>
        <section className="section-spacing">
          <div className="shell narrative-layout">
            <div className="narrative-title">
              <h2>
                Pembeli siap pesan.
                <br />
                Jangan buat mereka <i>menunggu.</i>
              </h2>
              <p>
                Setelah melihat produk di media sosial, pelanggan bisa langsung
                memilih ukuran, memasukkan ke keranjang, dan mengisi alamat.
                Belanja tanpa membuat akun, dengan rincian biaya sebelum pesanan
                dikirim.
              </p>
              <ArrowLink to="/demo/batiknalaro">Coba jadi pembeli</ArrowLink>
            </div>
            <div
              className="narrative-picture"
              style={{ backgroundImage: `url(${detailImage})` }}
            >
              <div className="narrative-receipt">
                <div className="receipt-top">
                  <span>Contoh keranjang</span>
                  <Icon name="bag" size={18} />
                </div>
                <div className="receipt-row">
                  {products[0].name} <b>{rupiah(products[0].price)}</b>
                </div>
                <div className="receipt-row">
                  {products[3].name} <b>{rupiah(products[3].price)}</b>
                </div>
                <div className="receipt-total">
                  Subtotal{" "}
                  <strong>
                    {rupiah(products[0].price + products[3].price)}
                  </strong>
                </div>
                <span className="receipt-cta">
                  Lanjut ke checkout <Icon name="arrow-right" size={16} />
                </span>
              </div>
            </div>
          </div>
        </section>
        <section className="mobile-access-section section-spacing" id="akses">
          <div className="shell mobile-access-layout">
            <div className="mobile-access-copy">
              <h2>Jualan terus jalan, meski kamu sedang di luar toko.</h2>
              <p>
                Buka dashboard lewat browser ponsel untuk mengecek pesanan,
                memperbarui produk, dan mengatur stok. Tak perlu selalu duduk
                di depan laptop.
              </p>
              <a className="text-link" href="/app">Buka dashboard toko <Icon name="arrow-up-right" size={18}/></a>
              <a className="mobile-access-note" href="#seller-center">Lebih suka pakai app? Kenali Seller Center untuk Android.</a>
            </div>
            <div className="mobile-access-visual" role="img" aria-label="Ilustrasi model muda Indonesia tersenyum saat melihat toko dari ponsel">
              <img src="/images/mobile-merchant.webp" alt="" loading="lazy"/>
              <span className="access-floating access-floating-left"><Icon name="bag" size={18}/>Pesanan di tanganmu</span>
              <span className="access-floating access-floating-right"><Icon name="chart" size={18}/>Cek perkembangan jualan</span>
            </div>
          </div>
        </section>
        <section className="service-section" id="pilihan">
          <div className="shell">
            <div className="service-top">
              <SectionIntro
                title="Kamu urus jualan. Urusan teknis, biar Nalaro."
                desc="Tidak harus paham coding atau menyiapkan server sendiri untuk punya toko online yang bisa dikelola setiap hari."
              />
            </div>
            <div className="service-columns">
              <article>
                <h3>Buat toko tanpa harus belajar bikin website.</h3>
                <p>
                  Beri nama toko, isi produk dan harga, tentukan cara pembayaran,
                  lalu bagikan alamat tokomu. Semuanya lewat dashboard yang mudah dipakai.
                </p>
                <div className="service-detail">Tambah produk · Atur stok · Kelola pesanan · Lihat penjualan</div>
                <Link className="text-link" to="/register">Mulai buat tokomu <Icon name="arrow-up-right" size={19}/></Link>
              </article>
              <article>
                <h3>Tak perlu repot urus kode dan maintenance.</h3>
                <p>
                  Infrastruktur, pembaruan sistem, dan pengembangan fitur inti
                  platform ditangani Nalaro. Kamu bisa lebih fokus melayani
                  pelanggan dan mengembangkan usahamu.
                </p>
                <div className="service-detail">Sistem siap pakai · Update platform · Akses dari ponsel</div>
                <a className="text-link" href="#paket">Lihat paket berlangganan <Icon name="arrow-up-right" size={19}/></a>
              </article>
            </div>
          </div>
        </section>
        <SellerCenterSection />
        <PublicPricing />
        <section className="demo-showcase section-spacing">
          <div className="shell demo-showcase-layout">
            <div className="demo-showcase-copy">
              <h2>
                Bayangkan produkmu
                <br />
                di toko <em>seperti ini.</em>
              </h2>
              <p>
                Batik, kebaya, busana muslim, sampai tenun. Coba jelajahi Batik
                Nalaro untuk merasakan alurnya dari memilih produk sampai
                checkout.
              </p>
              <p className="demo-caption">
                Toko contoh. Kamu bisa mencoba belanja tanpa pembayaran atau
                pesanan nyata.
              </p>
              <ArrowLink to="/demo/batiknalaro">
                Masuk ke Batik Nalaro
              </ArrowLink>
            </div>
            <Link
              className="demo-showcase-image"
              to="/demo/batiknalaro"
              aria-label="Jelajahi demo Batik Nalaro"
            >
              <img
                src={editorialImage}
                alt="Model Indonesia mengenakan kemeja batik dan kebaya untuk koleksi Batik Nalaro"
                loading="lazy"
              />
              <span>
                Batik Nalaro <Icon name="arrow-up-right" size={24} />
              </span>
            </Link>
          </div>
        </section>
        <section className="faq-section" id="pertanyaan">
          <div className="shell faq-layout">
            <h2>
              Sebelum buka toko,
              <br />
              mungkin kamu
              <br />
              ingin tahu.
            </h2>
            <div className="faq-list">
              <details>
                <summary>
                  Sudah jualan di Instagram atau WhatsApp. Masih perlu toko
                  online?
                </summary>
                <p>
                  Tetap gunakan keduanya untuk promosi dan ngobrol dengan
                  pelanggan. Link toko membantu mereka melihat harga, memilih
                  produk, dan membuat pesanan tanpa harus menanyakan setiap
                  detail lewat chat.
                </p>
              </details>
              <details>
                <summary>Pelanggan harus punya akun untuk belanja?</summary>
                <p>
                  Tidak. Pelanggan bisa memilih produk dan checkout sebagai
                  tamu. Mereka mengisi informasi kontak dan cara menerima
                  pesanan saat checkout.
                </p>
              </details>
              <details>
                <summary>Bisa dipakai dari ponsel?</summary>
                <p>
                  Bisa. Kelola produk, stok, pesanan, dan omzet lewat aplikasi
                  Nalaro Seller Center untuk Android atau dashboard web. Kamu
                  juga bisa mendaftar langsung dari aplikasi. Pelanggan tetap
                  berbelanja lewat link tokomu tanpa perlu memasang app.
                </p>
              </details>
              <details>
                <summary>Kalau butuh website dengan fitur khusus?</summary>
                <p>
                  Nalaro Store khusus untuk toko berlangganan. Untuk website atau
                  aplikasi e-commerce dengan fitur khusus, tim Nalaro Dev bisa
                  membantu lewat <a href={CUSTOM_ORDER_URL} target="_blank" rel="noopener noreferrer">form order Nalaro</a>.
                </p>
              </details>
              <details>
                <summary>Apakah saya mendapat domain toko sendiri?</summary>
                <p>
                  Setiap toko memiliki alamat dalam domain Nalaro Store. Penggunaan
                  domain milik sendiri memerlukan paket yang memenuhi syarat,
                  verifikasi teknis, dan aktivasi; fitur ini belum tersedia untuk semua toko.
                </p>
              </details>
              <details>
                <summary>Bagaimana pembayaran dan pengirimannya?</summary>
                <p>
                  Pelanggan mengikuti metode pembayaran dan pengiriman yang
                  diatur pemilik toko. Status pembayaran diperbarui setelah
                  diverifikasi. Pada demo Batik Nalaro, seluruh checkout hanya
                  simulasi.
                </p>
              </details>
              <details>
                <summary>Bisa dibantu memilih layanan?</summary>
                <p>
                  Tentu.{" "}
                  <a
                    href={subscriptionWhatsApp}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Hubungi kami lewat WhatsApp
                  </a>{" "}
                  atau email{" "}
                  <a href="mailto:store@nalaro.digital">store@nalaro.digital</a>
                  . Ceritakan produk dan kebutuhan usahamu agar kita bisa
                  membahas pilihan yang sesuai.
                </p>
              </details>
            </div>
          </div>
        </section>
        <section className="closing-section">
          <div className="shell closing-layout">
            <h2>
              Produkmu punya cerita.
              <br />
              <em>Beri tempat untuk belanja.</em>
            </h2>
            <div>
              <p>
                Mulai dengan koleksi yang sudah kamu punya. Kalau masih bingung
                memilih, kita bantu membahas kebutuhan tokomu.
              </p>
              <Link className="button button-orange" to="/register">
                Yuk, buka toko <Icon name="arrow-up-right" size={19} />
              </Link>
              <a
                className="closing-chat"
                href={subscriptionWhatsApp}
                target="_blank"
                rel="noopener noreferrer"
              >
                Tanya dulu lewat WhatsApp{" "}
                <Icon name="arrow-up-right" size={17} />
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
function StoreHeader() {
  const cart = useCart();
  const [menu, setMenu] = useState(false);
  const location = useLocation();
  useEffect(() => setMenu(false), [location]);
  return (
    <>
      <div className="store-shipping">
        Batik Nalaro · Toko contoh, belanja di sini hanya simulasi
      </div>
      <header className="store-header">
        <div className="store-shell store-header-inner">
          <nav
            className={`store-links ${menu ? "store-links-open" : ""}`}
            aria-label="Kategori toko"
          >
            <Link to="/demo/batiknalaro/catalog">Semua produk</Link>
            <Link to="/demo/batiknalaro/catalog?category=Busana%20Muslim">
              Busana muslim
            </Link>
            <Link to="/demo/batiknalaro/catalog?category=Batik">Batik</Link>
          </nav>
          <Link to="/demo/batiknalaro" className="store-logo">
            BATIK <span>NALARO</span>
          </Link>
          <div className="store-tools">
            <Link to="/demo/batiknalaro/catalog" aria-label="Cari produk">
              <Icon name="search" size={21} />
            </Link>
            <Link
              to="/demo/batiknalaro/cart"
              className="store-bag"
              aria-label={`Keranjang ${cart.count} item`}
            >
              <Icon name="bag" size={21} />
              {cart.count > 0 && <span>{cart.count}</span>}
            </Link>
            <button
              className="store-menu-button"
              onClick={() => setMenu(!menu)}
              aria-label="Menu toko"
            >
              <Icon name={menu ? "close" : "menu"} size={22} />
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
function StoreFooter() {
  return (
    <footer className="store-footer">
      <div className="store-shell store-footer-grid">
        <div>
          <div className="store-logo">
            BATIK <span>NALARO</span>
          </div>
          <p>Batik, kebaya, dan tenun untuk menemani keseharian.</p>
        </div>
        <div>
          <b>Jelajahi</b>
          <Link to="/demo/batiknalaro/catalog">Semua produk</Link>
          <Link to="/demo/batiknalaro/catalog?category=Batik">Batik</Link>
          <Link to="/demo/batiknalaro/catalog?category=Busana%20Muslim">
            Busana muslim
          </Link>
        </div>
        <div>
          <b>Informasi</b>
          <span>
            Pembayaran dan pengiriman pada contoh ini bersifat simulasi.
          </span>
          <Link to="/">Tentang Nalaro Store</Link>
        </div>
      </div>
      <div className="store-shell store-footer-bottom">
        © Batik Nalaro · Toko contoh{" "}
        <Link to="/">
          Powered by Nalaro Store <Icon name="arrow-up-right" size={13} />
        </Link>
      </div>
    </footer>
  );
}
function StoreShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="storefront">
      <StoreHeader />
      <main>{children}</main>
      <StoreFooter />
    </div>
  );
}
function ProductTile({ product }: { product: DemoProduct }) {
  return (
    <Link
      className="product-tile"
      to={`/demo/batiknalaro/product/${product.slug}`}
    >
      <div className="product-image" style={{ backgroundColor: product.shade }}>
        <img src={product.image} alt={product.imageAlt} loading="lazy" />
        <span className="product-image-action" aria-hidden="true">
          <Icon name="arrow-up-right" size={18} />
        </span>
      </div>
      <div className="product-meta">
        <span>{product.category}</span>
        <h3>{product.name}</h3>
        <p>{rupiah(product.price)}</p>
      </div>
    </Link>
  );
}
function StoreHome() {
  return (
    <StoreShell>
      <section className="store-hero">
        <div
          className="store-hero-image"
          style={{ backgroundImage: `url(${editorialImage})` }}
        />
        <div className="store-hero-copy">
          <span>BATIK NALARO / KOLEKSI KESEHARIAN</span>
          <h1>
            Akar tradisi.
            <br />
            <i>Gaya hari ini.</i>
          </h1>
          <p>
            Batik, kebaya, dan tenun dengan padu padan yang dekat dengan
            keseharianmu.
          </p>
          <Link className="store-outline-button" to="/demo/batiknalaro/catalog">
            Lihat koleksi <Icon name="arrow-up-right" size={19} />
          </Link>
        </div>
        <div className="store-hero-side">
          Dari keseharian sampai momen istimewa. <span>Batik Nalaro</span>
        </div>
      </section>
      <section className="store-shell store-section">
        <div className="store-section-head">
          <div>
            <span>PILIHAN KOLEKSI</span>
            <h2>Dipilih untuk keseharian.</h2>
          </div>
          <Link to="/demo/batiknalaro/catalog" className="store-text-link">
            Semua produk <Icon name="arrow-right" size={18} />
          </Link>
        </div>
        <div className="product-grid">
          {products.slice(0, 4).map((p) => (
            <ProductTile key={p.id} product={p} />
          ))}
        </div>
      </section>
      <section className="store-editorial">
        <div
          className="store-editorial-photo"
          style={{ backgroundImage: `url(${collectionImage})` }}
        />
        <div className="store-editorial-copy">
          <span>BUSANA NUSANTARA</span>
          <h2>
            Tetap berakar.
            <br />
            <i>Bebas bergaya.</i>
          </h2>
          <p>
            Kebaya untuk acara keluarga, batik untuk bekerja, atau tenun untuk
            akhir pekan. Temukan cara memakainya yang paling terasa seperti
            dirimu.
          </p>
          <Link to="/demo/batiknalaro/catalog" className="store-outline-button">
            Jelajahi produk <Icon name="arrow-right" size={17} />
          </Link>
        </div>
      </section>
      <section className="store-shell store-section">
        <div className="store-section-head">
          <div>
            <span>TEMAN KESEHARIAN</span>
            <h2>Lebih banyak pilihan.</h2>
          </div>
        </div>
        <div className="product-grid">
          {products.slice(2, 6).map((p) => (
            <ProductTile key={p.id} product={p} />
          ))}
        </div>
      </section>
    </StoreShell>
  );
}
function StoreCatalog() {
  const [query, setQuery] = useState("");
  const params = new URLSearchParams(useLocation().search);
  const selected = params.get("category") || "Semua produk";
  const filtered = products.filter(
    (p) =>
      (selected === "Semua produk" || p.category === selected) &&
      `${p.name} ${p.category}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  return (
    <StoreShell>
      <section className="store-shell catalog-head">
        <div>
          <span className="store-overline">BATIK NALARO / KOLEKSI</span>
          <h1>Semua produk.</h1>
          <p>Temukan pilihan yang paling cocok untuk keseharianmu.</p>
        </div>
        <span>{filtered.length} produk</span>
      </section>
      <div className="store-shell catalog-layout">
        <aside className="catalog-side">
          <b>Kategori</b>
          {categories.map((c) => (
            <Link
              key={c}
              to={
                c === "Semua produk"
                  ? "/demo/batiknalaro/catalog"
                  : `/demo/batiknalaro/catalog?category=${encodeURIComponent(c)}`
              }
              className={selected === c ? "active" : ""}
            >
              {c}
              <Icon name="chevron-right" size={15} />
            </Link>
          ))}
        </aside>
        <div className="catalog-results">
          <div className="catalog-filters">
            <div className="search-box">
              <Icon name="search" size={20} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari produk"
                aria-label="Cari produk"
              />
            </div>
            <span>
              {selected === "Semua produk" ? "Semua kategori" : selected}
            </span>
          </div>
          <div className="catalog-mobile-cats">
            {categories.map((c) => (
              <Link
                key={c}
                to={
                  c === "Semua produk"
                    ? "/demo/batiknalaro/catalog"
                    : `/demo/batiknalaro/catalog?category=${encodeURIComponent(c)}`
                }
                className={selected === c ? "active" : ""}
              >
                {c}
              </Link>
            ))}
          </div>
          {filtered.length ? (
            <div className="product-grid">
              {filtered.map((p) => (
                <ProductTile key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <div className="empty-result">
              <Icon name="search" size={32} />
              <h2>Produk tidak ditemukan.</h2>
              <p>Coba kata kunci lain atau lihat semua kategori.</p>
              <Link to="/demo/batiknalaro/catalog" onClick={() => setQuery("")}>
                Atur ulang pencarian
              </Link>
            </div>
          )}
        </div>
      </div>
    </StoreShell>
  );
}
function ProductDetail() {
  const { slug } = useParams();
  const product = products.find((p) => p.slug === slug);
  const [size, setSize] = useState(product?.sizes[0] || "");
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const cart = useCart();
  useEffect(() => {
    setSize(product?.sizes[0] || "");
    setQuantity(1);
    setAdded(false);
  }, [product]);
  if (!product)
    return (
      <StoreShell>
        <div className="store-shell missing-product">
          <h1>Produk tidak ditemukan</h1>
          <Link to="/demo/batiknalaro/catalog">Kembali ke katalog</Link>
        </div>
      </StoreShell>
    );
  return (
    <StoreShell>
      <div className="store-shell product-detail">
        <div className="pdp-media">
          <div
            className="pdp-primary"
            style={{ backgroundColor: product.shade }}
          >
            <img src={product.image} alt={product.imageAlt} />
          </div>
          <div
            className="pdp-secondary"
            style={{ backgroundImage: `url(${product.image})` }}
          />
        </div>
        <div className="pdp-info">
          <div className="pdp-breadcrumb">
            <Link to="/demo/batiknalaro/catalog">Koleksi</Link>
            <Icon name="chevron-right" size={14} />
            <span>{product.category}</span>
          </div>
          <h1>{product.name}</h1>
          <div className="pdp-price">{rupiah(product.price)}</div>
          <p className="pdp-description">{product.description}</p>
          <div className="pdp-field">
            <div className="pdp-label">
              <b>Ukuran</b>
              <span>{size}</span>
            </div>
            <div className="size-options">
              {product.sizes.map((s) => (
                <button
                  key={s}
                  aria-pressed={s === size}
                  className={s === size ? "selected" : ""}
                  onClick={() => {
                    setSize(s);
                    setAdded(false);
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="pdp-field">
            <div className="pdp-label">
              <b>Jumlah</b>
              <span>{product.stock} tersedia (contoh)</span>
            </div>
            <div className="quantity-stepper">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                aria-label="Kurangi jumlah"
                disabled={quantity === 1}
              >
                <Icon name="minus" size={17} />
              </button>
              <span>{quantity}</span>
              <button
                onClick={() =>
                  setQuantity((q) => Math.min(product.stock, q + 1))
                }
                aria-label="Tambah jumlah"
                disabled={quantity >= product.stock}
              >
                <Icon name="plus" size={17} />
              </button>
            </div>
          </div>
          <button
            className="pdp-add"
            onClick={() => {
              cart.add(product.id, size, quantity);
              setAdded(true);
            }}
          >
            <Icon name="bag" size={20} /> Tambah ke keranjang{" "}
            <Icon name="arrow-right" size={20} />
          </button>
          {added && (
            <div className="pdp-added" role="status">
              <Icon name="check" size={17} /> Ditambahkan ke keranjang.{" "}
              <Link to="/demo/batiknalaro/cart">Lihat keranjang</Link>
            </div>
          )}
          <div className="pdp-service">
            <div>
              <Icon name="truck" size={20} />
              Opsi pengiriman saat checkout
            </div>
            <div>
              <Icon name="shield" size={20} />
              Simulasi belanja, tanpa pembayaran nyata
            </div>
          </div>
        </div>
      </div>
      <section className="store-shell store-section">
        <div className="store-section-head">
          <div>
            <span>PILIHAN LAINNYA</span>
            <h2>Lengkapi koleksimu.</h2>
          </div>
        </div>
        <div className="product-grid">
          {products
            .filter((p) => p.id !== product.id)
            .slice(0, 4)
            .map((p) => (
              <ProductTile key={p.id} product={p} />
            ))}
        </div>
      </section>
    </StoreShell>
  );
}
function Cart() {
  const cart = useCart();
  const items = cart.lines
    .map((line) => ({ line, product: products.find((p) => p.id === line.id)! }))
    .filter((x) => x.product);
  const subtotal = items.reduce(
    (sum, x) => sum + x.product.price * x.line.quantity,
    0,
  );
  return (
    <StoreShell>
      <div className="store-shell cart-page">
        <div className="cart-title">
          <span className="store-overline">PILIHANMU</span>
          <h1>
            Keranjang <span>({cart.count})</span>
          </h1>
        </div>
        {items.length ? (
          <div className="cart-layout">
            <div className="cart-lines">
              {items.map(({ line, product }) => (
                <div className="cart-line" key={`${line.id}:${line.size}`}>
                  <Link
                    to={`/demo/batiknalaro/product/${product.slug}`}
                    className="cart-line-image"
                  >
                    <img src={product.image} alt={product.imageAlt} />
                  </Link>
                  <div className="cart-line-body">
                    <div>
                      <Link to={`/demo/batiknalaro/product/${product.slug}`}>
                        <h2>{product.name}</h2>
                      </Link>
                      <p>Ukuran {line.size}</p>
                    </div>
                    <div className="cart-line-bottom">
                      <div className="quantity-stepper">
                        <button
                          aria-label={`Kurangi ${product.name}`}
                          onClick={() =>
                            cart.update(line.id, line.size, line.quantity - 1)
                          }
                        >
                          <Icon name="minus" size={15} />
                        </button>
                        <span>{line.quantity}</span>
                        <button
                          aria-label={`Tambah ${product.name}`}
                          onClick={() =>
                            cart.update(line.id, line.size, line.quantity + 1)
                          }
                          disabled={line.quantity >= product.stock}
                        >
                          <Icon name="plus" size={15} />
                        </button>
                      </div>
                      <button
                        className="underlined"
                        onClick={() => cart.update(line.id, line.size, 0)}
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                  <strong>{rupiah(product.price * line.quantity)}</strong>
                </div>
              ))}
            </div>
            <aside className="cart-summary">
              <h2>Ringkasan belanja</h2>
              <div>
                <span>Subtotal ({cart.count} produk)</span>
                <strong>{rupiah(subtotal)}</strong>
              </div>
              <div>
                <span>Pengiriman</span>
                <span>Dihitung saat checkout</span>
              </div>
              <div className="cart-total">
                <span>Subtotal</span>
                <strong>{rupiah(subtotal)}</strong>
              </div>
              <Link className="pdp-add" to="/demo/batiknalaro/checkout">
                Lanjut ke checkout <Icon name="arrow-right" size={19} />
              </Link>
              <p>
                Ini adalah contoh toko. Checkout tidak memproses pesanan atau
                pembayaran nyata.
              </p>
            </aside>
          </div>
        ) : (
          <div className="cart-empty">
            <Icon name="bag" size={42} />
            <h2>Keranjangmu masih kosong.</h2>
            <p>Jelajahi koleksi untuk menemukan produk pilihanmu.</p>
            <Link className="button button-dark" to="/demo/batiknalaro/catalog">
              Lihat semua produk <Icon name="arrow-right" size={18} />
            </Link>
          </div>
        )}
      </div>
    </StoreShell>
  );
}
function Checkout() {
  const cart = useCart();
  const navigate = useNavigate();
  const items = cart.lines
    .map((line) => ({ line, product: products.find((p) => p.id === line.id)! }))
    .filter((x) => x.product);
  const [method, setMethod] = useState<"pickup" | "delivery">("pickup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const subtotal = items.reduce(
    (sum, x) => sum + x.product.price * x.line.quantity,
    0,
  );
  const shipping = method === "delivery" ? 15000 : 0;
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!items.length) return;
    const token = `DEMO-${Math.floor(100000 + Math.random() * 899999)}`;
    sessionStorage.setItem(
      "nalaro-demo-confirmation",
      JSON.stringify({
        token,
        name,
        subtotal,
        shipping,
        method,
        items: cart.count,
      }),
    );
    cart.clear();
    navigate("/demo/batiknalaro/complete");
  }
  return (
    <StoreShell>
      <div className="store-shell checkout-page">
        <Link to="/demo/batiknalaro/cart" className="back-link">
          <Icon name="arrow-left" size={17} /> Kembali ke keranjang
        </Link>
        <div className="checkout-top">
          <span className="store-overline">CHECKOUT</span>
          <h1>Selesaikan pemesanan.</h1>
          <p>
            Mode demonstrasi. Data tidak dikirim ke server dan tidak ada
            transaksi pembayaran.
          </p>
        </div>
        {items.length ? (
          <form className="checkout-layout" onSubmit={submit}>
            <div className="checkout-fields">
              <fieldset>
                <legend>
                  <span>01</span> Informasi kontak
                </legend>
                <div className="checkout-two">
                  <label>
                    Nama lengkap
                    <input
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="name"
                      placeholder="Nama penerima"
                    />
                  </label>
                  <label>
                    Nomor WhatsApp
                    <input
                      required
                      type="tel"
                      inputMode="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="08..."
                      minLength={8}
                    />
                  </label>
                </div>
                <label>
                  Email (opsional)
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    placeholder="nama@email.com"
                  />
                </label>
              </fieldset>
              <fieldset>
                <legend>
                  <span>02</span> Cara menerima pesanan
                </legend>
                <div className="option-list">
                  <label
                    className={`delivery-option ${method === "pickup" ? "chosen" : ""}`}
                  >
                    <input
                      type="radio"
                      name="delivery"
                      checked={method === "pickup"}
                      onChange={() => setMethod("pickup")}
                    />
                    <Icon name="map-pin" size={21} />
                    <span>
                      <b>Ambil di toko</b>
                      <small>Tanpa biaya pengiriman</small>
                    </span>
                    <strong>Gratis</strong>
                  </label>
                  <label
                    className={`delivery-option ${method === "delivery" ? "chosen" : ""}`}
                  >
                    <input
                      type="radio"
                      name="delivery"
                      checked={method === "delivery"}
                      onChange={() => setMethod("delivery")}
                    />
                    <Icon name="truck" size={21} />
                    <span>
                      <b>Kurir lokal (simulasi)</b>
                      <small>
                        Tarif contoh, bukan penawaran pengiriman nyata
                      </small>
                    </span>
                    <strong>{rupiah(15000)}</strong>
                  </label>
                </div>
                {method === "delivery" && (
                  <label>
                    Alamat lengkap
                    <textarea
                      required
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Nama jalan, nomor rumah, kecamatan, kota/kabupaten, kode pos"
                      rows={4}
                      minLength={12}
                    />
                  </label>
                )}
              </fieldset>
              <fieldset>
                <legend>
                  <span>03</span> Pembayaran
                </legend>
                <div className="notice">
                  <Icon name="info" size={20} />
                  <p>
                    Tidak ada pembayaran pada mode demo. Kamu bisa mencoba
                    alurnya tanpa transfer uang. Pesanan contoh tidak dikirim ke
                    toko.
                  </p>
                </div>
              </fieldset>
              <button type="submit" className="pdp-add checkout-submit">
                Simulasikan pesanan <Icon name="arrow-right" size={20} />
              </button>
            </div>
            <aside className="checkout-summary">
              <h2>Pesananmu</h2>
              {items.map(({ line, product }) => (
                <div className="checkout-item" key={`${line.id}:${line.size}`}>
                  <img src={product.image} alt="" />
                  <div>
                    <b>{product.name}</b>
                    <p>
                      {line.size} · {line.quantity} item
                    </p>
                  </div>
                  <strong>{rupiah(product.price * line.quantity)}</strong>
                </div>
              ))}
              <div className="checkout-line">
                <span>Subtotal</span>
                <strong>{rupiah(subtotal)}</strong>
              </div>
              <div className="checkout-line">
                <span>Pengiriman</span>
                <strong>{shipping ? rupiah(shipping) : "Gratis"}</strong>
              </div>
              <div className="checkout-final">
                <span>Total simulasi</span>
                <strong>{rupiah(subtotal + shipping)}</strong>
              </div>
            </aside>
          </form>
        ) : (
          <div className="cart-empty">
            <h2>Belum ada produk yang dipilih.</h2>
            <Link to="/demo/batiknalaro/catalog" className="button button-dark">
              Jelajahi koleksi
            </Link>
          </div>
        )}
      </div>
    </StoreShell>
  );
}
function Complete() {
  const saved = sessionStorage.getItem("nalaro-demo-confirmation");
  let record: {
    token: string;
    name: string;
    subtotal: number;
    shipping: number;
    items: number;
    method: string;
  } | null = null;
  try {
    record = saved ? JSON.parse(saved) : null;
  } catch {
    /* invalid demo session */
  }
  return (
    <StoreShell>
      <div className="store-shell complete-page">
        <span className="complete-icon">
          <Icon name="check" size={32} />
        </span>
        <span className="store-overline">SIMULASI CHECKOUT</span>
        <h1>Alur pemesanan selesai.</h1>
        <p>
          Ini hanya pratinjau pengalaman belanja. Tidak ada pesanan yang dicatat
          atau pembayaran yang ditagihkan.
        </p>
        {record && (
          <div className="complete-slip">
            <div>
              <span>Referensi demo</span>
              <strong>{record.token}</strong>
            </div>
            <div>
              <span>Nama</span>
              <strong>{record.name}</strong>
            </div>
            <div>
              <span>Item</span>
              <strong>{record.items}</strong>
            </div>
            <div>
              <span>Total contoh</span>
              <strong>{rupiah(record.subtotal + record.shipping)}</strong>
            </div>
          </div>
        )}
        <Link className="button button-dark" to="/demo/batiknalaro">
          Kembali ke toko <Icon name="arrow-right" size={18} />
        </Link>
      </div>
    </StoreShell>
  );
}
const menuItems: { title: string; icon: IconName; href: string }[] = [
  { title: "Ringkasan", icon: "home", href: "/demo/workspace" },
  { title: "Pesanan", icon: "orders", href: "/demo/workspace/orders" },
  { title: "Produk", icon: "box", href: "/demo/workspace/products" },
  { title: "Tampilan toko", icon: "palette", href: "/demo/workspace/design" },
];
function MerchantLayout({children,title,subtitle}:{children:React.ReactNode;title:string;subtitle:string}){const location=useLocation();const [mobileMenu,setMobileMenu]=useState(false);useEffect(()=>setMobileMenu(false),[location]);return <div className="workspace"><aside className={`workspace-sidebar ${mobileMenu?'workspace-open':''}`}><div className="workspace-sidebar-top"><Logo/><div className="workspace-switcher"><span className="workspace-store-avatar">SA</span><div><strong>Studio Atelier</strong><small>Toko pratinjau</small></div><Icon name="chevron-down" size={15}/></div></div><nav aria-label="Navigasi workspace">{menuItems.map(item=><Link key={item.href} className={(location.pathname===item.href?'active':'')} to={item.href}><Icon name={item.icon} size={19}/><span>{item.title}</span></Link>)}<span className="workspace-menu-heading">LAINNYA</span><Link to="/custom"><Icon name="help" size={19}/><span>Bantuan & custom</span></Link></nav><div className="workspace-sidebar-bottom"><span>Contoh antarmuka merchant</span><Link to="/demo/atelier">Lihat contoh toko <Icon name="arrow-up-right" size={16}/></Link></div></aside><div className="workspace-main"><header className="workspace-topbar"><button className="mobile-menu" aria-label="Buka menu workspace" onClick={()=>setMobileMenu(true)}><Icon name="menu" size={22}/></button><span>Studio Atelier <Icon name="chevron-right" size={15}/> Workspace</span><div><span className="preview-tag">DATA CONTOH</span><Link to="/demo/atelier" className="work-view-store">Lihat toko <Icon name="arrow-up-right" size={16}/></Link><span className="user-avatar">N</span></div></header><main className="workspace-content"><div className="workspace-heading"><div><span className="work-eyebrow">WORKSPACE / STUDIO ATELIER</span><h1>{title}</h1><p>{subtitle}</p></div><span className="work-date">Pratinjau desain dan navigasi</span></div>{children}</main></div><nav className="workspace-bottom-nav" aria-label="Navigasi utama mobile">{menuItems.slice(0,3).map(item=><Link key={item.href} className={location.pathname===item.href?'active':''} to={item.href}><Icon name={item.icon} size={21}/><span>{item.title}</span></Link>)}<button onClick={()=>setMobileMenu(!mobileMenu)}><Icon name="menu" size={21}/><span>Lainnya</span></button></nav>{mobileMenu&&<button className="workspace-overlay" aria-label="Tutup menu" onClick={()=>setMobileMenu(false)}/>}</div>}
const demoOrders = [
  {
    id: "#NS-0248",
    name: "Ratna Prameswari",
    date: "Hari ini, 10.24",
    amount: 448000,
    payment: "Dibayar",
    fulfillment: "Perlu dikemas",
    style: "amber",
  },
  {
    id: "#NS-0247",
    name: "Rizki Ramadhan",
    date: "Hari ini, 09.12",
    amount: 289000,
    payment: "Menunggu",
    fulfillment: "Menunggu pembayaran",
    style: "gray",
  },
  {
    id: "#NS-0246",
    name: "Fira Andini",
    date: "Kemarin, 17.46",
    amount: 159000,
    payment: "Dibayar",
    fulfillment: "Dalam pengiriman",
    style: "blue",
  },
  {
    id: "#NS-0245",
    name: "Taufik Hidayat",
    date: "Kemarin, 13.05",
    amount: 578000,
    payment: "Dibayar",
    fulfillment: "Selesai",
    style: "green",
  },
];
function Status({children,style}:{children:React.ReactNode;style:string}){return <span className={`status status-${style}`}><span/>{children}</span>}
function OrderRows({limit}:{limit?:number}){return <div className="orders-scroll"><table className="orders-table"><thead><tr><th>Pesanan</th><th>Pelanggan</th><th>Waktu</th><th>Nominal</th><th>Pembayaran</th><th>Pengiriman</th></tr></thead><tbody>{demoOrders.slice(0,limit).map(o=><tr key={o.id}><td className="mono-bold">{o.id}</td><td>{o.name}</td><td>{o.date}</td><td className="amount-cell">{rupiah(o.amount)}</td><td><Status style={o.payment==='Dibayar'?'green':'gray'}>{o.payment}</Status></td><td><Status style={o.style}>{o.fulfillment}</Status></td></tr>)}</tbody></table></div>}
function Overview(){return <MerchantLayout title="Ringkasan toko" subtitle="Apa yang perlu diperhatikan hari ini."><section className="work-priorities"><div className="work-priority-title"><Icon name="alert" size={19}/><span>Perlu perhatian</span></div><div className="priority-columns"><Link to="/demo/workspace/orders"><strong>04</strong><span>Pesanan menunggu tindakan</span><Icon name="arrow-up-right" size={18}/></Link><Link to="/demo/workspace/products"><strong>02</strong><span>Produk perlu cek stok</span><Icon name="arrow-up-right" size={18}/></Link><Link to="/demo/workspace/design"><strong>01</strong><span>Pengaturan tampilan toko</span><Icon name="arrow-up-right" size={18}/></Link></div></section><div className="work-numbers"><div><span>Penjualan terverifikasi</span><strong>{rupiah(1487000)}</strong><small>Contoh data 7 hari</small></div><div><span>Pesanan masuk</span><strong>18</strong><small>Contoh data 7 hari</small></div><div><span>Nilai rata-rata pesanan</span><strong>{rupiah(217000)}</strong><small>Contoh data 7 hari</small></div></div><section className="work-section"><div className="work-section-title"><h2>Pesanan terbaru</h2><Link to="/demo/workspace/orders">Lihat semua <Icon name="arrow-right" size={17}/></Link></div><OrderRows limit={4}/></section><div className="work-lower"><section className="work-section"><div className="work-section-title"><h2>Aktivitas penjualan</h2><span>7 hari terakhir</span></div><div className="bar-chart" role="img" aria-label="Ilustrasi penjualan contoh dalam tujuh hari, tidak berasal dari transaksi asli">{[44,65,47,90,67,73,83].map((height,i)=><div key={i}><span style={{height:`${height}%`}}/><small>{['Sen','Sel','Rab','Kam','Jum','Sab','Min'][i]}</small></div>)}</div></section><section className="work-section work-note"><span className="work-note-icon"><Icon name="shield" size={24}/></span><h2>Bangun toko yang siap tumbuh.</h2><p>Contoh workspace ini memperlihatkan arah pengalaman merchant. Pengelolaan akun dan pesanan nyata diaktifkan setelah database, akses pengguna dan keamanan transaksi terhubung.</p><Link to="/custom">Diskusikan kebutuhanmu <Icon name="arrow-right" size={17}/></Link></section></div></MerchantLayout>}
function Orders(){const [filter,setFilter]=useState('Semua');const shown=demoOrders.filter(o=>filter==='Semua'||(filter==='Perlu diproses'&&o.fulfillment==='Perlu dikemas')||(filter==='Menunggu pembayaran'&&o.payment==='Menunggu')||(filter==='Selesai'&&o.fulfillment==='Selesai'));return <MerchantLayout title="Pesanan" subtitle="Pantau transaksi dan tentukan langkah berikutnya."><div className="work-section"><div className="work-tabbar">{['Semua','Perlu diproses','Menunggu pembayaran','Selesai'].map(f=><button key={f} className={f===filter?'active':''} onClick={()=>setFilter(f)}>{f}</button>)}</div><div className="work-list-mobile">{shown.map(o=><article key={o.id}><div><strong>{o.id}</strong><Status style={o.style}>{o.fulfillment}</Status></div><h3>{o.name}</h3><p>{o.date}</p><b>{rupiah(o.amount)}</b></article>)}</div><div className="work-list-desktop"><div className="orders-scroll"><table className="orders-table"><thead><tr><th>Pesanan</th><th>Pelanggan</th><th>Waktu</th><th>Nominal</th><th>Pembayaran</th><th>Pengiriman</th></tr></thead><tbody>{shown.map(o=><tr key={o.id}><td className="mono-bold">{o.id}</td><td>{o.name}</td><td>{o.date}</td><td className="amount-cell">{rupiah(o.amount)}</td><td><Status style={o.payment==='Dibayar'?'green':'gray'}>{o.payment}</Status></td><td><Status style={o.style}>{o.fulfillment}</Status></td></tr>)}</tbody></table></div></div></div><p className="work-caption">Data di atas adalah contoh untuk mengevaluasi tampilan, bukan pesanan nyata.</p></MerchantLayout>}
function Products(){const [q,setQ]=useState('');const shown=products.filter(p=>p.name.toLowerCase().includes(q.toLowerCase()));return <MerchantLayout title="Produk" subtitle="Koleksi produk yang dijual di tokomu."><div className="work-section"><div className="product-work-tools"><div className="search-box"><Icon name="search" size={19}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Cari produk" aria-label="Cari produk"/></div><button className="button button-dark" title="Editor produk akan terhubung di fase berikutnya" disabled><Icon name="plus" size={18}/> Tambah produk</button></div><div className="work-product-list">{shown.map(p=><article key={p.id}><img src={p.image} alt=""/><div><h3>{p.name}</h3><p>{p.category} · {p.sizes.length} pilihan</p></div><strong>{rupiah(p.price)}</strong><span className="product-stock">Stok contoh {p.stock}</span><Link to={`/demo/atelier/product/${p.slug}`} aria-label={`Lihat ${p.name}`}><Icon name="arrow-up-right" size={20}/></Link></article>)}</div>{shown.length===0&&<p className="work-caption">Tidak ada produk yang cocok dengan pencarian.</p>}</div><p className="work-caption">Tambah/edit produk akan aktif pada fase backend merchant berikutnya; tombol dinonaktifkan agar tidak terkesan menyimpan data sungguhan.</p></MerchantLayout>}
function Design(){return <MerchantLayout title="Tampilan toko" subtitle="Identitas visual yang tetap menjadi milik bisnismu."><div className="work-section theme-overview"><div><span className="work-eyebrow">TEMA YANG DIGUNAKAN</span><h2>Atelier</h2><p>Komposisi editorial untuk fashion, lifestyle, dan produk kurasi. Fokus pada fotografi koleksi dan alur belanja.</p><div className="theme-swatches"><span style={{background:'#171715'}}/><span style={{background:'#ece7dd'}}/><span style={{background:'#b1a693'}}/><span style={{background:'#fff'}}/></div><p className="work-caption">Tema Market dan Local dipersiapkan setelah commerce core stabil.</p><Link className="button button-dark" to="/demo/atelier">Lihat pratinjau <Icon name="arrow-up-right" size={18}/></Link></div><div className="theme-preview"><img src={editorialImage} alt="Contoh visual tema Atelier"/><div><b>STUDIO ATELIER</b><span>Made for your everyday.</span></div></div></div></MerchantLayout>}
function NotFound(){return <><MarketingNav/><main className="not-found shell"><span>404</span><h1>Halaman tidak ditemukan.</h1><p>Alamat mungkin berubah atau tidak tersedia.</p><Link className="button button-dark" to="/">Kembali ke beranda <Icon name="arrow-right" size={17}/></Link></main><Footer/></>}
function StoreRoute(){const {slug}=useParams();return <LiveStore key={slug}/>;}
function LegacyDemoRedirect() {
  const { pathname, search } = useLocation();
  const legacySlugs: Record<string, string> = {
    "cotton-overshirt": "kemeja-batik-sagara",
    "essential-tee": "kebaya-ivory-laras",
    "weekend-shirt": "gamis-sage-ayu",
    "linen-layer": "sarung-tenun-bumi",
    "everyday-carry": "jaket-aksen-nusa",
    "relaxed-pants": "selendang-tenun-senja",
  };
  const slug = pathname.split("/").pop() || "";
  const nextPath = pathname.replace("/demo/atelier", "/demo/batiknalaro");
  const destination =
    pathname.includes("/product/") && legacySlugs[slug]
      ? nextPath.slice(0, nextPath.lastIndexOf("/") + 1) + legacySlugs[slug]
      : nextPath;
  return <Navigate to={destination + search} replace />;
}
function CustomRedirect() {
  useEffect(() => { window.location.replace(CUSTOM_ORDER_URL); }, []);
  return <main className="auth-page"><h1>Pesan toko khusus bersama Nalaro Dev</h1><p>Kamu akan diarahkan ke formulir Nalaro Digital.</p><a className="button button-dark" href={CUSTOM_ORDER_URL}>Buka formulir Nalaro <Icon name="arrow-up-right" size={18}/></a></main>;
}
function LegalRoute() {
  const { document } = useParams();
  const kind = document === "privasi" || document === "ketentuan" || document === "program-umkm" ? document : null;
  if (!kind) return <NotFound/>;
  return <><MarketingNav/><LegalPage kind={kind}/><Footer/></>;
}
function App() {
  if (window.location.hostname.endsWith(".store.nalaro.digital"))
    return (
      <BrowserRouter>
        <LiveStore hostname />
      </BrowserRouter>
    );
  return (
    <BrowserRouter>
      <CartProvider>
        <ScrollTop />
        <Routes>
          <Route path="/" element={<Marketing />} />
          <Route path="/custom" element={<CustomRedirect />} />
          <Route path="/program-umkm" element={<UmkmApplication />} />
          <Route path="/legal/:document" element={<LegalRoute />} />
          <Route path="/login" element={<Auth />} />
          <Route path="/register" element={<Auth register />} />
          <Route path="/verify" element={<Verify />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/auth/action" element={<AuthAction />} />
          <Route path="/app/*" element={<Merchant />} />
          <Route path="/admin/*" element={<Admin />} />
          <Route path="/s/:slug/*" element={<StoreRoute />} />
          <Route
            path="/preview/:sid/*"
            element={
              <RequireAuth>
                <LiveStore preview />
              </RequireAuth>
            }
          />
          <Route path="/demo/batiknalaro" element={<StoreHome />} />
          <Route path="/demo/batiknalaro/catalog" element={<StoreCatalog />} />
          <Route
            path="/demo/batiknalaro/product/:slug"
            element={<ProductDetail />}
          />
          <Route path="/demo/batiknalaro/cart" element={<Cart />} />
          <Route path="/demo/batiknalaro/checkout" element={<Checkout />} />
          <Route path="/demo/batiknalaro/complete" element={<Complete />} />
          <Route path="/demo/atelier/*" element={<LegacyDemoRedirect />} />
          <Route path="/demo/workspace" element={<Overview />} />
          <Route path="/demo/workspace/orders" element={<Orders />} />
          <Route path="/demo/workspace/products" element={<Products />} />
          <Route path="/demo/workspace/design" element={<Design />} />
          <Route
            path="/dashboard"
            element={<Navigate to="/demo/workspace" replace />}
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </CartProvider>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Suspense
      fallback={
        <main className="auth-page" aria-busy="true">
          Memuat halaman...
        </main>
      }
    >
      <App />
    </Suspense>
  </React.StrictMode>,
);
