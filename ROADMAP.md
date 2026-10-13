# Nalaro Store delivery status

## Phase 1: merchant identity and real data

- [x] Registration, one-use email verification, secure sessions, owner bootstrap after verified email.
- [x] Per-store merchant authorization, hostile cross-tenant tests, audit records.
- [x] Store/product/variant/settings editors, image uploads and stock movements.
- [x] Real catalog, storefront and workspace; demonstrations are separate routes.
- [x] Owner-only package/price administration.
- [ ] Connect actual Aiven credentials to Hyperdrive, migrate the production database, verify real sender-domain mail.

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

Implementation and test coverage do not imply production activation. The original foundation is on main; the phase 1–3 implementation is in the linked feature branch/PR. Live checkout stays disabled until the account-level gates in DEPLOYMENT.md are satisfied. No SaaS prices or real merchant products are invented.
