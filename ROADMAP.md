# Nalaro Store — Delivery status and next phases

## Delivered in this session (foundation / visual pilot)

- [x] Locked **hybrid** business direction: monthly/yearly SaaS plans, prices set only by Nalaro owner; independent paid custom work with explicit source/modular reuse policy.
- [x] Copied original submitted PRD and design specification with relevant updates.
- [x] Established React/TypeScript/Vite frontend and Cloudflare Worker static + API config.
- [x] Marketing, full responsive example fashion storefront, product detail, cart, checkout simulation, completion, custom consultation, merchant workspace prototype.
- [x] Premium icon library in one folder (45 SVG icons) and reusable typed component.
- [x] Embedded original Nalaro favicon assets and web metadata.
- [x] Multi-tenant Aiven PostgreSQL foundation SQL with subscription interval and custom lead tables.
- [x] Read-only Worker catalog/public pricing routes using Hyperdrive **when user configures account**.
- [x] GitHub Actions build skeleton (needs dependency install in CI).

## Still to implement (not delivered / must not be claimed complete)

### Phase 1 — Actual merchant data & authentication

- Merchant registration, email verification, secure HttpOnly sessions, role membership and server-side tenant checks.
- Server endpoints for stores/products/variants and R2 uploads, SSR-aware storefront resolver for verified tenant hostname.
- Dynamic storefront and dashboard connected to PostgreSQL (sample frontend data removed from production paths).
- Tenant adversarial tests and audit records. Plan price/entitlement edit admin workflows with owner-only permissions.

### Phase 2 — Live commerce

- Persisted carts optional, guest checkout against actual inventory, transactionally created order + reserved stock, idempotent retry.
- Scheduled reservation expiry, stock release and payment reconciliation.
- Secure guest tracking links, merchant order processing, manual bank/QRIS verification and customer notifications.
- Checkout go-live only after DB backup restore drill, error tests and concurrency load tests.

### Phase 3 — SaaS commercialization

- Owner-managed plans/prices (monthly and yearly), manual subscription invoices, billing cycle/suspension-grace-policy, entitlements and quota metering.
- Custom lead pipeline → quote → delivery with contractual source-license ownership fields.
- Merchant self-service onboarding and verified subdomains.

### Phase 4 — Integrations & scaling

- Merchant-specific payment gateways with verified signatures and settlement directly to merchant, live shipping APIs, custom domains with Cloudflare for SaaS cost review.
- More storefront themes with distinct structure (Market, Local), analytics, RBAC staff, SSR metadata/product SEO, cache invalidation.
- Upgrade Aiven according to storage, connection and reliability metrics; no paid resources activated without approval.

## Operating principles

Never hardcode prices; never mix SaaS subscription payments with customer-to-merchant payments. Never claim a mock checkout is a real order. Reuse stable modules for custom client work without destabilizing core SaaS. Do not ship emoji / third-party icon mix. Screens must work on both desktop and mobile, and anti-AI-slop editorial guidelines are mandatory.
