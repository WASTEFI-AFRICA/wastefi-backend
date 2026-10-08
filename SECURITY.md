# Security Policy

## Reporting a vulnerability

Please do not open a public issue or pull request for a security vulnerability.

Report it privately through
[GitHub's private vulnerability reporting](https://github.com/WASTEFI-AFRICA/wastefi-backend/security/advisories/new),
or by email to **security@wastefi.org**.

Include, as far as you can:

- what the issue is and which component it affects
- the steps or request sequence needed to reproduce it
- what an attacker gains, and any preconditions they need
- the commit, tag, or deployed address you tested against

We aim to acknowledge a report within three working days and to tell you our
assessment and intended fix timeline within ten. If you do not hear back in that
window, please follow up — a missed report is a failure on our side, not a
closed case.

## Disclosure

Please give us a reasonable window to ship a fix before publishing. We will keep
you informed as we work, credit you in the advisory unless you would rather stay
anonymous, and tell you when the fix is released so you can publish. If a report
turns out to be a duplicate or not a vulnerability, we will explain why rather
than simply closing it.

## Scope

In scope: this repository's own code and configuration, and any instance of it
that WasteFi operates.

Out of scope: vulnerabilities in third-party dependencies with no WasteFi-side
exposure (report those upstream, and tell us if we need to pin or patch),
findings that require a compromised device or a malicious administrator,
volumetric denial of service, and reports from automated scanners with no
demonstrated impact.

## Supported versions

This project is pre-1.0 and under active development. Only the current `main`
branch receives security fixes; there are no maintained release branches and no
backports.
