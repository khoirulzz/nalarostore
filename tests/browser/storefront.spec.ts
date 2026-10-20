import { test, expect } from "@playwright/test";
import { resolve } from "node:path";

test("storefront discovery, variants, cart undo, saved products and inline buyer login preserve the purchase flow", async ({
  page,
  request,
}) => {
  test.setTimeout(240000);
  page.setDefaultTimeout(20000);
  const origin = "http://127.0.0.1:5175",
    firebase = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
  const login = await (
    await request.post(
      firebase + "/accounts:signInWithPassword?key=fake-emulator-key",
      {
        data: {
          email: "owner@local.test",
          password: "LocalTest123",
          returnSecureToken: true,
        },
      },
    )
  ).json();
  const headers = { origin, authorization: "Bearer " + login.idToken };
  const base = "/s/toko-rupa-ui";
  const created = await request.post("/api/merchant/stores", {
    headers,
    data: { name: "Rupa — Pilihan Sehari-hari", slug: "toko-rupa-ui" },
  });
  expect(created.ok()).toBe(true);
  const { id: sid } = await created.json();
  expect(
    (
      await request.post(`/api/admin/stores/${sid}/pilot`, {
        headers,
        data: { days: 7 },
      })
    ).ok(),
  ).toBe(true);
  expect(
    (
      await request.put(`/api/merchant/stores/${sid}/settings`, {
        headers,
        data: {
          contact_phone: "081234567890",
          pickup_address: "Jalan Rupa Nomor 12, Bandung",
          pickup_enabled: true,
          delivery_enabled: true,
          shipping_fee_idr: 12000,
          bank_details: "Bank Uji 12345678 Rupa",
          policies:
            "Pengiriman dan pengembalian dapat dibicarakan dengan toko.",
          accent: "#e8e3bd",
          opening_hours: "Senin–Sabtu, 09.00–17.00",
          hero_title: "Untuk hari yang lebih sederhana.",
          hero_image_url: "https://images.example.test/hero.jpg",
        },
      })
    ).ok(),
  ).toBe(true);
  for (const data of [
    {
      slug: "tas-harian",
      name: "Tas Harian",
      category: "Tas",
      price_idr: 85000,
      variants: [{ sku: "RUPA-TAS", option_label: "Natural", stock_qty: 3 }],
    },
    {
      slug: "kemeja-linen",
      name: "Kemeja Linen dengan Potongan Nyaman untuk Sehari-hari",
      category: "Pakaian",
      price_idr: 125000,
      variants: [
        {
          sku: "RUPA-BIRU",
          option_label: "Biru · M",
          stock_qty: 2,
          price_override_idr: 135000,
          image_url: "https://images.example.test/variant.jpg",
        },
        { sku: "RUPA-PUTIH", option_label: "Putih · L", stock_qty: 0 },
      ],
    },
    {
      slug: "scarf",
      name: "Scarf Tenun",
      category: "Aksesori",
      price_idr: 75000,
      variants: [{ sku: "RUPA-SCARF", option_label: "Cokelat", stock_qty: 0 }],
    },
  ]) {
    const response = await request.post(
      `/api/merchant/stores/${sid}/products`,
      {
        headers,
        data: {
          ...data,
          status: "active",
          description:
            "Dibuat untuk menemani kegiatan sehari-hari. Pilih varian yang sesuai sebelum memesan.",
          primary_image_url: "https://images.example.test/product.jpg",
          gallery: [
            {
              url: "https://images.example.test/detail.jpg",
              alt: "Detail bahan",
            },
          ],
        },
      },
    );
    expect(response.ok()).toBe(true);
  }
  expect(
    (
      await request.post(`/api/merchant/stores/${sid}/publish`, {
        headers,
        data: { publish: true },
      })
    ).ok(),
  ).toBe(true);
  const signup = await (
    await request.post(firebase + "/accounts:signUp?key=fake-emulator-key", {
      data: {
        email: "storefront-buyer@local.test",
        password: "BuyerUI123",
        returnSecureToken: true,
      },
    })
  ).json();
  await request.post(firebase + "/accounts:update?key=fake-emulator-key", {
    headers: { authorization: "Bearer owner" },
    data: { localId: signup.localId, emailVerified: true },
  });
  await page.route("https://images.example.test/**", (route) =>
    route.fulfill({
      path: resolve("public/images/batiknalaro/tenun.webp"),
      contentType: "image/webp",
    }),
  );
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base);
  await expect(page.locator(".sf-hero h1")).toHaveText(
    "Untuk hari yang lebih sederhana.",
  );
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/storefront-home-${width}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Cari produk di toko", exact: true })
    .click();
  const search = page.getByRole("dialog");
  await expect(search.getByRole("searchbox")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(search).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Cari produk di toko", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("/");
  await page.getByRole("dialog").getByRole("searchbox").fill("Kemeja");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cari", exact: true })
    .click();
  await expect(page).toHaveURL(/catalog\?q=Kemeja/);
  await expect(page.locator(".sf-product-tile")).toHaveCount(1);
  await page.reload();
  await expect(
    page.getByRole("searchbox", { name: "Cari produk", exact: true }),
  ).toHaveValue("Kemeja");
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  const filters = page.getByRole("dialog");
  await filters.getByLabel("Harga minimum").fill("200000");
  await filters.getByLabel("Harga maksimum").fill("100000");
  await filters.getByRole("button", { name: "Terapkan filter" }).click();
  await expect(filters.getByRole("alert")).toContainText("Harga minimum");
  await filters.getByLabel("Harga minimum").fill("100000");
  await filters.getByLabel("Harga maksimum").fill("150000");
  await filters.getByLabel("Stok tersedia").check();
  await filters.getByRole("button", { name: "Terapkan filter" }).click();
  await expect(page).toHaveURL(/stock=1/);
  await page.goBack();
  await expect(page).toHaveURL(/catalog\?q=Kemeja$/);
  await page.goto(base + "/catalog");
  await page
    .getByRole("navigation", { name: "Kategori produk" })
    .getByRole("link", { name: "Tas", exact: true })
    .click();
  await expect(page).toHaveURL(/category=Tas/);
  await expect(page.locator(".sf-product-tile")).toHaveCount(1);
  await page.goBack();
  await expect(page.locator(".sf-product-tile")).toHaveCount(3);
  await expect(
    page.getByRole("button", { name: "Tambah Scarf Tenun ke keranjang" }),
  ).toBeDisabled();
  await page
    .getByRole("button", {
      name: "Tambah Kemeja Linen dengan Potongan Nyaman untuk Sehari-hari ke keranjang",
    })
    .click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("button", { name: /Putih/ })).toBeDisabled();
  await expect(
    sheet.getByRole("button", { name: "Tambah ke keranjang", exact: true }),
  ).toBeDisabled();
  await sheet.getByRole("button", { name: "Biru · M", exact: true }).click();
  await expect(sheet).toContainText("Rp 135.000");
  await sheet
    .getByRole("button", { name: "Tambah ke keranjang", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Keranjang 1 item", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Simpan Tas Harian", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Produk tersimpan 1", exact: true })
    .click();
  await expect(page.locator(".sf-product-tile")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".sf-product-tile")).toHaveCount(1);
  // Reusing the platform route must not carry one tenant's cart or wishlist into another.
  const publicStore = await (
    await request.get("/api/public/stores/toko-rupa-ui")
  ).json();
  await page.route("**/api/public/stores/toko-lain-ui", (r) =>
    r.fulfill({
      json: {
        ...publicStore,
        store: {
          ...publicStore.store,
          name: "Toko Lain",
          slug: "toko-lain-ui",
        },
      },
    }),
  );
  await page.route("**/api/public/stores/toko-lain-ui/products", (r) =>
    r.fulfill({ json: { products: [] } }),
  );
  await page.goto("/s/toko-lain-ui/wishlist");
  await expect(
    page.getByRole("heading", { name: "Belum ada produk tersimpan." }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Keranjang 0 item", exact: true }),
  ).toBeVisible();
  await page.goto(base + "/wishlist");
  await expect(page.locator(".sf-product-tile")).toHaveCount(1);
  await page.goto(base + "/product/tas-harian");
  await page
    .getByRole("button", { name: "Tambah Tas Harian", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Tambah ke keranjang", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Keranjang 3 item", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Tambah Tas Harian", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: /Lihat foto 2:/ }).click();
  await expect(page.locator(".sf-gallery-count")).toHaveText("2 / 2");
  await expect
    .poll(() =>
      page
        .locator(".sf-gallery")
        .evaluate((g) => Math.abs(g.scrollLeft - g.clientWidth)),
    )
    .toBeLessThan(2);
  await page.screenshot({
    path: "test-results/storefront-pdp-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Keranjang 3 item", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Hapus Tas Harian", exact: true })
    .click();
  await page.getByRole("button", { name: "Urungkan", exact: true }).focus();
  await page.waitForTimeout(5200);
  await page.getByRole("button", { name: "Urungkan", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Keranjang 3 item", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Lanjut ke checkout" }).click();
  await page.getByRole("button", { name: /Buat pesanan/ }).click();
  await expect(page.locator("#checkout-name-error")).toBeVisible();
  await page.getByLabel("Nama lengkap", { exact: true }).fill("Pembeli Rupa");
  await page.getByLabel("Nomor WhatsApp", { exact: true }).fill("081234567890");
  await page.getByLabel("Metode menerima barang").selectOption("local_flat");
  await page
    .getByLabel("Alamat lengkap", { exact: true })
    .fill("Jalan Pembeli Nomor 42, Bandung");
  await page
    .getByRole("button", { name: "Masuk / daftar", exact: true })
    .click();
  const auth = page.getByRole("dialog");
  await auth
    .getByLabel("Email", { exact: true })
    .fill("storefront-buyer@local.test");
  await auth.getByLabel("Kata sandi", { exact: true }).fill("BuyerUI123");
  await auth.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Kelola akun", exact: true }),
  ).toBeFocused();
  await expect(page).toHaveURL(base + "/checkout");
  await expect(page.getByLabel("Nama lengkap", { exact: true })).toHaveValue(
    "Pembeli Rupa",
  );
  await expect(page.getByLabel("Alamat lengkap", { exact: true })).toHaveValue(
    "Jalan Pembeli Nomor 42, Bandung",
  );
  await expect(page.getByLabel("Metode menerima barang")).toHaveValue(
    "local_flat",
  );
  await page.screenshot({
    path: "test-results/storefront-checkout-mobile.png",
    fullPage: true,
  });
  const checkout = page.waitForResponse(
    (r) => r.url().endsWith("/checkout") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: /Buat pesanan/ }).click();
  expect((await checkout).ok()).toBe(true);
  await expect(
    page.getByRole("heading", { name: "Pesanan diterima.", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Progres pesanan" }),
  ).toContainText("Dalam pengiriman");
  await expect(page.locator('[aria-current="step"]')).toContainText(
    "Pembayaran diverifikasi",
  );
  expect(errors).toEqual([]);
});

test("tracking renders canceled, expired, delivery and pickup states without invented event timestamps", async ({
  page,
}) => {
  const token = "a".repeat(64);
  const order = {
    order_number: "NS-TEST",
    order_status: "pending",
    payment_status: "unpaid",
    fulfillment_status: "unfulfilled",
    shipping_method: "pickup",
    created_at: "2026-10-20T01:00:00Z",
    updated_at: "2026-10-20T02:00:00Z",
    total_idr: 100000,
    subtotal_idr: 100000,
    shipping_idr: 0,
    reservation_expires_at: "2026-10-21T01:00:00Z",
  };
  await page.route("**/api/public/stores/timeline/track/**", (r) =>
    r.fulfill({
      json: {
        order,
        items: [],
        payment: { bank_details: "Bank uji", contact_phone: "081234567890" },
      },
    }),
  );
  await page.goto(`/s/timeline/track/${token}`);
  await expect(
    page.getByRole("list", { name: "Progres pesanan" }),
  ).toContainText("Siap diambil");
  await expect(
    page.getByRole("list", { name: "Progres pesanan" }),
  ).not.toContainText("Dalam pengiriman");
  order.order_status = "expired";
  await page
    .getByRole("button", { name: "Perbarui status", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Pesanan kedaluwarsa." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Selesaikan pembayaran." }),
  ).toHaveCount(0);
  order.order_status = "canceled";
  await page
    .getByRole("button", { name: "Perbarui status", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Pesanan dibatalkan." }),
  ).toBeVisible();
  order.order_status = "processing";
  order.payment_status = "paid";
  order.fulfillment_status = "shipped";
  order.shipping_method = "local_flat";
  await page
    .getByRole("button", { name: "Perbarui status", exact: true })
    .click();
  await expect(page.locator('[aria-current="step"]')).toContainText(
    "Dalam pengiriman",
  );
  await expect(page.locator(".sf-order-timeline time")).toHaveCount(1);
});
