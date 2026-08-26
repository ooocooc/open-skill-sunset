# Experiment format

Use the generated `experiment-template.json` for one `TEST` candidate at a time.

Validate without executing anything:

```bash
skill-sunset test <experiment.json> --root <bounded-project-root>
```

Inspect both command arrays before adding `--run`. Commands run directly without a shell, and each `cwd` must remain inside `--root`.

The runner uses a minimal environment allowlist by default. Do not put credentials in command arguments or the manifest. Add `--inherit-env` only when a trusted command genuinely needs the caller's complete environment; this can expose provider credentials to that child process.

Result files store exit state, duration, output byte counts, output hashes, executable names, argument counts, and command hashes—not output bodies or argument values.

- `PASS`: the candidate met the encoded gates for this experiment only.
- `REGRESSION`: the baseline passed but the candidate failed an exit, duration, or output gate.
- `INCONCLUSIVE`: the baseline itself did not satisfy the gates.

The harness does not edit instruction files or prove that a Skill is universally obsolete.
