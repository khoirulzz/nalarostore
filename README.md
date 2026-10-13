# Nalaro Store

Commerce SaaS for Nalaro Digital: independent merchant stores, manual customer payments, owner-managed monthly/yearly subscriptions, and separately contracted custom projects. React/TypeScript/Vite + Cloudflare Workers/R2 + Aiven PostgreSQL through Hyperdrive.

**Release state:** phases 1–3 are implemented and under verification. Aiven `nalarostore-pg` Free in Singapore and R2 `nalarostore-media` have been created. The production database has not been migrated or connected to Hyperdrive. Email Sending and tenant DNS/TLS still need account-level configuration. **Real checkout remains disabled.** Demo data is confined to `/demo/atelier` and `/demo/workspace`.

## What is implemented

| Phase | Behavior                                                                                                                                                                                                                                                                   |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Registration/email verification, Secure HttpOnly host-only sessions, merchant membership checks, store creation, product/variant editors, stock changes, R2 image validation/uploads, tenant-specific catalog and workspace                                                |
| 2     | Guest checkout with server price/stock validation, atomic order/item/reservation writes, idempotent retries, order counters, opaque expiring tracking links, audited payment checks, fulfillment transitions, cancellation/expiry and retryable transactional email outbox |
| 3     | Owner-only package/price/policy administration, monthly/yearly subscription invoices with price snapshots, verification/renewal/grace/expiry, quota enforcement, self-service onboarding/HTTPS subdomain proof, custom lead→quote→delivery with ownership/license fields   |

Storefront/cart/checkout never consume production demo products. Customer payments settle to each merchant's bank/QRIS; subscription invoices are separately verified by Nalaro admins. No gateway, automatic settlement or refund processing is included.

## Local development

Node 22+, npm. No production credentials are required for local testing.

```bash
npm ci
npm run check
npm run dev             # UI only
npm run build
npm run dev:full        # disposable PostgreSQL-engine database + development-only account
```

`dev:full` uses PGlite. It creates `owner@local.test` with `local-dev-password-123`; these credentials exist only in the disposable development server. Never deploy that server or its database. The production Worker does not import it. Local transaction tests serialize PGlite transactions; GitHub Actions reruns them against native PostgreSQL 17 using separate connections and verifies backup/restore.

```bash
npx playwright install chromium
npm run test:e2e
# Optional existing browser:
CHROMIUM_PATH=/path/to/chromium npm run test:e2e
```

The browser tests create a store/product, guest order, payment verification and completed pickup; they check 320/390/768/1440px layouts. QA screenshots are written to `test-results` and published as an Actions artifact. These are fixture data, never real customers or sales.

## Production configuration

Follow [DEPLOYMENT.md](DEPLOYMENT.md). Required bindings/configuration:

- `HYPERDRIVE`: Aiven PostgreSQL, **query caching disabled**; validate TLS and actual connection usage.
- `MEDIA`: the dedicated R2 media bucket; no private customer documents are accepted.
- `EMAIL`: Cloudflare Email Sending binding, with an onboarded sender domain.
- `TOKEN_SECRET`: 32+ random bytes as a Cloudflare secret; never a `VITE_` variable.
- `APP_ORIGIN`, `ROOT_DOMAIN`, `OWNER_EMAIL`: verified platform URL/domain/owner address.
- `ENABLE_LIVE_CHECKOUT`: stays `false` until release gates pass.

Owner privileges are granted only after the exact configured owner email is verified. No public admin bootstrap endpoint exists. Session cookies have no parent-domain attribute. All state-changing API requests require same-origin requests. Catalog and upload writes recheck the user's store membership in the backend.

A new store is draft. Publication requires an active stocked variant, valid manual payment instructions, and a configured fulfillment method. Subdomains remain pending until a real HTTPS proof from the exact hostname succeeds. `/s/{slug}` remains the fallback platform store address.

Pricing is not seeded or hardcoded. Admins publish packages and fill Nalaro billing instructions. Trial/grace policy applies to new subscriptions; existing prices/period invoices retain their agreed snapshots. Product quotas count retained catalog records, order quotas count successfully created orders per UTC month, and media quota counts uploaded bytes per UTC month. Pilot stores without a subscription remain available until a subscription is selected.

## Operations and limitations

- Cron every ten minutes releases unpaid expired reservations, advances subscription status, processes the email outbox, and cleans expired authentication/rate-limit records. Paid orders are never expired by reservation cleanup.
- Outbox delivery is at-least-once; an email can repeat after a provider acceptance/DB acknowledgment failure. Eight failures move the event to `failed`; operators inspect and retry deliberately. Web tracking remains the primary fallback.
- Guest links expire after 30 days and expose no buyer name, email, phone or address. Tracking remains accessible after store pause/subscription expiry.
- R2 accepts bounded raster files only: JPG/PNG/WebP, at most 5MB, sane dimensions; no SVG, HTML, executable, or customer payment-document uploads. Stored product images are public only for published stores or authenticated store members.
- Password hashing uses salted PBKDF2-SHA256 with 100,000 iterations, within the Workers Web Crypto limit. Account/IP rate limits and minimum 12-character passwords are enforced. Validate Worker CPU/latency on the actual account before public launch; consider stronger managed authentication as the service grows.
- There is no claim of Aiven/Hyperdrive live load or production restore verification until performed on the account. Cloudflare email permission currently blocks sender-domain setup via the connector; Aiven's connector redacts database passwords.
- Custom domains, gateways, carrier APIs, refunds, more themes and advanced analytics remain phase 4.
- Demo photography references Unsplash URLs from the original foundation. Replace them with approved local/R2 assets before public marketing launch; the automated test environment may not load external photography.

Original Nalaro favicon assets are preserved. Business/legal source handover for custom work is defined per contract; public repository visibility does not grant a blanket redistribution license.
