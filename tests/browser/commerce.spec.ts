import { test, expect } from "@playwright/test";
test("merchant → product → guest checkout → manual verification → completion on mobile", async ({
  page,
  context,
}) => {
  test.setTimeout(process.env.CI ? 60000 : 120000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await page.getByRole("button", { name: "Langsung ke form" }).click();
  await page.getByLabel("Email", { exact: true }).fill("owner@local.test");
  await page.getByLabel("Kata sandi", { exact: true }).fill("LocalTest123");
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page).toHaveURL(/admin$/);
  await page.goto("/app/new");
  await expect(
    page.getByRole("heading", { name: "Buat toko pertamamu." }),
  ).toBeVisible();
  await page.getByLabel("Nama toko").fill("Toko Browser");
  await page.getByLabel("Link toko").fill("toko browser");
  await expect(page.getByLabel("Link toko")).toHaveValue("toko-browser");
  await expect(
    page.getByText("store.nalaro.digital/s/toko-browser"),
  ).toBeVisible();
  await expect(
    page.getByText(/Invalid string: must match pattern/),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Buat toko", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Ringkasan toko" }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Lewati", exact: true })
    .click();
  // Change viewport without re-fetching the same merchant data sixteen times:
  // the test server intentionally rate-limits authenticated API requests.
  for (const route of ["/app", "/app/chat", "/app/notifications", "/app/inventory", "/app/analytics", "/app/responsible"]) {
    await page.goto(route);
    await expect(page.locator(".workspace-current-store strong")).toHaveText("Toko Browser");
    if (route === "/app") await expect(page.locator(".work-numbers > div")).toHaveCount(2);
    if (route === "/app/analytics") {
      await expect(page.locator(".analytics-stats .analytics-stat")).toHaveCount(6);
      await expect(page.locator(".analytics-daily-row")).toHaveCount(0);
    }
    if (route === "/app/responsible") {
      await expect(page.locator(".responsible-form")).toBeVisible();
      await expect(page.getByLabel("Nama lengkap", { exact: true })).toBeVisible();
    }
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app/customers");
  await expect(page.getByLabel("Cari nama, email atau telepon")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Belum ada pelanggan" }),
  ).toBeVisible();
  await expect(page.locator(".seller-export-button .icon")).toBeVisible();
  await page.getByRole("button", { name: "Buka menu" }).click();
  await expect(page.locator(".workspace-sidebar .logout .icon")).toBeVisible();
  await page.locator(".seller-drawer-close").click();
  await page.goto("/app/billing");
  await expect(
    page.getByRole("heading", { name: "Langganan toko" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tagihan" })).toBeVisible();
  await expect(
    page.getByText("Instruksi pembayaran belum ditetapkan admin."),
  ).toHaveCount(0);
  await page.goto("/admin");
  await page
    .locator(".admin-record")
    .filter({ hasText: "Toko Browser" })
    .getByRole("button", { name: "Atur pilot" })
    .click();
  await page.getByLabel("Lama pilot (hari)").fill("7");
  const pilot = page.waitForResponse(
    (r) => r.url().includes("/pilot") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  expect((await pilot).ok()).toBe(true);
  await page.goto("/app/products");
  await page.getByRole("button", { name: "Tambah produk" }).click();
  await expect(page.locator(".seller-editor-back")).toBeVisible();
  await expect(page.getByLabel("Unggah foto utama")).toHaveCount(1);
  await expect(page.getByLabel("Unggah foto galeri")).toHaveCount(1);
  await page.getByRole("button", { name: "Tambah foto dari link" }).click();
  await expect(page.getByLabel("Link foto 1")).toBeVisible();
  await page.getByRole("button", { name: "Hapus foto galeri 1" }).click();
  await expect(page.getByLabel("Link foto 1")).toHaveCount(0);
  await page.getByRole("button", { name: "Tambah varian" }).click();
  await expect(
    page.getByRole("button", { name: "Hapus varian 2" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Hapus varian 2" }).click();
  await expect(
    page.getByRole("button", { name: "Hapus varian 2" }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByLabel("Nama produk").fill("Kaos Browser");
  await page.getByLabel("Link produk").fill("kaos-browser");
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
  await expect(page.getByRole("heading", { name: "Link toko" })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 750));
  expect(
    await page
      .locator(".workspace-topbar")
      .evaluate((header) => Math.abs(header.getBoundingClientRect().top) < 2),
  ).toBe(true);
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
  await page.goto("/app/analytics");
  await expect(page.locator(".analytics-daily-row")).toHaveCount(1);
  await expect(page.getByText(/Riwayat tersedia sejak toko dipublikasikan/)).toBeVisible();
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
  await page.getByLabel("Link toko").fill("toko-auth");
  await page.getByRole("button", { name: "Buat toko", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Ringkasan toko" }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Lewati", exact: true })
    .click();
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
  await page.getByRole("button", { name: "Langsung ke form" }).click();
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
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole("button", { name: "Langsung ke form" }).click();
  await expect(
    page.getByRole("heading", { name: "Masuk ke akun" }),
  ).toBeVisible();
});

test("owner activates and ends the six-month UMKM access", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Langsung ke form" }).click();
  await page.getByLabel("Email", { exact: true }).fill("owner@local.test");
  await page.getByLabel("Kata sandi", { exact: true }).fill("LocalTest123");
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page).toHaveURL(/admin$/);
  const row = page.locator(".admin-record").filter({ hasText: "toko-browser" });
  await row.getByRole("button", { name: "UMKM 6 bulan" }).click();
  const activation = page.waitForResponse(
    (r) => r.url().endsWith("/pilot") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Aktifkan akses" }).click();
  const activationResponse = await activation;
  expect(activationResponse.ok(), `Activation HTTP ${activationResponse.status()}: ${await activationResponse.text()}`).toBe(true);
  await expect(row.getByText(/Pilot sampai/)).toBeVisible();
  await row.getByRole("button", { name: "Atur pilot" }).click();
  await page.getByLabel("Lama pilot (hari)").fill("0");
  const ending = page.waitForResponse(
    (r) => r.url().endsWith("/pilot") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  const endingResponse = await ending;
  expect(endingResponse.ok(), `Ending HTTP ${endingResponse.status()}: ${await endingResponse.text()}`).toBe(true);
  await expect(row.getByText(/Pilot sampai/)).toHaveCount(0);
});

test("Seller Center motion fits phones and desktop, respects reduced motion and exposes honest app access", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const section = page.locator("#seller-center");
    await section.scrollIntoViewIfNeeded();
    await expect(
      section.getByRole("heading", { name: /Tokomu ikut jalan/ }),
    ).toBeVisible();
    await expect(section.locator("#omzet")).toBeVisible();
    await expect(section.getByRole("button")).toHaveCount(0);
    await expect(section.locator("#omzet")).toHaveText("Rp4.650.000");
    const host = section.locator(".seller-center-motion");
    expect(
      await host.evaluate((el) =>
        el
          .shadowRoot!.querySelector(".motion-stage")!
          .classList.contains("motion-static"),
      ),
    ).toBe(true);
    const contained = await host.evaluate((el) => {
      const phone = el
        .shadowRoot!.querySelector(".phone")!
        .getBoundingClientRect();
      const stage = el.getBoundingClientRect();
      return (
        phone.left >= stage.left &&
        phone.right <= stage.right &&
        phone.top >= stage.top &&
        phone.bottom <= stage.bottom
      );
    });
    expect(contained).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await expect(
      section.getByRole("link", { name: /Dapatkan app Android/ }),
    ).toHaveAttribute("href", /^https:\/\/wa\.me\/6285771298582\?text=/);
    await expect(
      section.getByRole("link", { name: /Daftar lewat web/ }),
    ).toHaveAttribute("href", "/register");
    await section.screenshot({
      path: `test-results/seller-center-${width}.png`,
    });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect
      .poll(() =>
        host.evaluate((el) =>
          el
            .shadowRoot!.querySelector(".motion-stage")!
            .classList.contains("motion-static"),
        ),
      )
      .toBe(false);
    await page.emulateMedia({ reducedMotion: "reduce" });
  }
});

test("Seller Center automatically plays the updated orders, catalog and buyer chat scenes", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/");
  const section = page.locator("#seller-center");
  await section.scrollIntoViewIfNeeded();
  await expect(section.locator("#omzet")).toBeVisible();
  const host = section.locator(".seller-center-motion");
  await host.scrollIntoViewIfNeeded();
  for (const [scene, selector] of [
    ["orders", "#oc1.done"],
    ["catalog", "#p2.live"],
    ["chat", "#chat.reply"],
    ["outro", "#outro.show"],
  ]) {
    await expect(section.locator(selector)).toBeVisible({ timeout: 20000 });
    await host.screenshot({ path: `test-results/seller-center-${scene}.png` });
  }
  await expect(section.getByRole("button")).toHaveCount(0);
});
