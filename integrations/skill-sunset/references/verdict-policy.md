# Verdict policy

## Deterministic verdicts

- `MERGE`: exact-content duplicates or same-name generic Skills with overlapping purpose.
- `UPDATE`: confirmed missing paths, broken local references, unavailable tools, or currently deprecated provider identifiers.
- `DEMOTE`: useful material whose unconditional loading cost is avoidable through references or explicit triggers.

## Evidence-limited verdicts

- `RETIRE`: require multiple deterministic signals. The current CLI only emits it when the complete Skill bundle is byte-identical, the generic Skill name matches, and both copies were discovered in the same scan root; future native-replacement retirement also requires usage or behavioral evidence.
- `TEST`: use when the instruction may be compensating for an older model weakness but current behavior has not been measured.
- `KEEP`: stable project facts, safety and authorization rules, domain source routing, deterministic scripts, and rules whose representative evaluations show continuing value.

Never infer that an instruction is obsolete only because it is long, old, rarely used, or references a previous model. Combine evidence and state the largest plausible false-positive explanation.
