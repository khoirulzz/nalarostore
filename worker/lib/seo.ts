import type { DB } from "./db";
import type { RuntimeEnv } from "../index";
import { pagesResponse } from "./pages";

export async function storeHTML(
  db: DB,
  request: Request,
  env: RuntimeEnv,
  store: Record<string, unknown>,
) {
  const url = new URL(request.url);
  const suffix = url.pathname.replace(new RegExp("^/s/" + store.slug), "");
  const slug = suffix.match(/^\/product\/([a-z0-9-]+)$/)?.[1];
  const product = slug
    ? (
        await db.query(
          "SELECT p.*,COALESCE((SELECT min(COALESCE(v.price_override_idr,p.price_idr)) FROM product_variants v WHERE v.store_id=p.store_id AND v.product_id=p.id AND v.status='active'),p.price_idr) AS offer_price,EXISTS(SELECT 1 FROM product_variants v WHERE v.store_id=p.store_id AND v.product_id=p.id AND v.status='active' AND v.stock_qty>v.reserved_qty) AS in_stock FROM products p WHERE p.store_id=$1 AND p.slug=$2 AND p.status='active'",
          [store.id, slug],
        )
      )[0]
    : null;
  const title = product
    ? String(product.name) + " | " + String(store.name)
    : String(store.name);
  const description = String(
    product?.description ||
      store.description ||
      "Belanja produk pilihan " + store.name + ".",
  ).slice(0, 160);
  const canonical =
    env.APP_ORIGIN + "/s/" + store.slug + (suffix === "/" ? "" : suffix);
  const escape = (s: string) =>
    s.replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c]!,
    );
  const image =
    product?.primary_image_url || store.hero_image_url || store.logo_url;
  const absoluteImage = image
    ? new URL(String(image), url.origin).toString()
    : null;
  const graph = product
    ? {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        description: product.description,
        ...(absoluteImage ? { image: [absoluteImage] } : {}),
        offers: {
          "@type": "Offer",
          priceCurrency: "IDR",
          price: String(product.offer_price),
          availability: product.in_stock
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
          url: canonical,
        },
      }
    : {
        "@context": "https://schema.org",
        "@type": "Store",
        name: store.name,
        url: canonical,
        description,
      };
  const metadata =
    '<link rel="canonical" href="' +
    escape(canonical) +
    '"><meta property="og:title" content="' +
    escape(title) +
    '"><meta property="og:description" content="' +
    escape(description) +
    '"><meta property="og:url" content="' +
    escape(canonical) +
    '"><meta property="og:type" content="' +
    (product ? "product" : "website") +
    '">' +
    (absoluteImage
      ? '<meta property="og:image" content="' + escape(absoluteImage) + '">'
      : "") +
    '<script type="application/ld+json">' +
    JSON.stringify(graph).replaceAll("<", "\\u003c") +
    "</script>";
  const response = await pagesResponse(request, env, true);
  const transformed = new HTMLRewriter()
    .on("title", {
      element(e) {
        e.setInnerContent(title);
      },
    })
    .on('meta[name="description"]', {
      element(e) {
        e.setAttribute("content", description);
      },
    })
    .on("head", {
      element(e) {
        e.append(metadata, { html: true });
      },
    })
    .transform(response);
  const headers = new Headers(transformed.headers);
  headers.set("cache-control", "no-store");
  headers.set("x-store-slug", String(store.slug));
  return new Response(transformed.body, {
    status: slug && !product ? 404 : transformed.status,
    headers,
  });
}
