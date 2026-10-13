import { useEffect, useState } from "react";
export class APIError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: data ? { "content-type": "application/json" } : undefined,
    body: data ? JSON.stringify(data) : undefined,
  });
  const result = (await response.json()) as T & { error?: string };
  if (!response.ok)
    throw new APIError(
      result.error || "Layanan belum tersedia.",
      response.status,
    );
  return result;
}
export function useData<T>(path: string, revision = 0) {
  const [value, setValue] = useState<T | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    api<T>(path)
      .then((v) => {
        if (current) setValue(v);
      })
      .catch((e) => {
        if (current) setError(e.message);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [path, revision]);
  return { value, error, loading };
}
export const rupiah = (v: number | string) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(v));
export type User = {
  id: string;
  email: string;
  verified: boolean;
  admin: boolean;
};
export type Store = {
  id: string;
  slug: string;
  name: string;
  status: string;
  description: string;
  role: string;
};
export type Variant = {
  id?: string;
  sku: string;
  option_label: string;
  price_override_idr: number | null;
  stock_qty: number;
  reserved_qty?: number;
  available_stock?: number;
  status: "active" | "inactive";
};
export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price_idr: number;
  category: string;
  primary_image_url: string | null;
  status: "active" | "draft" | "archived";
  variants: Variant[];
};
export type Settings = {
  contact_phone: string;
  pickup_address: string;
  shipping_fee_idr: number;
  pickup_enabled: boolean;
  delivery_enabled: boolean;
  bank_details: string;
  qris_media_key: string | null;
  policies: string;
  accent: string;
  hero_title: string;
  hero_image_url: string | null;
  logo_url: string | null;
  opening_hours: string;
  low_stock_threshold: number;
};
export type Order = {
  id: string;
  order_number: string;
  customer_name: string;
  contact_email: string;
  contact_phone: string;
  total_idr: number;
  subtotal_idr: number;
  shipping_idr: number;
  order_status: string;
  payment_status: string;
  fulfillment_status: string;
  shipping_method: string;
  created_at: string;
  updated_at: string;
  reservation_expires_at: string;
  address_json: { address: string };
  shipment_reference: string;
};
export type Item = {
  id?: string;
  name_snapshot: string;
  variant_snapshot: string;
  quantity: number;
  unit_price_idr: number;
  line_total_idr: number;
};
export type Plan = {
  id: string;
  code: string;
  name: string;
  description: string;
  status: string;
  is_public: boolean;
  sort_order: number;
  prices: {
    id?: string;
    billing_interval: "monthly" | "yearly";
    amount_idr: number;
  }[];
  entitlements: {
    feature_code: string;
    allowed: boolean;
    limit_value: number | null;
  }[];
};
export type Invoice = {
  id: string;
  invoice_number: string;
  amount_idr: number;
  status: string;
  period_start: string;
  period_end: string;
  store_id?: string;
};
export const label = (status: string) =>
  (
    ({
      draft: "Draft",
      published: "Terbit",
      paused: "Dijeda",
      suspended: "Ditangguhkan",
      active: "Aktif",
      archived: "Diarsipkan",
      pending: "Menunggu konfirmasi",
      confirmed: "Dikonfirmasi",
      processing: "Diproses",
      completed: "Selesai",
      canceled: "Dibatalkan",
      expired: "Kedaluwarsa",
      unpaid: "Belum dibayar",
      paid: "Dibayar",
      failed: "Belum berhasil",
      refunded: "Dikembalikan",
      unfulfilled: "Belum diproses",
      packing: "Dikemas",
      shipped: "Dikirim",
      delivered: "Terkirim",
      pickup_ready: "Siap diambil",
      picked_up: "Sudah diambil",
      trial: "Masa coba",
      grace: "Masa tenggang",
      past_due: "Jatuh tempo",
      overdue: "Jatuh tempo",
      monthly: "Bulanan",
      yearly: "Tahunan",
      new: "Baru",
      reviewing: "Ditinjau",
      quoted: "Diajukan penawaran",
      accepted: "Disepakati",
      declined: "Ditolak",
      closed: "Ditutup",
      not_started: "Belum dimulai",
      in_progress: "Dikerjakan",
      review: "Peninjauan",
      initial: "Stok awal",
      adjustment: "Penyesuaian",
      reserve: "Reservasi",
      release: "Reservasi dilepas",
      fulfill: "Penjualan",
      return: "Pengembalian",
      "order.create": "Pesanan diterima",
      "payment.verify": "Pembayaran terverifikasi",
      "payment.reject": "Pembayaran perlu diperiksa",
      "order.cancel": "Pesanan dibatalkan",
      "order.expire": "Batas pembayaran berakhir",
      "fulfillment.packing": "Pesanan dikemas",
      "fulfillment.shipped": "Pesanan dikirim",
      "fulfillment.delivered": "Pesanan diterima pembeli",
      "fulfillment.pickup_ready": "Pesanan siap diambil",
      "fulfillment.picked_up": "Pesanan sudah diambil",
    }) as Record<string, string>
  )[status] || "Status diperbarui";
