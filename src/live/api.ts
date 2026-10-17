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
  extraHeaders: Record<string, string> = {},
): Promise<T> {
  const needsAuth =
    /^\/api\/(merchant|admin|auth|customer)\//.test(path) ||
    /\/(checkout|conversations)(?:$|\?)/.test(path) ||
    path.startsWith("/api/public/chat/");
  const firebase = needsAuth ? await import("../lib/firebase") : null;
  if (firebase) await firebase.authReady;
  const identity = firebase?.auth?.currentUser?.uid;
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: {
      ...(data ? { "content-type": "application/json" } : {}),
      ...(firebase ? await firebase.authorizationHeaders() : {}),
      ...adminContextHeaders(path),
      ...extraHeaders,
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  if (firebase && identity !== firebase.auth?.currentUser?.uid)
    throw new APIError("Akun berubah. Muat ulang data untuk akun aktif.", 401);
  let result: T & { error?: string };
  try {
    result = await response.json();
  } catch {
    throw new APIError(
      "API belum tersedia. Pastikan server aplikasi lengkap berjalan.",
      response.status || 503,
    );
  }
  if (!response.ok)
    throw new APIError(
      result.error || "Layanan belum tersedia.",
      response.status,
    );
  return result;
}
export function adminContextHeaders(path: string): Record<string, string> {
  const sid = new URLSearchParams(window.location.search).get("adminStore");
  return sid && path.startsWith(`/api/merchant/stores/${sid}/`)
    ? { "x-nalaro-admin-store": sid }
    : {};
}
export function useData<T>(path: string | null, revision = 0) {
  const [value, setValue] = useState<T | null>(null),
    [loadedPath, setLoadedPath] = useState<string | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    if (!path) {
      setLoading(false);
      return () => {
        current = false;
      };
    }
    api<T>(path)
      .then((v) => {
        if (current) {
          setLoadedPath(path);
          setValue(v);
        }
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
  return { value: loadedPath === path ? value : null, error, loading };
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
  pilot_until?: string | null;
  umkm_activated_at?: string | null;
  owner_email?: string;
  plan_name?: string;
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
  image_url?: string | null;
};
export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price_idr: number;
  category: string;
  primary_image_url: string | null;
  gallery?: { url: string; alt: string }[];
  status: "active" | "draft" | "archived";
  variants: Variant[];
};
export function catalogPrice(product: Product) {
  const prices = product.variants
    .filter((v) => v.status === "active")
    .map((v) => Number(v.price_override_idr ?? product.price_idr));
  return prices.length ? Math.min(...prices) : Number(product.price_idr);
}
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
      products: "Jumlah produk",
      orders: "Pesanan",
      media_bytes: "Unggahan gambar (byte)",
      verified: "Terverifikasi",
      sent: "Terkirim",
      "admin.store.view": "Toko diakses admin",
      "admin.store.status": "Status toko diubah admin",
      "admin.store.delete": "Toko dihapus admin",
      "admin.subscription.assign": "Paket ditetapkan admin",
      "product.create": "Produk ditambahkan",
      "product.update": "Produk diperbarui",
      "product.archive": "Produk diarsipkan",
      "media.upload": "Foto diunggah",
      "data.export": "Data diekspor",
      "domain.verify": "Domain diverifikasi",
      "custom.update": "Pengajuan diperbarui",
      "email.retry": "Pengiriman email diulang",
      "billing.policy.update": "Aturan pembayaran diperbarui",
      void: "Dibatalkan",
      "store.create": "Toko dibuat",
      "store.publish": "Toko diterbitkan",
      "store.pause": "Toko dijeda",
      "settings.update": "Pengaturan diperbarui",
      "plan.save": "Paket disimpan",
      "pilot.update": "Akses pilot diperbarui",
      "subscription.request": "Paket diajukan",
      "subscription.payment.verify": "Pembayaran langganan diverifikasi",
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
