# WasteFi — Backend

REST API for WasteFi, a platform that pays waste collectors in emerging markets
for verified recyclable material drop-offs. Handles accounts and authentication,
collection records, material pricing, payouts over mobile money and Stellar, and
the digital material passports that make a collection auditable.

For the on-chain side, see
[wastefi-contracts](https://github.com/WASTEFI-AFRICA/wastefi-contracts).

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

`/metrics` is mounted at the root, outside the version prefix, and serves
Prometheus metrics.

Swagger UI is served at `/api/docs` and the OpenAPI JSON at `/api/docs.json`.
Both are mounted unconditionally, so they are reachable in production as well as
in development; gate them at the reverse proxy if that is not what you want. See
[docs/SWAGGER_GUIDE.md](docs/SWAGGER_GUIDE.md).

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

Measured coverage is 22.9% of statements, 12.4% of branches. The CI threshold sits
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
boot on any host. Two platforms are configured; both need a PostgreSQL database and
these variables:

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | the PostgreSQL connection string |
| `JWT_SECRET` | a unique random value. In production the server refuses to start without one. Generate with `openssl rand -hex 32` |
| `REDIS_ENABLED` | `false` (Redis is optional) |
| `CLIENT_URL` | the frontend's origin, to restrict CORS in production. Optional until the frontend exists |

`PORT` is provided by the platform. Everything else (Twilio, SMTP, mobile money,
Stellar) is optional and the API starts without it.

### Railway

`railway.toml` tells Railway to build the `Dockerfile` and wait for `/health` before
routing traffic.

1. In [Railway](https://railway.com), create a project with **New > GitHub Repo** and
   choose this repository. Railway needs the Railway GitHub app installed on the
   organization, which an organization owner must approve.
2. In the same project, **New > Database > Add PostgreSQL**.
3. Open the API service's **Variables** tab and add:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (a reference to the database
     service; check that the service is actually named `Postgres`)
   - `JWT_SECRET`, `NODE_ENV=production` and `REDIS_ENABLED=false` from the table above
4. Under **Settings > Networking**, choose **Generate Domain**.
5. Watch the deploy logs for the three migrations being applied and the server
   starting, then check `https://<your-domain>/health`. It should report
   `"database":"connected"`.

### Render

`render.yaml` is a blueprint for a Docker web service plus a managed database. Choose
**New > Blueprint** in [Render](https://render.com), select this repository, and
supply `CLIENT_URL` when asked. `JWT_SECRET` is generated for you. On the free plan
the service sleeps when idle and the database is deleted after 30 days.

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

For local development, `npm run prisma:seed` creates the same admin plus two sample
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
