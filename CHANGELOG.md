# Changelog

All notable changes to Skill Sunset are documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-08-26

### Added

- Dependency-free CLI audits for Codex, Claude Code, and bounded custom directories.
- Deterministic findings with `KEEP`, `MERGE`, `UPDATE`, `DEMOTE`, `RETIRE`, and `TEST` verdicts.
- Portable bilingual HTML, Markdown, JSON, evaluation-plan, and Agent handoff reports.
- A bounded experiment runner whose child processes receive a minimal environment unless `--inherit-env` is explicitly selected.
- Absolute-path redaction in user-facing output, including `$HOME/...` handling.
- GitHub Actions coverage for Node.js 20, 22, and 24 on Ubuntu, macOS, and Windows.
- Gitleaks secret scanning in CI.
- A real fixture-generated animated report walkthrough, contributor guidance, security policy, issue forms, and a pull request template.

### Security

- Core audits remain read-only and do not call an AI service.
- Findings marked `TEST` remain hypotheses until independently validated.

[Unreleased]: https://github.com/ooocooc/open-skill-sunset/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/ooocooc/open-skill-sunset/releases/tag/v0.2.0
