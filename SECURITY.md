# Security Policy

## Reporting a Vulnerability

Please report security vulnerabilities via **[GitHub Security Advisories](https://github.com/alexrobinett/agent-dashboard/security/advisories/new)** (private, preferred) or by contacting the maintainer directly.

> **TODO(j57829ppmv0890pthrs5q82ge981d1cj):** Replace with a dedicated public security contact email once established. Until then, use GitHub's private advisory flow above.

---

## Accepted Vulnerabilities

The following vulnerabilities have been reviewed and accepted as low/no realistic risk for this codebase.

### ajv ReDoS (dev-only)

- **CVE:** CVE-2025-69873 | **GHSA:** [GHSA-2g4f-4pwh-qvx6](https://github.com/advisories/GHSA-2g4f-4pwh-qvx6)
- **Package:** ajv <8.18.0 (transitive via eslint)
- **Severity:** Low (dev-only)
- **Reason accepted:** Requires attacker-controlled JSON Schemas in ESLint config validation — no realistic attack surface. Upgrading to ajv v8 breaks ESLint 10's internal require path (`ajv/lib/refs/json-schema-draft-04.json` only exists in ajv v6). Accept until ESLint ships native ajv v8 support.
- **Scanner:** pnpm audit
- **Accepted:** 2026-02-18
- **Re-review by:** 2026-08-18
