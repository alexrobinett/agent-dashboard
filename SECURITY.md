# Security Policy

## Reporting a Vulnerability

Please report security vulnerabilities by opening a GitHub issue or contacting the maintainers directly.

---

## Accepted Vulnerabilities

The following vulnerabilities have been reviewed and accepted as low/no realistic risk for this codebase.

### ajv ReDoS (dev-only)

- **Package:** ajv <8.18.0 (transitive via eslint)
- **Severity:** Low (dev-only)
- **Reason accepted:** Requires attacker-controlled JSON Schemas in ESLint config validation — no realistic attack surface. Upgrading to ajv v8 breaks ESLint 10's internal require path (`ajv/lib/refs/json-schema-draft-04.json` only exists in ajv v6). Accept until ESLint ships native ajv v8 support.
- **Accepted:** 2026-02-18
