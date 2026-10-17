// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { mountSellerMotion } from "../src/components/seller-motion";

let frames: Map<number, FrameRequestCallback>, time: number, next: number;
let reduced = false;
let preferenceListeners: Set<() => void>;
let motion: ReturnType<typeof mountSellerMotion>;
let root: ShadowRoot;
let disconnected: ReturnType<typeof vi.fn>;
beforeEach(() => {
  frames = new Map();
  time = 1000;
  next = 0;
  preferenceListeners = new Set();
  disconnected = vi.fn();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++next, callback);
    return next;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.stubGlobal("matchMedia", () => ({
    get matches() {
      return reduced;
    },
    addEventListener: (_: string, fn: () => void) =>
      preferenceListeners.add(fn),
    removeEventListener: (_: string, fn: () => void) =>
      preferenceListeners.delete(fn),
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect = disconnected;
    },
  );
  const host = document.createElement("div");
  document.body.appendChild(host);
  Object.defineProperties(host, {
    clientWidth: { value: 420 },
    clientHeight: { value: 760 },
  });
  root = host.attachShadow({ mode: "open" });
  root.innerHTML = readFileSync(
    "src/components/seller-center-motion.html",
    "utf8",
  );
});
afterEach(() => {
  motion?.dispose();
  document.body.replaceChildren();
  reduced = false;
  vi.unstubAllGlobals();
});
function tick(ms = 100) {
  time += ms;
  const callbacks = [...frames.values()];
  frames.clear();
  callbacks.forEach((callback) => callback(time));
}

it("plays the supplied dashboard/product sequence and stops scheduling frames while offscreen, then resumes and loops automatically", () => {
  motion = mountSellerMotion(root);
  expect(frames.size).toBe(0);
  motion.setActive(true);
  for (let n = 0; n < 96; n++) tick();
  expect(root.getElementById("omzet")?.textContent).toBe("Rp4.650.000");
  expect(root.getElementById("nOrd")?.textContent).toBe("13");
  expect(root.getElementById("todo")?.classList.contains("alert")).toBe(true);
  motion.setActive(false);
  expect(frames.size).toBe(0);
  const amount = root.getElementById("omzet")?.textContent;
  tick(5000);
  expect(root.getElementById("omzet")?.textContent).toBe(amount);
  motion.setActive(true);
  for (let n = 0; n < 75; n++) tick();
  expect(root.getElementById("vProd")?.classList.contains("on")).toBe(true);
  expect(root.getElementById("p2")?.classList.contains("live")).toBe(true);
  motion.setActive(false);
  expect(frames.size).toBe(0);
  motion.setActive(true);
  for (let n = 0; n < 65; n++) tick();
  expect(root.getElementById("intro")?.classList.contains("out")).toBe(false);
  expect(root.getElementById("omzet")?.textContent).toBe("Rp0");
  motion.dispose();
  expect(frames.size).toBe(0);
  expect(disconnected).toHaveBeenCalled();
  expect(preferenceListeners.size).toBe(0);
});

it("shows a readable still frame for reduced motion and responds to preference changes", () => {
  reduced = true;
  motion = mountSellerMotion(root);
  motion.setActive(true);
  expect(frames.size).toBe(0);
  expect(root.getElementById("omzet")?.textContent).toBe("Rp4.650.000");
  expect(root.getElementById("intro")?.classList.contains("out")).toBe(true);
  expect(root.querySelector("button")).toBeNull();
  reduced = false;
  for (const listener of preferenceListeners) listener();
  expect(frames.size).toBe(1);
  reduced = true;
  for (const listener of preferenceListeners) listener();
  expect(frames.size).toBe(0);
});
