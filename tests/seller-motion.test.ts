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

it("plays all six scenes for 35.5 seconds, suspends offscreen, and resets the entire sequence on repeat", () => {
  motion = mountSellerMotion(root);
  expect(frames.size).toBe(0);
  motion.setActive(true);
  tick(); // First frame establishes the playback clock.
  const advance = (seconds: number) => {
    for (let n = 0; n < Math.round(seconds * 10); n++) tick();
  };
  const has = (id: string, name: string) =>
    root.getElementById(id)?.classList.contains(name);
  advance(11.2);
  expect(root.getElementById("omzet")?.textContent).toBe("Rp4.650.000");
  expect(root.getElementById("nOrd")?.textContent).toBe("13");
  expect(has("todo", "alert")).toBe(true);
  expect(has("sc", "up")).toBe(true);
  expect(has("screen", "on-dark")).toBe(true);
  motion.setActive(false);
  expect(frames.size).toBe(0);
  tick(5000);
  expect(has("vPes", "on")).toBe(false);
  motion.setActive(true);
  tick();
  advance(3); // 14.2s: incoming order list
  expect(has("vPes", "on")).toBe(true);
  expect(has("pesStack", "has")).toBe(true);
  expect(has("vHome", "on")).toBe(false);
  advance(2.5); // 16.7s: accept button pressed
  expect(has("btnTerima", "press")).toBe(true);
  advance(0.5);
  expect(has("oc1", "done")).toBe(true);
  expect(has("btnTerima", "press")).toBe(false);
  advance(2.3); // 19.5s: catalog
  expect(has("vProd", "on")).toBe(true);
  expect(has("vPes", "on")).toBe(false);
  advance(4.5); // 24s: product published
  expect(has("p2w", "in")).toBe(true);
  expect(has("p2", "live")).toBe(true);
  expect(has("btnAdd", "press")).toBe(false);
  advance(4); // 28s: buyer chat with unread badge
  expect(has("chat", "on")).toBe(true);
  expect(has("chat", "has")).toBe(true);
  expect(has("chat", "badge")).toBe(true);
  expect(has("screen", "on-dark")).toBe(false);
  advance(1.5);
  expect(has("chat", "reply")).toBe(true);
  advance(1.5); // 31s: outro
  expect(has("outro", "show")).toBe(true);
  expect(root.querySelectorAll("#stories b")).toHaveLength(6);
  advance(4.3); // Still playing the longer supplied outro at 35.3s
  expect(has("outro", "show")).toBe(true);
  advance(0.4); // Loop at 35.5s
  for (const [id, name] of [
    ["intro", "out"],
    ["outro", "show"],
    ["vPes", "on"],
    ["vProd", "on"],
    ["pesStack", "has"],
    ["oc1", "done"],
    ["p2", "live"],
    ["chat", "reply"],
    ["chat", "on"],
    ["sc", "up"],
  ]) {
    expect(has(id, name), `${id}.${name} resets`).toBe(false);
  }
  expect(root.getElementById("omzet")?.textContent).toBe("Rp0");
  expect(has("vHome", "on")).toBe(true);
  expect(has("tHome", "on")).toBe(true);
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
