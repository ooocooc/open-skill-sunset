# Contributing to Skill Sunset

Thanks for helping keep Agent configurations useful, current, and safe.

## Before you start

- Use Node.js 20 or newer.
- Search existing issues before opening a new one.
- For security-sensitive reports, follow [SECURITY.md](SECURITY.md) instead of filing technical details in a public issue.
- Remove credentials, private paths, and proprietary prompt content from every fixture, screenshot, log, and issue.

## Local setup

Skill Sunset has no runtime or development dependencies.

```bash
git clone https://github.com/ooocooc/open-skill-sunset.git
cd open-skill-sunset
npm test
```

Run the deterministic sample audit:

```bash
node ./bin/skill-sunset.js audit ./test/fixtures/sample-setup --out ./demo-report --open
```

Check the package contents before proposing a release:

```bash
npm pack --dry-run
```

## Change guidelines

- Keep core analysis deterministic and read-only. Do not add a hidden network or AI dependency.
- Treat `TEST` as a hypothesis, not a proven stale instruction.
- Keep all filesystem traversal inside the selected audit boundary.
- Preserve output redaction. Never add live credentials or absolute private paths to fixtures.
- Add or update tests when changing rules, CLI behavior, security boundaries, or report structure.
- Update both `README.md` and `README.zh-CN.md` when user-facing behavior changes.
- Keep the integration Skill concise and run its validator when changing `integrations/skill-sunset/`.

## Pull requests

A focused pull request should explain the observed problem, the proposed behavior, how it was verified, and any remaining uncertainty. Run `npm test` before submitting. Maintainers may ask for a minimal sanitized fixture when a rule change depends on a real configuration pattern.

By contributing, you agree that your contribution is licensed under the repository's MIT License.
