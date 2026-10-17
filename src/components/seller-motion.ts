/** The supplied 23-second film. Only lifecycle, fitting and motion preferences are adapted. */
export function mountSellerMotion(root: ShadowRoot) {
  const $ = (id: string) => {
    const element = root.getElementById(id);
    if (!(element instanceof HTMLElement))
      throw Error(`Motion element missing: ${id}`);
    return element;
  };
  const stage = root.querySelector<HTMLElement>(".motion-stage")!;
  const screen = $("screen"),
    intro = $("intro"),
    outro = $("outro"),
    home = $("vHome"),
    prod = $("vProd"),
    cap = $("cap"),
    touch = $("touch"),
    toast = $("toast"),
    todo = $("todo"),
    kpi = $("kpi"),
    omzet = $("omzet"),
    orders = $("nOrd"),
    waiting = $("nWait"),
    tHome = $("tHome"),
    tProd = $("tProd"),
    p2w = $("p2w"),
    p2 = $("p2"),
    add = $("btnAdd"),
    dot = $("bdot");
  const segs = [...root.querySelectorAll<HTMLElement>("#stories b")];
  const preference = matchMedia("(prefers-reduced-motion: reduce)");
  let t = 0,
    last = 0,
    fired = 0,
    cur = 0,
    raf = 0,
    active = false,
    paused = preference.matches,
    disposed = false;
  let capHas = false,
    pending: { at: number; lines: string[]; sub: string } | null = null;
  type Tween = {
    el: HTMLElement;
    s: number;
    d: number;
    a: number;
    b: number;
    fmt: (v: number) => string;
  };
  let tweens: Tween[] = [];
  const rupiah = (n: number) => "Rp" + Math.round(n).toLocaleString("id-ID");
  const num = (n: number) => String(Math.round(n));
  const tween = (
    el: HTMLElement,
    a: number,
    b: number,
    d: number,
    fmt: Tween["fmt"],
  ) => tweens.push({ el, s: cur, d, a, b, fmt });
  function caption(lines: string[], sub: string) {
    cap.replaceChildren();
    [...lines, sub].forEach((text, i) => {
      const line = document.createElement("span"),
        inner = document.createElement("span");
      line.className = "l " + (i === lines.length ? "s" : "t");
      inner.textContent = text;
      inner.style.transitionDelay = `${i * 90 + (i === lines.length ? 60 : 0)}ms`;
      line.appendChild(inner);
      cap.appendChild(line);
    });
    cap.classList.remove("in", "out");
    void cap.offsetWidth;
    cap.classList.add("show", "in");
    capHas = true;
  }
  function setCap(lines: string[], sub: string) {
    pending = null;
    if (capHas) {
      cap.classList.add("out");
      pending = { at: t + 0.38, lines, sub };
    } else caption(lines, sub);
  }
  function tap(on: boolean) {
    touch.classList.toggle("tap", on);
    if (on) {
      touch.classList.remove("rip");
      void touch.offsetWidth;
      touch.classList.add("rip");
    }
  }
  function move(x: number, y: number) {
    touch.classList.add("show");
    touch.style.left = x + "px";
    touch.style.top = y + "px";
  }
  function reset() {
    t = 0;
    fired = 0;
    cur = 0;
    tweens = [];
    pending = null;
    capHas = false;
    screen.classList.add("on-dark");
    [intro, outro].forEach((n) => n.classList.remove("go", "out", "show"));
    home.classList.remove("in", "out");
    prod.classList.remove("on", "in");
    kpi.classList.remove("draw");
    todo.classList.remove("alert");
    toast.classList.remove("show");
    dot.style.transform = "";
    tHome.classList.add("on");
    tProd.classList.remove("on", "pop");
    p2w.classList.remove("in");
    p2.classList.remove("live", "flash");
    add.classList.remove("press");
    cap.classList.remove("show", "in", "out");
    cap.replaceChildren();
    touch.classList.remove("show", "tap", "rip");
    touch.style.transition = "none";
    touch.style.left = "250px";
    touch.style.top = "660px";
    void touch.offsetWidth;
    touch.style.transition = "";
    omzet.textContent = "Rp0";
    orders.textContent = "0";
    waiting.textContent = "0";
    segs.forEach((s) => {
      s.style.width = "0";
    });
  }
  const events: [number, () => void][] = [
    [0.05, () => intro.classList.add("go")],
    [
      3.3,
      () => {
        intro.classList.add("out");
        screen.classList.remove("on-dark");
      },
    ],
    [
      3.45,
      () => {
        home.classList.add("in");
        setCap(
          ["Pantau toko", "dalam satu layar."],
          "Omzet, pesanan, dan stok selalu terbarui.",
        );
      },
    ],
    [
      4.5,
      () => {
        kpi.classList.add("draw");
        tween(omzet, 0, 4350000, 2.4, rupiah);
        tween(orders, 0, 12, 1.8, num);
      },
    ],
    [
      7.5,
      () => {
        toast.classList.add("show");
        dot.style.transform = "scale(1)";
      },
    ],
    [
      7.9,
      () => {
        todo.classList.add("alert");
        tween(waiting, 0, 2, 0.6, num);
        tween(omzet, 4350000, 4650000, 1.2, rupiah);
        tween(orders, 12, 13, 0.5, num);
        setCap(
          ["Pesanan masuk,", "langsung terlihat."],
          "Cek pesanan terbaru, lalu proses dari HP.",
        );
      },
    ],
    [10.1, () => toast.classList.remove("show")],
    [10.5, () => move(180, 742)],
    [
      11.5,
      () => {
        tap(true);
        tProd.classList.add("pop");
      },
    ],
    [
      11.7,
      () => {
        tap(false);
        home.classList.add("out");
        tHome.classList.remove("on");
        tProd.classList.remove("pop");
        tProd.classList.add("on");
        prod.classList.add("on", "in");
        setCap(
          ["Katalog produk", "di genggamanmu."],
          "Atur harga, foto, dan ketersediaan kapan saja.",
        );
      },
    ],
    [12.8, () => move(292, 124)],
    [
      13.9,
      () => {
        tap(true);
        add.classList.add("press");
      },
    ],
    [
      14.1,
      () => {
        tap(false);
        add.classList.remove("press");
        p2w.classList.add("in");
        setCap(
          ["Produk baru,", "tayang dalam detik."],
          "Tambah, terbitkan, dan stok langsung tersinkron.",
        );
      },
    ],
    [15.4, () => move(200, 424)],
    [16.4, () => tap(true)],
    [
      16.6,
      () => {
        tap(false);
        p2.classList.add("live", "flash");
      },
    ],
    [17.3, () => touch.classList.remove("show")],
    [
      17.9,
      () => {
        pending = null;
        cap.classList.remove("show");
      },
    ],
    [
      18,
      () => {
        screen.classList.add("on-dark");
        outro.classList.add("show", "go");
      },
    ],
  ];
  function render() {
    while (fired < events.length && events[fired][0] <= t) {
      cur = events[fired][0];
      events[fired++][1]();
    }
    if (pending && t >= pending.at) {
      caption(pending.lines, pending.sub);
      pending = null;
    }
    tweens.forEach((w) => {
      const p = Math.max(0, Math.min(1, (t - w.s) / w.d));
      w.el.textContent = w.fmt(w.a + (w.b - w.a) * (1 - Math.pow(1 - p, 3)));
    });
    const bounds = [0, 3.4, 11.5, 18, 23.2];
    segs.forEach((s, i) => {
      s.style.width = `${Math.max(0, Math.min(1, (t - bounds[i]) / (bounds[i + 1] - bounds[i]))) * 100}%`;
    });
    if (t >= 23.2) reset();
  }
  function frame(now: number) {
    raf = 0;
    if (disposed || !active || paused) return;
    t += last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    render();
    raf = requestAnimationFrame(frame);
  }
  function sync() {
    cancelAnimationFrame(raf);
    raf = 0;
    last = 0;
    stage.classList.toggle("motion-paused", paused || !active);
    if (active && !paused && !disposed) raf = requestAnimationFrame(frame);
  }
  function onPreference() {
    paused = preference.matches;
    if (paused) snapshot();
    else stage.classList.remove("motion-static");
    sync();
  }
  function snapshot() {
    stage.classList.add("motion-static");
    reset();
    t = 9.2;
    render();
    if (pending) {
      caption(pending.lines, pending.sub);
      pending = null;
    }
  }
  function fit() {
    const host = root.host as HTMLElement;
    const scale = Math.max(
      0.1,
      Math.min(
        (host.clientHeight - 48) / 812,
        (host.clientWidth - 32) / 392,
        1,
      ),
    );
    $("fit").style.width = 392 * scale + "px";
    $("fit").style.height = 812 * scale + "px";
    $("phone").style.transform = `scale(${scale})`;
  }
  const resize = new ResizeObserver(fit);
  resize.observe(root.host);
  preference.addEventListener("change", onPreference);
  reset();
  if (paused) snapshot();
  fit();
  sync();
  return {
    setActive(value: boolean) {
      active = value;
      sync();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      resize.disconnect();
      preference.removeEventListener("change", onPreference);
    },
  };
}
