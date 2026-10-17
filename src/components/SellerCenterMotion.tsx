import { useEffect, useRef } from "react";
import template from "./seller-center-motion.html?raw";
import { mountSellerMotion } from "./seller-motion";

export function SellerCenterMotion() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = host.current!;
    const root = element.shadowRoot || element.attachShadow({ mode: "open" });
    // Trusted, checked-in markup supplied by the product owner; no scripts or user input.
    root.innerHTML = template;
    const motion = mountSellerMotion(root);
    let visible = false;
    const sync = () => motion.setActive(visible && !document.hidden);
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        sync();
      },
      { threshold: 0.15 },
    );
    observer.observe(element);
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
      motion.dispose();
      root.replaceChildren();
    };
  }, []);
  return <div ref={host} className="seller-center-motion" />;
}
