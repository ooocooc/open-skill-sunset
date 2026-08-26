# Security Policy

## Supported versions

| Version | Supported |
| --- | --- |
| 0.2.x | Yes |
| Earlier versions | No |

## Reporting a vulnerability

Do not post exploit details, credentials, private configuration, or unredacted paths in a public issue.

If the repository's **Security** tab offers **Report a vulnerability**, use that private channel. If private reporting is unavailable, open a minimal issue titled `Security contact request` without technical details or secrets so a maintainer can arrange a private handoff.

Before reporting:

1. Revoke or rotate any credential that may have been exposed.
2. Reduce the report to a sanitized reproduction.
3. Include the affected version, platform, expected boundary, observed behavior, and impact.

Relevant reports include secret disclosure, audit-boundary escape, unsafe symlink handling, command-runner environment leakage, and a way to turn report content into unintended command execution.

Maintainers will acknowledge reports on a best-effort basis. Please allow time for validation and a coordinated fix before public disclosure.

## Security design

- Core audits are deterministic, read-only, and do not call an AI service.
- Experiment commands are opt-in and receive a minimal environment by default.
- User-facing paths are redacted, but users should still inspect reports before sharing them.
- A `TEST` finding is a hypothesis and does not authorize automatic deletion or configuration changes.
