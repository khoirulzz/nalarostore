import { expect, it } from "vitest";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fashionProducts, fashionSettings } from "../src/data/nalaro-fashion";

it("ships ten distinct products across the four requested collections with local images", () => {
  expect(fashionProducts).toHaveLength(10);
  expect(new Set(fashionProducts.map((p) => p.id)).size).toBe(10);
  expect(new Set(fashionProducts.map((p) => p.primary_image_url)).size).toBe(
    10,
  );
  const counts = Object.fromEntries(
    ["Sarung Batik", "Kemeja Batik", "Kebaya", "Celana Batik"].map(
      (category) => [
        category,
        fashionProducts.filter((p) => p.category === category).length,
      ],
    ),
  );
  expect(counts).toEqual({
    "Sarung Batik": 3,
    "Kemeja Batik": 3,
    Kebaya: 2,
    "Celana Batik": 2,
  });
  const assets = new Set([
    fashionSettings.hero_image_url!,
    ...fashionProducts.flatMap((p) => [
      p.primary_image_url!,
      ...(p.gallery || []).map((g) => g.url),
    ]),
  ]);
  for (const asset of assets) {
    expect(asset.startsWith("/images/")).toBe(true);
    const file = resolve("public", asset.slice(1)),
      bytes = readFileSync(file);
    expect(bytes.subarray(0, 4).toString()).toBe("RIFF");
    expect(bytes.subarray(8, 12).toString()).toBe("WEBP");
    expect(statSync(file).size).toBeLessThan(350000);
  }
});

it("provides valid variant inventory and clearly identifies the sample catalog", () => {
  const ids = fashionProducts.flatMap((p) => p.variants.map((v) => v.id));
  expect(new Set(ids).size).toBe(ids.length);
  for (const p of fashionProducts) {
    expect(Number.isInteger(p.price_idr) && p.price_idr > 0).toBe(true);
    expect(p.variants.some((v) => Number(v.available_stock) > 0)).toBe(true);
    for (const v of p.variants) {
      expect(v.available_stock).toBe(v.stock_qty);
      expect(v.status).toBe("active");
    }
  }
  expect(fashionSettings.policies).toContain("toko demo");
  expect(fashionSettings.bank_details).toBe("");
  expect(fashionSettings.qris_media_key).toBeNull();
});
