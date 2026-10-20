import { test, expect } from "@playwright/test";

test("loading, retry, empty storefront and buyer registration remain accessible on small screens", async ({
  page,
  request,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(20000);
  const base = "/s/toko-kosong-ui",
    firebase = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
  let release!: () => void,
    failing = true;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 320, height: 568 });
  await page.route("**/api/public/stores/toko-kosong-ui", async (route) => {
    await gate;
    if (failing)
      return route.fulfill({
        status: 503,
        json: { error: "Toko sedang diperbarui." },
      });
    return route.fulfill({
      json: {
        store: {
          id: "empty",
          name: "Toko dengan Nama yang Cukup Panjang",
          slug: "toko-kosong-ui",
          description: "Pilihan untuk kebutuhan sehari-hari.",
        },
        settings: {
          accent: "#f6ed00",
          hero_title: "Selamat datang di toko kami.",
          hero_image_url: null,
          logo_url: null,
          opening_hours: "09.00–17.00",
          contact_phone: "081234567890",
          pickup_enabled: true,
          pickup_address: "Jalan Toko Nomor 12",
          delivery_enabled: false,
          policies: "Hubungi toko untuk informasi pengiriman.",
          shipping_fee_idr: 0,
        },
      },
    });
  });
  await page.route("**/api/public/stores/toko-kosong-ui/products", (r) =>
    r.fulfill({ json: { products: [] } }),
  );
  await page.goto(base);
  await expect(page.getByRole("main", { name: "Memuat toko" })).toBeVisible();
  await expect(page.locator(".sf-skeleton").first()).toHaveCSS(
    "animation-name",
    "none",
  );
  await page.screenshot({
    path: "test-results/storefront-skeleton-320.png",
    fullPage: true,
  });
  release();
  await expect(
    page.getByRole("heading", { name: "Toko belum tersedia." }),
  ).toBeVisible();
  failing = false;
  await page.getByRole("button", { name: "Coba lagi" }).click();
  await expect(
    page.getByRole("heading", { name: "Koleksi sedang disiapkan." }),
  ).toBeVisible();
  await expect(page.locator(".sf-hero")).toHaveCSS("color", "rgb(21, 21, 21)");
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
  }
  await page.setViewportSize({ width: 320, height: 568 });
  await page.screenshot({
    path: "test-results/storefront-empty-320.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Akun pembeli", exact: true }).click();
  const drawer = page.getByRole("dialog");
  await drawer
    .getByRole("button", { name: "Daftar akun baru", exact: true })
    .click();
  await drawer
    .getByLabel("Email", { exact: true })
    .fill("drawer-register@local.test");
  await drawer.getByLabel("Kata sandi", { exact: true }).fill("DrawerBuyer123");
  await drawer.getByRole("button", { name: "Buat akun", exact: true }).click();
  await expect(
    drawer.getByRole("button", {
      name: "Saya sudah memverifikasi email",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page).toHaveURL(base);
  const user = await (
    await request.post(
      firebase + "/accounts:signInWithPassword?key=fake-emulator-key",
      {
        data: {
          email: "drawer-register@local.test",
          password: "DrawerBuyer123",
          returnSecureToken: true,
        },
      },
    )
  ).json();
  await request.post(firebase + "/accounts:update?key=fake-emulator-key", {
    headers: { authorization: "Bearer owner" },
    data: { localId: user.localId, emailVerified: true },
  });
  await drawer
    .getByRole("button", {
      name: "Saya sudah memverifikasi email",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(base);
  await page.getByRole("button", { name: "Akun pembeli", exact: true }).click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("link", { name: "Buka akun pembeli", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Akun pembeli", exact: true }),
  ).toBeFocused();
});
