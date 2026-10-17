import { useEffect, useRef, useState } from "react";
const steps = [
  {
    title: "Kenali ruang tokomu",
    body: "Nama toko menunjukkan ruang yang sedang aktif. Pilihan toko hanya berisi toko yang menjadi keanggotaan akunmu.",
    selector: ".workspace-current-store",
  },
  {
    title: "Pantau pesanan",
    body: "Periksa pesanan baru, verifikasi pembayaran, lalu siapkan pengiriman atau pengambilan.",
    selector: 'a[href^="/app/orders"]',
  },
  {
    title: "Kelola produk dan stok",
    body: "Tambahkan foto, varian, dan harga. Perbarui persediaan agar pembeli melihat stok yang tersedia.",
    selector: 'a[href^="/app/products"]',
  },
  {
    title: "Pahami penjualanmu",
    body: "Analitik memisahkan penjualan produk dan ongkir, serta menampilkan produk dan varian terlaris.",
    selector: 'a[href^="/app/analytics"]',
  },
  {
    title: "Tetap dekat dengan pelanggan",
    body: "Buka Chat pelanggan untuk membalas pesan, Notifikasi untuk pekerjaan terbaru, dan Penanggung jawab untuk profil pribadi operasional. Di ponsel, buka menu Lainnya.",
    selector: '.workspace-bottom-nav button, a[href^="/app/chat"]',
  },
];
export function SellerGuide({
  userId,
  replay,
}: {
  userId: string;
  replay: number;
}) {
  const [open, setOpen] = useState(false),
    [index, setIndex] = useState(0),
    [target, setTarget] = useState<DOMRect | null>(null);
  const card = useRef<HTMLDivElement>(null),
    previousFocus = useRef<HTMLElement | null>(null);
  const key = "nalaro-web-guide-v2:" + userId;
  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(key) === "seen";
    } catch {
      /* In-memory acknowledgement still works. */
    }
    if (!seen || replay > 0) {
      previousFocus.current = document.activeElement as HTMLElement;
      setIndex(0);
      setOpen(true);
    }
  }, [key, replay]);
  function close() {
    setOpen(false);
    try {
      localStorage.setItem(key, "seen");
    } catch {
      /* Storage may be disabled. */
    }
    previousFocus.current?.focus();
  }
  useEffect(() => {
    if (!open) return;
    const update = () => {
      const nodes = [
        ...document.querySelectorAll<HTMLElement>(steps[index].selector),
      ];
      const visible = nodes.find((n) => n.getClientRects().length > 0);
      setTarget(visible?.getBoundingClientRect() || null);
    };
    update();
    card.current?.focus();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, index]);
  if (!open) return null;
  return (
    <div
      className="seller-guide-overlay"
      onKeyDown={(e) => {
        if (e.key === "Escape") close();
        if (e.key === "Tab") {
          const buttons = card.current?.querySelectorAll<HTMLButtonElement>(
            "button:not(:disabled)",
          );
          if (!buttons?.length) return;
          const first = buttons[0],
            last = buttons[buttons.length - 1];
          if (
            e.shiftKey &&
            (document.activeElement === first ||
              document.activeElement === card.current)
          ) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }}
    >
      {target && (
        <div
          className="seller-guide-highlight"
          style={{
            left: target.left - 5,
            top: target.top - 5,
            width: target.width + 10,
            height: target.height + 10,
          }}
        />
      )}
      <div
        className="seller-guide-card"
        ref={card}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="seller-guide-title"
      >
        <small>
          PANDUAN SELLER · {index + 1} / {steps.length}
        </small>
        <h2 id="seller-guide-title">{steps[index].title}</h2>
        <p>{steps[index].body}</p>
        <div>
          <button onClick={close}>Lewati</button>
          {index > 0 && (
            <button onClick={() => setIndex((i) => i - 1)}>Kembali</button>
          )}
          <button
            className="button button-dark"
            onClick={() =>
              index === steps.length - 1 ? close() : setIndex((i) => i + 1)
            }
          >
            {index === steps.length - 1 ? "Mulai kelola toko" : "Berikutnya"}
          </button>
        </div>
      </div>
    </div>
  );
}
