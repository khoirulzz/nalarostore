# Deployment and activation

## Provisioned resources

- GitHub: `khoirulzz/nalarostore`, branch `feat/nalarostore-phases-1-3`.
- Cloudflare Primary account: `fa9e4b5cc90250f132b17fb7c067490b`.
- Aiven project: `uniquefactuhl-7887`; PostgreSQL `nalarostore-pg`, `free-1-1gb`, `do-sgp`, PostgreSQL 17, termination protection enabled.
- R2: `nalarostore-media`, APAC, Standard. Existing account R2 was already enabled; no paid service plan was activated.

## Database connection and migrations

Retrieve the connection and CA certificate directly from the Aiven Console into a trusted private terminal/environment. Do not paste passwords into chat, repository files or frontend environment variables. Aiven's connector returns `[REDACTED]` for the password, so it cannot be used to create Hyperdrive or execute migrations.

Use a dedicated PostgreSQL role for the app with the necessary table/sequence permissions, separately from the migration owner. Create Hyperdrive with verified Aiven TLS, caching **disabled**, and a deliberately small origin pool. Distributed pooling is not a guaranteed global connection cap. Keep connection headroom for migrations and administration and measure `pg_stat_activity` under load.

Add the real Hyperdrive id to `wrangler.jsonc`:

```json
"hyperdrive": [{"binding":"HYPERDRIVE","id":"<actual-id>"}]
```

Supply server-only `DATABASE_URL` and either `PG_CA_CERT_FILE` or `PG_CA_CERT_BASE64`. The migration script strips URL `sslmode`, verifies the CA for remote databases, obtains an advisory lock, checks migration checksums and records each migration in the same transaction.

```bash
npm run db:migrate
npm run types
```

Migrations 0001/0002/0003 add the domain schema, identity/commerce/billing support and platform billing policy. Use forward migrations; never edit an applied file.

## Email, owner and secrets

Enable Email Sending for the actual sender domain in Cloudflare and verify required DNS records. Add `"send_email":[{"name":"EMAIL"}]` to config only after domain onboarding. Set `EMAIL_FROM` to an address on that domain. A routing-only Email binding is not a substitute for arbitrary transactional Email Sending.

Create `TOKEN_SECRET` through Cloudflare's secret interface. It encrypts recoverable guest tracking tokens; keep it through normal deployments. Changing it without a migration invalidates idempotent token replay for existing orders. Set `OWNER_EMAIL` to the exact platform owner's address and register/verify it normally.

Registration is unavailable in production until the email binding exists; it does not falsely report that unconfigured mail was delivered. Validate real delivery, sender authentication, verification links and renewal/order notifications on controlled addresses.

## Platform domain and store subdomains

Attach `store.nalaro.digital` to the Worker and verify HTTPS. For `{slug}.store.nalaro.digital`, verify DNS, Worker routing, and a certificate covering that exact depth before enabling a hostname. A wildcard DNS record alone does not guarantee TLS coverage. Review any certificate-product cost before activating it; no paid certificate product has been enabled here.

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
npm run deploy
```

For rollback, deploy the previous tested Worker version and keep checkout disabled as needed. Do not drop historical order/inventory tables. A release remains incomplete until account-level smoke tests pass, even when source/CI tests are green.
