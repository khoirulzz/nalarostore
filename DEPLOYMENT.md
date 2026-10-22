# Deployment and activation

## Provisioned resources

- GitHub: `khoirulzz/nalarostore`, production branch `main`.
- Cloudflare Primary account: `fa9e4b5cc90250f132b17fb7c067490b`.
- Aiven project: `uniquefactuhl-7887`; PostgreSQL `nalarostore-pg`, `free-1-1gb`, `do-sgp`, PostgreSQL 17. Termination protection was disabled when inspected on 2026-10-15; this audit did not change that setting.
- R2: `nalarostore-media`, APAC, Standard. Existing account R2 was already enabled; no paid service plan was activated.
- Hyperdrive: `nalarostore-db`, id `5445c942b1a647a9a01b5c9d7eb6e99f`, bound as `HYPERDRIVE` in `wrangler.worker.jsonc`. Query caching is disabled; origin TLS uses `verify-full` with the uploaded Aiven CA.

The Hyperdrive binding is deployed. On 15 October 2026, all five migrations were
applied to Aiven and their recorded checksums matched the source files. There
are 30 public tables. Production health, plans and capabilities endpoints return
200; the plans list is empty until owner configuration. Email Sending remains
pending and live checkout stays disabled. See the readiness audit below.

## Separate Pages and Worker deployment

| Setting | Pages frontend | Worker backend |
| --- | --- | --- |
| Config | `wrangler.jsonc` | `wrangler.worker.jsonc` |
| Project/Worker name | `nalarostore` | `nalarostore` |
| Build command | `npm run build` | `npm run typecheck` |
| Output directory | `dist` | No static asset directory |
| Deploy command | `npm run deploy:pages` | `npm run deploy:worker` |
| Public hostname | `nalaro.store` custom domain | Routes on that same hostname |
| Variables | Public `VITE_FIREBASE_*` in build settings | Backend vars and `TOKEN_SECRET` secret |

For Git-connected Pages, set build command `npm run build`, output `dist`, and
repository root as the root directory. Pages auto-detects the root Wrangler config.
For Git-connected Worker Builds, use `npm run typecheck` as the build command and
`npm run deploy:worker` as the deploy command; its explicit config flag selects
the backend config. The legacy `npm run deploy` command also targets only the Worker.

Worker values are:

```env
APP_ORIGIN=https://nalaro.store
ROOT_DOMAIN=nalaro.store
PAGES_ORIGIN=https://nalarostore.pages.dev
```

`TOKEN_SECRET` belongs only on the Worker. Preserve its current value for the same
database/orders. No database password, backup key, or tracking secret belongs in
Pages frontend build variables. `HYPERDRIVE`, `MEDIA`, and `EMAIL` are Worker bindings.
Add the actual Hyperdrive id and configured Email binding to the backend config;
`--keep-vars` preserves dashboard text variables, not missing resource bindings.

Frontend requests keep using relative `/api/...` URLs. No API base URL or cross-origin
CORS change is needed. Route activation happens when the Worker is deployed; these
local edits do not attach the Pages custom domain or modify Cloudflare resources.

`PAGES_ORIGIN` must keep serving Pages directly, without redirecting to
`nalaro.store`. The Worker uses it for streaming storefront HTML and optional
tenant assets without forwarding cookies, Firebase tokens, or tracking query strings.
Pages handles SPA deep links by its default fallback; do not add a top-level `404.html`.
The `public/_headers` file preserves frontend security and indexing headers.

The `nalarostore.pages.dev` URL and Pages preview URLs serve frontend previews.
Backend flows require the configured public hostname, or an explicitly configured
preview backend; production Worker routes do not run on arbitrary Pages preview URLs.

Before deploying, validate both artifacts:

```bash
npm run check
npm run check:worker
```

After both deployments and Pages domain attachment, check the public root,
`/login`, `/demo/batiknalaro`, `/api/live`, `/api/health`, and an actual published
`/s/{slug}` product deep link. An `ok` result from `/api/live` proves Worker routing;
`/api/health` must also confirm the database is connected. Test a signed-in merchant
write and a controlled guest order before enabling live checkout.

## Database connection and migrations

Test the database independently before provisioning Hyperdrive:

```powershell
npm.cmd run db:diagnose
```

The standalone `scripts/aiven-diagnostics.mjs` reads `DATABASE_URL` from
`.env.local` and the certificate from root `ca.pem`. It checks configuration,
CA validity, system/direct DNS, hostname/IP TCP connectivity, an HTTPS TCP
control, PostgreSQL SSL negotiation, verified TLS, login and read-only queries.
TLS and login are skipped when TCP fails. It never migrates or writes application
data and never logs credentials or raw server error messages. Results are saved
to ignored `test-results/aiven-diagnostics.json`; exit code 1 means a check failed.
Use `npm.cmd run db:diagnose -- --timeout-ms 20000` for slower networks. Paths can
be overridden with `--env-file`, `--ca`, and `--report`. Node 20.12+ and installed
project dependencies are required. A successful terminal test does not verify
the Worker/Hyperdrive connection. Keep `.env.local` and `ca.pem` ignored.

Retrieve the connection and CA certificate directly from the Aiven Console into a trusted private terminal/environment. Do not paste passwords into chat, repository files or frontend environment variables. Aiven's connector redacts the password, so it cannot supply a direct DATABASE_URL or Hyperdrive connection credentials. Its separate PG Editor tools can inspect SQL state; direct local tests and the migration CLI still require private connection credentials.

Use a dedicated PostgreSQL role for the app with the necessary table/sequence permissions, separately from the migration owner. Create Hyperdrive with verified Aiven TLS, caching **disabled**, and a deliberately small origin pool. Distributed pooling is not a guaranteed global connection cap. Keep connection headroom for migrations and administration and measure `pg_stat_activity` under load.

Add the real Hyperdrive id to `wrangler.worker.jsonc`:

```json
"hyperdrive": [{"binding":"HYPERDRIVE","id":"<actual-id>"}]
```

Supply server-only `DATABASE_URL` and either `PG_CA_CERT_FILE` or `PG_CA_CERT_BASE64`. The migration script strips URL `sslmode`, verifies the CA for remote databases, obtains an advisory lock, checks migration checksums and records each migration in the same transaction.

```bash
npm run db:migrate
npm run types
```

Migrations 0001–0005 add the domain schema, commerce/billing, Firebase UID mapping, time-bounded pilots and product galleries. Use forward migrations; never edit an applied file.

## Email, owner and secrets

Enable Email Sending for the actual sender domain in Cloudflare and verify required DNS records. Add `"send_email":[{"name":"EMAIL"}]` to config only after domain onboarding. Set `EMAIL_FROM` to an address on that domain. A routing-only Email binding is not a substitute for arbitrary transactional Email Sending.

Create `TOKEN_SECRET` through Cloudflare's secret interface. It encrypts recoverable guest tracking tokens; keep it through normal deployments. Changing it without a migration invalidates idempotent token replay for existing orders. Set `FIREBASE_PROJECT_ID`, `FIREBASE_API_KEY` and the exact `OWNER_EMAIL`; register and verify that identity through Firebase.

Firebase Auth handles registration, identity verification and password-reset email. The Cloudflare EMAIL binding is only for order/subscription notifications. Validate real delivery, sender authentication, verification links and renewal/order notifications on controlled addresses.

## Platform domain and store subdomains

Attach `nalaro.store` as a **Pages custom domain**, with proxied DNS and HTTPS.
The Worker uses **Routes**, not a Worker Custom Domain for the entire hostname:
`nalaro.store/api/*` serves the API; `nalaro.store/s/*` preserves
store/product metadata while loading its HTML from Pages.
For `{slug}.nalaro.store`, verify DNS, Worker routing, and a certificate covering that exact depth before enabling a hostname. Then add the optional `*.nalaro.store/*` Worker route. A wildcard DNS record alone does not guarantee TLS coverage. Review any certificate-product cost before activating it; no paid certificate product has been enabled here.

The app's `/.well-known/nalarostore-domain` proof exposes only an existing store id/hostname. Merchant subdomain activation fetches the exact expected HTTPS hostname with redirects disallowed and compares all proof fields. Pending domains cannot serve tenant storefronts. The admin's manual verification action is for an operator who has independently validated DNS/TLS/routing.

Path storefronts `/s/{slug}` work without wildcard TLS and remain available as fallback. They resolve ownership by server-side slug lookup; merchant write APIs still require membership for the store id.

## Backup and recovery

Install `pg_dump`/`pg_restore` at the server's major version or later. Configure a distinct random `BACKUP_KEY_HEX` and retain it separately from encrypted backups. Keep database credentials and CA in server-only environment variables.

```bash
node scripts/backup.mjs backup /secure/backups/nalarostore.enc
# Set DATABASE_URL to a separate EMPTY staging database, never the live one.
ALLOW_RESTORE=yes node scripts/backup.mjs restore /secure/backups/nalarostore.enc
```

The archive is AES-256-GCM encrypted with a new IV for each backup. Restore authenticates the complete file before invoking `pg_restore`, uses a single transaction, and removes the temporary plaintext afterward. Schedule external encrypted backups and retention only after selecting the destination and verifying cost/security. The CI drill restores into a separate PostgreSQL database and compares orders and inventory; it does not claim to have restored the live Aiven service.

## Release gates

Before switching `ENABLE_LIVE_CHECKOUT` to `true`:

- Native PostgreSQL tests, real browser funnel, tenant-isolation checks and Worker build pass.
- Migrations and Hyperdrive work on Aiven; test real concurrent checkouts and connection exhaustion.
- Restore a real encrypted account backup into staging and compare order/inventory integrity.
- Real transactional emails and periodic jobs run; verify a stale reservation release and an invoice cycle.
- Platform URL/DNS/TLS is valid; optional subdomain fallback is tested.
- Owner has configured payment instructions, plans/policy, privacy/support documents and incident responsibility.
- Review Worker CPU, request/SQL quotas, R2 storage and Aiven disk/connection usage. No paid resource is activated silently.

```bash
npm run check
npm run test:e2e
npm run deploy:pages
npm run deploy:worker
```

For rollback, deploy the previous tested Worker version and keep checkout disabled as needed. Do not drop historical order/inventory tables. A release remains incomplete until account-level smoke tests pass, even when source/CI tests are green.

## Firebase migration and deployment

Use the same Firebase project in Vite build variables and Worker variables. API verifies Firebase RS256 ID tokens using Google public keys, then checks the current account UID/email/verification/disabled/validSince through Firebase account lookup. A Firebase Admin service-account private key is not required for this flow. If the frontend API key is restricted by HTTP referrer, use an appropriate separate server API key restricted to the necessary Identity Toolkit API.

Legacy password/session tables are retained by forward migration for historical compatibility but are not used for authentication. Existing unbound users can be linked only by a verified Firebase email; already linked UIDs cannot be replaced via client-supplied email. Merchant/admin roles remain server-owned. Configure Firebase email action URL/Authorized Domains per environment; see LOCAL-DEVELOPMENT.md.

Do not set FIREBASE_AUTH_EMULATOR_HOST or VITE_FIREBASE_AUTH_EMULATOR_URL in production. Build rejects emulator configuration for production, and Worker rejects emulator tokens outside development/test.

The earlier audit found an empty Aiven schema and no Hyperdrive configuration.
The 15 October migration and binding verification supersede those observations.
Aiven connector redacts passwords; use private DATABASE_URL/CA values for direct
connections and migrations.

Firebase project Authorized Domains was read during verification: localhost is already allowed; nalaronalaro.store is also allowed. The repository platform domain nalaro.store is not in that list yet. Add the selected production domain before the production identity-email walkthrough. No Firebase domain configuration was changed remotely.

## Readiness audit, 15 October 2026

The production Pages deployment uses main commit `93e44cc` and has succeeded.
The `nalarostore` Worker has `/api/*` and `/s/*` routes, R2, TOKEN_SECRET and the
verified Hyperdrive binding. Worker version:
`e1fe7877-c602-47bb-9d3d-216db889da9d`. Aiven migrations 0001 through 0005 are
applied with verified checksums and 30 public tables. The database was empty
before migration; the migration introduced structure and the initial
platform_settings row, without test accounts, stores or orders.

Validation completed:

- `npm run check` passed: types, schema checks, typecheck, 43 tests and production
  build. One native PostgreSQL encrypted backup/restore test was skipped because
  no TEST_PG_CONTAINER/Docker environment was available.
- `npm run check:worker` passed.
- Five Playwright E2E tests passed using isolated PGlite and Firebase Auth
  Emulator: merchant/product/guest order/manual payment/completion, responsive
  marketing/auth layouts, external custom-order redirect, account verification/
  reset/password change, and manual six-calendar-month UMKM access/revocation.
  The obsolete local `/custom` layout assertion was replaced with an explicit
  destination redirect test; the external form submission was not exercised.
- Production `/api/live`, `/api/health`, `/api/public/plans` and capabilities
  returned 200. Health reports database connected and liveCheckout false.
  Merchant API without credentials returned 401; a nonexistent store returned 404.
- Production `/`, `/login`, and `/demo/batiknalaro` rendered at 390px and 1350px
  without horizontal overflow or page errors. Local layout tests additionally
  covered 320px, 768px and 1440px. These are browser viewports, not physical-device tests.

Readiness: the database/backend foundation and local business flows are ready
for further controlled verification, not unrestricted live checkout. Remaining:

- Firebase's public project config still lacks `nalaro.store` in Authorized
  Domains. Add it under Authentication > Settings > Authorized domains before
  testing production verification/reset emails; those actions use the current
  application origin as continue URL.
- EMAIL binding and real transactional delivery remain deferred by user choice.
- Production plans/prices and billing instructions have not been configured.
- Real signed-in merchant/guest transactions, native backup/restore to staging,
  origin connection-limit/load tests and actual scheduled-job effects have not
  been production-verified. The local flows above do not prove these external paths.

Keep ENABLE_LIVE_CHECKOUT=false until the remaining release gates are satisfied.
Detailed command artifacts are local and ignored under `.wrangler/readiness/`,
`.wrangler/readiness-e2e/` and `test-results/`.

`/api/live` is a process liveness probe. `/api/health` returns HTTP 503 when the
Hyperdrive binding is missing or the application schema cannot be queried; only
successful schema queries yield HTTP 200. Do not use liveness as release readiness.

The admin can approve a selected store for six **calendar months** of UMKM access
using `Aktifkan UMKM 6 bulan`. The existing 0–90 day pilot control remains available
for shorter pilots and revocation (0). Approval remains manual and records the
requested duration and resulting expiry in the audit log. Form submission alone
does not grant this access. This does not publish a draft store or configure billing.

This run applied the authorized Aiven migrations and verified the already-deployed
Hyperdrive binding. It did not enable checkout, change plans, send real emails,
activate paid infrastructure, or create production test users/orders. Source
configuration and E2E test changes are local until separately committed/pushed.


## Domain migration — 2026-10-22

The production platform origin is `https://nalaro.store`. Pages serves the frontend;
the Worker owns `/api/*` and `/s/*` on both the apex and `www` hostname.
Catch-all Worker routes redirect `www.nalaro.store` and `store.nalaro.digital` documents to the apex,
preserving the path and query. Worker storefront requests use the same redirect.
The old `/api/*` route remains same-origin for existing Seller Center clients.
Keep `PAGES_ORIGIN=https://nalarostore.pages.dev` to avoid recursive fetches.
Firebase `authDomain` stays `nalarostore.firebaseapp.com`; confirm `nalaro.store`
and `www.nalaro.store` in Authorized domains for verification/reset continue URLs.
Tenant subdomains require separate DNS/routing verification before publishing.
