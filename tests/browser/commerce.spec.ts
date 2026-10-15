import { test, expect } from "@playwright/test";
test("merchant → product → guest checkout → manual verification → completion on mobile", async ({
  page,
  context,
}) => {
  test.setTimeout(process.env.CI ? 60000 : 120000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("owner@local.test");
  await page.getByLabel("Kata sandi", { exact: true }).fill("LocalTest123");
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Buat toko pertamamu." }),
  ).toBeVisible();
  await page.getByLabel("Nama toko").fill("Toko Browser");
  await page.getByLabel("Alamat toko").fill("toko-browser");
  await page.getByRole("button", { name: "Buat toko", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Ringkasan toko" }),
  ).toBeVisible();
  await page.goto("/admin");
  page.once("dialog", (d) => d.accept("7"));
  const pilot = page.waitForResponse(
    (r) => r.url().includes("/pilot") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Atur masa pilot" }).click();
  expect((await pilot).ok()).toBe(true);
  await page.goto("/app/products");
  await page.getByRole("button", { name: "Tambah produk" }).click();
  await page.getByLabel("Nama produk").fill("Kaos Browser");
  await page.getByLabel("Alamat produk").fill("kaos-browser");
  await page.getByLabel("Harga (Rp)", { exact: true }).fill("120000");
  await page.getByLabel("SKU", { exact: true }).fill("BROWSER-M");
  await page.getByLabel("Pilihan", { exact: true }).fill("Ukuran M");
  await page.getByLabel("Stok total").fill("5");
  await page.getByLabel("Status produk").selectOption("active");
  await page.getByRole("button", { name: "Simpan produk" }).click();
  await expect(
    page.getByRole("heading", { name: "Kaos Browser" }),
  ).toBeVisible();
  await page.goto("/app/settings");
  await page
    .getByLabel("Alamat pengambilan")
    .fill("Jalan Toko Browser Nomor 1");
  await page
    .getByLabel("Rekening & instruksi transfer")
    .fill("Bank Uji 12345678 Toko Browser");
  await page.getByLabel("Nomor WhatsApp", { exact: true }).fill("081234567890");
  await page
    .getByLabel("Kebijakan toko", { exact: true })
    .fill(
      "Kebijakan fixture pengiriman dan pengembalian untuk pengujian browser.",
    );
  await page.getByRole("button", { name: "Simpan pengaturan" }).click();
  await expect(page.getByText("Pengaturan disimpan.")).toBeVisible();
  await page.getByRole("button", { name: "Terbitkan toko" }).click();
  await expect(page.getByRole("button", { name: "Jeda toko" })).toBeVisible();
  // Separate guest context proves checkout does not rely on merchant session.
  const guest = await context
    .browser()!
    .newContext({ viewport: { width: 390, height: 844 } });
  const buyer = await guest.newPage();
  await buyer.goto("/s/toko-browser");
  await buyer.getByRole("link", { name: /Kaos Browser/ }).click();
  await buyer.getByRole("button", { name: "Tambah ke keranjang" }).click();
  await buyer.getByRole("link", { name: "Lihat keranjang" }).click();
  await buyer.getByRole("link", { name: "Lanjut ke checkout" }).click();
  await buyer.getByLabel("Nama lengkap").fill("Pembeli Browser");
  await buyer.getByLabel("Nomor WhatsApp").fill("081234567890");
  await buyer.getByRole("button", { name: /Buat pesanan/ }).click();
  await expect(
    buyer.getByRole("heading", { name: "Pesanan diterima." }),
  ).toBeVisible();
  await expect(buyer.getByText(/Bank Uji 12345678/)).toBeVisible();
  const track = buyer.url();
  await page.goto("/app/orders");
  await page.getByRole("button", { name: /NS-000001/ }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Verifikasi pembayaran" }).click();
  await expect(
    page.getByRole("button", { name: "Siap diambil" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Siap diambil" }).click();
  await page.getByRole("button", { name: "Sudah diambil" }).click();
  await buyer.goto(track);
  await expect(
    buyer.getByRole("heading", { name: "Pembayaran terverifikasi." }),
  ).toBeVisible();
  await expect(
    buyer.getByText(/Selesai · Dibayar · Sudah diambil/),
  ).toBeVisible();
  await page.goto("/app/settings");
  await page.getByRole("button", { name: "Jeda toko", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Terbitkan toko" }),
  ).toBeVisible();
  await buyer.goto(track);
  await expect(
    buyer.getByRole("heading", { name: "Pembayaran terverifikasi." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Terbitkan toko" }).click();
  await expect(page.getByRole("button", { name: "Jeda toko" })).toBeVisible();
  for (const width of [320, 390, 768, 1440]) {
    await buyer.setViewportSize({ width, height: 900 });
    await buyer.goto("/s/toko-browser/catalog");
    await expect(
      buyer.getByRole("heading", { name: "Katalog produk" }),
    ).toBeVisible();
    expect(
      await buyer.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await buyer.screenshot({
      path: `test-results/nalarostore-catalog-${width}.png`,
      fullPage: true,
    });
  }
  await guest.close();
});
test("marketing and auth layout fit viewport", async ({ page }) => {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/", "/register"]) {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await expect(page.locator("h1")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.screenshot({
      path: `test-results/nalarostore-home-${width}.png`,
      fullPage: true,
    });
  }
});
test("custom service redirects to the Nalaro order form", async ({ page }) => {
  const destination = "https://order.nalaro.digital/form/";
  await page.route(destination, (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><title>Order form destination</title>",
    }),
  );
  await page.goto("/custom");
  await expect(page).toHaveURL(destination);
});

test("Firebase signup, verified access, password reset and password change", async ({
  page,
  request,
}) => {
  await page.goto("/register");
  await page.getByLabel("Email", { exact: true }).fill("merchant@local.test");
  await page.getByLabel("Kata sandi", { exact: true }).fill("Merchant123");
  await page.getByRole("button", { name: "Buat akun", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Verifikasi alamat email." }),
  ).toBeVisible();
  const codes = await (
    await request.get(
      "http://127.0.0.1:9099/emulator/v1/projects/demo-nalarostore/oobCodes",
    )
  ).json();
  const verification = codes.oobCodes.find(
    (c: { email: string; requestType: string }) =>
      c.email === "merchant@local.test" && c.requestType === "VERIFY_EMAIL",
  );
  expect(verification).toBeTruthy();
  await page.goto(
    "/auth/action?mode=verifyEmail&oobCode=" + verification.oobCode,
  );
  await page
    .getByRole("button", { name: "Konfirmasi email", exact: true })
    .click();
  await expect(
    page.getByText("Email berhasil diverifikasi. Akunmu siap digunakan."),
  ).toBeVisible();
  await page.goto("/app");
  await expect(
    page.getByRole("heading", { name: "Buat toko pertamamu." }),
  ).toBeVisible();
  await page.getByLabel("Nama toko").fill("Toko Auth");
  await page.getByLabel("Alamat toko").fill("toko-auth");
  await page.getByRole("button", { name: "Buat toko", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Ringkasan toko" }),
  ).toBeVisible();
  await page.goto("/forgot-password");
  await page.getByLabel("Email", { exact: true }).fill("merchant@local.test");
  await page.getByRole("button", { name: "Kirim tautan pemulihan" }).click();
  await expect(page.getByText(/Jika email terdaftar/)).toBeVisible();
  const resetCodes = await (
    await request.get(
      "http://127.0.0.1:9099/emulator/v1/projects/demo-nalarostore/oobCodes",
    )
  ).json();
  const reset = resetCodes.oobCodes.find(
    (c: { email: string; requestType: string }) =>
      c.email === "merchant@local.test" && c.requestType === "PASSWORD_RESET",
  );
  await page.goto("/auth/action?mode=resetPassword&oobCode=" + reset.oobCode);
  await page.getByLabel("Kata sandi", { exact: true }).fill("MerchantNew123");
  await page.getByRole("button", { name: "Simpan kata sandi baru" }).click();
  await expect(
    page.getByText("Kata sandi diperbarui. Masuk dengan kata sandi baru."),
  ).toBeVisible();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("merchant@local.test");
  await page.getByLabel("Kata sandi", { exact: true }).fill("MerchantNew123");
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Ringkasan toko" }),
  ).toBeVisible();
  await page.goto("/app/account");
  await page
    .getByLabel("Kata sandi saat ini", { exact: true })
    .fill("MerchantNew123");
  await page
    .getByLabel("Kata sandi baru", { exact: true })
    .fill("MerchantFinal123");
  await page
    .getByRole("button", { name: "Ubah kata sandi", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Masuk ke akun" }),
  ).toBeVisible();
});

test("owner activates and ends the six-month UMKM access", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("owner@local.test");
  await page.getByLabel("Kata sandi", { exact: true }).fill("LocalTest123");
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page.getByRole("heading", {name: "Ringkasan toko"})).toBeVisible();
  await page.goto("/admin");
  const row = page.locator(".live-order-row").filter({hasText: "toko-browser"});
  page.once("dialog", d => d.accept());
  const activation = page.waitForResponse(r => r.url().endsWith("/pilot") && r.request().method() === "POST");
  await row.getByRole("button", {name: "Aktifkan UMKM 6 bulan"}).click();
  expect((await activation).ok()).toBe(true);
  await expect(row.getByText(/Pilot sampai/)).toBeVisible();
  page.once("dialog", d => d.accept("0"));
  const ending = page.waitForResponse(r => r.url().endsWith("/pilot") && r.request().method() === "POST");
  await row.getByRole("button", {name: "Atur masa pilot"}).click();
  expect((await ending).ok()).toBe(true);
  await expect(row.getByText(/Pilot sampai/)).toHaveCount(0);
});
