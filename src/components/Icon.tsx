import type { CSSProperties } from "react";

// Custom-drawn SVG assets, centrally registered. Never substitute emoji or arbitrary icon packs.
export type IconName =
  | "arrow-right"
  | "arrow-left"
  | "arrow-up-right"
  | "chevron-left"
  | "chevron-right"
  | "chevron-down"
  | "close"
  | "check"
  | "plus"
  | "minus"
  | "menu"
  | "bag"
  | "cart"
  | "search"
  | "filter"
  | "grid"
  | "home"
  | "box"
  | "orders"
  | "users"
  | "chart"
  | "palette"
  | "settings"
  | "credit-card"
  | "calendar"
  | "globe"
  | "link"
  | "map-pin"
  | "clock"
  | "truck"
  | "shield"
  | "file"
  | "help"
  | "external"
  | "logout"
  | "eye"
  | "info"
  | "alert"
  | "upload"
  | "edit"
  | "sliders"
  | "copy"
  | "mail"
  | "phone"
  | "heart"
  | "refresh";

export function Icon({
  name,
  size = 20,
  className = "",
  label,
}: {
  name: IconName;
  size?: number;
  className?: string;
  label?: string;
}) {
  const url = new URL(`../assets/icons/${name}.svg`, import.meta.url).href;
  const style: CSSProperties = {
    width: size,
    height: size,
    flexShrink: 0,
    maskImage: `url("${url}")`,
    WebkitMaskImage: `url("${url}")`,
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
    maskPosition: "center",
    WebkitMaskPosition: "center",
    maskSize: "contain",
    WebkitMaskSize: "contain",
    backgroundColor: "currentColor",
    display: "inline-block",
  };
  return (
    <span
      className={`icon ${className}`}
      style={style}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={!label}
    />
  );
}
