import { test, expect } from "@playwright/test";

test("revealed form keeps Firebase credential errors and submit recovery", async ({
  page,
}) => {
  await page.route(/\/accounts:signInWithPassword\?/, (route) =>
    route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: 400, message: "INVALID_LOGIN_CREDENTIALS" },
      }),
    }),
  );
  await page.goto("/login");
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill("seller@example.com");
  await page.getByLabel("Kata sandi", { exact: true }).fill("WrongPassword1");
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Email atau kata sandi tidak cocok.",
  );
  await expect(
    page.getByRole("button", { name: "Masuk", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".shop-login-panel form")).toHaveAttribute(
    "aria-busy",
    "false",
  );
});

test("seller lamp supports keyboard, drag, focus shortcut and preserves entered values", async ({
  page,
}) => {
  await page.goto("/login");
  const panel = page.locator(".shop-login-panel");
  const lamp = page.getByRole("button", {
    name: "Nyalakan lampu",
    exact: true,
  });
  await expect(panel).toBeHidden();
  await expect(panel).toHaveAttribute("inert", "");
  await lamp.focus();
  await page.keyboard.press("Enter");
  await expect(panel).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Matikan lampu" }),
  ).toBeFocused();
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill("seller@example.com");
  await page.getByLabel("Kata sandi", { exact: true }).fill("MyPassword1");
  await page.getByRole("button", { name: "Tampilkan kata sandi" }).click();
  await expect(page.getByLabel("Kata sandi", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );

  // A real downward drag must toggle once and return the handle to rest.
  const pull = page.getByRole("button", { name: "Matikan lampu" });
  const box = (await pull.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 8,
    box.y + box.height / 2 + 40,
    { steps: 10 },
  );
  await page.mouse.up();
  await expect(panel).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Nyalakan lampu" }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Email", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("textbox", { name: "Email", exact: true }),
  ).toHaveValue("seller@example.com");
  await expect(page.getByLabel("Kata sandi", { exact: true })).toHaveValue(
    "MyPassword1",
  );
  await page.getByRole("link", { name: "Lupa kata sandi?" }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
});

test("lamp layout fits mobile and desktop, including reduced motion and direct registration", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/login");
    await page.getByRole("button", { name: "Nyalakan lampu" }).click();
    await expect(page.locator(".shop-login-panel")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByRole("button", { name: "Matikan lampu" }),
    ).toBeInViewport();
    await page.screenshot({
      path: `test-results/lamp-login-${width}.png`,
      fullPage: true,
    });
  }
  await page.goto("/register");
  await expect(
    page.getByRole("heading", { name: "Buat akun penjual" }),
  ).toBeVisible();
  await expect(page.getByLabel("Kata sandi", { exact: true })).toHaveAttribute(
    "autocomplete",
    "new-password",
  );
  await page.goto("/buyer/login?next=%2Faccount");
  await expect(
    page.getByRole("heading", { name: "Masuk ke akun" }),
  ).toBeVisible();
  await expect(page.locator(".shop-lamp")).toHaveCount(0);
  await page.getByRole("link", { name: "Daftar", exact: true }).click();
  await expect(page).toHaveURL(/\/buyer\/register\?next=%2Faccount$/);
});

test("mobile touch can pull the lamp, while cancellation leaves it off", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(test.info().project.use.baseURL + "/login");
  const lamp = page.locator(".shop-lamp-pull");
  const box = (await lamp.boundingBox())!;
  const cdp = await context.newCDPSession(page);
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [point],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchCancel",
    touchPoints: [],
  });
  await expect(page.locator(".shop-login-panel")).toBeHidden();
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [point],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ ...point, y: point.y + 36 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(page.locator(".shop-login-panel")).toBeVisible();
  await lamp.tap();
  await expect(page.locator(".shop-login-panel")).toBeHidden();
  await lamp.tap();
  await expect(page.locator(".shop-login-panel")).toBeVisible();
  expect(errors).toEqual([]);
  await context.close();
});
