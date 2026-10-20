import { test, expect } from "@playwright/test";

const base = "/demo/nalaro-fashion";
test("Nalaro Fashion renders ten local product images and responsive commerce pages without an API", async ({
  page,
  request,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(20000);
  const apiRequests: string[] = [],
    errors: string[] = [];
  await page.route("**/api/**", (route) => {
    apiRequests.push(route.request().url());
    return route.abort();
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await expect(page.locator(".sf-hero h1")).toHaveText(
    "Batik, untuk setiap cerita.",
  );
  await expect(page.locator(".sf-product-tile")).toHaveCount(10);
  const imageURLs = await page
    .locator(".product-image img")
    .evaluateAll((images) => images.map((img) => img.getAttribute("src")!));
  expect(new Set(imageURLs).size).toBe(10);
  for (const src of imageURLs) {
    const response = await request.get(src);
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toContain("image/webp");
  }
  for (const image of await page.locator(".product-image img").all()) {
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        image.evaluate(
          (img) =>
            (img as HTMLImageElement).complete &&
            (img as HTMLImageElement).naturalWidth > 0,
        ),
      )
      .toBe(true);
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/nalaro-fashion-home-${viewport.width}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("navigation", { name: "Kategori produk" })
    .getByRole("link", { name: "Celana Batik", exact: true })
    .click();
  await expect(page.locator(".sf-product-tile")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Cari produk di toko", exact: true })
    .click();
  await page.getByRole("dialog").getByRole("searchbox").fill("Kulot");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cari", exact: true })
    .click();
  await expect(page.locator(".sf-product-tile")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".sf-product-tile")).toHaveCount(1);
  await page.goto(base + "/product/kemeja-batik-sagara");
  await expect(page.getByRole("button", { name: /XL.*Habis/ })).toBeDisabled();
  await page.getByRole("button", { name: /Lihat foto 2:/ }).click();
  await expect
    .poll(() =>
      page
        .locator(".sf-gallery")
        .evaluate((g) => Math.abs(g.scrollLeft - g.clientWidth)),
    )
    .toBeLessThan(2);
  await page.screenshot({
    path: "test-results/nalaro-fashion-pdp-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Akun pembeli", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "tanpa masuk atau membuat akun",
  );
  await page.keyboard.press("Escape");
  expect(errors).toEqual([]);
  expect(apiRequests).toEqual([]);
});

test("Nalaro Fashion supports quick-add, wishlist, demo chat and checkout without creating real orders or storing contact data", async ({
  page,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(20000);
  const apiRequests: string[] = [];
  await page.route("**/api/**", (route) => {
    apiRequests.push(route.request().method() + " " + route.request().url());
    return route.abort();
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base);
  await page
    .getByRole("button", {
      name: "Tambah Sarung Batik Sogan Bumi ke keranjang",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("link", { name: "Keranjang 1 item", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Simpan Kebaya Sage Kartini", exact: true })
    .click();
  await page.goto(base + "/wishlist");
  await expect(page.locator(".sf-product-tile")).toHaveCount(1);
  await expect(page.locator(".sf-product-tile")).toContainText(
    "Kebaya Sage Kartini",
  );
  await page.goto(base + "/catalog");
  await page
    .getByRole("button", {
      name: "Tambah Kemeja Batik Parang Sogan ke keranjang",
      exact: true,
    })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "M", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Tambah ke keranjang", exact: true })
    .click();
  await page.goto(base + "/product/kemeja-batik-parang-sogan");
  await page.getByRole("button", { name: "Tanya produk ke penjual" }).click();
  const chat = page.getByRole("region", { name: "Chat demo Nalaro Fashion" });
  await expect(chat.getByLabel("Pesan", { exact: true })).toHaveValue(
    /Kemeja Batik Parang Sogan/,
  );
  await chat.getByRole("button", { name: "Kirim pesan demo" }).click();
  await expect(chat.getByRole("log")).toContainText("balasan simulasi");
  await chat.getByRole("button", { name: "Tutup panel chat" }).click();
  await page.goto(base + "/cart");
  await expect(page.locator(".cart-line")).toHaveCount(2);
  await page.getByRole("link", { name: "Lanjut ke checkout" }).click();
  await expect(
    page.getByRole("heading", { name: "Coba alur pemesanan." }),
  ).toBeVisible();
  await page
    .getByLabel("Nama lengkap", { exact: true })
    .fill("CONTOH TIDAK DISIMPAN");
  await page.getByLabel("Nomor WhatsApp", { exact: true }).fill("081200009999");
  await page
    .getByLabel("Email (opsional)", { exact: true })
    .fill("kontak-tidak-disimpan@example.com");
  await page.getByLabel("Metode menerima barang").selectOption("local_flat");
  await page
    .getByLabel("Alamat lengkap", { exact: true })
    .fill("ALAMAT CONTOH YANG TIDAK DISIMPAN");
  await page.getByRole("button", { name: /Simulasikan pesanan/ }).click();
  await expect(page).toHaveURL(base + "/complete");
  await expect(
    page.getByRole("heading", { name: "Simulasi pesanan selesai." }),
  ).toBeVisible();
  await expect(page.locator(".nf-receipt-total")).toContainText("Rp 503.000");
  await expect(
    page.getByRole("link", { name: "Keranjang 0 item", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/nalaro-fashion-complete-mobile.png",
    fullPage: true,
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Simulasi pesanan selesai." }),
  ).toBeVisible();
  const storage = await page.evaluate(() =>
    JSON.stringify({
      local: { ...localStorage },
      session: { ...sessionStorage },
    }),
  );
  for (const secret of [
    "CONTOH TIDAK DISIMPAN",
    "081200009999",
    "kontak-tidak-disimpan@example.com",
    "ALAMAT CONTOH YANG TIDAK DISIMPAN",
  ])
    expect(storage).not.toContain(secret);
  expect(apiRequests).toEqual([]);
});
