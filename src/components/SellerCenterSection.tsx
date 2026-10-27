import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "./Icon";
import "./seller-center.css";

const Motion = lazy(() =>
  import("./SellerCenterMotion").then((m) => ({
    default: m.SellerCenterMotion,
  })),
);
export const SELLER_APP_URL = `https://wa.me/6285771298582?text=${encodeURIComponent("Halo Nalaro, saya ingin mencoba Nalaro Seller Center untuk Android. Boleh minta link APK beta dan panduan mendaftar dari aplikasi?")}`;

function MotionPlaceholder() {
  return (
    <div className="seller-motion-placeholder" aria-hidden="true">
      <img src="/android-chrome-192x192.png" alt="" width="52" height="52" />
      <span>
        Nalaro
        <br />
        Seller Center
      </span>
    </div>
  );
}

export function SellerCenterSection() {
  const visual = useRef<HTMLElement>(null);
  const [load, setLoad] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "240px" },
    );
    observer.observe(visual.current!);
    return () => observer.disconnect();
  }, []);
  return (
    <section
      className="seller-center-section"
      id="seller-center"
      aria-labelledby="seller-center-title"
    >
      <div className="shell seller-center-layout">
        <div className="seller-center-copy">
          <h2 id="seller-center-title">
            Kelola tokomu dari mana saja.
          </h2>
          <p className="seller-center-intro">Nalaro Seller Center</p>
          <p>
            Cek pesanan, perbarui produk, dan atur stok lewat Nalaro Seller Center untuk Android atau dashboard web, termasuk di iPhone.
          </p>
          <ul className="seller-center-benefits">
            <li>
              <Icon name="box" size={21} />
              <span>Produk, foto, dan stok kamu atur di satu app.</span>
            </li>
            <li>
              <Icon name="chart" size={21} />
              <span>Omzet dan hasil penjualan lebih mudah dipantau.</span>
            </li>
            <li>
              <Icon name="users" size={21} />
              <span>Belum punya toko? Daftar langsung dari aplikasi.</span>
            </li>
          </ul>
          <div className="seller-center-actions">
            <a
              className="button seller-app-button"
              href={SELLER_APP_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Dapatkan app Android <Icon name="arrow-up-right" size={19} />
            </a>
            <Link to="/register" className="seller-web-link">
              Daftar lewat web <Icon name="arrow-right" size={17} />
            </Link>
          </div>
          <p className="seller-center-availability">
            Versi beta untuk Android. Minta link APK dan panduan instalasi lewat
            WhatsApp Nalaro.
          </p>
        </div>
        <figure
          ref={visual}
          className="seller-center-visual"
          aria-label="Motion aplikasi Nalaro Seller Center"
        >
          {load ? (
            <>
              <link
                rel="stylesheet"
                href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
                precedence="seller-motion"
              />
              <Suspense fallback={<MotionPlaceholder />}>
                <Motion />
              </Suspense>
            </>
          ) : (
            <MotionPlaceholder />
          )}
          <figcaption>Pratinjau aplikasi dengan data contoh.</figcaption>
        </figure>
      </div>
    </section>
  );
}
