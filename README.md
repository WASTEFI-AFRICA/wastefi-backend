# WasteFi — Backend

REST API for WasteFi, a platform that pays waste collectors in emerging markets
for verified recyclable material drop-offs. Handles accounts and authentication,
collection records, material pricing, payouts over mobile money and Stellar, and
the digital material passports that make a collection auditable.

For the on-chain side, see
[wastefi-contracts](https://github.com/WASTEFI-AFRICA/wastefi-contracts).

## Try it

The API runs at `https://wastefi-backend.onrender.com` (`/health`,
`/api/v1/public/stats` and `/api/v1/public/materials` need no account). The easiest
way to see it work end to end is the
[frontend](https://wastefi-frontend.vercel.app/login): sign in with a demo account
from the sign-in page, approve a collection, and watch it get recorded and paid on
Stellar testnet. The free host sleeps when idle, so the first request can take up to
a minute.

## Stack

- TypeScript, Node.js
- Express
- PostgreSQL via Prisma
- Redis for caching and rate-limit counters (optional; the API runs without it)
- Stellar SDK for on-chain payouts
- Socket.IO for live collection and payment updates

## API

Routes are mounted under `/api/{API_VERSION}`, where `API_VERSION` comes from the
environment and defaults to `v1`:

| Prefix | Purpose |
| --- | --- |
| `/auth` | Registration, login, phone verification, password reset |
| `/users` | Profile and account management |
| `/collection-points` | Collection point registry and geolocation lookup |
| `/collections` | Submitting and querying waste collections |
| `/payments` | Payout initiation and mobile money callbacks |
| `/wallet` | Stellar wallet balances and transfers |
| `/passports` | Digital material passports |
| `/admin` | Administrative operations and fraud review |
| `/backups` | Database backup management |
| `/public` | Unauthenticated aggregate statistics (`GET /public/stats`), used by the frontend's public stats page |

`GET /api/v1/public/stats` needs no login. It returns counts and totals plus the
material, weight, city and time of the latest verified collections, and nothing that
identifies a person. Weight and value count verified collections only, so unverified
submissions cannot inflate it. It is cached for 30 seconds.

`GET /api/v1/users/me` returns the signed-in user's profile.
`PUT /api/v1/users/me` accepts only `firstName`, `lastName`, `email`, `address`
and `city`. Names must be non-empty strings; email, address and city can be
cleared with `null`. Phone numbers, account roles, activation and wallet fields
cannot be changed through this route. An email already in use returns 409.

`/metrics` is mounted at the root, outside the version prefix, and serves
Prometheus metrics. In production it requires a bearer token from the
`METRICS_TOKEN` environment variable (open, e.g. for local Prometheus, in
non-production environments); configure the scrape job with
`bearer_token: ${METRICS_TOKEN}`, substituting the variable in your
orchestrator (Prometheus itself does not expand `${VAR}` without envsubst).

Swagger UI is served at `/api/docs` and the OpenAPI JSON at `/api/docs.json`.
Both are mounted unconditionally, so they are reachable in production as well as
in development; gate them at the reverse proxy if that is not what you want. See
[docs/SWAGGER_GUIDE.md](docs/SWAGGER_GUIDE.md).

## Stellar: recording collections on-chain

When a collection point approves a collection, the API also records it on the
WasteFi Soroban contracts and pays the collector in WASTE. This runs in the
background (`src/services/onchain-collection.service.ts`), so approval in the API
never waits for the chain and is never undone by it. Each approved collection
goes through four contract calls:

1. `waste_transaction.record_with_price_lookup`, signed by the collector's
   custodial wallet. The contract prices it from `material_pricing`.
2. `waste_transaction.verify_transaction_by_point`, signed by the collection
   point's custodial wallet. The registry must verify that point and accept the
   material. This also updates the collector's on-chain reputation. Saved legacy
   `admin_v1` collections keep using `verify_transaction` as admin.
3. `payment_distribution.process_payment`, signed by the admin.
4. `payment_distribution.update_payment_status(Completed)`, signed by the admin,
   which mints the WASTE to the collector.

The collection's `chainStatus` moves through `PENDING`, `RECORDED`, `VERIFIED`
and `PAID`, and the three transaction hashes are stored on it and returned by
`GET /api/v1/collections/:id`. Every step checks the chain before acting, so an
interrupted collection resumes where it stopped. Failed steps are retried every
minute, up to five attempts, and `GET /api/v1/public/stats` reports how many
collections were paid on-chain and how much WASTE was minted.

Collectors are registered in `collector_registry` under a pseudonym derived
from their user id. Names and phone numbers never go on the public ledger.

The wallets are **custodial and testnet-only**: the API generates each
collector's key and stores it encrypted with `WALLET_ENCRYPTION_KEY`, and on
testnet funds it from Friendbot. To turn recording on, set:

| Variable | Value |
| --- | --- |
| `SOROBAN_ADMIN_SECRET` | secret key of the contracts' admin account (the deployer in wastefi-contracts). Recording is off while this is unset |
| `SOROBAN_COLLECTION_FLOW` | optional; `point_owner_v1` by default for the built-in bundle. Use `admin_v1` with the original bundle. Existing contexts retain their saved flow |
| `SOROBAN_PAYMENT_MODE` | optional; `caller_amount_v1` by default. `derived_v1` makes new collections create their payment with `process_verified_payment`, which needs a payment contract that supports it (see [Payout mode](#payout-mode)). Existing contexts retain their saved mode |
| `SOROBAN_RPC_URL` | optional, defaults to `https://soroban-testnet.stellar.org` |
| `SOROBAN_CONTRACTS` | optional, the `contracts` object of `deployed_addresses_testnet.json` as JSON. Defaults to the addresses in `src/config/soroban-contracts.ts` |

### Preserve existing collections before a contract rollout

Every newly processed collection stores a `chainContext`: its contract bundle,
Stellar network, flow version and public collector and point addresses. Retries
use those stored values, including the original collector registry. Changing
`SOROBAN_CONTRACTS` affects work that has not started recording; it does not move
an existing record to another contract. A different configured network, changed
collector wallet, mismatched chain record or mismatched payment stops the retry.
The worker checks the record's collector, point, material, weight and stored
amount, and checks the payment's transaction, recipient and amount before
completing it or reporting it paid.

The database also binds each payment contract to one transaction contract on a
network. A fresh transaction counter needs a fresh payment mapping. Reusing a
payment contract from another transaction deployment is rejected, even if both
IDs happen to be the same. The token contract can remain unchanged, preserving
existing WASTE balances.

Existing rows with on-chain progress need an explicit context backfill. The API
will refuse to resume those rows until they are pinned. Do this **before changing
contract addresses or rotating point identities**:

1. Stop API workers. Keep the original network, RPC and `SOROBAN_CONTRACTS`
   configuration and use the database containing the old collections.
2. Apply migrations with `npx prisma migrate deploy` and build the updated API.
3. Preview with `npm run stellar:pin-collections`. The command simulates reads
   against the original contracts. It does not submit Stellar transactions,
   generate wallets or mint tokens. Review the printed public deployment values
   and any collection IDs marked `needs_review`.
4. Set `ORIGINAL_TRANSACTION_CONTRACT` and `ORIGINAL_PAYMENT_CONTRACT` to the
   original public contract addresses, then apply:

   ```sh
   npm run stellar:pin-collections -- --apply \
     --transaction-contract="$ORIGINAL_TRANSACTION_CONTRACT" \
     --payment-contract="$ORIGINAL_PAYMENT_CONTRACT"
   ```

5. Repeat the preview until no historical rows remain unpinned. Keep workers
   stopped while preparing the updated backend release. Deploy that release with
   the intended default bundle, then resume workers and confirm pinned work
   finishes on its original contracts. Do not restart an older API that can
   create new unpinned records before the cutover.

The command uses `DATABASE_URL` and the existing Soroban configuration. Set the
admin identity securely for read-only RPC simulations; never paste its secret
into logs or source. Preview mode never writes. Apply mode only writes checked
context metadata, a recovered transaction ID when available, and namespace
bindings. It preserves statuses, amounts and transaction hashes. It does not
reset the five-attempt retry limit. Work with no on-chain progress can be pinned
by the worker when it starts recording.

A saved record hash with an unknown RPC outcome is held for review rather than
submitted again. A confirmed failed transaction may be retried, and a confirmed
successful one resumes from its returned ID. Do not clear an unknown hash merely
to retry it; first establish whether the original record landed.

### Point signing and deployment defaults

The built-in testnet bundle uses point verification for newly started work.
It reuses the existing WASTE token, collector registry, material pricing and
reputation contracts, preserving balances. The point registry, transaction
contract and payment map have new addresses. Legacy role grants remain so
previously pinned work can finish. Apply the historical backfill before deploying
these changed defaults. The original bundle is archived in
[`deployments/testnet-2026-10-28.json`](https://github.com/WASTEFI-AFRICA/wastefi-contracts/blob/main/deployments/testnet-2026-10-28.json).
Use that original `contracts` object as `SOROBAN_CONTRACTS` when backfilling old
records; do not let the new built-in addresses stand in for it.

`SOROBAN_COLLECTION_FLOW` selects the flow for newly started collections:
`point_owner_v1` is the default; `admin_v1` is the explicit legacy option.
The chosen flow is stored in `chainContext`. Changing the default never changes
an existing collection's signer or contract bundle. A failed point authorization
is never retried through the admin method. Legacy backfill always writes
`admin_v1`, regardless of the current default. Check any hosting overrides before
release. With no override, the source defaults are used.

Point keys are custodial, encrypted with the existing `WALLET_ENCRYPTION_KEY`,
and stored in the private `CollectionPointWallet` relation. Public point queries
use an explicit field selection, and point updates select allowed inputs. The
old public-only `stellarAddress` remains intact for legacy work. Keys are created
atomically, and missing, corrupt or mismatched keys on pinned work fail closed.
Back up the encryption key and database together; this release adds no key export
or rotation endpoint.

Before a point signs, the API checks its current activation, administrative
verification and accepted materials. It registers the wallet under pseudonymous
metadata, synchronizes its declared material categories and, for a trusted DB
point, asks the registry admin to verify it. Rejected registry entries require
administrative review. A per-registry lease coordinates provisioning between
workers; its heartbeat runs only while a preparation is active and stops in all
exit paths. RPC requests have a 30-second timeout. Saved registration hashes
allow recovery after an interruption.
Unknown outcomes and failed RPC reads are not treated as permission to register
again. Demo refill in point mode uses only material codes accepted by the assigned
verified point.

Point mode requires a transaction contract wired to the selected registry and
its `find_point_by_owner -> Option<u64>` method. The built-in bundle has this
wiring; the original bundle does not. Provisioning is testnet-only. Do not
rotate `WALLET_ENCRYPTION_KEY` during the rollout. Admin custody and the explicit
contract admin override remain. `GET /api/v1/public/stats` reports
`onChain.verificationFlow` for new work: the selected flow when recording is
configured, or `null` when it is disabled. Older API versions may omit it.
The public frontend uses this field rather than inferring the flow from its own
release date. Historical totals can include both flows.

### Payout mode

A payment can be created two ways, and each collection pins the way it started with
in `chainContext.payment`:

- `caller_amount_v1`: the admin passes the recipient and amount to
  `payment_distribution.process_payment`. Every payment contract before derivation
  works this way, and contexts pinned before this field existed are read as this
  mode.
- `derived_v1`: the backend calls `process_verified_payment(transaction_id)` and
  passes nothing else. The contract reads the collector and the amount from the
  verified transaction record, so a payment cannot differ from what was verified.

`SOROBAN_PAYMENT_MODE` selects the mode for newly started collections and defaults
to `caller_amount_v1`. Use `derived_v1` only with a payment contract deployed with
`set_transaction_contract` bound to the bundle's transaction contract (see the
contracts repo's `docs/DERIVED_PAYMENTS_ROLLOUT.md`). Before recording a
`derived_v1` collection the worker reads `get_transaction_contract` and stops if the
payment contract is unbound or bound to a different transaction contract, so a
mismatched configuration fails before anything is recorded. Legacy backfill always
pins `caller_amount_v1`. The contract's admin override (`process_payment`) and the
token's admin `mint` remain, so the admin key is still trusted.

## Operator assignments

Each `COLLECTION_POINT` user has one optional `collectionPointId`. Administrators
assign or remove it with `PUT /api/v1/users/:userId/collection-point` and a body
such as `{"collectionPointId":"<point UUID>"}` or `{"collectionPointId":null}`.
The endpoint accepts only existing operators and active points; it cannot change
roles, account status or KYC. Assignment changes and the audit record commit in
one database transaction. The admin frontend offers these controls on `/users`.

The API reads current roles and assignments from the database on each request.
Operators can list, read and review collections only at their assigned active
point. Collection and material statistics use the same restriction. Another
point ID in a filter is rejected; a foreign collection ID is not returned.
Unassigned operators and those assigned to inactive points receive 403 with
`COLLECTION_POINT_REQUIRED` or `COLLECTION_POINT_INACTIVE`. Reassignment takes
effect with the existing access token. Reviews use a conditional write to
prevent duplicate decisions and recheck assignment if it changes during review.
Central `ADMIN` and `VERIFIER` accounts retain their existing review access;
statistics remain restricted to admins and collection point operators.

Deploy the Prisma migration before running this API. Existing non-demo operators
start unassigned and need an admin assignment. The one-time migration assigns
only the known public demo operator to Nairobi Central if both demo records
exist. New demo operators receive that assignment when created. Later seeding
preserves administrator changes, including removal of an assignment. The demo
queue refills at the demo operator's currently assigned active point.

This restriction is enforced by the API. The current deployment still verifies
as admin; the point-signing source path above awaits its coordinated rollout.

## Mobile money

Payouts reach collectors through three providers, each behind a common
interface in `src/services/mobile-money/`: M-Pesa (Kenya), MTN Mobile Money,
and Airtel Money. Every provider needs its own credentials and a publicly
reachable callback URL, because settlement is asynchronous — the API records a
payout as pending and only marks it complete when the provider posts back.

Callbacks are the security-sensitive surface here: they arrive unauthenticated
from the provider's network and move money on a payout record. See
[docs/MOBILE_MONEY.md](docs/MOBILE_MONEY.md) and
[docs/PAYMENTS.md](docs/PAYMENTS.md).

## Local development

Requires Node.js 18 or later and PostgreSQL 14 or later. Redis is optional.

```sh
cp .env.example .env            # then fill in the values
npm install
npm run prisma:generate
npm run prisma:migrate          # apply migrations to the database in DATABASE_URL
npm run prisma:seed             # optional: sample users, points and materials
npm run dev
```

The server listens on `PORT` (default 3000).

Environment variables are documented in [`.env.example`](.env.example). Only the
`.env.*.example` templates are tracked; files holding real values are gitignored
and must never be committed. For database setup options, including Docker, see
[docs/DATABASE_SETUP.md](docs/DATABASE_SETUP.md).

### With Docker

```sh
docker compose up -d
```

This brings up the API alongside PostgreSQL, Redis, and nginx as configured in
[`docker-compose.yml`](docker-compose.yml).

## Testing

```sh
npm test                 # all suites
npm run test:unit        # unit tests only
npm run test:integration # end-to-end API tests (need a database, see below)
npm run test:coverage    # with a coverage report
```

`tests/integration/api-flow.test.ts` drives the real Express app against a real
PostgreSQL database with nothing mocked: registration, login, account activation,
role checks, token forgery, recording and verifying collections, payment
calculation, and the production secret check. It needs `DATABASE_URL` to point at
a database that has had migrations applied:

```sh
docker run -d --name wastefi-test-db -p 5433:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=wastefi_test postgres:14-alpine
export DATABASE_URL=postgresql://postgres:postgres@localhost:5433/wastefi_test
npx prisma migrate deploy
npm test
```

CI does the same with a Postgres service container. The tests create their own
rows under a unique phone prefix and delete them afterwards.

Measured coverage is 30.97% of statements, 20.12% of branches. The CI threshold sits
just under that so it cannot silently fall. The authentication and collection
paths are covered; payments, wallet, mobile money, admin, notifications and the
material passport service are not. `tests/integration/auth.test.ts` mocks Prisma
and checks request validation only.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server with reload |
| `npm run build` | Generate the Prisma client and compile TypeScript to `dist/` |
| `npm start` | Run the compiled server |
| `npm run lint` | ESLint over the TypeScript sources |
| `npm run format` | Prettier over `src/` |
| `npm run prisma:studio` | Prisma Studio against the current database |
| `npm run db:reset` | Drop, recreate and re-migrate the database |
| `npm run stellar:generate-wallet` | Generate a Stellar keypair for local use |

## Deploying

The `Dockerfile` is the unit of deployment. Its default command applies pending
Prisma migrations and then starts the server, so a fresh database is ready on first
boot on any host. Any host needs a PostgreSQL database and these variables:

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | the PostgreSQL connection string |
| `JWT_SECRET` | a unique random value. In production the server refuses to start without one. Generate with `openssl rand -hex 32` |
| `WALLET_ENCRYPTION_KEY` | encrypts custodial Stellar keys stored for users and collection points. In production the server refuses to start without one. Generate with `openssl rand -hex 32`, keep a copy somewhere safe, and never change it: losing it makes stored wallets unrecoverable |
| `REDIS_ENABLED` | `false` (Redis is optional) |
| `CLIENT_URL` | the frontend's origin, to restrict CORS in production. Optional until the frontend exists |

`PORT` is provided by the platform. Everything else (Twilio, SMTP, mobile money,
Stellar) is optional and the API starts without it.

Two endpoints report health. `/ping` answers without touching the database and is
what container health checks and uptime monitors should call. `/health` also checks
the database and Redis.

### Render with a Neon database (free)

This is how the public demo runs. Render's free web service sleeps after 15 minutes
without traffic, and Render's own free PostgreSQL is deleted after 30 days, so the
database lives on [Neon](https://neon.com), whose free plan does not expire. Neon
suspends the database after 5 minutes without queries; the API is built so that an
idle server sends none (`/ping` and the on-chain retry sweep stay off the database
when there is nothing to do).

1. In Neon, create a project (a region near Frankfurt, such as AWS eu-central-1,
   keeps latency low). On the dashboard, choose **Connect**, turn **Connection
   pooling** off, and copy the connection string. It ends in `?sslmode=require`.
2. In [Render](https://render.com), choose **New > Blueprint**, select this
   repository, and fill in the values `render.yaml` asks for: `DATABASE_URL` (the
   Neon string), `CLIENT_URL`, `INITIAL_ADMIN_PHONE`, `INITIAL_ADMIN_PASSWORD`, and
   `SOROBAN_ADMIN_SECRET` if collections should be recorded on-chain. Render
   generates `JWT_SECRET` and `WALLET_ENCRYPTION_KEY`.
3. Watch the deploy logs for the migrations being applied and the server starting,
   then check `https://<service>.onrender.com/health`. It should report
   `"database":"connected"`.
4. Optional: point a free uptime monitor (for example UptimeRobot) at
   `https://<service>.onrender.com/ping` every 5 to 10 minutes, so visitors never
   wait for the service to wake up.

### Railway

`railway.toml` tells Railway to build the `Dockerfile` and wait for `/health` before
routing traffic. Railway has no lasting free tier.

1. In [Railway](https://railway.com), create a project with **New > GitHub Repo** and
   choose this repository. Railway needs the Railway GitHub app installed on the
   organization, which an organization owner must approve.
2. In the same project, **New > Database > Add PostgreSQL**.
3. Open the API service's **Variables** tab and add:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (a reference to the database
     service; check that the service is actually named `Postgres`)
   - `JWT_SECRET`, `WALLET_ENCRYPTION_KEY`, `NODE_ENV=production` and
     `REDIS_ENABLED=false` from the table above
4. Under **Settings > Networking**, choose **Generate Domain**.
5. Watch the deploy logs for the migrations being applied and the server starting,
   then check `https://<your-domain>/health`. It should report
   `"database":"connected"`.

### Create the admin account

Registration cannot create an administrator, so a fresh deployment starts with none.
On a hosted deployment, where the database is private and there is no shell, create the
first one from the environment. Set both variables on the API service and redeploy:

| Variable | Value |
| --- | --- |
| `INITIAL_ADMIN_PHONE` | the admin's phone number in international format, for example `+254700000000` |
| `INITIAL_ADMIN_PASSWORD` | a password that meets the password policy (8+ characters with upper and lower case, a number and a symbol) |

On startup, if no administrator exists, the server creates one with that phone and
password, already active. It does nothing if an admin exists, so leaving the variables
set is harmless, but remove `INITIAL_ADMIN_PASSWORD` once you have logged in. A weak
password or malformed number is logged as a warning and the server still starts. The
password is hashed and never logged.

### Demo data

A public demo needs something to try. With `SEED_DEMO_DATA=true` and
`DEMO_ACCOUNT_PASSWORD` set (it must meet the password policy), the server creates
at startup:

- three collection points (two in Nairobi, one in Mombasa)
- a demo collector, `+254700000101`, and a demo collection point operator,
  `+254700000102`, both signing in with `DEMO_ACCOUNT_PASSWORD`
- four pending collections from the demo collector at the operator's assigned point

With `DEMO_AUTO_ACTIVATE=true`, people who register on the demo are active
immediately and can submit collections straight away. Without it, new accounts stay
`PENDING` until an administrator activates them, which is what a real deployment
needs; the setting is ignored when `STELLAR_NETWORK=mainnet`.

Nothing is created already verified. Signing in as the operator and approving a
collection runs the real flow, including the on-chain record and the WASTE payout,
so every verified collection on the demo has a transaction to show for it. The
seeding only creates what is missing, so it is safe to leave on.

For local development, `npm run prisma:seed` creates an admin account plus two sample
collection points. Leave `SEED_ADMIN_PASSWORD` unset and it generates a password and
prints it once.

## How accounts work today

Registration always creates a `COLLECTOR`: any `role` in the request is ignored, and
there is not yet an endpoint to promote an account, so other roles come from the seed
or the initial-admin setup above.

A new account is `PENDING`, and login requires an `ACTIVE` one with a password. OTP and
phone verification are **not implemented**: `verifyUser` exists but nothing calls it,
and the `otp` login field is rejected. Until that is built, an admin activates new
accounts with `PUT /api/v1/users/:userId/status` and `{"status": "ACTIVE"}`.

## Operations

- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — deploying the API
- [docs/CICD.md](docs/CICD.md) — the GitHub Actions pipelines
- [docs/MONITORING.md](docs/MONITORING.md) and [docs/PERFORMANCE_MONITORING.md](docs/PERFORMANCE_MONITORING.md) — Prometheus and Grafana
- [docs/BACKUP_RECOVERY.md](docs/BACKUP_RECOVERY.md) — backup and restore
- [docs/RATE_LIMITING.md](docs/RATE_LIMITING.md) — rate-limit tiers
- [docs/REDIS_CACHING.md](docs/REDIS_CACHING.md) — what is cached and for how long

## Documentation

- [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md) — full endpoint reference
- [docs/API_QUICK_REFERENCE.md](docs/API_QUICK_REFERENCE.md) — one-page summary
- [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md) — token flow and roles
- [docs/API_VERSIONING.md](docs/API_VERSIONING.md) — versioning policy
- [docs/STELLAR_INTEGRATION.md](docs/STELLAR_INTEGRATION.md) — on-chain payouts
- [docs/RECYCLEGRAPH_INTEGRATION.md](docs/RECYCLEGRAPH_INTEGRATION.md) — material standards
- [docs/WEBSOCKET.md](docs/WEBSOCKET.md) — live update channels
- [docs/SECURITY_ARCHITECTURE.md](docs/SECURITY_ARCHITECTURE.md) — authentication, data protection and hardening
- [docs/TESTING.md](docs/TESTING.md) — test layout and conventions

## Related repositories

- [wastefi-contracts](https://github.com/WASTEFI-AFRICA/wastefi-contracts) — Soroban smart contracts
- [wastefi-frontend](https://github.com/WASTEFI-AFRICA/wastefi-frontend) — collector and operator progressive web app
- [wastefi-docs](https://github.com/WASTEFI-AFRICA/wastefi-docs) — platform documentation site

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Pull requests need `npm run lint` and
`npm test` to pass.

## Security

To report a vulnerability, see [SECURITY.md](SECURITY.md). Please do not open a
public issue for one.

## License

MIT. See [LICENSE](LICENSE).
