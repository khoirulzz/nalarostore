import { it, expect } from "vitest";
import { safeURL } from "../worker/lib/security";

it("rejects malformed media URLs without throwing and accepts HTTPS without credentials", () => {
  for (const value of [
    "https://",
    "https://[invalid",
    "https://user:pass@example.com/a.png",
    "https://:pass@example.com/a.png",
    "javascript:alert(1)",
    "http://example.com/a.png",
  ])
    expect(safeURL.safeParse(value).success).toBe(false);
  for (const value of [
    "",
    "/api/media/store/photo.png",
    "https://example.com/photo.png?size=100",
  ])
    expect(safeURL.safeParse(value).success).toBe(true);
});
