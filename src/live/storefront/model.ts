import { catalogPrice, type Product, type Variant, type Order } from "../api";

export type CartLine = { variant_id: string; quantity: number };
export function available(v?: Variant) {
  const stock = Number(v?.available_stock);
  return v?.status === "active" && Number.isFinite(stock)
    ? Math.max(0, Math.min(99, Math.floor(stock)))
    : 0;
}
export function addToCart(lines: CartLine[], v: Variant, quantity: number) {
  const existing = lines.find((l) => l.variant_id === v.id);
  const room = available(v) - (existing?.quantity || 0);
  if (!v.id || !Number.isInteger(quantity) || quantity < 1 || room < 1)
    return {
      lines,
      added: 0,
      error:
        room < 1
          ? "Jumlah di keranjang sudah mencapai stok atau batas pembelian."
          : "Periksa jumlah produk yang dipilih.",
    };
  if (!existing && lines.length >= 50)
    return {
      lines,
      added: 0,
      error: "Keranjang berisi maksimal 50 pilihan produk.",
    };
  const added = Math.min(room, quantity);
  return {
    lines: existing
      ? lines.map((l) =>
          l === existing ? { ...l, quantity: l.quantity + added } : l,
        )
      : [...lines, { variant_id: v.id, quantity: added }],
    added,
    error: "",
  };
}
export function readCart(raw: string | null): CartLine[] {
  try {
    const saved: unknown = JSON.parse(raw || "[]");
    if (!Array.isArray(saved)) return [];
    const seen = new Set<string>();
    return saved
      .filter((l): l is CartLine => {
        if (
          !l ||
          typeof l.variant_id !== "string" ||
          !Number.isInteger(l.quantity) ||
          l.quantity < 1 ||
          l.quantity > 99 ||
          seen.has(l.variant_id)
        )
          return false;
        seen.add(l.variant_id);
        return true;
      })
      .slice(0, 50);
  } catch {
    return [];
  }
}
export function filterCatalog(products: Product[], params: URLSearchParams) {
  const q = (params.get("q") || "").trim().toLocaleLowerCase("id"),
    category = params.get("category") || "",
    min = params.get("min"),
    max = params.get("max"),
    sort = params.get("sort");
  return products
    .filter(
      (p) =>
        (!category || p.category === category) &&
        (!q || p.name.toLocaleLowerCase("id").includes(q)) &&
        (params.get("stock") !== "1" ||
          p.variants.some((v) => available(v) > 0)) &&
        (!min ||
          !Number.isFinite(Number(min)) ||
          catalogPrice(p) >= Number(min)) &&
        (!max ||
          !Number.isFinite(Number(max)) ||
          catalogPrice(p) <= Number(max)),
    )
    .sort((a, b) =>
      sort === "low"
        ? catalogPrice(a) - catalogPrice(b)
        : sort === "high"
          ? catalogPrice(b) - catalogPrice(a)
          : 0,
    );
}
export function accentForeground(hex: string) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return "#fff";
  const rgb = [1, 3, 5].map((i) => {
    const n = parseInt(hex.slice(i, i + 2), 16) / 255;
    return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05)
    ? "#151515"
    : "#fff";
}
export function orderProgress(
  o: Pick<
    Order,
    "order_status" | "payment_status" | "fulfillment_status" | "shipping_method"
  >,
) {
  const terminal =
    ["canceled", "expired"].includes(o.order_status) ||
    ["expired", "failed", "refunded"].includes(o.payment_status);
  const pickup = o.shipping_method === "pickup";
  const states = pickup
    ? ["unfulfilled", "packing", "pickup_ready", "picked_up"]
    : ["unfulfilled", "packing", "shipped", "delivered"];
  const fulfillment = Math.max(0, states.indexOf(o.fulfillment_status));
  const paid = o.payment_status === "paid";
  const current = paid ? Math.min(4, Math.max(2, fulfillment + 1)) : 1;
  const names = [
    "Pesanan diterima",
    "Pembayaran diverifikasi",
    "Disiapkan toko",
    pickup ? "Siap diambil" : "Dalam pengiriman",
    pickup ? "Sudah diambil" : "Pesanan diterima pembeli",
  ];
  return names.map((name, i) => ({
    name,
    state: terminal
      ? i === 0
        ? "done"
        : "pending"
      : i < current || (i === 4 && fulfillment === 3)
        ? "done"
        : i === current
          ? "current"
          : "pending",
  }));
}
