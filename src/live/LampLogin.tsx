import {
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import { Icon } from "../components/Icon";
import "./lamp-login.css";

/** A short-lived spring animation: no animation loop runs while the lamp rests. */
function PullLamp({ on, toggle }: { on: boolean; toggle: () => void }) {
  const id = useId().replace(/:/g, "");
  const svg = useRef<SVGSVGElement>(null);
  const rope = useRef<SVGPathElement>(null);
  const handle = useRef<HTMLSpanElement>(null);
  const motion = useRef({ x: 0, y: 0, vx: 0, vy: 0, frame: 0 });
  const drag = useRef<{
    pointer: number;
    x: number;
    y: number;
    moved: number;
  } | null>(null);

  function draw(x: number, y: number) {
    motion.current.x = x;
    motion.current.y = y;
    rope.current?.setAttribute(
      "d",
      `M 254 218 Q ${254 + x * 0.28} ${275 + y * 0.4} ${254 + x} ${342 + y}`,
    );
    if (handle.current)
      handle.current.style.transform = `translate(${x}px, ${y}px) rotate(${-x * 0.18}deg)`;
  }

  function settle() {
    cancelAnimationFrame(motion.current.frame);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      draw(0, 0);
      return;
    }
    let last = performance.now();
    const tick = (time: number) => {
      const m = motion.current;
      const dt = Math.min((time - last) / 16.67, 2);
      last = time;
      m.vx = (m.vx - m.x * 0.12 * dt) * Math.pow(0.82, dt);
      m.vy = (m.vy - m.y * 0.15 * dt) * Math.pow(0.78, dt);
      draw(m.x + m.vx * dt, m.y + m.vy * dt);
      if (
        Math.abs(m.x) + Math.abs(m.y) + Math.abs(m.vx) + Math.abs(m.vy) >
        0.12
      )
        m.frame = requestAnimationFrame(tick);
      else draw(0, 0);
    };
    motion.current.frame = requestAnimationFrame(tick);
  }

  useEffect(() => () => cancelAnimationFrame(motion.current.frame), []);

  function start(e: PointerEvent<HTMLButtonElement>) {
    if (!e.isPrimary || e.button !== 0) return;
    cancelAnimationFrame(motion.current.frame);
    motion.current.vx = motion.current.vy = 0;
    drag.current = {
      pointer: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      moved: 0,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function move(e: PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    const scale = 420 / (svg.current?.getBoundingClientRect().width || 420);
    const x = (e.clientX - d.x) * scale;
    const y = (e.clientY - d.y) * scale;
    d.moved = Math.max(d.moved, Math.hypot(x, y));
    draw(Math.max(-65, Math.min(65, x)), Math.max(-8, Math.min(64, y)));
  }

  function release(e: PointerEvent<HTMLButtonElement>, cancelled = false) {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    drag.current = null;
    if (!cancelled && (d.moved <= 7 || motion.current.y >= 22)) {
      toggle();
      if (d.moved <= 7) draw(0, 32);
    }
    settle();
  }

  return (
    <div className="shop-lamp">
      <svg ref={svg} viewBox="0 0 420 580" aria-hidden="true">
        <defs>
          <linearGradient id={`${id}-shade`}>
            <stop stopColor="#851c3b" />
            <stop offset=".46" stopColor="#ed416c" />
            <stop offset="1" stopColor="#9d2345" />
          </linearGradient>
          <linearGradient id={`${id}-metal`}>
            <stop stopColor="#51454b" />
            <stop offset=".48" stopColor="#b8a8a9" />
            <stop offset="1" stopColor="#4b3e45" />
          </linearGradient>
          <linearGradient id={`${id}-beam`} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#ffd4c4" stopOpacity=".38" />
            <stop offset="1" stopColor="#ff7595" stopOpacity="0" />
          </linearGradient>
          <radialGradient id={`${id}-pool`}>
            <stop stopColor="#f29eae" stopOpacity=".24" />
            <stop offset="1" stopColor="#e37696" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g className="shop-lamp-light">
          <path d="M101 222H309L440 548H-30Z" fill={`url(#${id}-beam)`} />
          <ellipse
            cx="210"
            cy="533"
            rx="218"
            ry="38"
            fill={`url(#${id}-pool)`}
          />
        </g>
        <ellipse
          cx="206"
          cy="548"
          rx="92"
          ry="12"
          fill="#08080d"
          opacity=".45"
        />
        <path d="M201 236H211V519H201Z" fill={`url(#${id}-metal)`} />
        <path
          d="M142 536Q146 512 206 512Q266 512 270 536Z"
          fill="#43343e"
          stroke="#6d5762"
        />
        <ellipse cx="206" cy="536" rx="64" ry="8" fill="#332730" />
        <path
          d="M206 77V98"
          stroke="#bfa1a7"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <ellipse cx="206" cy="225" rx="105" ry="12" fill="#462332" />
        <ellipse
          className="shop-lamp-light"
          cx="206"
          cy="225"
          rx="101"
          ry="10"
          fill="#ffe1cf"
        />
        <path
          d="M155 99Q206 91 257 99L311 218Q206 238 101 218Z"
          fill={`url(#${id}-shade)`}
        />
        <path
          d="M155 99Q206 107 257 99M101 218Q206 238 311 218"
          fill="none"
          stroke="#f184a0"
          strokeOpacity=".65"
          strokeWidth="2"
        />
        <path
          d="M181 104L162 223M231 104L250 223"
          stroke="#ffb2c5"
          strokeOpacity=".12"
        />
        <path
          ref={rope}
          d="M254 218Q254 275 254 342"
          fill="none"
          stroke="#e3bdc7"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <g transform="translate(111 383) rotate(-8)">
          <path d="M4 4L24 -15L44 4" fill="none" stroke="#92757e" />
          <rect
            width="110"
            height="64"
            rx="9"
            fill="#251d28"
            stroke="#78505f"
          />
          <circle
            cx="14"
            cy="17"
            r="3"
            fill="currentColor"
            className="shop-sign-dot"
          />
          <text
            x="26"
            y="21"
            fill="#bfa9b4"
            fontSize="9"
            fontFamily="sans-serif"
            letterSpacing="1.3"
          >
            TOKO SAYA
          </text>
          <text
            x="14"
            y="47"
            fill={on ? "#ffb8ca" : "#a48e9c"}
            fontSize="18"
            fontFamily="sans-serif"
            fontWeight="600"
            letterSpacing="1"
          >
            {on ? "BUKA" : "TUTUP"}
          </text>
        </g>
      </svg>
      <div className="shop-lamp-controls">
        <button
          type="button"
          className="shop-lamp-pull"
          aria-label={on ? "Matikan lampu" : "Nyalakan lampu"}
          aria-pressed={on}
          aria-describedby="lamp-instruction"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={(e) => release(e)}
          onPointerCancel={(e) => release(e, true)}
          onLostPointerCapture={(e) => release(e, true)}
          onClick={(e) => {
            // Pointer activation happens on release, including touch devices
            // that omit a compatibility click after a drag. Keep keyboard and
            // assistive-technology click activation without toggling twice.
            if (e.detail !== 0) return;
            toggle();
            draw(0, 32);
            settle();
          }}
        >
          <span ref={handle} className="shop-lamp-grip" />
        </button>
      </div>
    </div>
  );
}

export function LampLoginFrame({
  children,
  register,
}: {
  children: ReactNode;
  register: boolean;
}) {
  const [on, setOn] = useState(register);
  const panel = useRef<HTMLDivElement>(null);
  const skipFocus = useRef(false);
  useEffect(() => {
    if (register) setOn(true);
  }, [register]);
  // Only the explicit shortcut moves focus; a decorative interaction must not open a mobile keyboard.
  useEffect(() => {
    if (!on || !skipFocus.current) return;
    skipFocus.current = false;
    panel.current
      ?.querySelector<HTMLInputElement>("input[name=email]")
      ?.focus({ preventScroll: true });
    panel.current?.scrollIntoView({ behavior: "instant", block: "nearest" });
  }, [on]);
  function openForm() {
    if (on) {
      panel.current
        ?.querySelector<HTMLInputElement>("input[name=email]")
        ?.focus();
    } else {
      skipFocus.current = true;
      setOn(true);
    }
  }
  return (
    <main className={`shop-login ${on ? "is-lit" : ""}`}>
      <header className="shop-login-header">
        <Link to="/" className="brand" aria-label="Nalaro Store, beranda">
          <img src="/favicon-32x32.png" alt="" width="32" height="32" />
          <span className="brand-word">
            nalaro<span className="brand-store">store</span>
          </span>
        </Link>
        <Link to="/">
          <Icon name="arrow-left" size={16} /> Kembali
        </Link>
      </header>
      <div className="shop-login-layout">
        <section
          className="shop-login-story"
          aria-labelledby="shop-login-title"
        >
          <div className="shop-login-copy">
            <h1 id="shop-login-title">
              {register ? "Daftar penjual" : "Akun penjual"}
            </h1>
          </div>
          <PullLamp on={on} toggle={() => setOn((v) => !v)} />
          <div className="shop-login-instruction">
            <span className="shop-login-pull-icon">
              <Icon name="arrow-right" size={16} />
            </span>
            <p id="lamp-instruction">Tarik atau ketuk tali.</p>
          </div>
        </section>
        <section
          className="shop-login-form-area"
          aria-label={register ? "Pendaftaran penjual" : "Login penjual"}
        >
          <div className="shop-login-wait" inert={on} aria-hidden={on}>
            <button type="button" onClick={openForm}>
              Masuk <Icon name="arrow-right" size={16} />
            </button>
          </div>
          <div
            ref={panel}
            className="shop-login-panel"
            inert={!on}
            aria-hidden={!on}
          >
            {children}
          </div>
        </section>
      </div>
      <footer className="shop-login-footer">
        <Link to="/demo/nalaro-fashion">
          Lihat contoh toko <Icon name="arrow-up-right" size={14} />
        </Link>
      </footer>
    </main>
  );
}
