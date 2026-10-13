# Nalaro Store — Foundation (Phase 0 + UX Pilot)

Hybrid commerce platform from Nalaro Digital: **SaaS monthly/yearly (pricing configured by owner) + custom e-commerce development**. Cloudflare Workers/static assets + Aiven PostgreSQL (through Hyperdrive once provisioned).

> **Current state:** a working UI prototype and a read-only backend foundation. The storefront is a labeled demonstration with a persistent client-side cart and a simulated checkout. **It does not place real orders, store personal data on a server, accept payments, or create subscription billing.** Merchant dashboards use sample data. Do not represent it as production-ready commerce.

## Included in this delivery

- Professional responsive marketing (`/`), custom-project brief (`/custom`), storefront demo (`/demo/atelier`), search/category catalog, product detail, variants, cart, checkout simulation and confirmation.
- Merchant UX pilot (`/app`, `/app/orders`, `/app/products`, `/app/design`) with static sample data. Disabled write controls remain visibly disabled.
- 45 original premium SVG UI icons in **`src/assets/icons/`** via a typed `<Icon />` component. Brand favicon supplied by Nalaro remains in `/public`.
- Worker API read-only: `/api/health`, `/api/public/capabilities`, `/api/public/plans`, `/api/public/stores/:slug`, `/api/public/stores/:slug/products`. Only works with Aiven for store reads after Hyperdrive is configured. No public writes.
- PostgreSQL foundation migration for multi-tenant stores, catalog, order/inventory transaction schema, monthly/yearly SaaS pricing, subscriptions, custom-project leads.
- Updated `PRD-Nalaro-Store.md`, `desain.md`, CI foundation and follow-up implementation plan.

## Run locally

Requirements: Node 22+ and npm.

```bash
npm install
npm run dev
# open http://localhost:5173
npm run db:check
npm run build
```

The local Vite demo does not need an Aiven account. The Worker API is deployed separately by Wrangler along with the built static assets. `npm run preview` previews the frontend, not a live API. Use `npx wrangler dev` after building to test Worker endpoints.

### Cloudflare + Aiven (not provisioned by this bundle)

1. Create one Aiven PostgreSQL Free service and review the limits. Do not commit usernames/passwords or connection strings.
2. Run `db/0001_foundation.sql` using a **trusted local PostgreSQL client** with TLS, after checking the target database. This is a forward-only foundation migration; make a backup before executing in an existing database. **Never expose database credentials to browser code.**
3. Create Hyperdrive in Cloudflare with Aiven connection URL, test TLS and pooling; check effective connections with `pg_stat_activity` under test load. Current Aiven Free documentation limits total connections to 20; Hyperdrive pooling is distributed and not a guaranteed global hard cap.
4. Insert real `[[hyperdrive]]` binding and id in `wrangler.toml`. Keep `APP_ENV` suitable for deployed env. Do not change `ENABLE_LIVE_CHECKOUT` to true: no checkout write endpoint exists in this phase.
5. Optional: provision R2 bucket and bind `MEDIA` after checking usage and billing. Files are not uploaded in this version.
6. `npm run deploy` **only after reviewing Cloudflare account, Worker name, routes, costs and desired release branch**. No infrastructure resources are created by this source package.
7. Implement auth/tenant gates, checkout transactions, stock-reservation expiry and webhook verification before any real purchase. Add backups to independent encrypted storage and practice restoration.

## Asset notes

The demo uses externally hosted **Unsplash sample images** as placeholders for layout review; these are not merchant product photos. Replace with owned or licensed Nalaro imagery in R2 before production. SVG icons are original project assets under `src/assets/icons/`. Original Nalaro favicon files are copied verbatim from the provided archive.

## Source / licensing

This repository is designed for Nalaro Digital's internal product development. No blanket permission to redistribute its proprietary modules or templates is granted by the presence of source files. Custom client IP ownership, source handover, support, licenses and hosting terms must be defined in individual contracts. Do not publish a source-code sale by default.

## Production gates

- [ ] Aiven/Hyperdrive connection tested under concurrency; monitoring, storage & outage limits understood.
- [ ] Auth sessions and merchant RBAC, tenant isolation and hostile cross-tenant test suite complete.
- [ ] Product/upload CRUD, R2 media limits and content safety checks live.
- [ ] Guest checkout atomic order + stock reservation, idempotency and expiry tested.
- [ ] Manual payment verification with audit actor and reconciliation in place.
- [ ] SSR/SEO storefront strategy and verified wildcard hostname/DNS/TLS implemented.
- [ ] Complete accessibility and responsive QA (320 through 1920px, keyboard/screen reader).
- [ ] Real email deliveries, restore drills, bot/rate limits, privacy policy and incident plan in place.
- [ ] Cloudflare / Aiven Free Tier cost and upgrade triggers reviewed.

See [ROADMAP.md](ROADMAP.md), [PRD-Nalaro-Store.md](PRD-Nalaro-Store.md) and [desain.md](desain.md).
