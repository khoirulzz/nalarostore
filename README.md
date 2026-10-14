# Nalaro Store

Commerce SaaS for Nalaro Digital: independent merchant stores, manual customer payments, owner-managed monthly/yearly subscriptions, and separately contracted custom projects. React/TypeScript/Vite on Cloudflare Pages + separate Workers/R2 backend + Aiven PostgreSQL through Hyperdrive.

**Release state:** phases 1–3 are implemented and under verification. Aiven `nalarostore-pg` Free in Singapore and R2 `nalarostore-media` have been created. The production database has not been migrated or connected to Hyperdrive. Email Sending and tenant DNS/TLS still need account-level configuration. **Real checkout remains disabled.** Demo data is confined to `/demo/atelier` and `/demo/workspace`.

## What is implemented

| Phase | Behavior                                                                                                                                                                                                                                                                   |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Firebase email/password registration, verification/reset/change-password, verified Firebase ID tokens and account revocation checks, merchant membership checks, store creation, product/variant editors, stock changes, R2 image validation/uploads, tenant-specific catalog and workspace                                                |
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

`npm run dev` runs the UI and API together and reads `.env.local`. Copy `.env.example`, then choose disposable PGlite or an explicit Aiven connection with a verified CA. Remote migrations are an explicit separate command. See [Local development](docs/LOCAL-DEVELOPMENT.md) for Windows commands, Firebase Authorized Domains, database fields, and email action URLs.

Automated E2E starts Firebase Auth Emulator with project `demo-nalarostore` on port 9099 and a disposable application on port 5175. Its accounts and database are separate from real Firebase/Aiven. The browser tests cover Firebase signup/verification/reset/password change, merchant/product/guest order/payment/pickup, tracking after store pause, and responsive layouts. Native PostgreSQL concurrency/backup tests remain in CI.

```bash
npx playwright install chromium
npm run test:e2e
# Optional existing browser:
CHROMIUM_PATH=/path/to/chromium npm run test:e2e
```

The browser tests create a store/product, guest order, payment verification and completed pickup; they check 320/390/768/1440px layouts. QA screenshots are written to `test-results` and published as an Actions artifact. These are fixture data, never real customers or sales.

## Production configuration

Follow [DEPLOYMENT.md](DEPLOYMENT.md). Required bindings/configuration:

Frontend and backend deploy independently. `wrangler.jsonc` configures Pages
(`npm run build`, output `dist`); `wrangler.worker.jsonc` configures the API Worker,
without bundled frontend assets. Pages serves `store.nalaro.digital`; Worker routes
handle `/api/*` and storefront HTML metadata under `/s/*` on that same hostname.
The Worker fetches storefront HTML from `PAGES_ORIGIN=https://nalarostore.pages.dev`.
Deploy with `npm run deploy:pages` and `npm run deploy:worker` separately.

- `HYPERDRIVE`: Aiven PostgreSQL, **query caching disabled**; validate TLS and actual connection usage.
- `MEDIA`: the dedicated R2 media bucket; no private customer documents are accepted.
- `EMAIL`: Cloudflare Email Sending binding, with an onboarded sender domain.
- `FIREBASE_PROJECT_ID`, `FIREBASE_API_KEY`: the trusted Auth project and an API key usable by server-side account lookup.
- `TOKEN_SECRET`: 32+ random bytes as a Cloudflare secret for guest tracking replay; never a `VITE_` variable.
- `APP_ORIGIN`, `ROOT_DOMAIN`, `OWNER_EMAIL`: verified platform URL/domain/owner address.
- `PAGES_ORIGIN`: the direct Pages origin, different from the public custom domain to avoid routing loops.
- `ENABLE_LIVE_CHECKOUT`: stays `false` until release gates pass.

Owner privileges are granted only after the exact configured owner email is verified. No public admin bootstrap endpoint exists. Firebase supplies short-lived bearer ID tokens; legacy password/session endpoints no longer authenticate users. The backend checks signature, issuer, audience, expiry and current account state. All state-changing API requests require same-origin requests. Catalog and upload writes recheck the user's store membership in the backend.

A new store is draft. Publication requires an active stocked variant, valid manual payment instructions, and a configured fulfillment method. Subdomains remain pending until a real HTTPS proof from the exact hostname succeeds. `/s/{slug}` remains the fallback platform store address.

Pricing is not seeded or hardcoded. Admins publish packages and fill Nalaro billing instructions. Trial/grace policy applies to new subscriptions; existing prices/period invoices retain their agreed snapshots. Product quotas count retained catalog records, order quotas count successfully created orders per UTC month, and media quota counts uploaded bytes per UTC month. Stores without a subscription can receive orders only during an explicit owner-approved pilot period. Draft preparation and authorized exports remain available.

## Operations and limitations

- Cron every ten minutes releases unpaid expired reservations, advances subscription status, processes the email outbox, and cleans expired authentication/rate-limit records. Paid orders are never expired by reservation cleanup.
- Outbox delivery is at-least-once; an email can repeat after a provider acceptance/DB acknowledgment failure. Eight failures move the event to `failed`; operators inspect and retry deliberately. Web tracking remains the primary fallback.
- Guest links expire after 30 days and expose no buyer name, email, phone or address. Tracking remains accessible after store pause/subscription expiry.
- R2 accepts bounded raster files only: JPG/PNG/WebP, at most 5MB, sane dimensions; no SVG, HTML, executable, or customer payment-document uploads. Stored product images are public only for published stores or authenticated store members.
- Password storage and reset are handled by Firebase Auth. The UI reads the project password policy; login does not force a policy upgrade. Admin MFA requires separate Firebase/Identity Platform review and is not enabled by this change.
- There is no claim of Aiven/Hyperdrive live load or production restore verification until performed on the account. Sender-domain permissions/onboarding must be checked at release; Aiven's connector redacts passwords needed for a direct local connection.
- Custom domains, gateways, carrier APIs, refunds, more themes and advanced analytics remain phase 4.
- Demo photography references Unsplash URLs from the original foundation. Replace them with approved local/R2 assets before public marketing launch; the automated test environment may not load external photography.

Original Nalaro favicon assets are preserved. Business/legal source handover for custom work is defined per contract; public repository visibility does not grant a blanket redistribution license.

## Audit repairs and current verification scope

Tracking pages no longer depend on published catalog or subscription entitlement. Custom lead status fields keep raw status values. Pilot access is explicit and time-bounded. The local server no longer reuses an unrelated Vite-only backend or assumes POSIX file separators.

Merchant operations include paged/searchable/date-filtered orders, customer summaries, basic paid-order analytics, CSV export and printable order summaries. Export stays tenant-scoped and protects spreadsheet cells against formula input. Store and product HTML metadata are prepared in the Worker; full storefront SSR, advanced funnel analytics, staff invitation, gateway/shipping integration and more themes remain future work.

Privacy/support/contract terms and plan amounts must be set by the owner; this implementation does not invent business promises or activate production checkout. Production Aiven migrations/Hyperdrive, real notification email, actual restore/load, DNS/TLS and physical-device checks remain separate release gates.
