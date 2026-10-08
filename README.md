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

## Known breakage

`npm run build` and `npm run type-check` currently fail on two pre-existing
issues on `main`:

- `src/services/waste-collection.service.ts` imports `CacheUtil` from
  `src/utils/cache.util.ts`, which does not export it. The two call sites use
  `CacheUtil.get` and `CacheUtil.set`; the module offers `cacheAside` and
  per-entity cache helpers instead.
- `src/middleware/file-upload.middleware.ts` has unused parameters that trip
  `noUnusedParameters`.

Neither is caused by the other, and both need a decision about intended
behaviour rather than a mechanical fix, so they are left as-is and recorded
here.

## Testing

```sh
npm test                 # all suites
npm run test:unit        # unit tests only
npm run test:integration # integration tests (needs a reachable test database)
npm run test:coverage    # with a coverage report
```

Integration tests read `.env.test`, which is not tracked. Copy
[`.env.test.example`](.env.test.example) to `.env.test` and point
`DATABASE_URL` at a database you are willing to have reset.

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
`npm test` to pass, and should not add new type errors beyond the two recorded
under [known breakage](#known-breakage).

## Security

To report a vulnerability, see [SECURITY.md](SECURITY.md). Please do not open a
public issue for one.

## License

MIT. See [LICENSE](LICENSE).
