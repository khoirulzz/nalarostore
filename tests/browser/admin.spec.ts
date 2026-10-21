import { test, expect } from "@playwright/test";

test("admin creates an internal package, previews drafts, manages access and deletes with three confirmations", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await page.getByRole("button", { name: "Langsung ke form" }).click();
  await page.getByLabel("Email", { exact: true }).fill("owner@local.test");
  await page.getByLabel("Kata sandi", { exact: true }).fill("LocalTest123");
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page).toHaveURL(/admin$/);
  await page
    .locator(".admin-mobile-nav")
    .getByRole("button", { name: "Paket", exact: true })
    .click();
  await expect(page.locator(".admin-kpis")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Paket & harga",
  );
  await page.getByRole("button", { name: "Buat paket", exact: true }).click();
  await page
    .getByLabel("Nama paket", { exact: true })
    .fill("Program Mitra Khusus");
  await expect(page.getByLabel("Kode paket", { exact: true })).toHaveValue(
    "program-mitra-khusus",
  );
  await page.getByLabel("Harga bulanan (Rp)", { exact: true }).fill("0");
  await page.getByLabel("Jumlah produk", { exact: true }).fill("1");
  await page
    .getByLabel("Pesanan per bulan (periode UTC)", { exact: true })
    .fill("5");
  await page
    .getByLabel("Unggahan gambar per bulan (MB)", { exact: true })
    .fill("100");
  await page.getByRole("button", { name: "Simpan paket", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Program Mitra Khusus", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/admin-packages-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Buat paket", exact: true }).click();
  await page.getByLabel("Nama paket", { exact: true }).fill("Paket Bertumbuh");
  await page.getByLabel("Harga bulanan (Rp)", { exact: true }).fill("50000");
  await page.getByLabel("Jumlah produk", { exact: true }).fill("10");
  await page.getByLabel("Tampilkan di halaman paket").check();
  await page.getByRole("button", { name: "Simpan paket", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Paket Bertumbuh", exact: true }),
  ).toBeVisible();
  await page
    .locator(".admin-mobile-nav")
    .getByRole("button", { name: "Billing", exact: true })
    .click();
  await page
    .getByLabel("Rekening / instruksi pembayaran Nalaro")
    .fill("Transfer ke Bank Uji 123456 Nalaro");
  await page.getByRole("button", { name: "Simpan kebijakan" }).click();
  await expect(page.getByText("Kebijakan billing disimpan.")).toBeVisible();
  await page.goto("/app/new");
  await page.getByLabel("Nama toko").fill("Toko Audit Admin");
  await page.getByLabel("Link toko").fill("toko-audit-admin");
  await page.getByRole("button", { name: "Buat toko", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Siapkan toko, lalu mulai berjualan." }),
  ).toBeVisible();
  await page.getByRole('dialog').getByRole('button',{name:'Lewati',exact:true}).click();
  await page.screenshot({
    path: "test-results/store-setup-mobile.png",
    fullPage: true,
  });
  await page.goto("/admin");
  const record = page
    .locator(".admin-record")
    .filter({ hasText: "Toko Audit Admin" });
  await record
    .getByRole("button", { name: "Kelola toko", exact: true })
    .click();
  await page.getByRole("link", { name: "Pratinjau toko", exact: true }).click();
  await expect(page.locator(".preview-banner")).toBeVisible();
  await expect(page.locator(".store-logo")).toHaveText("Toko Audit Admin");
  await expect(
    page.getByText("Toko belum tersedia.", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Kembali ke pengaturan" }).click();
  await expect(page).toHaveURL(/admin\?tab=overview&store=/);
  const price = await page
    .getByLabel("Paket yang diberikan")
    .locator("option")
    .filter({ hasText: "Program Mitra Khusus" })
    .getAttribute("value");
  await page.getByLabel("Paket yang diberikan").selectOption(price!);
  await page.getByLabel("Masa akses (hari)").fill("180");
  await page
    .getByLabel("Alasan penetapan")
    .fill("Program mitra internal untuk audit");
  await page.getByRole("button", { name: "Terapkan paket pengganti" }).click();
  await expect(page.getByRole("status")).toHaveText("Perubahan tersimpan.");
  await page
    .getByRole("link", { name: "Kelola isi toko", exact: true })
    .click();
  await expect(page.locator(".workspace-current-store")).toHaveText(
    "Toko Audit Admin",
  );
  await page.goto("/app/billing");
  await expect(page.locator(".seller-subscription-list")).toContainText(
    "Program Mitra Khusus",
  );
  await page
    .locator(".seller-plan")
    .filter({ hasText: "Paket Bertumbuh" })
    .getByRole("button")
    .click();
  await expect(
    page.getByRole("dialog", { name: "Ganti paket toko" }),
  ).toContainText("paket lama dihentikan");
  await page
    .getByRole("button", { name: "Setuju & buat tagihan", exact: true })
    .click();
  await expect(page.getByText(/Menunggu pembayaran paket/)).toBeVisible();
  await expect(page.locator(".seller-subscription-list")).toContainText(
    "Program Mitra Khusus",
  );
  const invoice = await page
    .locator(".seller-invoice-row strong")
    .first()
    .innerText();
  await page.goto("/admin");
  await page
    .locator(".admin-record")
    .filter({ hasText: invoice })
    .getByRole("button", { name: "Verifikasi pembayaran", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Ya, verifikasi", exact: true })
    .click();
  await expect(
    page.locator(".admin-record").filter({ hasText: invoice }),
  ).toContainText("Dibayar");
  await page
    .locator(".admin-record")
    .filter({ hasText: "Toko Audit Admin" })
    .getByRole("button", { name: "Kelola toko", exact: true })
    .click();
  await expect(page.locator(".admin-store-stats")).toContainText(
    "Paket Bertumbuh",
  );
  await page
    .getByLabel("Alasan perubahan status")
    .fill("Tinjauan ulang data toko");
  await page
    .getByRole("button", { name: "Nonaktifkan toko", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Aktifkan kembali sebagai Draft" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/admin-store-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "test-results/admin-store-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Hapus toko", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Konfirmasi 1 dari 3" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Lanjutkan", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Konfirmasi 2 dari 3" }),
  ).toBeVisible();
  await page
    .getByLabel("Ketik nama toko persis: Toko Audit Admin")
    .pressSequentially("Toko Audit Admin");
  await expect(
    page.getByLabel("Ketik nama toko persis: Toko Audit Admin"),
  ).toHaveValue("Toko Audit Admin");
  await page.getByRole("button", { name: "Lanjutkan", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Data toko tidak bisa dipulihkan.",
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/admin-delete-final.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Ya, hapus permanen", exact: true })
    .click();
  await expect(page).toHaveURL(/admin\?tab=overview$/);
  await expect(
    page.locator(".admin-record").filter({ hasText: "Toko Audit Admin" }),
  ).toHaveCount(0);
});
