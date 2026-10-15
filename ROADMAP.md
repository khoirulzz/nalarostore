# Nalaro Store delivery status

## Phase 1: merchant identity and real data

- [x] Firebase Auth registration, verification, password reset/change, server-side token validation and verified owner access.
- [x] Per-store merchant authorization, hostile cross-tenant tests, audit records.
- [x] Store/product/variant/settings editors, image uploads and stock movements.
- [x] Real catalog, storefront and workspace; demonstrations are separate routes.
- [x] Owner-only package/price administration.
- [ ] Connect actual Aiven credentials to Hyperdrive, migrate the production database, verify real order-email delivery; Firebase handles identity emails.

## Phase 2: commerce

- [x] Tenant-scoped client cart; guest checkout against server inventory/prices.
- [x] Atomic order/items/reservations, race-safe order counters, idempotency replay.
- [x] Scheduled unpaid expiry and exactly-once stock release in transactions.
- [x] Opaque expiring tracking links, manual payment audit and fulfillment state transitions.
- [x] Native PostgreSQL concurrency and encrypted backup restore drill in CI.
- [x] Browser walkthrough: create store/product → guest order → payment check → completed pickup.
- [x] Responsive checks at 320, 390, 768 and 1440px; reduced-motion/focus/error states.
- [ ] Actual Aiven/Hyperdrive load, account backup/restore, email delivery and go-live activation.

## Phase 3: commercialization

- [x] Owner-managed monthly/yearly prices, immutable invoice price snapshots.
- [x] Manual subscription invoice verification, renewal, configurable trial/grace policy and expiry.
- [x] Entitlements/usage: retained products, created orders per UTC month, uploaded image bytes per UTC month.
- [x] Custom briefs, quotations, contractual source ownership, reusable modules and delivery states.
- [x] Self-service merchant/store onboarding; verified-hostname resolver and HTTPS subdomain proof.
- [ ] Deploy platform URL and verify actual tenant DNS/routing/TLS; path storefronts are the fallback.
- [ ] Owner publishes actual plans/prices and confirms billing/support/privacy terms before public signup.

## Phase 4: future work

Merchant payment gateways/signature verification/reconciliation/refunds; carrier APIs; custom domains after billing/TLS review; Market/Local themes; richer analytics and staff interfaces; SEO/SSR metadata; independent production backups and scaling according to measured limits.

## Release status

Implementation and test coverage do not imply production activation. The phase 1–3 implementation is now on main. Live checkout stays disabled until the account-level gates in DEPLOYMENT.md are satisfied. No SaaS prices or real merchant products are invented.

## Audit follow-up

- [x] Firebase migration, dynamic password policy and localhost/Aiven configuration.
- [x] Firebase emulator registration/verification/reset/password-change browser coverage.
- [x] Tracking independent of paused/expired storefront; raw custom status preservation.
- [x] Explicit time-bounded pilot approval; draft preview before publication.
- [x] Product gallery/variant image editing, customer summaries, basic revenue analytics.
- [x] Order search/date filters/pagination, tenant CSV export, printable order summary.
- [x] Worker store/product metadata, canonical and structured data implementation.
- [ ] Account-level Aiven migrations/Hyperdrive, notification email, DNS/TLS and measured restore/load.
- [ ] Real Firebase identity-email delivery and production auth walkthrough.
- [ ] Full SSR, advanced funnel, staff invitation, MFA provider review, additional themes and physical-device QA.

## Readiness audit, 15 October 2026

- [x] Readiness probe queries application schema and returns 503 for missing database setup.
- [x] Six-calendar-month UMKM approval with owner authorization, expiry audit and revocation.
- [x] Reject duplicate variant IDs, impossible order dates and malformed media URLs.
- [x] Remove internal campaign instructions from pricing and fix UMKM brief line breaks.
- [ ] Aiven public schema is empty; Hyperdrive and transactional EMAIL binding still absent.
- [ ] Verify browser flow, notification delivery, restore/load and checkout on the actual production backend.
