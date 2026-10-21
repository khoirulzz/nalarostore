import { test, expect } from "@playwright/test";

test("guest chat, private seller profile and common buyer account share the same protected backend", async ({
  page,
  browser,
  request,
}) => {
  test.setTimeout(150000);
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
  const create = await request.post("/api/merchant/stores", {
    headers,
    data: { name: "Toko Chat UI", slug: "toko-chat-ui" },
  });
  expect(create.ok()).toBe(true);
  const { id: sid } = await create.json();
  await request.post(`/api/admin/stores/${sid}/pilot`, {
    headers,
    data: { days: 7 },
  });
  await request.put(`/api/merchant/stores/${sid}/settings`, {
    headers,
    data: {
      contact_phone: "081234567890",
      pickup_address: "Jalan Pengujian Nomor 12",
      pickup_enabled: true,
      bank_details: "Rekening uji 12345678",
      policies:
        "Pengiriman dan pengembalian mengikuti kesepakatan dengan toko.",
    },
  });
  const product = await request.post(`/api/merchant/stores/${sid}/products`, {
    headers,
    data: {
      slug: "kaos-chat",
      name: "Kaos Chat UI",
      price_idr: 100000,
      status: "active",
      primary_image_url: "https://images.example.test/test.jpg",
      variants: [{ sku: "CHAT-UI-M", option_label: "M", stock_qty: 20 }],
    },
  });
  expect(product.ok()).toBe(true);
  const publish = await request.post(`/api/merchant/stores/${sid}/publish`, {
    headers,
    data: { publish: true },
  });
  expect(publish.ok()).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/s/toko-chat-ui");
  await page.getByRole("button", { name: "Chat toko", exact: true }).click();
  await page.getByLabel("Nama kamu").fill("Pembeli Chat UI");
  await page.getByRole("button", { name: "Mulai chat", exact: true }).click();
  await page
    .getByLabel("Pesan", { exact: true })
    .fill("Apakah ukuran M tersedia?");
  await page.getByRole("button", { name: "Kirim pesan", exact: true }).click();
  await expect(
    page.getByText("Apakah ukuran M tersedia?", { exact: true }),
  ).toBeVisible();
  const sellerContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    seller = await sellerContext.newPage();
  await seller.goto("/login");
  await seller.getByRole("button", { name: "Langsung ke form" }).click();
  await seller.getByLabel("Email", { exact: true }).fill("owner@local.test");
  await seller.getByLabel("Kata sandi", { exact: true }).fill("LocalTest123");
  await seller.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(seller).toHaveURL(/admin$/);
  await seller.goto("/app/chat?store=" + sid);
  await seller
    .getByRole("dialog")
    .getByRole("button", { name: "Lewati", exact: true })
    .click();
  await seller.getByRole("button", { name: /Pembeli Chat UI/ }).click();
  await expect(
    seller.getByText("Apakah ukuran M tersedia?", { exact: true }),
  ).toBeVisible();
  await seller
    .getByLabel("Pesan", { exact: true })
    .fill("Tersedia, silakan pesan.");
  await seller
    .getByRole("button", { name: "Kirim pesan", exact: true })
    .click();
  await expect(
    page.getByText("Tersedia, silakan pesan.", { exact: true }),
  ).toBeVisible({ timeout: 20000 });
  // Product shortcut opens the existing chat and sends an actionable product card.
  await page.goto("/s/toko-chat-ui/product/kaos-chat");
  await page.getByRole("button", { name: "Tanya produk ke penjual" }).click();
  await expect(page.locator(".chat-selected-product")).toContainText("Kaos Chat UI");
  await page.getByLabel("Pesan", { exact: true }).fill("Boleh tanya warna lainnya?");
  await page.getByRole("button", { name: "Kirim pesan", exact: true }).click();
  await expect(page.locator(".chat-bubble.mine .chat-product-card")).toContainText("Kaos Chat UI");
  await expect(page.locator(".chat-bubble.mine .chat-product-card")).toHaveAttribute("href", "/s/toko-chat-ui/product/kaos-chat");
  await seller.goto("/app/responsible?store=" + sid);
  await seller
    .getByLabel("Nama lengkap", { exact: true })
    .fill("Pemilik Toko Chat");
  await seller.getByLabel("Jabatan", { exact: true }).fill("Pemilik");
  await seller
    .getByLabel("Nomor telepon", { exact: true })
    .fill("081234567891");
  await seller
    .getByLabel("Email operasional", { exact: true })
    .fill("private-ui@test.invalid");
  await seller
    .getByRole("button", { name: "Simpan informasi", exact: true })
    .click();
  await expect(seller.getByRole("status")).toHaveText(
    "Informasi penanggung jawab disimpan.",
  );
  const publicStore = await (
    await request.get("/api/public/stores/toko-chat-ui")
  ).json();
  expect(JSON.stringify(publicStore)).not.toContain("private-ui@test.invalid");
  await page.goto("/buyer/register");
  await page.getByLabel("Email", { exact: true }).fill("buyer-ui@local.test");
  await page.getByLabel("Kata sandi", { exact: true }).fill("BuyerUI123");
  await page.getByRole("button", { name: "Buat akun", exact: true }).click();
  await expect(page).toHaveURL(/verify\?buyer=1/);
  const buyerLogin = await (
    await request.post(
      firebase + "/accounts:signInWithPassword?key=fake-emulator-key",
      {
        data: {
          email: "buyer-ui@local.test",
          password: "BuyerUI123",
          returnSecureToken: true,
        },
      },
    )
  ).json();
  await request.post(firebase + "/accounts:update?key=fake-emulator-key", {
    headers: { authorization: "Bearer owner" },
    data: { localId: buyerLogin.localId, emailVerified: true },
  });
  await page
    .getByRole("button", {
      name: "Saya sudah memverifikasi email",
      exact: true,
    })
    .click();
  await page.getByRole("link", { name: "Buka akun pembeli" }).click();
  await expect(
    page.getByRole("heading", { name: "Aktivitas belanjamu" }),
  ).toBeVisible();
  await expect(page.getByText("Buat toko pertamamu.")).toHaveCount(0);
  await page.getByRole("button", { name: "Alamat", exact: true }).click();
  await page.getByLabel("Label", { exact: true }).fill("Rumah");
  await page
    .getByLabel("Nama penerima", { exact: true })
    .fill("Pembeli Chat UI");
  await page.getByLabel("Telepon", { exact: true }).fill("081234567892");
  await page
    .getByLabel("Alamat lengkap", { exact: true })
    .fill("Jalan Pembeli Nomor 15 Kota Uji");
  await page
    .getByRole("button", { name: "Simpan alamat", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Rumah", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await sellerContext.close();
});
