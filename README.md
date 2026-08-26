# Skill Sunset

[English](README.md) | [简体中文](README.zh-CN.md)

> Your AI evolved. Did your rules?

Skill Sunset performs read-only analysis of generic `AGENTS.md`, `CLAUDE.md`, and `SKILL.md` files. It finds deterministic drift, duplicate bundles, excessive always-loaded context, and model-era compensation rules that should be evaluated before they keep consuming context.

It does **not** automatically retire domain knowledge, safety rules, authorization gates, or project invariants.

The audit engine is a deterministic, dependency-free Node.js program. It does not call an AI API, use the installer's model quota, or read model-provider credentials. `--codex` and `--claude` select local configuration directories only. A `TEST` verdict is an obsolescence hypothesis, not proof that a newer model made the instruction unnecessary.

## Downloaded it? Run it — no install

Requirement: Node.js 20 or newer.

Open a terminal in the downloaded project folder and choose one command:

```bash
npm run scan:codex
npm run scan:claude
```

These commands do not install Skill Sunset globally. They scan the matching local configuration and open the visual report automatically.

The equivalent direct commands are:

```bash
node ./bin/skill-sunset.js audit --codex --open
node ./bin/skill-sunset.js audit --claude --open
```

The scan is read-only. Reports are saved under `.skill-sunset` inside the selected configuration directory, and the terminal prints the exact path.

## Language

The CLI defaults to `--lang auto`. You can choose explicitly:

```bash
node ./bin/skill-sunset.js audit --codex --lang en --open
node ./bin/skill-sunset.js audit --codex --lang zh-CN --open
```

Every report bundle includes portable English and Simplified Chinese HTML pages with an in-report language switch. The selected language also controls `audit.json`, Markdown, Agent prompts, and the evaluation plan.

## After npm publication

Run the latest published version without a permanent global installation:

```bash
npx skill-sunset@latest audit --codex --open
npx skill-sunset@latest audit --claude --open
```

These commands are the planned public entrypoint and are not claimed as available before the package is actually published. Global installation is optional, not part of the first-run path.

## Report bundle

```text
.skill-sunset/
├── index.html
├── index.en.html
├── index.zh-CN.html
├── audit-report.md
├── audit.json
├── execution-prompt-codex.md
├── execution-prompt-claude.md
├── eval-plan.md
├── experiment-template.json
└── rollback-manifest.json
```

Report contents redact targets below the user's home directory as `$HOME/...`; other absolute targets are represented as `$ABSOLUTE/<name>`. The terminal still prints the real local report location so you can open it.

## Behavioral experiments

Fill the generated `experiment-template.json`, then validate it without executing commands:

```bash
node ./bin/skill-sunset.js test .skill-sunset/experiment-template.json --root /path/to/setup
```

Execution requires the separate `--run` flag. Commands run without a shell and receive only a small allowlist of non-secret environment variables by default. Full environment inheritance—including possible provider credentials—requires the additional explicit `--inherit-env` flag and should be used only with trusted commands.

The dry run and result files retain command hashes, executable names, argument counts, output sizes, and output hashes instead of command arguments or output bodies. Do not place credentials in an experiment manifest.

## Verdicts

- `MERGE`: exact duplicates or conflicting same-name Skills.
- `UPDATE`: stale paths, references, tools, or version-coupled instructions.
- `DEMOTE`: useful always-loaded detail that belongs in progressive disclosure.
- `RETIRE`: requires a byte-identical complete Skill bundle, the same generic Skill name, and both copies discovered inside the same scan root; it only recommends recoverable archival.
- `TEST`: an obsolescence hypothesis that requires old-versus-new behavioral evaluation before any cleanup edit.

No finding authorizes deletion. Execution prompts wrap findings as untrusted JSON and require inspection, recoverable backups, validation, and separate approval for push, publish, or deploy.

## Development and CI

```bash
npm test
node ./bin/skill-sunset.js audit /path/to/setup --open
node ./bin/skill-sunset.js audit /path/to/setup --format json --fail-on high
```

GitHub Actions runs the test matrix and Gitleaks secret scanning. Gitleaks is a publication guard, not a guarantee that every possible credential format can be recognized.

This is an MVP. Static checks, bounded file handling, conservative duplicate retirement, localized reports, a gated command experiment harness, CI severity exits, and adversarial prompt-output tests are implemented. Current-provider capability snapshots, session-usage adapters, and task-quality adapters are the next evidence layers.
