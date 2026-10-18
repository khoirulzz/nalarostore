/** The supplied 35.5-second film. Only lifecycle, fitting and motion preferences are adapted. */
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
    pes = $("vPes"),
    chat = $("chat"),
    sc = $("sc"),
    pesStack = $("pesStack"),
    oc1 = $("oc1"),
    btnTerima = $("btnTerima"),
    chatBtn = root.getElementById("chatBtn")!,
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
    tPes = $("tPes"),
    tProd = $("tProd"),
    p2w = $("p2w"),
    p2 = $("p2"),
    add = $("btnAdd"),
    dot = $("bdot");
  const views = { home, pes, prod };
  const tabs = { home: tHome, pes: tPes, prod: tProd };
  type ViewName = keyof typeof views;
  const viewNames = Object.keys(views) as ViewName[];
  let presses: { el: HTMLElement; until: number }[] = [];
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
  function tap(on: boolean, el?: HTMLElement) {
    touch.classList.toggle("tap", on);
    if (on) {
      touch.classList.remove("rip");
      void touch.offsetWidth;
      touch.classList.add("rip");
      if (el) {
        el.classList.add("press");
        presses.push({ el, until: cur + 0.32 });
      }
    }
  }
  function move(x: number, y: number) {
    touch.classList.add("show");
    touch.style.left = x + "px";
    touch.style.top = y + "px";
  }
  function moveToEl(el: Element) {
    const screenRect = screen.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    const scale = screenRect.width / 360;
    if (!scale) return;
    move(
      (rect.left + rect.width / 2 - screenRect.left) / scale,
      (rect.top + rect.height / 2 - screenRect.top) / scale,
    );
  }
  function show(name: ViewName) {
    viewNames.forEach((key) => {
      const view = views[key];
      if (key === name) {
        view.classList.remove("out");
        view.classList.add("on", "in");
      } else if (view.classList.contains("on")) {
        view.classList.remove("on");
        view.classList.add("out");
      }
      tabs[key].classList.toggle("on", key === name);
    });
  }
  function reset() {
    t = 0;
    fired = 0;
    cur = 0;
    tweens = [];
    presses.forEach(({ el }) => el.classList.remove("press"));
    presses = [];
    pending = null;
    capHas = false;
    screen.classList.add("on-dark");
    [intro, outro].forEach((n) => n.classList.remove("go", "out", "show"));
    viewNames.forEach((name) => {
      views[name].classList.remove("on", "in", "out");
      tabs[name].classList.toggle("on", name === "home");
      tabs[name].classList.remove("pop");
    });
    home.classList.add("on");
    sc.classList.remove("up");
    pesStack.classList.remove("has");
    oc1.classList.remove("done");
    chat.classList.remove("on", "has", "badge", "reply");
    kpi.classList.remove("draw");
    todo.classList.remove("alert");
    toast.classList.remove("show");
    dot.style.transform = "";
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
    [
      0.05,
      () => {
        intro.classList.add("go");
      },
    ],
    [
      3.3,
      () => {
        intro.classList.add("out");
      },
    ],
    [
      3.45,
      () => {
        home.classList.add("in");
        setCap(
          ["Semua kendali toko,", "dalam satu layar."],
          "Akses cepat, omzet, dan pesanan dari Beranda.",
        );
      },
    ],
    [
      6.2,
      () => {
        sc.classList.add("up");
      },
    ],
    [
      6.6,
      () => {
        kpi.classList.add("draw");
        tween(omzet, 0, 4350000, 2.4, rupiah);
        tween(orders, 0, 12, 1.8, num);
      },
    ],
    [
      9.3,
      () => {
        toast.classList.add("show");
        dot.style.transform = "scale(1)";
      },
    ],
    [
      9.7,
      () => {
        todo.classList.add("alert");
        tween(waiting, 0, 2, 0.6, num);
        tween(omzet, 4350000, 4650000, 1.2, rupiah);
        tween(orders, 12, 13, 0.5, num);
        setCap(
          ["Pesanan masuk,", "langsung terlihat."],
          "Notifikasi muncul begitu pembeli checkout.",
        );
      },
    ],
    [
      12.0,
      () => {
        toast.classList.remove("show");
      },
    ],
    [
      12.1,
      () => {
        moveToEl(tabs.pes);
      },
    ],
    [
      13.0,
      () => {
        tap(true);
        tabs.pes.classList.add("pop");
      },
    ],
    [
      13.2,
      () => {
        tap(false);
        tabs.pes.classList.remove("pop");
        show("pes");
        setCap(
          ["Proses pesanan", "tanpa ribet."],
          "Terima dan pantau status dari satu daftar.",
        );
      },
    ],
    [
      13.9,
      () => {
        pesStack.classList.add("has");
      },
    ],
    [
      15.6,
      () => {
        moveToEl(btnTerima);
      },
    ],
    [
      16.6,
      () => {
        tap(true, btnTerima);
      },
    ],
    [
      16.8,
      () => {
        tap(false);
        oc1.classList.add("done");
      },
    ],
    [
      17.8,
      () => {
        moveToEl(tabs.prod);
      },
    ],
    [
      18.7,
      () => {
        tap(true);
        tabs.prod.classList.add("pop");
      },
    ],
    [
      18.9,
      () => {
        tap(false);
        tabs.prod.classList.remove("pop");
        show("prod");
        setCap(
          ["Katalog produk", "di genggamanmu."],
          "Atur harga, foto, dan stok kapan saja.",
        );
      },
    ],
    [
      20.0,
      () => {
        moveToEl(add);
      },
    ],
    [
      21.0,
      () => {
        tap(true, add);
      },
    ],
    [
      21.2,
      () => {
        tap(false);
        p2w.classList.add("in");
        setCap(
          ["Produk baru,", "tayang dalam detik."],
          "Tambah, terbitkan, dan stok langsung tersinkron.",
        );
      },
    ],
    [
      22.5,
      () => {
        moveToEl(p2);
      },
    ],
    [
      23.4,
      () => {
        tap(true);
      },
    ],
    [
      23.6,
      () => {
        tap(false);
        p2.classList.add("live", "flash");
      },
    ],
    [
      24.6,
      () => {
        moveToEl(chatBtn);
      },
    ],
    [
      25.5,
      () => {
        tap(true);
      },
    ],
    [
      25.7,
      () => {
        tap(false);
        screen.classList.remove("on-dark");
        chat.classList.add("on");
        setCap(
          ["Balas pembeli", "lebih cepat."],
          "Semua percakapan pelanggan ada di satu tempat.",
        );
      },
    ],
    [
      26.4,
      () => {
        touch.classList.remove("show");
      },
    ],
    [
      27.0,
      () => {
        chat.classList.add("has");
      },
    ],
    [
      27.9,
      () => {
        chat.classList.add("badge");
      },
    ],
    [
      29.2,
      () => {
        chat.classList.add("reply");
      },
    ],
    [
      30.2,
      () => {
        pending = null;
        cap.classList.remove("show");
      },
    ],
    [
      30.5,
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
    presses = presses.filter(({ el, until }) => {
      if (t < until) return true;
      el.classList.remove("press");
      return false;
    });
    tweens.forEach((w) => {
      const p = Math.max(0, Math.min(1, (t - w.s) / w.d));
      w.el.textContent = w.fmt(w.a + (w.b - w.a) * (1 - Math.pow(1 - p, 3)));
    });
    const bounds = [0, 3.4, 13.2, 18.9, 25.7, 30.5, 35.5];
    segs.forEach((s, i) => {
      s.style.width = `${Math.max(0, Math.min(1, (t - bounds[i]) / (bounds[i + 1] - bounds[i]))) * 100}%`;
    });
    if (t >= 35.5) reset();
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
    t = 11.2;
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
