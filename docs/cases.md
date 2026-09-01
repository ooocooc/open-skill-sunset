# Four real, redacted, reproducible cases

These cases came from read-only scans of two Skill directories currently used by the maintainer on 2026-09-01. Source paths, Skill names, and instruction text are omitted; counts and verdicts are retained in the [machine-readable snapshot](cases/2026-09-01-owner-scan.json).

This is evidence from one maintainer environment, not a claim that every user has these problems or that changing a rule will improve task quality.

## 1. Windows-only paths found while scanning on macOS

One installed Skill contained five Windows absolute paths when scanned on macOS. Skill Sunset returned `UPDATE / stale-absolute-path`. The current host cannot use those instructions directly, but that does not prove the Skill is wrong: it may intentionally support Windows only. Verify the intended platform first, then add an operating-system condition or use a portable path when appropriate.

```bash
node ./bin/skill-sunset.js audit ./examples/cases/platform-specific-paths --out /tmp/skill-sunset-platform --lang en
```

## 2. A 2,517-line always-loaded entry file

One Agent instruction file had 2,517 lines and an estimated 17,984 tokens. Skill Sunset returned `DEMOTE / progressive-disclosure`. Keep activation conditions, safety boundaries, and acceptance criteria in the entry file; move low-frequency examples into reachable references and verify that the Agent can still find them. The public fixture triggers the same rule with 414 lines.

```bash
node ./bin/skill-sunset.js audit ./test/fixtures/sample-setup/.agents/skills/large-skill --out /tmp/skill-sunset-large --lang en
```

## 3. A tool required for every task

The two scans found four rules binding tool use to every task. Skill Sunset returned `TEST / unconditional-tooling`, not a deletion recommendation. Compare representative tasks under the current rule and a conditional version; preserve the current rule if task quality regresses or the result is inconclusive.

```bash
node ./bin/skill-sunset.js audit ./examples/cases/always-use-tool --out /tmp/skill-sunset-tool --lang en
```

## 4. A model-name alert that manual review kept

One instruction named a concrete model family, so Skill Sunset returned `UPDATE / model-version-coupling`. Manual review found that the wording described a current, task-specific migration and remained intentional, so it was kept unchanged. This case demonstrates that a finding is a review prompt, not proof of a defect or permission to rewrite the file.

```bash
node ./bin/skill-sunset.js audit ./examples/cases/model-pinned --out /tmp/skill-sunset-model --lang en
```

## At a glance

| Original problem | Verdict | Safe next step |
| --- | --- | --- |
| Windows paths unavailable on the current Mac | `UPDATE` | Verify intended platform before editing |
| Oversized entry file | `DEMOTE` | Split low-frequency detail and test discovery |
| Tool required for every task | `TEST` | Run a controlled comparison before editing |
| Concrete model name | `UPDATE` | Review it; this observed item was current and kept |

These examples show how the audit narrows the next decision. It does not authorize deletion.
