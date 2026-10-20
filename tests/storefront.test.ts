import { describe, expect, it } from "vitest";
import {
  accentForeground,
  addToCart,
  filterCatalog,
  orderProgress,
  readCart,
} from "../src/live/storefront/model";
import { type Product, type Variant } from "../src/live/api";

const variant: Variant = {
  id: "one",
  sku: "SKU",
  option_label: "Biru",
  price_override_idr: null,
  stock_qty: 5,
  available_stock: 5,
  status: "active",
};
const product: Product = {
  id: "p",
  name: "Kemeja Biru",
  slug: "kemeja",
  description: "",
  category: "Pakaian",
  price_idr: 100000,
  primary_image_url: null,
  status: "active",
  variants: [variant],
};
describe("storefront cart rules", () => {
  it("accounts for existing quantities and never reports a successful add at the stock limit", () => {
    const first = addToCart([{ variant_id: "one", quantity: 4 }], variant, 3);
    expect(first.added).toBe(1);
    expect(first.lines[0].quantity).toBe(5);
    const second = addToCart(first.lines, variant, 1);
    expect(second.added).toBe(0);
    expect(second.lines).toBe(first.lines);
    expect(second.error).not.toBe("");
  });
  it("rejects unavailable, inactive, fractional, and invalid quantities without creating zero-quantity lines", () => {
    for (const v of [
      { ...variant, available_stock: 0 },
      { ...variant, status: "inactive" as const },
      { ...variant, available_stock: NaN },
    ])
      expect(addToCart([], v, 1).lines).toEqual([]);
    for (const q of [0, -1, 1.5, NaN])
      expect(addToCart([], variant, q).added).toBe(0);
    expect(
      addToCart([], { ...variant, available_stock: 1000 }, 120).lines[0]
        .quantity,
    ).toBe(99);
  });
  it("validates stored lines, deduplicates variants, and tolerates corrupted storage", () => {
    expect(readCart("invalid")).toEqual([]);
    expect(
      readCart(
        JSON.stringify([
          null,
          { variant_id: "one", quantity: 2 },
          { variant_id: "one", quantity: 3 },
          { variant_id: "two", quantity: 100 },
          { quantity: 1 },
        ]),
      ),
    ).toEqual([{ variant_id: "one", quantity: 2 }]);
  });
});
it("filters URL queries using variant prices and stock without mutating catalog order", () => {
  const cheaper = {
    ...product,
    id: "cheap",
    name: "Kemeja Putih",
    variants: [{ ...variant, price_override_idr: 50000 }],
  };
  const sold = {
    ...product,
    id: "sold",
    variants: [{ ...variant, available_stock: 0 }],
  };
  const products = [product, cheaper, sold];
  expect(
    filterCatalog(
      products,
      new URLSearchParams(
        "q=KEMEJA&category=Pakaian&min=40000&max=60000&stock=1",
      ),
    ),
  ).toEqual([cheaper]);
  expect(filterCatalog(products, new URLSearchParams("sort=low"))[0]).toBe(
    cheaper,
  );
  expect(products[0]).toBe(product);
});
it("uses actual fulfillment branches and does not advance canceled or unpaid orders", () => {
  const order = {
    order_status: "pending",
    payment_status: "unpaid",
    fulfillment_status: "unfulfilled",
    shipping_method: "pickup",
  };
  expect(orderProgress(order).find((s) => s.state === "current")?.name).toBe(
    "Pembayaran diverifikasi",
  );
  const pickup = orderProgress({
    ...order,
    order_status: "processing",
    payment_status: "paid",
    fulfillment_status: "pickup_ready",
  });
  expect(pickup.find((s) => s.state === "current")?.name).toBe("Siap diambil");
  expect(pickup.some((s) => s.name === "Dalam pengiriman")).toBe(false);
  expect(
    orderProgress({
      ...order,
      shipping_method: "local_flat",
      payment_status: "paid",
      fulfillment_status: "shipped",
    }).find((s) => s.state === "current")?.name,
  ).toBe("Dalam pengiriman");
  expect(
    orderProgress({ ...order, order_status: "canceled" }).some(
      (s) => s.state === "current",
    ),
  ).toBe(false);
  expect(
    orderProgress({
      ...order,
      payment_status: "paid",
      fulfillment_status: "picked_up",
    }).every((s) => s.state === "done"),
  ).toBe(true);
});
it("keeps merchant accent foreground readable on light and dark colors", () => {
  expect(accentForeground("#ffffff")).toBe("#151515");
  expect(accentForeground("#000000")).toBe("#fff");
  expect(accentForeground("#f6ed00")).toBe("#151515");
});
