# Contributing to WasteFi Backend

Thanks for your interest in contributing.

## Getting set up

Requires Node.js 18 or later and PostgreSQL 14 or later.

```sh
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

See [docs/DATABASE_SETUP.md](docs/DATABASE_SETUP.md) if you need a database.

## Checks a pull request must pass

```sh
npm run lint
npm test
npm run build
```

`npm run build` currently fails on two pre-existing type errors that are
unrelated to most changes; see the known breakage section of the
[README](README.md#known-breakage). Check that your change does not add a third.

Integration tests need `.env.test`; copy
[`.env.test.example`](.env.test.example) and point `DATABASE_URL` at a scratch
database. Never commit a file holding real credentials — only `.env.*.example`
templates belong in git.

## Conventions

- TypeScript throughout; no new JavaScript sources.
- Route handlers stay thin. Business logic belongs in `src/services/`, database
  access behind Prisma in the service layer.
- Validate request input with `express-validator` in the route, not in the
  service.
- Database schema changes go through a Prisma migration
  (`npm run prisma:migrate`); do not hand-edit generated SQL.
- Run `npm run format` before committing.

## Reporting bugs

Open an issue with what you expected, what happened, and the smallest set of
steps that reproduces it. Include versions and, where relevant, logs or a
failing test. Search existing issues first.

Do not report security vulnerabilities as issues — see [SECURITY.md](SECURITY.md).

## Pull requests

1. Fork the repository and branch from `main`.
2. Make your change, with tests for anything that changes behaviour.
3. Run the checks listed above and make sure they pass.
4. Open a pull request describing what changed and why. Link the issue it
   closes, if there is one.

Keep a pull request to one logical change. A branch that reformats half the tree
alongside a bug fix is hard to review and harder to revert.

## Commit messages

Write messages in the imperative mood, explaining why rather than restating the
diff:

```
Reject payouts for unverified collections

process_payment accepted any transaction id, so a payout could be
recorded against a collection that was never verified. Check the
verified flag before writing the payment record.
```

[Conventional Commits](https://www.conventionalcommits.org/) prefixes
(`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`) are welcome but not
required.

## Code of conduct

Be straightforward and civil. We follow the
[Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/);
report unacceptable behaviour to conduct@wastefi.org.
