# Reproducible cases

Run these examples from a clone of this repository. Each command writes only to a temporary report directory chosen by you.

```bash
node ./bin/skill-sunset.js audit ./examples/cases/platform-specific-paths --out /tmp/skill-sunset-platform --lang en
node ./bin/skill-sunset.js audit ./test/fixtures/sample-setup/.agents/skills/large-skill --out /tmp/skill-sunset-large --lang en
node ./bin/skill-sunset.js audit ./examples/cases/always-use-tool --out /tmp/skill-sunset-tool --lang en
node ./bin/skill-sunset.js audit ./examples/cases/model-pinned --out /tmp/skill-sunset-model --lang en
```

Expected rule IDs, in the same order:

1. `stale-absolute-path` — five Windows-only absolute paths scanned on macOS; verify whether the Skill is intentionally platform-specific before editing;
2. `progressive-disclosure` — an entry file large enough to merit splitting low-frequency detail into references;
3. `unconditional-tooling` — a tool bound to every task, which remains a `TEST` hypothesis;
4. `model-version-coupling` — a concrete model name that warrants review; the real flagged rule was kept after manual review found it current and intentional.

See [the English walkthrough](../../docs/cases.md) or [简体中文说明](../../docs/cases.zh-CN.md).
